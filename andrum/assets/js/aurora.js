/*
  Andrum's picture, for the page (WebGL 2): the plug-in's own spectrum, drawn by the rules of its
  window (source/ui/SpectrumView.cpp, Andrum 1.8):

    - the music is light, one aurora along the spectrum (blue in the lows, purple in the middle,
      pink in the air), lit along its top, glowing down into its body and settling into the night;
    - where Andrum makes room, between the music as it was and as it is now, the music's own light
      grows stronger and brighter toward the top, the more so the more it takes away;
    - the key is a fine neon line, violet where it's quiet, burning toward white where it's loudest.

  Everything is drawn from what Andrum measured while it ran on the demo loop (assets/data/
  spectrum.js), with the window's own ballistics, so it is what the plug-in showed.

    const a = new AndrumAurora(canvas, window.ANDRUM_SPECTRUM);
    a.resize(widthPx, heightPx, pxPerCss);      // the canvas, in device pixels
    a.layout({ top, bottom, fLo, fHi, unit, veil, limits, fade });   // CSS px from the canvas's top
                                                // (fade: how far up from the canvas's lower edge the light settles)
    a.frame(t, on);                             // t: seconds into the loop; on: 0..1 (Andrum's room)
    a.read(t, on)                               // { deepest } in dB

  The canvas is transparent: whatever lies behind it is the night.
*/
(function () {
  "use strict";

  // ---------------------------------------------------------------- the window's rules
  const TOP_DB = -10, BOTTOM_DB = -94, TILT = 3;          // dB, and dB/oct (display only)
  const BANDS = 60;
  const DESIGN_GRAPH_H = 324;                             // the window's picture, in design units
  const VEIL_MAX = 0.62;
  const bandHz = (b) => 20 * Math.pow(2, b / 6);
  const freqToNorm = (hz) => Math.log2(Math.max(hz, 1) / 20) / 10;
  const smoothstep = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const DEG = Math.PI / 180;

  // ---------------------------------------------------------------- colour (OKLCH, as the window)
  const toGamma = (c) => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
  function oklchToLinear(L, C, h) {
    const A = C * Math.cos(h), B = C * Math.sin(h);
    const l = L + 0.3963377774 * A + 0.2158037573 * B;
    const m = L - 0.1055613458 * A - 0.0638541728 * B;
    const s = L - 0.0894841775 * A - 1.2914855480 * B;
    const l3 = l * l * l, m3 = m * m * m, s3 = s * s * s;
    return [4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
            -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
            -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3];
  }
  const fromOklch = (L, C, h) => oklchToLinear(L, C, h).map(toGamma);
  function maxChroma(L, h) {
    let lo = 0, hi = 0.37;
    for (let i = 0; i < 20; i++) {
      const mid = 0.5 * (lo + hi), c = oklchToLinear(L, mid, h);
      if (Math.min(c[0], c[1], c[2]) >= 0 && Math.max(c[0], c[1], c[2]) <= 1) lo = mid; else hi = mid;
    }
    return lo;
  }
  /** The music's light at a frequency: its edge, the glow in its body, its hottest (sRGB 0..1). */
  function aurora(hz) {
    const u = Math.min(1, Math.max(0, freqToNorm(hz)));
    const h = (262 + 70 * u) * DEG, L = 0.64 + 0.08 * u;
    const C = Math.min(0.21, 0.92 * maxChroma(L, h));
    const le = L + 0.07, edge = fromOklch(le, Math.min(C * 0.9, 0.95 * maxChroma(le, h)), h);
    const lg = L - 0.12, hg = h - 3 * DEG, glow = fromOklch(lg, Math.min(C * 1.2, 0.95 * maxChroma(lg, hg)), hg);
    const hh = h - 22 * (1 - u) * DEG, hottest = fromOklch(0.88, 0.85 * maxChroma(0.88, hh), hh);
    return { edge, glow, hottest };
  }
  const DEEP = fromOklch(0.31, 0.105, 290 * DEG);
  /** The key's neon at a frequency: violet in the lows, warming toward magenta. */
  const keyHue = (hz) => (296 + 18 * smoothstep((freqToNorm(hz) - 0.2) / 0.65)) * DEG;

  // ---------------------------------------------------------------- the measurements
  function decode(data) {
    const bin = atob(data.data), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const rows = data.rows, bands = data.bands, fields = {};
    let p = 0;
    data.fields.forEach((name) => {
      const f = new Float32Array(rows * bands);
      for (let b = 0; b < bands; b++) {
        let v = 0;
        for (let r = 0; r < rows; r++) {
          const byte = bytes[p++];
          if (byte === 0x80) { v = bytes[p] | (bytes[p + 1] << 8); p += 2; }
          else v += byte > 127 ? byte - 256 : byte;
          f[r * bands + b] = v;
        }
      }
      fields[name] = f;
    });
    const off = data.dbOffset, sc = data.dbScale;
    return {
      rows, bands, rate: data.rate, loop: data.loop,
      music: fields.music.map((v) => v / sc - off), key: fields.key.map((v) => v / sc - off),
      cutMid: fields.cutMid.map((v) => v / sc), cutSide: fields.cutSide.map((v) => v / sc),
      keep: fields.keep.map((v) => v / data.keepScale),
    };
  }

  // ---------------------------------------------------------------- the shader
  const VS = `#version 300 es
  void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const FS = `#version 300 es
  precision highp float;
  precision highp sampler2D;
  // per pixel column:
  //  0: the music's top, where the room's light ends, the key, the glow's reach (px)
  //  1: the near layer's strength, the glow's, the haze's, how far the room goes toward its hottest
  //  2: the room's depth (px), the key's search band (lo, hi), the veil
  //  3: the key's core (sRGB) and alpha; 4: its bloom and alpha
  //  5, 6, 7: the aurora's edge, glow and hottest (sRGB)
  uniform sampler2D uCols;
  uniform vec2 uSize;           // pixels
  uniform float uU;             // pixels per design unit (the light)
  uniform float uLU;            // pixels per design unit (the key's line)
  uniform float uBottom;        // the horizon, pixels from the top
  uniform float uTop;           // the graph's top
  uniform int uReach;           // columns to look either side for the key
  uniform vec4 uLimit[2];       // x, line alpha, ring alpha, shown
  uniform float uRingY;
  uniform float uFade;          // pixels over which the light settles into the night above the bottom (0: none)
  out vec4 outColor;

  const vec3 DEEP = vec3(${DEEP.map((v) => v.toFixed(5)).join(", ")});
  const vec3 FROST = vec3(243.0, 245.0, 249.0) / 255.0;
  const vec3 RING_FILL = vec3(5.0, 7.0, 12.0) / 255.0;

  vec4 col(int row, int x) { return texelFetch(uCols, ivec2(x, row), 0); }
  void over(inout vec4 dst, vec4 src) { dst = src + dst * (1.0 - src.a); }
  float cover(float d, float w) { return clamp(min(d + 0.5, 0.5 * w) - max(d - 0.5, -0.5 * w), 0.0, 1.0); }
  float deepAlpha(float d) { return 0.07 + 0.17 * exp(-(d * d) / (44.0 * 44.0)) + 0.09 * exp(-(d * d) / (170.0 * 170.0)); }

  // the music's light at a row under its top: the near layer over the body's glow over the deep,
  // and in the room drawn toward the hottest the closer to the top (premultiplied, as the window)
  vec4 light(float y, float yT, float yB, vec4 a1, vec4 c2, float glowLen, vec3 K, vec3 G, vec3 Hc) {
    float dTop = y - yT, d = max(0.0, y - yB);
    float tn = dTop / (4.5 * uU), tg = d / glowLen;
    float n = a1.x * exp(-tn * tn), gl = a1.y * exp(-tg * tg);
    float da = deepAlpha(d / uU);
    float a = gl + (1.0 - gl) * da;
    vec3 c = gl * G + (1.0 - gl) * DEEP * da;
    a = n + (1.0 - n) * a;
    c = n * K + (1.0 - n) * c;
    if (y < yB && c2.x > 0.01) {
      float u = clamp((yB - y) / c2.x, 0.0, 1.0);
      float s = a1.w * pow(u, 1.25);
      a = a + (1.0 - a) * s;
      c += (Hc - c) * s;
    }
    return vec4(c, a);
  }

  // the distance to the key through the column samples near x
  float keyDist(vec2 p, int x) {
    int W = int(uSize.x);
    int x0 = max(x - uReach, 0), x1 = min(x + uReach, W - 1);
    vec2 a = vec2(float(x0) + 0.5, col(0, x0).z);
    float best = 1e9;
    for (int i = x0 + 1; i <= x1; ++i) {
      vec2 b = vec2(float(i) + 0.5, col(0, i).z);
      vec2 ab = b - a, ap = p - a;
      float h = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
      best = min(best, length(ap - ab * h));
      a = b;
    }
    return best;
  }
  // glowStroke: layers that trace a Gaussian, each 'strength / layers' strong
  float glow(float d, float core, float radius, float strength, float layers, float k) {
    float sigma = radius / sqrt(-2.0 * log(0.5 / layers));
    float e = max(d - 0.5 * core, 0.0);
    float n = layers * exp(-e * e / (2.0 * sigma * sigma));
    return 1.0 - pow(max(1.0 - k * strength / layers, 0.0), n);
  }

  void main() {
    vec2 p = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
    int x = int(gl_FragCoord.x), W = int(uSize.x);
    vec4 c0 = col(0, x), c1 = col(1, x), c2 = col(2, x);
    vec3 K = col(5, x).rgb, G = col(6, x).rgb, Hc = col(7, x).rgb;
    float yT = c0.x, yB = c0.y, glowLen = c0.w;
    float veil = c2.w * (p.y > uBottom ? 0.0 : smoothstep(0.0, 1.0, (p.y - (uTop - 20.0 * uU)) / (130.0 * uU)));
    vec4 dst = vec4(0.0);

    // the limits' hairlines lie under the music
    for (int i = 0; i < 2; ++i) {
      vec4 L = uLimit[i];
      if (L.w < 0.5) continue;
      float lt = uTop + 10.0 * uU, lb = uRingY - 6.0 * uU;
      if (p.y >= lt && p.y <= lb) {
        float a = L.y * (p.y - lt) / (lb - lt) * cover(abs(p.x - L.x), uLU);
        over(dst, vec4(FROST * a, a));
      }
    }

    // the music
    if (p.y < uBottom + 0.5) {
      float haze = 0.0;
      float slope = 0.5 * (col(0, min(x + 1, W - 1)).x - col(0, max(x - 1, 0)).x);
      float invN = inversesqrt(1.0 + slope * slope);
      float y = p.y + 0.0;
      if (y < yT + 2.0) {
        float e = c1.z * exp(-(yT - y) / (4.0 * uU));
        haze = (yT - y) < 17.0 * uU ? e : 0.0;
      }
      float cov = clamp((y - yT) * invN + 0.5, 0.0, 1.0);
      vec4 m = vec4(0.0);
      if (cov > 0.0) m = light(max(y, yT), yT, yB, c1, c2, glowLen, K, G, Hc) * cov;
      m += vec4(K * haze, haze) * (1.0 - cov);
      // it fades into the horizon, as the window's floor
      m *= clamp((uBottom - y) / (3.0 * uU) + 0.5, 0.0, 1.0);
      over(dst, m * (1.0 - veil));
    }

    // the key: a fine neon line with a bloom of its own colour
    if (p.y >= c2.y && p.y <= c2.z) {
      vec4 core = col(3, x), bloom = col(4, x);
      float d = keyDist(p, x);
      float g = glow(d, 1.4 * uLU, 4.5 * uLU, 0.34, 4.0, bloom.a);
      over(dst, vec4(bloom.rgb * g, g));
      float a = core.a * cover(d, 1.4 * uLU);
      over(dst, vec4(core.rgb * a, a));
    }

    // the limits' rings, on top
    for (int i = 0; i < 2; ++i) {
      vec4 L = uLimit[i];
      if (L.w < 0.5) continue;
      float r = length(p - vec2(L.x, uRingY));
      float f = clamp(5.0 * uLU - r + 0.5, 0.0, 1.0);
      over(dst, vec4(RING_FILL * f, f));
      float s = L.z * cover(abs(r - 5.0 * uLU), 1.4 * uLU);
      over(dst, vec4(FROST * s, s));
    }

    // on a page, the picture settles into the night toward its lower edge
    if (uFade > 0.0) dst *= smoothstep(0.0, 1.0, (uSize.y - p.y) / uFade);

    // rounded to 8 bits through a fine dither, so the slow glows never band
    float nz = fract(52.9829189 * fract(0.06711056 * gl_FragCoord.x + 0.00583715 * gl_FragCoord.y));
    dst.rgb = clamp(dst.rgb + (nz - 0.5) / 255.0, 0.0, 1.0);
    dst.rgb = min(dst.rgb, vec3(dst.a));
    outColor = dst;
  }`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  const ROWS = 8;

  class AndrumAurora {
    constructor(canvas, data, opts) {
      opts = opts || {};
      const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false,
                                               stencil: false, preserveDrawingBuffer: !!opts.preserve });
      if (!gl) throw new Error("no WebGL 2");
      this.gl = gl;
      this.canvas = canvas;
      this.d = decode(data);
      this.limits = data.limits;
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      this.prog = prog;
      this.loc = {};
      ["uCols", "uSize", "uU", "uLU", "uBottom", "uTop", "uReach", "uLimit", "uRingY", "uFade"]
        .forEach((n) => { this.loc[n] = gl.getUniformLocation(prog, n); });
      this.vao = gl.createVertexArray();
      this.cols = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.cols);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const n = BANDS;
      this.v = { music: new Float32Array(n), key: new Float32Array(n), cutMid: new Float32Array(n),
                 cutSide: new Float32Array(n), keep: new Float32Array(n) };
      this.pts = { main: new Float32Array((n + 2) * 2), out: new Float32Array((n + 2) * 2), key: new Float32Array((n + 2) * 2) };
      this.xs = new Float32Array(n); this.ka = new Float32Array(n);
      this.W = 0; this.H = 0; this.px = 1;
      this.lay = { top: 0, bottom: 1, fLo: 20, fHi: 20480, unit: 1, lineUnit: 1, veil: false, limits: false, fade: 0 };
    }

    resize(w, h, px) {
      w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
      if (w === this.W && h === this.H && px === this.px) return;
      this.W = w; this.H = h; this.px = px;
      this.canvas.width = w; this.canvas.height = h;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.cols);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, ROWS, 0, gl.RGBA, gl.FLOAT, null);
      this.buf = new Float32Array(w * 5 * 4);
      this.y = { main: new Float32Array(w), out: new Float32Array(w), key: new Float32Array(w) };
      this.tmp = { a: new Float32Array(w), b: new Float32Array(w), sum: new Float32Array(w + 1), rise: new Float32Array(w),
                   room: new Float32Array(w) };
      this.static();
    }

    layout(o) {
      Object.assign(this.lay, o);
      if (this.W) this.static();
    }

    xForHz(hz) { const L = this.lay; return (Math.log2(hz / L.fLo) / Math.log2(L.fHi / L.fLo)) * (this.W / this.px); }
    hzForX(x) { const L = this.lay; return L.fLo * Math.pow(L.fHi / L.fLo, x / (this.W / this.px)); }
    yFor(db, hz) {           // device px
      const L = this.lay, shown = db + TILT * Math.log2(hz / 1000);
      const t = (TOP_DB - shown) / (TOP_DB - BOTTOM_DB);
      return (L.top + Math.min(1.03, Math.max(-0.05, t)) * (L.bottom - L.top)) * this.px;
    }

    /** What doesn't move: the aurora per column, the veil beyond the limits, the limits. */
    static() {
      const W = this.W, px = this.px, L = this.lay, lim = this.limits;
      const rows = new Float32Array(W * 3 * 4);
      // the veil (as the window: a fade per limit, smoothed along log frequency)
      const veil = new Float32Array(W);
      if (L.veil) {
        const fade = (x, s) => {
          if (x <= 0) return 0; if (x >= 1) return 1;
          const k = 1 + 3 * Math.min(1, Math.max(0, s)), a = Math.pow(x, k), b = Math.pow(1 - x, k);
          return a / (a + b);
        };
        const edge = (inside, width, s) => (inside >= 0 ? 1 : (width <= 1e-3 || inside <= -width) ? 0 : fade(1 + inside / width, s));
        for (let c = 0; c < W; c++) {
          const l2 = Math.log2(this.hzForX((c + 0.5) / px));
          veil[c] = 1 - edge(l2 - Math.log2(lim.low), lim.lowFade, lim.lowSoft) * edge(Math.log2(lim.high) - l2, lim.highFade, lim.highSoft);
        }
        const a = Math.exp(-1 / Math.max(1, 0.13 * W / Math.log2(L.fHi / L.fLo)));
        for (let pass = 0; pass < 2; pass++) {
          let y = veil[0];
          for (let c = 0; c < W; c++) { y = a * y + (1 - a) * veil[c]; veil[c] = y; }
          y = veil[W - 1];
          for (let c = W - 1; c >= 0; c--) { y = a * y + (1 - a) * veil[c]; veil[c] = y; }
        }
      }
      this.veil = veil;
      for (let c = 0; c < W; c++) {
        const au = aurora(this.hzForX((c + 0.5) / px));
        rows.set([au.edge[0], au.edge[1], au.edge[2], 1], c * 4);
        rows.set([au.glow[0], au.glow[1], au.glow[2], 1], (W + c) * 4);
        rows.set([au.hottest[0], au.hottest[1], au.hottest[2], 1], (2 * W + c) * 4);
      }
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.cols);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 5, W, 3, gl.RGBA, gl.FLOAT, rows);
      this.keyHues = new Float32Array(W);
      for (let c = 0; c < W; c++) this.keyHues[c] = keyHue(this.hzForX((c + 0.5) / px));
      this.lim = new Float32Array(8);
      [[lim.low, lim.low <= 20.5], [lim.high, lim.high >= 20400]].forEach(([hz, atEnd], i) => {
        const x = Math.min(W - 8 * L.lineUnit * px, Math.max(8 * L.lineUnit * px, this.xForHz(hz) * px));
        this.lim.set([x, atEnd ? 0.08 : 0.30, atEnd ? 0.3 : 0.85, L.limits ? 1 : 0], i * 4);
      });
    }

    sample(t) {
      const d = this.d, n = BANDS, B = d.bands;
      const pos = ((t % d.loop) + d.loop) % d.loop * d.rate;
      const i0 = Math.floor(pos) % d.rows, i1 = (i0 + 1) % d.rows, f = pos - Math.floor(pos);
      const v = this.v;
      for (let b = 0; b < n; b++) {
        const a0 = i0 * B + b, a1 = i1 * B + b;
        v.music[b] = d.music[a0] + (d.music[a1] - d.music[a0]) * f;
        v.key[b] = d.key[a0] + (d.key[a1] - d.key[a0]) * f;
        v.cutMid[b] = d.cutMid[a0] + (d.cutMid[a1] - d.cutMid[a0]) * f;
        v.cutSide[b] = d.cutSide[a0] + (d.cutSide[a1] - d.cutSide[a0]) * f;
        v.keep[b] = d.keep[a0] + (d.keep[a1] - d.keep[a0]) * f;
      }
      return v;
    }

    read(t, on) {
      const v = this.sample(t);
      let peak = 0;
      for (let b = 0; b < BANDS; b++) peak = Math.max(peak, v.cutMid[b], v.cutSide[b]);
      return { deepest: peak * on };
    }

    // a curve through the band points, as the window's smoothPath, at every column's centre
    columns(pts, out) {
      const W = this.W, n = pts.length / 2;
      let i = 0;
      for (let c = 0; c < W; c++) {
        const x = c + 0.5;
        while (i < n - 2 && pts[(i + 1) * 2] <= x) i++;
        const p0 = Math.max(i - 1, 0), p3 = Math.min(i + 2, n - 1);
        const x1 = pts[i * 2], y1 = pts[i * 2 + 1], x2 = pts[(i + 1) * 2], y2 = pts[(i + 1) * 2 + 1];
        const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
        const c1 = Math.min(hi, Math.max(lo, y1 + (y2 - pts[p0 * 2 + 1]) / 6));
        const c2 = Math.min(hi, Math.max(lo, y2 - (pts[p3 * 2 + 1] - y1) / 6));
        const s = Math.min(1, Math.max(0, (x - x1) / Math.max(1e-6, x2 - x1))), r = 1 - s;
        out[c] = r * r * r * y1 + 3 * r * r * s * c1 + 3 * r * s * s * c2 + s * s * s * y2;
      }
    }

    // box blur of a over radius R (columns), into out, `passes` times
    boxes(a, out, R, passes) {
      const W = this.W, sum = this.tmp.sum;
      if (a !== out) out.set(a);
      for (let pass = 0; pass < passes; pass++) {
        sum[0] = 0;
        for (let c = 0; c < W; c++) sum[c + 1] = sum[c] + out[c];
        for (let c = 0; c < W; c++) {
          const lo = Math.max(0, c - R), hi = Math.min(W, c + R + 1);
          out[c] = (sum[hi] - sum[lo]) / (hi - lo);
        }
      }
    }

    frame(t, on) {
      const gl = this.gl, W = this.W, H = this.H, px = this.px, L = this.lay;
      if (!W) return;
      const v = this.sample(t);
      const n = BANDS, U = L.unit * px, LU = L.lineUnit * px;
      const pts = this.pts, xs = this.xs, ka = this.ka;
      const ext = 2 * LU;
      let most = 0;
      for (let b = 0; b < n; b++) {
        const hz = bandHz(b), x = this.xForHz(hz) * px;
        const cut = Math.max(v.cutMid[b], v.cutSide[b]) * on;      // the deeper of the two lanes
        most = Math.max(most, cut);
        xs[b] = x;
        const k = b + 1;
        pts.main[k * 2] = pts.out[k * 2] = pts.key[k * 2] = x;
        pts.main[k * 2 + 1] = this.yFor(v.music[b], hz);
        pts.out[k * 2 + 1] = this.yFor(v.music[b] - cut, hz);
        pts.key[k * 2 + 1] = this.yFor(v.key[b], hz);
        const level = Math.min(1, Math.max(0, (v.key[b] + 82) / 22));
        ka[b] = (0.18 + 0.82 * v.keep[b]) * (0.12 + 0.88 * level * level);
      }
      Object.keys(pts).forEach((name) => {
        const p = pts[name];
        p[0] = xs[0] - ext; p[1] = p[3];
        p[(n + 1) * 2] = xs[n - 1] + ext; p[(n + 1) * 2 + 1] = p[n * 2 + 1];
        this.columns(p, this.y[name]);
      });
      const changing = most > 0.05;
      const Y = this.y, T = this.tmp;
      const yTop = T.a, room = T.room, rise = T.rise;
      for (let c = 0; c < W; c++) yTop[c] = Math.min(Y.main[c], changing ? Y.out[c] : Y.main[c]);

      // where the room's light ends: its depth swept up across a few bands, then softened
      if (changing) {
        const depth = T.b;
        for (let c = 0; c < W; c++) depth[c] = Math.max(0, Math.max(Y.main[c], Y.out[c]) - yTop[c]);
        const R = Math.max(1, Math.round(6 * U));
        for (let c = 0; c < W; c++) {
          let m = 0;
          for (let k = Math.max(0, c - R), e = Math.min(W - 1, c + R); k <= e; k++) m = Math.max(m, depth[k]);
          room[c] = m;
        }
        this.boxes(room, room, Math.max(1, Math.round(8 * U)), 3);
      } else room.fill(0);

      // how far the top stands above its neighbourhood (0..1, 0.5 level), softened
      {
        const R = Math.max(1, Math.round(26 * U)), sum = T.sum;
        sum[0] = 0;
        for (let c = 0; c < W; c++) sum[c + 1] = sum[c] + yTop[c];
        for (let c = 0; c < W; c++) {
          const lo = Math.max(0, c - R), hi = Math.min(W, c + R + 1);
          const level = (sum[hi] - sum[lo]) / (hi - lo);
          rise[c] = Math.min(1, Math.max(0, 0.5 + (level - yTop[c]) / (16 * U)));
        }
        this.boxes(rise, rise, Math.max(1, Math.round(5 * U)), 2);
      }

      const floorY = L.bottom * px;
      const buf = this.buf;
      const reach = Math.ceil(8.5 * LU + 2);
      let bi = 0;
      for (let c = 0; c < W; c++) {
        const x = c + 0.5;
        while (bi < n - 2 && xs[bi + 1] <= x) bi++;
        const f = Math.min(1, Math.max(0, (x - xs[bi]) / (xs[bi + 1] - xs[bi])));
        const yt = yTop[c], depth = room[c], yb = yt + depth;
        const r = rise[c];
        const presence = smoothstep((floorY - yt) / (26 * U));
        const amount = smoothstep(depth / (26 * U));
        const o0 = c * 4, o1 = (W + c) * 4, o2 = (2 * W + c) * 4, o3 = (3 * W + c) * 4, o4 = (4 * W + c) * 4;
        buf[o0] = yt; buf[o0 + 1] = yb; buf[o0 + 2] = Y.key[c]; buf[o0 + 3] = 27 * (0.75 + 0.5 * r) * U;
        buf[o1] = 0.82 * (0.70 + 0.30 * r) * presence;
        buf[o1 + 1] = 0.94 * (0.82 + 0.18 * r) * presence;
        buf[o1 + 2] = (0.11 + 0.07 * r) * (1 + 1.6 * amount) * presence;
        buf[o1 + 3] = amount * presence;
        // the key's band to search, and the veil
        let lo = 1e9, hi = -1e9;
        for (let k = Math.max(0, c - reach); k <= Math.min(W - 1, c + reach); k++) { const yk = Y.key[k]; if (yk < lo) lo = yk; if (yk > hi) hi = yk; }
        buf[o2] = depth; buf[o2 + 1] = lo - reach; buf[o2 + 2] = hi + reach; buf[o2 + 3] = this.veil[c] * VEIL_MAX;
        // the key's light: brighter the higher it runs (the louder it is heard)
        const a = ka[bi] + (ka[bi + 1] - ka[bi]) * f;
        const up = Math.min(1, Math.max(0, (floorY - Y.key[c]) / ((L.bottom - L.top) * px)));
        const heard = smoothstep((up - 0.18) / 0.68);
        const hue = this.keyHues[c];
        const core = fromOklch(0.70 + 0.285 * heard, 0.015 + 0.165 * Math.pow(1 - heard, 1.3), hue);
        const bloom = fromOklch(0.58 + 0.10 * heard, 0.230, hue);
        buf[o3] = core[0]; buf[o3 + 1] = core[1]; buf[o3 + 2] = core[2]; buf[o3 + 3] = a;
        buf[o4] = bloom[0]; buf[o4 + 1] = bloom[1]; buf[o4 + 2] = bloom[2]; buf[o4 + 3] = a * (0.7 + 0.5 * heard);
      }

      gl.bindTexture(gl.TEXTURE_2D, this.cols);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, 5, gl.RGBA, gl.FLOAT, buf);
      gl.viewport(0, 0, W, H);
      gl.disable(gl.BLEND);
      gl.useProgram(this.prog);
      gl.bindVertexArray(this.vao);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.cols); gl.uniform1i(this.loc.uCols, 0);
      gl.uniform2f(this.loc.uSize, W, H);
      gl.uniform1f(this.loc.uU, U);
      gl.uniform1f(this.loc.uLU, LU);
      gl.uniform1f(this.loc.uBottom, L.bottom * px);
      gl.uniform1f(this.loc.uTop, L.top * px);
      gl.uniform1i(this.loc.uReach, reach);
      gl.uniform4fv(this.loc.uLimit, this.lim);
      gl.uniform1f(this.loc.uRingY, (L.bottom - 16 * L.lineUnit) * px);
      gl.uniform1f(this.loc.uFade, (L.fade || 0) * px);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  AndrumAurora.DESIGN_GRAPH_H = DESIGN_GRAPH_H;
  window.AndrumAurora = AndrumAurora;
})();
