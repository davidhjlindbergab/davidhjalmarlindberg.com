/* Blick's pages on davidhjalmarlindberg.com: what the overview and the pages under it share. Loaded at the end of each
   page, after store.js. No build step: this is the file. */
(function () {
  'use strict';
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function each(sel, fn) { [].forEach.call(document.querySelectorAll(sel), fn); }

  // The store (store.js). The prices are shown from the start. Until the store is live the buttons ask to be told when
  // Blick is on sale; once it is, each becomes the free trial, each plan gets a button to its own checkout, and the
  // lines under them say what the trial is. The pages under the overview find the store's pages one folder up.
  var store = window.BLICK_STORE || {}, plans = { monthly: store.monthly || {}, yearly: store.yearly || {} };
  var tag = document.querySelector('script[src$="store.js"]'), root = tag ? tag.getAttribute('src').replace(/store\.js$/, '') : '';
  each('[data-bk-price]', function (el) { var pl = plans[el.getAttribute('data-bk-price')]; if (pl && pl.price) el.textContent = pl.price; });
  if (store.live && store.download && plans.monthly.checkout && plans.yearly.checkout) {
    each('a.btn.solid[href^="mailto:"]', function (a) {
      a.href = root + 'download/'; a.textContent = 'Try it free for 7 days'; a.setAttribute('data-lk-download', '');
    });
    each('[data-bk-plan]', function (el) {
      var k = el.getAttribute('data-bk-plan'), a = document.createElement('a');
      a.className = 'btn line'; a.href = plans[k].checkout; a.setAttribute('data-lk-buy', ''); a.textContent = k === 'yearly' ? 'Subscribe by the year' : 'Subscribe by the month';
      el.appendChild(a);
    });
    each('[data-bk-live]', function (el) { el.innerHTML = el.getAttribute('data-bk-live'); });
    each('[data-bk-only]', function (el) { el.hidden = false; });
  }

  // Which version the download is (store.js: version for the Mac, versionWin for Windows where it differs). A part of
  // the app that came with a later version says so beside its name: "Coming in 3.7" while the download is older than
  // that, "New" while it is that version, and nothing once the download has moved on. Without the store's version the
  // marks stay as they are written in the page: the version's number.
  function ver(s) { var m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(s || '')); return m ? [+m[1], +m[2], +(m[3] || 0)] : null; }
  function older(a, b) { return a[0] !== b[0] ? a[0] < b[0] : a[1] < b[1]; }                 // by the first two numbers
  var mac = ver(store.version), win = ver(store.versionWin || store.version), newest = null;
  each('.v[data-v]', function (el) { var need = ver(el.getAttribute('data-v')); if (need && (!newest || older(newest, need))) newest = need; });
  if (mac) {
    var behind = !!newest && older(mac, newest);
    each('.v[data-v]', function (el) {
      var need = ver(el.getAttribute('data-v')); if (!need) return;
      if (older(mac, need)) el.textContent = 'Coming in ' + need[0] + '.' + need[1];
      else if (!older(need, mac)) { el.textContent = 'New'; el.classList.add('new'); }
      else el.textContent = '';
    });
    each('[data-bk-version]', function (el) { el.textContent = store.version; });
    each('[data-bk-version-win]', function (el) { el.textContent = store.versionWin || store.version; });
    // the lines that say what the download does not have yet: shown only while that is so
    each('[data-bk-behind]', function (el) { el.hidden = !behind; });
    each('[data-bk-behind-win]', function (el) { el.hidden = behind || !win || !older(win, mac); });
    each('[data-bk-level]', function (el) { el.hidden = behind || (!!win && older(win, mac)); });
  }

  // the bar gets its line once the page has moved; the page you are on is brought into view in the row of pages
  var bar = document.getElementById('bar');
  var onScroll = function () { bar.classList.toggle('on', window.scrollY > 8); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  var here = document.querySelector('.tabs a[aria-current="page"]'), row = here && here.parentNode;
  if (row && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, here.offsetLeft - row.offsetLeft - 22);

  // things come into focus as they are reached
  var rise = [].slice.call(document.querySelectorAll('.rise'));
  if (!('IntersectionObserver' in window)) rise.forEach(function (el) { el.classList.add('in'); });
  else {
    var seen = new IntersectionObserver(function (list) {
      list.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rise.forEach(function (el) { seen.observe(el); });
  }

  function press(seg, show) { [].forEach.call(seg.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.show === show)); }); }

  // The eye. David's "Blick Animation": a line drawing made of light alone. It is black until the light finds it; the
  // light follows the pointer with some weight, wanders by itself when the pointer rests, and breathes a little. The
  // shader is his, unchanged. On this page the light never goes further from the eye than it can reach, so the eye is
  // never left dark; nothing is drawn while the eye is out of view; and where WebGL 2 is missing the eye under the
  // canvas, lit by a plain gradient, takes the light instead. With Reduce motion on, the light only moves with the pointer.
  (function () {
    var box = document.getElementById('eye'), canvas = document.getElementById('eyeLight'), plain = document.getElementById('eye-plain-light');
    if (!box || !canvas) return;
    var FRAG = "#version 300 es\nprecision highp float;\nout vec4 fragColor;\nuniform vec2 uCenter; uniform float uUnit; uniform vec3 uLight; uniform float uPower; uniform float uOpen; uniform float uTime; uniform float uDepth;\nconst float R = 10.0; const float D = 6.0;\nconst float REACH = 6.4;      // how far the light carries, in stroke widths\nconst vec3 INDIGO = vec3(0.0116, 0.0284, 0.3916); const vec3 ROYAL = vec3(0.0144, 0.1248, 0.7454); const vec3 AZURE = vec3(0.0497, 0.4452, 0.8880);\nconst vec3 SKY = vec3(0.1912, 0.7157, 0.9301);\nconst vec3 OPEN = vec3(0.1385, 0.4375, 0.9080);\nconst vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);\nconst mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);\nfloat sdVesica(vec2 p, float r, float d){ p = abs(p); float b = sqrt(r * r - d * d);\nreturn ((p.y - b) * d > p.x * b) ? length(p - vec2(0.0, b)) : length(p - vec2(-d, 0.0)) - r; }\nfloat hash12(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }\nvec2 hash22(vec2 p){ vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }\nfloat gnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);\nfloat a = dot(hash22(i) * 2.0 - 1.0, f), b = dot(hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0, f - vec2(1.0, 0.0));\nfloat c = dot(hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0, f - vec2(0.0, 1.0)), d = dot(hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0, f - vec2(1.0, 1.0));\nreturn mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }\nfloat edge(vec2 p){ return min(max(sdVesica(p.yx, R, D), -sdVesica(p.yx, R - 1.0, D)), abs(length(p) - 3.5) - 0.5); }\nbool within(vec2 p){ vec2 q = abs(p); float r = length(q); float len = length(q + vec2(0.0, 6.0));\nreturn len < 10.0 && r > 3.0 && (len > 9.0 || r < 4.0); }\nvoid cut(vec2 p, vec2 d, vec2 c, float rho, inout float best){\nvec2 oc = p - c; float b = dot(oc, d); float disc = b * b - dot(oc, oc) + rho * rho;\nif (disc <= 0.0) { return; }\nfloat s = sqrt(disc); float t = -b - s;\nif (t > 0.0005 && t < best && !within(p + d * (t + 0.002))) { best = t; }\nt = -b + s;\nif (t > 0.0005 && t < best && !within(p + d * (t + 0.002))) { best = t; } }\nvec3 ramp(float v){ v = clamp(v, 0.0, 1.0);\nreturn v < 0.33 ? mix(SKY, AZURE, v / 0.33) : (v < 0.66 ? mix(AZURE, ROYAL, (v - 0.33) / 0.33) : mix(ROYAL, INDIGO, (v - 0.66) / 0.34)); }\nvec3 film(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }\nvoid main(){\nvec2 p = (gl_FragCoord.xy - uCenter) / uUnit;\nfloat aa = 0.7 / uUnit;\nfloat sd = edge(p);\nfloat m = smoothstep(aa, -aa, sd);\nvec3 col = vec3(0.0);\nif (m > 0.0){\nvec2 toL = uLight.xy - p; float hz = uLight.z + uDepth; float d2 = dot(toL, toL) + hz * hz;\nfloat lz = hz * inversesqrt(d2);\nfloat lit = 1.0 / (1.0 + d2 / (REACH * REACH)); lit *= lit;\nvec2 g = p * 0.30 - uLight.xy * 0.19 + vec2(uTime * 0.034, -uTime * 0.026);\nlit *= max(0.35, 1.0 + 0.45 * (gnoise(g) + 0.3 * gnoise(ROT * g * 2.1 + 4.0)));\nfloat lh = max(length(toL), 0.001); vec2 ld = toL / lh;\nfloat tEnd = max(lh * uDepth / hz, 0.0001);                       // closer to the edge than this, and the edge is in the way\nfloat tr = tEnd * 4.0;                                            // further than this never matters\nif (sd >= 0.0) { tr = 0.0; } else {\ncut(p, ld, vec2(0.0, -6.0), 10.0, tr); cut(p, ld, vec2(0.0, 6.0), 10.0, tr);       // the outer edge of the lids\ncut(p, ld, vec2(0.0, -6.0), 9.0, tr); cut(p, ld, vec2(0.0, 6.0), 9.0, tr);         // their inner edge\ncut(p, ld, vec2(0.0), 3.0, tr); cut(p, ld, vec2(0.0), 4.0, tr);                     // the two edges of the iris\n}\nfloat cs = smoothstep(0.5, 1.5, tr / tEnd);                       // a soft shadow, softer the longer it is\nfloat amount = lit * (lz * cs * 1.2 + 0.16 * (0.35 + 0.65 * lz));\namount = 1.0 - exp(-amount * 1.25);                              // the brightest parts settle into sky blue and never go white\ncol = ramp((-log2(max(amount, 0.0001)) - 0.35) / 3.9) * amount;\ncol *= uPower * 0.56;\ncol = mix(col, OPEN, uOpen);\nfloat lin = max(dot(col, LUMA), 0.00001);\ncol = clamp(mix(col * (film(vec3(lin)).r / lin), film(col), 0.5), 0.0, 1.0);\ncol = pow(col * m, vec3(1.0 / 2.2));\ncol += (hash12(gl_FragCoord.xy) + hash12(gl_FragCoord.xy + 31.7) - 1.0) / 255.0 * smoothstep(0.0, 0.012, dot(col, LUMA));   // too fine to see: it only keeps the smooth blues from breaking into bands\n}\nfragColor = vec4(col, 1.0);\n}\n";
    var VERT = '#version 300 es\nvoid main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }\n';
    var HEIGHT = 1.7, DEPTH = 0.11, IDLE = 2600, VIEW_W = 17.6;
    var gl = null, prog = null, vao = null, raf = 0, inView = true, dirty = true;
    var size = { w: 0, h: 0, cw: 1, ch: 1, scale: 1, unit: 1 }, ladder = [3, 2, 1.5, 1.25, 1, 0.8, 0.6], rung = 0, slow = 0;
    var lastDrawn = 0, prev = 0, clock = 0, rise = still ? 1 : 0, born = 0, lastInput = -1e9, idleStart = 0, wandering = !still;
    // positions are in stroke widths from the eye's centre, x to the right and y up
    function wander(t) { return { x: -8.2 * Math.cos(0.17 * t), y: 4.4 * Math.sin(0.275 * t + 0.76) }; }
    var w0 = still ? { x: -3.2, y: 2.4 } : wander(0), light = { x: w0.x, y: w0.y, vx: 0, vy: 0, tx: w0.x, ty: w0.y };

    function compile(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader'); return s; }
    function initGL() {
      try {
        gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
        if (!gl) return false;
        var p = gl.createProgram();
        gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
        var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
        for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
        prog = { p: p, u: u }; vao = gl.createVertexArray();
        return true;
      } catch (e) { gl = null; return false; }
    }
    function layout() {
      var r = box.getBoundingClientRect(), cw = Math.max(1, r.width), ch = Math.max(1, r.height), dpr = window.devicePixelRatio || 1;
      size.cw = cw; size.ch = ch; size.scale = Math.min(ladder[rung], Math.max(dpr, 1.5)); size.unit = cw / VIEW_W;
      size.w = Math.max(2, Math.round(cw * size.scale)); size.h = Math.max(2, Math.round(ch * size.scale));
      if (gl && (canvas.width !== size.w || canvas.height !== size.h)) { canvas.width = size.w; canvas.height = size.h; }
      dirty = true;
    }
    function point(e) {
      if (!inView) return;
      var r = box.getBoundingClientRect();
      var x = (e.clientX - r.left - r.width / 2) / size.unit, y = -(e.clientY - r.top - r.height / 2) / size.unit;
      // kept within the light's reach of the eye: it leans toward the pointer, and the eye is never left dark
      var far = Math.sqrt(x * x / 81 + y * y / 25); if (far > 1) { x /= far; y /= far; }
      light.tx = x; light.ty = y; lastInput = performance.now(); wandering = false; dirty = true; wake();
    }
    function draw() {
      var s = size.scale, u = prog.u;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, size.w, size.h);
      gl.useProgram(prog.p); gl.bindVertexArray(vao); gl.disable(gl.BLEND);
      gl.uniform2f(u.uCenter, size.cw / 2 * s, size.ch / 2 * s);
      gl.uniform1f(u.uUnit, size.unit * s); gl.uniform1f(u.uTime, clock); gl.uniform1f(u.uDepth, DEPTH);
      gl.uniform3f(u.uLight, light.x, light.y, HEIGHT);
      var breath = 1 + 0.022 * (Math.sin(clock * 1.9) + 0.6 * Math.sin(clock * 3.1 + 1.3) + 0.4 * Math.sin(clock * 5.3 + 4.1));
      gl.uniform1f(u.uPower, 1.8 * (0.22 + 0.78 * rise) * breath);
      gl.uniform1f(u.uOpen, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!box.classList.contains('lit')) box.classList.add('lit');
    }
    function frame(now) {
      raf = 0;
      if (!inView || document.hidden) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.25, (now - prev) / 1000 || 0.016); prev = now;
      if (!wandering && !still && now - lastInput > IDLE) { wandering = true; idleStart = now - 4000; }
      if (wandering && !still) { var w = wander((now - idleStart) / 1000); light.tx = w.x; light.ty = w.y; }
      // a critically damped spring, stepped in small slices of real time, so the light has some weight
      var k = wandering ? 14 : 70, c = 2 * Math.sqrt(k), steps = Math.max(1, Math.ceil(dt / 0.008)), h = dt / steps;
      for (var i = 0; i < steps; i++) {
        light.vx += (k * (light.tx - light.x) - c * light.vx) * h; light.vy += (k * (light.ty - light.y) - c * light.vy) * h;
        light.x += light.vx * h; light.y += light.vy * h;
      }
      if (!still) { clock = now / 1000; dirty = true; }
      // the eye comes up out of the dark when the page opens
      if (rise < 1) { born = born || now; var q = Math.min(1, (now - born) / 1800); rise = q * q * (3 - 2 * q); dirty = true; }
      var moving = Math.abs(light.vx) + Math.abs(light.vy) > 0.002 || Math.abs(light.tx - light.x) + Math.abs(light.ty - light.y) > 0.002;
      if (!(moving || dirty)) { if (still) { cancelAnimationFrame(raf); raf = 0; } return; }
      dirty = false;
      if (!gl) { plain.setAttribute('cx', light.x.toFixed(2)); plain.setAttribute('cy', (-light.y).toFixed(2)); return; }
      draw();
      // step the resolution down if this machine cannot keep up; it never steps back up
      var ms = now - (lastDrawn || now); lastDrawn = now;
      if (ms > 45 && ms < 1500) slow += ms > 110 ? 6 : 1; else slow = Math.max(0, slow - 1);
      if (slow > 24 && rung < ladder.length - 1) { do { rung++; } while (rung < ladder.length - 1 && ladder[rung] >= size.scale); slow = 0; layout(); }
    }
    function wake() { if (!raf && inView && !document.hidden) { prev = 0; lastDrawn = 0; raf = requestAnimationFrame(frame); } }

    initGL();
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); gl = null; box.classList.remove('lit'); });
    canvas.addEventListener('webglcontextrestored', function () { if (initGL()) { canvas.width = 0; layout(); wake(); } });
    addEventListener('pointermove', point, { passive: true }); addEventListener('pointerdown', point, { passive: true });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });
    if (window.ResizeObserver) new ResizeObserver(function () { layout(); wake(); }).observe(box); else addEventListener('resize', function () { layout(); wake(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (list) { inView = list[0].isIntersecting; if (inView) wake(); }, { threshold: 0 }).observe(box);
    layout(); wake();
  })();

  // The cut. One film file carries every shot twice, frame for frame: the upper picture is the clip as it arrived, the
  // lower one as Blick rendered it, with a gutter of data-gap rows between them. A canvas over the film draws what is
  // asked for out of the frame the film is on: the two side by side with a line between them (how it starts), or one of
  // them whole. Both always come from the same frame, so they cannot drift apart. Before the film has a frame, its poster
  // (the first frame, laid out the same way) stands in.
  (function () {
    var fig = document.getElementById('filmFig'); if (!fig) return;
    var stage = document.getElementById('stage'), reel = document.getElementById('reel'), view = document.getElementById('reelView'),
        knob = document.getElementById('reelKnob'), play = document.getElementById('reelPlay'), seg = document.querySelector('.seg[data-for="reel"]');
    var ctx = view.getContext && view.getContext('2d'); if (!ctx) return;
    var gap = +reel.dataset.gap, first = new Image(), mode = 'split', at = 0.5, wants = !still, inView = false, fresh = true, last = 0, raf = 0, grab = null;
    var counts = 'requestVideoFrameCallback' in reel;

    // if drawing ever fails, hand the film back as it is: both pictures, and the browser's controls
    function plain() { fig.classList.remove('live'); reel.controls = true; paint = function () {}; }
    function from() { return reel.readyState >= 2 && reel.videoWidth ? reel : first.complete && first.naturalWidth ? first : null; }
    var paint = function () {
      var s = from(); if (!s) return;
      var w = s === reel ? reel.videoWidth : first.naturalWidth, h = ((s === reel ? reel.videoHeight : first.naturalHeight) - gap) / 2;
      try {
        if (view.width !== w || view.height !== h) { view.width = w; view.height = h; }
        var x = mode === 'original' ? w : mode === 'final' ? 0 : Math.round(at * w);
        if (x > 0) ctx.drawImage(s, 0, 0, x, h, 0, 0, x, h);                      // the original, left of the line
        if (x < w) ctx.drawImage(s, x, h + gap, w - x, h, x, 0, w - x, h);        // the graded picture, right of it
      } catch (e) { plain(); }
    };
    // Paint when the film shows a new frame. Where the browser does not say so, or stops saying so, paint on every screen frame.
    function frame() { last = performance.now(); paint(); reel.requestVideoFrameCallback(frame); }
    function loop() {
      raf = 0;
      if (fresh || !counts || performance.now() - last > 120) { fresh = false; paint(); }
      if (!reel.paused && !reel.ended) raf = requestAnimationFrame(loop);
    }
    function run() { fresh = true; if (!raf) raf = requestAnimationFrame(loop); }
    if (counts) reel.requestVideoFrameCallback(frame);
    ['play', 'playing', 'pause', 'seeked', 'loadeddata'].forEach(function (n) { reel.addEventListener(n, run); });

    function show(m) { mode = m; stage.dataset.show = m; press(seg, m); paint(); }
    function move(v) {
      at = Math.max(0.04, Math.min(0.96, v));
      stage.style.setProperty('--at', (at * 100).toFixed(2) + '%'); knob.setAttribute('aria-valuenow', String(Math.round(at * 100))); paint();
    }
    seg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) show(b.dataset.show); });
    // a click on the picture: from the split, the side that was clicked, whole; after that, the other one
    stage.addEventListener('click', function (e) {
      if (!fig.classList.contains('live') || e.target.closest('.knob, .play')) return;
      var r = stage.getBoundingClientRect();
      show(mode === 'split' ? ((e.clientX - r.left) / r.width < at ? 'original' : 'final') : mode === 'original' ? 'final' : 'original');
      if (reel.paused) sync();      // where the browser would not let the film start by itself, a touch lets it
    });
    // the line: dragged, or moved with the keys
    knob.addEventListener('pointerdown', function (e) { if (e.button) return; grab = e.pointerId; try { knob.setPointerCapture(grab); } catch (x) {} e.preventDefault(); });
    knob.addEventListener('pointermove', function (e) { if (e.pointerId !== grab) return; var r = stage.getBoundingClientRect(); move((e.clientX - r.left) / r.width); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { knob.addEventListener(n, function () { grab = null; }); });
    knob.addEventListener('keydown', function (e) {
      var d = { ArrowLeft: -0.02, ArrowDown: -0.02, ArrowRight: 0.02, ArrowUp: 0.02, PageDown: -0.1, PageUp: 0.1, Home: -1, End: 1 }[e.key];
      if (d) { e.preventDefault(); move(at + d); }
    });

    // it plays by itself while it is in view, unless it was stopped by hand; with Reduce motion it waits to be started
    function sync() { if (wants && inView) { var p = reel.play(); if (p && p.catch) p.catch(function () {}); } else reel.pause(); }
    reel.addEventListener('play', function () { stage.classList.remove('paused'); play.setAttribute('aria-label', 'Pause the film'); });
    reel.addEventListener('pause', function () { stage.classList.add('paused'); play.setAttribute('aria-label', 'Play the film'); });
    play.addEventListener('click', function () { wants = reel.paused; inView = true; sync(); });

    reel.controls = false; stage.classList.add('paused'); fig.classList.add('live');
    first.onload = function () { paint(); }; first.src = reel.getAttribute('poster');
    if ('IntersectionObserver' in window) new IntersectionObserver(function (list) { inView = list[0].isIntersecting; sync(); }, { threshold: 0.15 }).observe(stage);
    else { inView = true; sync(); }
    // a phone stops the film when the browser is put away; take it up again on the way back
    document.addEventListener('visibilitychange', function () { if (!document.hidden) sync(); });
    addEventListener('pageshow', function (e) { if (e.persisted) sync(); });
  })();

  // A window of the app as two photographs, one over the other (class win, with a row of two buttons that names it in
  // data-for). One marked data-turn turns to its second photograph by itself the first time it is seen.
  each('.win[id]', function (win) {
    var seg = document.querySelector('.seg[data-for="' + win.id + '"]'); if (!seg) return;
    var touched = false;
    function show(s) { win.dataset.show = s; press(seg, s); }
    seg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { touched = true; show(b.dataset.show); } });
    if (!win.hasAttribute('data-turn')) return;
    if (still || !('IntersectionObserver' in window)) show('b');
    else {
      var firstSeen = new IntersectionObserver(function (list) {
        if (!list[0].isIntersecting) return;
        firstSeen.disconnect(); setTimeout(function () { if (!touched) show('b'); }, 1400);
      }, { threshold: 0.55 });
      firstSeen.observe(win.querySelector('.shot'));
    }
  });

  // One frame in several looks (class looks): the look that is pressed is the one that shows. The buttons are a row of
  // names, or the looks' own pictures; a button may carry the line to put under the picture (data-says, shown in data-said).
  each('.looks[id]', function (looks) {
    var seg = document.querySelector('[data-for="' + looks.id + '"]'); if (!seg) return;
    var cap = looks.querySelector('[data-said]');
    function look(n) {
      [].forEach.call(looks.querySelectorAll('.frames img'), function (im) { var on = im.dataset.look === n; im.classList.toggle('on', on); im.setAttribute('aria-hidden', String(!on)); });
      press(seg, n);
      var b = seg.querySelector('button[data-show="' + n + '"]'); if (cap && b && b.dataset.says) cap.textContent = b.dataset.says;
    }
    seg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) look(b.dataset.show); });
    look(seg.querySelector('[aria-pressed="true"]').dataset.show);
  });

  // The wall of looks rests in the dark, and a light crosses it: the pointer's while it moves over the wall, the wall's
  // own, slowly, when the pointer rests. With Reduce motion on the light stays where it is unless the pointer moves it.
  each('.wall', function (wall) {
    var x = 0.5, y = 0.46, tx = x, ty = y, last = -1e9, raf = 0, inView = false, t0 = performance.now();
    function put() { wall.style.setProperty('--mx', (x * 100).toFixed(2) + '%'); wall.style.setProperty('--my', (y * 100).toFixed(2) + '%'); }
    function frame(now) {
      raf = 0; if (!inView || document.hidden) return;
      var own = now - last > 2200;
      if (own && !still) { var t = (now - t0) / 1000; tx = 0.5 + 0.4 * Math.cos(0.21 * t); ty = 0.5 + 0.26 * Math.sin(0.33 * t + 0.8); }
      var k = own ? 0.03 : 0.16; x += (tx - x) * k; y += (ty - y) * k; put();
      if (!still || Math.abs(tx - x) + Math.abs(ty - y) > 0.001) raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf && inView) raf = requestAnimationFrame(frame); }
    wall.addEventListener('pointermove', function (e) { var r = wall.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width; ty = (e.clientY - r.top) / r.height; last = performance.now(); wake(); }, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (list) { inView = list[0].isIntersecting; wake(); }, { threshold: 0 }).observe(wall);
    else { inView = true; wake(); }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });
    put();
  });
})();
