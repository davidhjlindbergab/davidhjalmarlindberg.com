/*
  Andrum's picture, for the page (WebGL 2).

  The plug-in's own spectrum, redrawn with the same rules as its window (source/ui/SpectrumView.cpp):
  the music is a body lit along its ridge and falling away into the night, the key is a fine white
  line with a cool bloom, and the room Andrum makes is one deep violet, lit at its top edge. The
  limits rise from two rings on the horizon, with a veil beyond them. Everything is drawn from what
  Andrum measured while it ran on the demo loop (assets/data/spectrum.js), with the window's own
  ballistics, so this is exactly what the plug-in showed.

    const sp = new AndrumSpectrum(canvas, window.ANDRUM_SPECTRUM);
    sp.resize(widthPx, heightPx, pxPerCss);   // the canvas, in device pixels
    sp.layout({ top, bottom, fLo, fHi, unit, lineUnit });   // CSS px from the canvas's top
    sp.frame(t, on, hover);                   // t: seconds into the loop; on: 0..1; hover: { x, a } in CSS px
    sp.read(t, on)                            // { deepest } (dB)
    sp.inspect(t, on, x)                      // what the window's hover bubble says at x (CSS px)
    sp.xForHz(hz)                             // CSS px

  The canvas is transparent: whatever is behind it is the night.
*/
(function () {
  "use strict";

  // ---------------------------------------------------------------- the window's rules
  const TOP_DB = -10, BOTTOM_DB = -94, TILT = 3;         // dB, and dB/oct (display only)
  const VEIL_MAX = 0.62;
  const BANDS = 60;                                       // active at 48 kHz
  const DESIGN_GRAPH_H = 324;                             // the window's picture, in design units
  const GRID = [[50, 0.035], [100, 0.07], [200, 0.035], [500, 0.035], [1000, 0.07], [2000, 0.035], [5000, 0.035], [10000, 0.07]];

  const bandHz = (b) => 20 * Math.pow(2, b / 6);

  // ---------------------------------------------------------------- colour (OKLCH, as Theme.cpp)
  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const toGamma = (c) => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  function toOklch(rgb) {
    const [r, g, b] = rgb.map(toLinear);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return { L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, C: Math.hypot(A, B), h: Math.atan2(B, A) };
  }
  function fromOklch(c) {
    const A = c.C * Math.cos(c.h), B = c.C * Math.sin(c.h);
    const l = c.L + 0.3963377774 * A + 0.2158037573 * B;
    const m = c.L - 0.1055613458 * A - 0.0638541728 * B;
    const s = c.L - 0.0894841775 * A - 1.2914855480 * B;
    const l3 = l * l * l, m3 = m * m * m, s3 = s * s * s;
    return [toGamma(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
            toGamma(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
            toGamma(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3)];
  }
  function lerpLch(a, b, u) {
    let dh = b.h - a.h;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    return { L: a.L + (b.L - a.L) * u, C: a.C + (b.C - a.C) * u, h: a.h + dh * u };
  }
  /** The room's light, top (lit violet) to bottom (indigo), premultiplied: SpectrumView's RoomLight. */
  function roomLight() {
    const n = 512, out = new Float32Array(n * 4);
    const top = toOklch(hex("#5143a0")), bottom = toOklch(hex("#2b2c81"));
    const mid = lerpLch(top, bottom, 0.5);
    mid.C += 0.0075;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), u = Math.pow(t, 1.25);
      const rgb = fromOklch(u < 0.5 ? lerpLch(top, mid, u * 2) : lerpLch(mid, bottom, u * 2 - 1));
      const a = 0.93 - 0.05 * t;
      out[i * 4] = rgb[0] * a; out[i * 4 + 1] = rgb[1] * a; out[i * 4 + 2] = rgb[2] * a; out[i * 4 + 3] = a;
    }
    return out;
  }

  // ---------------------------------------------------------------- the measurements
  function decode(data) {
    const bin = atob(data.data), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const rows = data.rows, bands = data.bands;
    const fields = {};
    let p = 0;
    data.fields.forEach((name) => {
      const f = new Float32Array(rows * bands);       // [row * bands + band]
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
    const music = fields.music.map((v) => v / sc - off);
    const key = fields.key.map((v) => v / sc - off);
    const cutMid = fields.cutMid.map((v) => v / sc);
    const cutSide = fields.cutSide.map((v) => v / sc);
    const keep = fields.keep.map((v) => v / data.keepScale);
    return { rows: rows, bands: bands, rate: data.rate, loop: data.loop, music, key, cutMid, cutSide, keep };
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
  uniform sampler2D uCols;      // per pixel column; rows: 0 curves, 1 alphas, 2-3 reach of the lines, 4 veil
  uniform sampler2D uRoom;      // the room's light, 512 x 1, premultiplied
  uniform vec2 uSize;           // pixels
  uniform float uPx;            // pixels per CSS px
  uniform float uU;             // pixels per design unit (the fog, the room)
  uniform float uLU;            // pixels per design unit, for line widths and glows
  uniform vec2 uGraph;          // the graph's top and its horizon, pixels from the top
  uniform vec4 uGrid[8];        // x, alpha
  uniform vec4 uLimit[2];       // x, line alpha, ring alpha, 1 if shown
  uniform float uRingY;
  uniform vec2 uHover;          // x, alpha
  uniform ivec4 uReach;         // how far (columns) to look for each line: main (rim), out (edge), key, side
  uniform float uDither;        // 1: round to 8 bits through a dither (0 for pictures that get compressed)
  out vec4 outColor;

  const vec3 OUTLINE = vec3(184.0, 182.0, 222.0) / 255.0;
  const vec3 RIM = vec3(168.0, 162.0, 225.0) / 255.0;
  const vec3 KEY_GLOW = vec3(150.0, 190.0, 240.0) / 255.0;
  const vec3 VOICE = vec3(241.0, 245.0, 250.0) / 255.0;
  const vec3 FROST = vec3(243.0, 245.0, 249.0) / 255.0;
  const vec3 VEIL = vec3(3.0, 4.0, 8.0) / 255.0;
  const vec3 RING_FILL = vec3(5.0, 7.0, 12.0) / 255.0;

  vec4 col(int row, int x) { return texelFetch(uCols, ivec2(x, row), 0); }
  void over(inout vec4 dst, vec4 src) { dst = src + dst * (1.0 - src.a); }
  // how much of a pixel at distance d (pixels) a line of width w covers
  float cover(float d, float w) { return clamp(min(d + 0.5, 0.5 * w) - max(d - 0.5, -0.5 * w), 0.0, 1.0); }

  // the distance to curve c (a component of row 0) through the column samples near x, and the length
  // along it to the nearest point (row 1's w holds the side lane's running length)
  vec2 curve(vec2 p, int x, int c, int reach) {
    int W = int(uSize.x);
    int x0 = max(x - reach, 0), x1 = min(x + reach, W - 1);
    vec2 a = vec2(float(x0) + 0.5, col(0, x0)[c]);
    float run = col(1, x0).w;
    float best = 1e9, along = 0.0;
    for (int i = x0 + 1; i <= x1; ++i) {
      vec2 b = vec2(float(i) + 0.5, col(0, i)[c]);
      vec2 ab = b - a, ap = p - a;
      float len2 = max(dot(ab, ab), 1e-6);
      float h = clamp(dot(ap, ab) / len2, 0.0, 1.0);
      float d = length(ap - ab * h);
      float len = sqrt(len2);
      if (d < best) { best = d; along = run + h * len; }
      run += len;
      a = b;
    }
    return vec2(best, along);
  }

  // glowStroke (Theme.cpp): layers that trace a Gaussian, each 'strength / layers' strong
  float glow(float d, float core, float radius, float strength, float layers, float k) {
    float sigma = radius / sqrt(-2.0 * log(0.5 / layers));
    float e = max(d - 0.5 * core, 0.0);
    float n = layers * exp(-e * e / (2.0 * sigma * sigma));
    return 1.0 - pow(max(1.0 - k * strength / layers, 0.0), n);
  }

  void main() {
    vec2 p = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
    int x = int(gl_FragCoord.x);
    vec4 c0 = col(0, x), c1 = col(1, x), c2 = col(2, x), c3 = col(3, x), c4 = col(4, x);
    float top = uGraph.x, bottom = uGraph.y, H = bottom - top;
    vec4 dst = vec4(0.0);

    // ---- the underlay: the grid's hairlines, fading in from the top, and the horizon
    if (p.y >= top && p.y <= bottom) {
      float t = (p.y - top) / H;
      float shape = t < 0.35 ? t / 0.35 : mix(1.0, 0.6, (t - 0.35) / 0.65);
      for (int i = 0; i < 8; ++i) {
        float a = uGrid[i].y * shape * cover(abs(p.x - uGrid[i].x), uPx);
        over(dst, vec4(vec3(a), a));
      }
    }
    {
      float a = 0.10 * max(0.0, 1.0 - abs(p.x / uSize.x - 0.5) * 2.0) * cover(abs(p.y - bottom - 0.5 * uPx), uPx);
      over(dst, vec4(vec3(a), a));
    }

    // ---- the veil beyond the limits: over the night and the grid, fading in from the top
    float vr = p.y > bottom ? 0.0 : smoothstep(0.0, 1.0, (p.y - (top - 20.0 * uU)) / (130.0 * uU));
    float v = c4.x * vr;
    dst = vec4(VEIL * v, v) + dst * (1.0 - v);

    if (p.y < bottom) {
      float mainY = c0.x, outY = c0.y, keyY = c0.z, sideY = c0.w;

      // ---- the music: a body lit along its ridge, falling away into the night
      float edge = clamp(p.y - outY + 0.5, 0.0, 1.0);
      if (edge > 0.0) {
        float d = max(0.0, p.y - outY) / uU;
        float a = 0.20 * exp(-d / 46.0) + 0.05 * exp(-d / 220.0) + 0.012;
        float k = exp(-d / 120.0);
        vec3 light = vec3(76.0 + 90.0 * k, 76.0 + 88.0 * k, 118.0 + 82.0 * k) / 255.0 * a;
        over(dst, vec4(light, a) * (1.0 - v) * edge);
      }

      // ---- the room: between the music as it was and as it is now
      float span = outY - mainY;
      if (span > 0.02) {
        float cov = clamp(p.y - mainY + 0.5, 0.0, 1.0) * clamp(outY - p.y + 0.5, 0.0, 1.0);
        if (cov > 0.0) {
          float t = clamp((p.y - mainY) / max(span, 16.0 * uU), 0.0, 1.0);
          over(dst, texelFetch(uRoom, ivec2(int(t * 511.0 + 0.5), 0), 0) * cov);
        }
      }

      // ---- the music's fine cool edge
      if (p.y >= c2.z - float(uReach.y) && p.y <= c2.w + float(uReach.y)) {
        float a = 0.5 * cover(curve(p, x, 1, uReach.y).x, 1.0 * uLU);
        over(dst, vec4(OUTLINE * a, a));
      }

      // ---- the lit edge the room opens from
      if (c1.y > 0.002 && p.y >= c2.x - float(uReach.x) && p.y <= c2.y + float(uReach.x)) {
        float d = curve(p, x, 0, uReach.x).x;
        float g = glow(d, 0.9 * uLU, 3.0 * uLU, 0.35, 3.0, c1.y);
        over(dst, vec4(RIM * g, g));
        float a = c1.y * cover(d, 0.9 * uLU);
        over(dst, vec4(RIM * a, a));
      }

      // ---- the second lane (the sides), where it parts from the first: a fine dotted line
      if (c1.z > 0.5 && p.y >= c3.z - float(uReach.w) && p.y <= c3.w + float(uReach.w)) {
        vec2 ds = curve(p, x, 3, uReach.w);
        float period = 5.0 * uLU, ph = mod(ds.y, period);
        float dash = clamp(min(ph + 0.5, 1.5 * uLU) - max(ph - 0.5, 0.0), 0.0, 1.0);
        float a = 0.55 * cover(ds.x, 1.0 * uLU) * dash;
        over(dst, vec4(RIM * a, a));
      }

      // ---- the key: a fine white line with a cool bloom; where it is quiet, or left out, it fades
      if (c1.x > 0.002 && p.y >= c3.x - float(uReach.z) && p.y <= c3.y + float(uReach.z)) {
        float d = curve(p, x, 2, uReach.z).x;
        float g = glow(d, 1.25 * uLU, 6.0 * uLU, 0.14, 4.0, c1.x);
        over(dst, vec4(KEY_GLOW * g, g));
        float a = c1.x * cover(d, 1.25 * uLU);
        over(dst, vec4(VOICE * a, a));
      }
    }

    // ---- where Andrum works: two hairlines rising from rings on the horizon
    for (int i = 0; i < 2; ++i) {
      vec4 L = uLimit[i];
      if (L.w < 0.5) continue;
      float lt = top + 10.0 * uU, lb = uRingY - 6.0 * uU;
      if (p.y >= lt && p.y <= lb) {
        float a = L.y * (p.y - lt) / (lb - lt) * cover(abs(p.x - L.x), uPx);
        over(dst, vec4(FROST * a, a));
      }
      float r = length(p - vec2(L.x, uRingY));
      float f = clamp(5.0 * uLU - r + 0.5, 0.0, 1.0);
      over(dst, vec4(RING_FILL * f, f));
      float s = L.z * cover(abs(r - 5.0 * uLU), 1.4 * uLU);
      over(dst, vec4(FROST * s, s));
    }

    // ---- the hover line
    if (uHover.y > 0.0 && p.y >= top && p.y <= bottom) {
      float a = uHover.y * 0.16 * (p.y - top) / H * cover(abs(p.x - uHover.x), uPx);
      over(dst, vec4(FROST * a, a));
    }

    // rounded to 8 bits through a fine dither, so the slow glows never band
    float n = fract(52.9829189 * fract(0.06711056 * gl_FragCoord.x + 0.00583715 * gl_FragCoord.y));
    dst.rgb = clamp(dst.rgb + uDither * (n - 0.5) / 255.0, 0.0, 1.0);
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

  // ---------------------------------------------------------------- the picture
  class AndrumSpectrum {
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
      ["uCols", "uRoom", "uSize", "uPx", "uU", "uLU", "uGraph", "uGrid", "uLimit", "uRingY", "uHover", "uReach", "uDither"]
        .forEach((n) => { this.loc[n] = gl.getUniformLocation(prog, n); });
      this.vao = gl.createVertexArray();

      this.room = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.room);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 512, 1, 0, gl.RGBA, gl.FLOAT, roomLight());
      this.nearest();
      this.cols = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.cols);
      this.nearest();

      // per band, this frame
      const n = BANDS;
      this.pts = { main: new Float32Array((n + 2) * 2), out: new Float32Array((n + 2) * 2),
                   key: new Float32Array((n + 2) * 2), side: new Float32Array((n + 2) * 2) };
      this.xs = new Float32Array(n); this.ka = new Float32Array(n); this.ra = new Float32Array(n); this.apart = new Uint8Array(n);
      this.v = { music: new Float32Array(n), key: new Float32Array(n), cutMid: new Float32Array(n),
                 cutSide: new Float32Array(n), keep: new Float32Array(n) };
      this.W = 0; this.H = 0; this.px = 1;
      this.lay = { top: 0, bottom: 1, fLo: 20, fHi: 20480, unit: 1, lineUnit: 1, showLimits: true };
    }

    nearest() {
      const gl = this.gl;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    /** The canvas, in device pixels, and how many of them make a CSS px. */
    resize(w, h, px) {
      w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
      if (w === this.W && h === this.H && px === this.px) return;
      this.W = w; this.H = h; this.px = px;
      this.canvas.width = w; this.canvas.height = h;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.cols);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, 5, 0, gl.RGBA, gl.FLOAT, null);
      this.buf = new Float32Array(w * 4 * 4);              // rows 0-3, rebuilt every frame
      this.y = { main: new Float32Array(w), out: new Float32Array(w), key: new Float32Array(w), side: new Float32Array(w) };
      this.static();
    }

    /** Where the graph sits (CSS px from the canvas's top), the frequencies at its edges, and its scale:
        unit is CSS px per design unit of the window (the fog and the room), lineUnit the same for lines. */
    layout(o) {
      Object.assign(this.lay, o);
      if (this.W) this.static();
    }

    xForHz(hz) {        // CSS px
      const L = this.lay;
      return (Math.log2(hz / L.fLo) / Math.log2(L.fHi / L.fLo)) * (this.W / this.px);
    }
    hzForX(x) {
      const L = this.lay;
      return L.fLo * Math.pow(L.fHi / L.fLo, x / (this.W / this.px));
    }
    /** SpectrumView::specY, in device pixels. */
    yFor(db, hz) {
      const L = this.lay, px = this.px;
      const shown = db + TILT * Math.log2(hz / 1000);
      const t = (TOP_DB - shown) / (TOP_DB - BOTTOM_DB);
      return (L.top + Math.min(1.03, Math.max(-0.05, t)) * (L.bottom - L.top)) * px;
    }

    /** What doesn't move: the veil beyond the limits, worked out per column as the window does. */
    static() {
      const W = this.W, px = this.px, L = this.lay, lim = this.limits;
      const veil = new Float32Array(W);
      const fade = (x, s) => {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        const k = 1 + 3 * Math.min(1, Math.max(0, s));
        const a = Math.pow(x, k), b = Math.pow(1 - x, k);
        return a / (a + b);
      };
      const edge = (inside, width, s) => (inside >= 0 ? 1 : (width <= 1e-3 || inside <= -width) ? 0 : fade(1 + inside / width, s));
      for (let c = 0; c < W; c++) {
        const hz = this.hzForX((c + 0.5) / px);
        const l2 = Math.log2(hz);
        const w = edge(l2 - Math.log2(lim.low), lim.lowFade, lim.lowSoft) * edge(Math.log2(lim.high) - l2, lim.highFade, lim.highSoft);
        veil[c] = 1 - w;
      }
      // smoothed along log frequency, forward and back, twice (0.13 octave)
      const pxPerOct = (W / Math.log2(L.fHi / L.fLo));
      const a = Math.exp(-1 / Math.max(1, 0.13 * pxPerOct));
      for (let pass = 0; pass < 2; pass++) {
        let y = veil[0];
        for (let c = 0; c < W; c++) { y = a * y + (1 - a) * veil[c]; veil[c] = y; }
        y = veil[W - 1];
        for (let c = W - 1; c >= 0; c--) { y = a * y + (1 - a) * veil[c]; veil[c] = y; }
      }
      const row = new Float32Array(W * 4);
      for (let c = 0; c < W; c++) { const v = veil[c] * VEIL_MAX; row[c * 4] = v < 0.5 / 255 ? 0 : v; }
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.cols);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 4, W, 1, gl.RGBA, gl.FLOAT, row);

      // the grid and the limits
      this.grid = new Float32Array(32);
      GRID.forEach(([hz, al], i) => { this.grid[i * 4] = (Math.round(this.xForHz(hz)) + 0.5) * px; this.grid[i * 4 + 1] = al; });
      this.lim = new Float32Array(8);
      [[lim.low, lim.low <= 20.5], [lim.high, lim.high >= 20400]].forEach(([hz, atEnd], i) => {
        const x = Math.min(W - 8 * L.lineUnit * px, Math.max(8 * L.lineUnit * px, this.xForHz(hz) * px));
        this.lim.set([x, atEnd ? 0.08 : 0.30, atEnd ? 0.3 : 0.85, L.showLimits === false ? 0 : 1], i * 4);
      });
    }

    /** The bands at t (seconds into the loop): linear between the measured rows. */
    sample(t) {
      const d = this.d, n = BANDS, B = d.bands;
      let pos = ((t % d.loop) + d.loop) % d.loop * d.rate;
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

    /** The deepest cut right now (dB), as the window's readout takes it (before its hold). */
    read(t, on) {
      const v = this.sample(t);
      let peak = 0;
      for (let b = 0; b < BANDS; b++) peak = Math.max(peak, v.cutMid[b], v.cutSide[b]);
      return { deepest: peak * on };
    }

    /** What the window's hover bubble says at x (CSS px). */
    inspect(t, on, x) {
      const v = this.sample(t);
      const hz = this.hzForX(x);
      const pos = Math.min(BANDS - 1, Math.max(0, 6 * Math.log2(hz / 20)));
      const b0 = Math.floor(pos), b1 = Math.min(b0 + 1, BANDS - 1), fr = pos - b0;
      const lerp = (a) => a[b0] * (1 - fr) + a[b1] * fr;
      return { hz: hz, key: lerp(v.key), music: lerp(v.music), cut: lerp(v.cutMid) * on, keep: lerp(v.keep) };
    }

    // one curve through the band points, as SpectrumView::smoothPath, sampled at every column's centre
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

    frame(t, on, hover) {
      const gl = this.gl, W = this.W, H = this.H, px = this.px, L = this.lay;
      if (!W) return;
      const v = this.sample(t);
      const n = BANDS, U = L.lineUnit * px;
      const ext = 2 * L.lineUnit * px;
      const pts = this.pts, xs = this.xs, ka = this.ka, ra = this.ra, apart = this.apart;
      for (let b = 0; b < n; b++) {
        const hz = bandHz(b), x = this.xForHz(hz) * px;
        const gm = v.cutMid[b] * on, gs = v.cutSide[b] * on;
        xs[b] = x;
        const k = b + 1;
        pts.main[k * 2] = pts.out[k * 2] = pts.key[k * 2] = pts.side[k * 2] = x;
        pts.main[k * 2 + 1] = this.yFor(v.music[b], hz);
        pts.out[k * 2 + 1] = this.yFor(v.music[b] - gm, hz);
        pts.side[k * 2 + 1] = this.yFor(v.music[b] - gs, hz);
        pts.key[k * 2 + 1] = this.yFor(v.key[b], hz);
        const level = Math.min(1, Math.max(0, (v.key[b] + 82) / 22));
        ka[b] = (0.18 + 0.82 * v.keep[b]) * (0.12 + 0.88 * level * level);
        ra[b] = 0.55 * Math.min(1, Math.max(0, gm / 1.5));
        apart[b] = Math.abs(pts.side[k * 2 + 1] - pts.out[k * 2 + 1]) > 0.6 * px ? 1 : 0;
      }
      Object.keys(pts).forEach((name) => {     // carried 2 px beyond both ends, as the window does
        const p = pts[name];
        p[0] = xs[0] - ext; p[1] = p[3];
        p[(n + 1) * 2] = xs[n - 1] + ext; p[(n + 1) * 2 + 1] = p[n * 2 + 1];
        this.columns(p, this.y[name]);
      });
      let most = 0;
      for (let b = 0; b < n; b++) most = Math.max(most, v.cutMid[b]);
      const changing = most * on > 0.05;

      // rows 0 and 1: the curves, the alphas along them, where the lanes part, the side lane's length
      const buf = this.buf, Y = this.y;
      let bi = 0, sideRun = 0;
      for (let c = 0; c < W; c++) {
        const x = c + 0.5;
        while (bi < n - 2 && xs[bi + 1] <= x) bi++;
        const f = Math.min(1, Math.max(0, (x - xs[bi]) / (xs[bi + 1] - xs[bi])));
        const o0 = c * 4, o1 = (W + c) * 4;
        buf[o0] = Y.main[c]; buf[o0 + 1] = changing ? Y.out[c] : Y.main[c]; buf[o0 + 2] = Y.key[c]; buf[o0 + 3] = Y.side[c];
        buf[o1] = ka[bi] + (ka[bi + 1] - ka[bi]) * f;
        buf[o1 + 1] = changing ? ra[bi] + (ra[bi + 1] - ra[bi]) * f : 0;
        // the dotted lane shows between the band before a run of parted bands and the band after it
        let show = 0;
        if (changing) {
          const b = x < xs[0] ? -1 : bi;
          if ((b >= 0 && apart[b]) || (b + 1 < n && apart[b + 1])) show = 1;
        }
        buf[o1 + 2] = show;
        if (c > 0) { const dy = Y.side[c] - Y.side[c - 1]; sideRun += Math.sqrt(1 + dy * dy); }
        buf[o1 + 3] = sideRun;
      }
      // rows 2 and 3: how high and low each line reaches near each column, so the shader only looks
      // for a line where it can be
      // (a glow reaches about 2.5 sigma past its core: 4.5 units for the rim, 8.5 for the key)
      const reach = [Math.ceil(4.5 * U + 2), Math.ceil(U + 2), Math.ceil(8.5 * U + 2), Math.ceil(U + 2)];
      const span = (arr, r, c) => {
        let lo = 1e9, hi = -1e9;
        for (let k = Math.max(0, c - r); k <= Math.min(W - 1, c + r); k++) { const y = arr[k]; if (y < lo) lo = y; if (y > hi) hi = y; }
        return [lo, hi];
      };
      for (let c = 0; c < W; c++) {
        const o2 = (2 * W + c) * 4, o3 = (3 * W + c) * 4;
        const m = span(Y.main, reach[0], c), o = span(changing ? Y.out : Y.main, reach[1], c);
        const k = span(Y.key, reach[2], c), s = span(Y.side, reach[3], c);
        buf[o2] = m[0]; buf[o2 + 1] = m[1]; buf[o2 + 2] = o[0]; buf[o2 + 3] = o[1];
        buf[o3] = k[0]; buf[o3 + 1] = k[1]; buf[o3 + 2] = s[0]; buf[o3 + 3] = s[1];
      }

      gl.bindTexture(gl.TEXTURE_2D, this.cols);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, 4, gl.RGBA, gl.FLOAT, buf);

      gl.viewport(0, 0, W, H);
      gl.disable(gl.BLEND);
      gl.useProgram(this.prog);
      gl.bindVertexArray(this.vao);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.cols); gl.uniform1i(this.loc.uCols, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.room); gl.uniform1i(this.loc.uRoom, 1);
      gl.uniform2f(this.loc.uSize, W, H);
      gl.uniform1f(this.loc.uPx, px);
      gl.uniform1f(this.loc.uU, L.unit * px);
      gl.uniform1f(this.loc.uLU, U);
      gl.uniform2f(this.loc.uGraph, L.top * px, L.bottom * px);
      gl.uniform4fv(this.loc.uGrid, this.grid);
      gl.uniform4fv(this.loc.uLimit, this.lim);
      gl.uniform1f(this.loc.uRingY, (L.bottom - 16 * L.lineUnit) * px);
      gl.uniform2f(this.loc.uHover, hover ? hover.x * px : -1e4, hover ? hover.a : 0);
      gl.uniform4i(this.loc.uReach, reach[0], reach[1], reach[2], reach[3]);
      gl.uniform1f(this.loc.uDither, L.dither === false ? 0 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  AndrumSpectrum.bandHz = bandHz;
  AndrumSpectrum.BANDS = BANDS;
  AndrumSpectrum.DESIGN_GRAPH_H = DESIGN_GRAPH_H;
  window.AndrumSpectrum = AndrumSpectrum;
})();
