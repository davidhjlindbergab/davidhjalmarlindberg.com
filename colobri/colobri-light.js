/* The bird's light around the live logo, shared by the opening, the Generate button and the product page:
     edge(el, o)        a mask for the logo's own canvas: its aura full across a rounded square (a superellipse, n 2.6) to `inner` of the
                        way out, easing (smootherstep) to nothing at the edges, at `strength`; always full over the bird (an oval just round
                        its light, easing out slowly to nothing at 2.6 times its size, so it never shows as a shape or a ring), joined softly as
                        1 - (1 - a)(1 - b), and eased to nothing towards the box's edges, so there is no seam anywhere
     glow(canvas, img, o)  the outer light: the aura made much softer (colobri-aura-glow.webp), centred on the bird, at `a`, from `from`
                        of the half-diagonal to nothing at `to` (1.06: just past the corners), optionally gone by the foot (`foot`), painted
                        with a one-step dither so its long, faint gradients show no bands, over the ground color `ground`; `iw` draws it
                        at least that wide (it always covers the box), `cap` at most that wide (its edges then drawn out to the box's), `ellipse`
                        measures the falloff to the box's own edges, and `rx` with `ry` makes it one soft bell round the bird with those
                        radii (in pixels; the opening's light since round 14: bigger, smoother, subtler, with no edge anywhere). With
                        `anchor` the canvas is sized in pixels and stays centred on the bird while the box changes size (at(canvas, cx,
                        cy)), so it is never stretched while it waits to be painted again
     grow(o)            the opening: the bird grows from `from` (0.5) of its size to full over `dur` (2000) ms on a very soft ease in and
                        out (cubic-bezier .65, 0, .32, 1), by its padding, so its haze grows with it and the canvas never shows as a
                        shape; o.step(s) is called each frame with the bird's share of its full size, o.done() at the end. It returns
                        { hold(ms), go(), finish() } (hold stops it at that moment, for tests and screenshots)
     dither(el, name)   a 128-pixel tile of a little white at random (one tile pixel to a screen pixel), for a layer over everything that
                        breaks up the GPU's whole-step contour lines in the dark; set as the CSS variables --<name> and --<name>-size
     ground(el)         the color behind an element (the first ancestor with a background), as [r, g, b]
   o: { w, h } the box in CSS pixels, { cx, cy } the bird's middle in it, bw the bird's width (its outline, 3378 logo units).
   A box that is tall for its width (a narrow window, a phone) is measured as if it were only as tall as the light's own shape round
   the bird (the aura: as wide as the box and 0.62 of that high, like the bird's light; the outer light: as high as wide): the light
   keeps its shape round the bird instead of being stretched into a tall column, and the box's top and bottom stay dark. */
(function () {
  'use strict';
  const sm = t => { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); };
  const keys = new WeakMap();
  // the frame the light is measured in: the box itself, or, when the box is tall for its width, a box as wide as it and k of that high,
  // round the bird (kept inside the box)
  function frame(w, h, cy, k) {
    const hx = w / 2, hy = Math.min(h / 2, k * w / 2);
    return { mx: w / 2, my: hy < h / 2 ? Math.max(hy, Math.min(h - hy, cy)) : h / 2, hx, hy };
  }
  function edge(el, o) {
    const inner = o.inner == null ? 0.4 : o.inner, strength = o.strength == null ? 1 : o.strength, fall = o.fall == null ? 1.6 : o.fall;
    const key = [o.w, o.h, o.cx, o.cy, o.bw].map(Math.round).join(':') + '/' + inner + '/' + strength + '/' + fall;
    if (keys.get(el) === key) return;
    const n = o.res || 320, W = o.w >= o.h ? n : Math.max(8, Math.round(n * o.w / o.h)), H = o.w >= o.h ? Math.max(8, Math.round(n * o.h / o.w)) : n;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); if (!x) return;
    keys.set(el, key);
    const F = frame(o.w, o.h, o.cy, 0.62);
    // the bird's own oval: just round its light (0.55 x 0.36 of its width each way), full inside and easing out slowly to nothing at 2.6
    // times that, so the aura hands over to the outer light gradually wherever the window's edges are (a quick hand-over shows as a
    // darker ring, where the aura is already faint and the outer light still bright)
    const im = x.createImageData(W, H), bx = 0.55 * o.bw, by = 0.36 * o.bw, cy = o.cy - 0.01 * o.bw;
    for (let j = 0; j < H; j++) {
      const y = (j + 0.5) / H * o.h, v = Math.abs(y - F.my) / F.hy, py = Math.pow(Math.abs(y - cy) / by, 2.2);
      // (and nothing at the box's own edges, whatever the window's shape: eased out over the last 30% of the way to the sides, so the aura
      // is never cut by them, even on a phone where the bird fills most of the width, and over the last 14% to the top and bottom, which
      // the bird comes close to)
      const ey = sm((1 - Math.abs((j + 0.5) / H * 2 - 1)) / 0.14);
      for (let i = 0; i < W; i++) {
        const X = (i + 0.5) / W * o.w, u = Math.abs(X - F.mx) / F.hx, px = Math.pow(Math.abs(X - o.cx) / bx, 2.2);
        const a = strength * (1 - sm((Math.pow(Math.pow(u, 2.6) + Math.pow(v, 2.6), 1 / 2.6) - inner) / (1 - inner)));
        const b = 1 - sm((Math.pow(px + py, 1 / 2.2) - 1) / fall);
        const e = ey * sm((1 - Math.abs((i + 0.5) / W * 2 - 1)) / 0.3);
        im.data[(j * W + i) * 4 + 3] = Math.round(255 * e * (1 - (1 - a) * (1 - b)));
      }
    }
    x.putImageData(im, 0, 0);
    const url = 'url(' + c.toDataURL() + ')';
    el.style.webkitMaskImage = url; el.style.maskImage = url;
    el.style.webkitMaskSize = el.style.maskSize = '100% 100%'; el.style.webkitMaskRepeat = el.style.maskRepeat = 'no-repeat';
  }
  function ground(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const m = /rgba?\((\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?/.exec(getComputedStyle(e).backgroundColor || '');
      if (m && (m[4] == null || +m[4] > 0.5)) return [+m[1], +m[2], +m[3]];
    }
    return [18, 18, 18];
  }
  function glow(canvas, img, o) {
    if (!canvas || !img || !img.naturalWidth) return false;
    const W = Math.max(2, Math.round(o.w)), H = Math.max(2, Math.round(o.h));
    const key = W + 'x' + H + '@' + Math.round(o.cx) + ',' + Math.round(o.cy) + '/' + o.a + '/' + (o.foot || 0) + '/' + Math.round(o.iw || 0) + '/' + Math.round(o.cap || 0) + (o.ellipse ? 'e' : '') + (o.ground || '') + '/' + Math.round(o.rx || 0) + 'x' + Math.round(o.ry || 0);
    if (keys.get(canvas) === key) { if (o.anchor) at(canvas, o.cx, o.cy); return false; }
    const x = canvas.getContext('2d', { willReadFrequently: true }); if (!x) return false;
    keys.set(canvas, key); canvas.width = W; canvas.height = H;
    const from = o.from == null ? 0.25 : o.from, to = o.to == null ? 1.06 : o.to, over = o.over == null ? 0.08 : o.over, a0 = o.a == null ? 0.5 : o.a;
    // (centred on the bird, large enough to pass every edge by 8%, and at least `iw` across)
    const iw = img.naturalWidth, ih = img.naturalHeight, hw = Math.max(o.cx, W - o.cx) * (1 + over), hh = Math.max(o.cy, H - o.cy) * (1 + over);
    // (never smaller than the box, unless `cap` keeps it at most that wide, as it is on a wide screen: a tall window would otherwise draw it
    // far larger than the bird and too bright round it; its edges are then drawn out to the box's, so it still fills it without a seam)
    const cover = Math.max(2 * hw / iw, 2 * hh / ih), s = Math.max(o.iw ? o.iw / iw : 0, o.cap ? Math.min(cover, o.cap / iw) : cover), dw = iw * s, dh = ih * s;
    const G0 = o.ground || [18, 18, 18]; x.fillStyle = 'rgb(' + G0.join(',') + ')'; x.fillRect(0, 0, W, H);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    const x0 = o.cx - dw / 2, y0 = o.cy - dh / 2, x1 = x0 + dw, y1 = y0 + dh;
    x.drawImage(img, x0, y0, dw, dh);
    if (s < cover) {
      if (y0 > 0) x.drawImage(img, 0, 0, iw, 1, x0, 0, dw, y0);                         // (the top row drawn up)
      if (y1 < H) x.drawImage(img, 0, ih - 1, iw, 1, x0, y1, dw, H - y1);               // (the bottom row drawn down)
      if (x0 > 0) x.drawImage(img, 0, 0, 1, ih, 0, y0, x0, dh);                         // (the left column drawn out)
      if (x1 < W) x.drawImage(img, iw - 1, 0, 1, ih, x1, y0, W - x1, dh);               // (the right column drawn out)
      if (x0 > 0 && y0 > 0) x.drawImage(img, 0, 0, 1, 1, 0, 0, x0, y0);                 // (and the corners)
      if (x1 < W && y0 > 0) x.drawImage(img, iw - 1, 0, 1, 1, x1, 0, W - x1, y0);
      if (x0 > 0 && y1 < H) x.drawImage(img, 0, ih - 1, 1, 1, 0, y1, x0, H - y1);
      if (x1 < W && y1 < H) x.drawImage(img, iw - 1, ih - 1, 1, 1, x1, y1, W - x1, H - y1);
    }
    const d = x.getImageData(0, 0, W, H), p = d.data, S = o.ground || [18, 18, 18], span = to - from, foot = o.foot, F = frame(W, H, o.cy, 1);
    // (with rx and ry: one soft bell of light round the bird itself, its radii in pixels: full in the middle, easing (smootherstep) to
    // nothing at the radii, so it has no edge anywhere; chosen so it is gone well before the box's edges)
    const R = o.rx && o.ry ? { rx: o.rx, ry: o.ry } : null;
    for (let j = 0, k = 0; j < H; j++) {
      const v = R ? ((j + 0.5) - o.cy) / R.ry : ((j + 0.5) - F.my) / F.hy, v2 = v * v, f = foot ? a0 * (1 - sm(((j + 0.5) / H - foot) / (1 - foot))) : a0;
      for (let i = 0; i < W; i++, k += 4) {
        const u = R ? ((i + 0.5) - o.cx) / R.rx : ((i + 0.5) - F.mx) / F.hx;
        const a = f * (1 - sm(((R ? Math.sqrt(u * u + v2) : Math.sqrt(o.ellipse ? u * u + v2 : (u * u + v2) / 2)) - from) / span));
        p[k] = S[0] + (p[k] - S[0]) * a + Math.random() + Math.random() - 1;   // (a triangular dither of one step; the array rounds and clamps)
        p[k + 1] = S[1] + (p[k + 1] - S[1]) * a + Math.random() + Math.random() - 1;
        p[k + 2] = S[2] + (p[k + 2] - S[2]) * a + Math.random() + Math.random() - 1;
        p[k + 3] = 255;
      }
    }
    x.putImageData(d, 0, 0);
    if (o.anchor) {
      canvas.__cl = { cx: o.cx, cy: o.cy };
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      canvas.style.transformOrigin = o.cx + 'px ' + o.cy + 'px';
      at(canvas, o.cx, o.cy);
    }
    return true;
  }
  // keep an anchored glow centred on the bird while the box changes size (the uncovered edges are the ground it fades to)
  function at(canvas, cx, cy) {
    const c = canvas && canvas.__cl; if (!c) return;
    canvas.style.left = Math.round(cx - c.cx) + 'px'; canvas.style.top = Math.round(cy - c.cy) + 'px';
  }
  // a cubic-bezier easing, as CSS draws it
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t, dX = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 40; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-7) break; if (e < 0) lo = t; else hi = t; const d = dX(t); t = d > 1e-6 ? t - e / d : (lo + hi) / 2; if (t <= lo || t >= hi) t = (lo + hi) / 2; }
      return Y(t);
    };
  }
  function grow(o) {
    const ease = bezier.apply(null, o.ease || [0.65, 0, 0.32, 1]), from = o.from == null ? 0.5 : o.from, dur = o.dur || 2000;
    const at = ms => from + (1 - from) * ease(ms / dur);
    let t0 = 0, held = -1, over = false;
    function f(now) {
      if (over || held >= 0) return;
      if (!t0) t0 = now;
      const ms = now - t0; o.step(at(ms));
      if (ms < dur) requestAnimationFrame(f); else { over = true; if (o.done) o.done(); }
    }
    o.step(from); requestAnimationFrame(f);
    return {
      hold(ms) { if (over) return; held = ms; o.step(at(ms)); },
      go() { if (over || held < 0) return; t0 = performance.now() - held; held = -1; requestAnimationFrame(f); },
      finish() { if (over) return; over = true; held = -1; o.step(1); if (o.done) o.done(); },
    };
  }
  function dither(el, name) {
    const n = 128, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); if (!x) return;
    const im = x.createImageData(n, n);
    for (let k = 0; k < n * n; k++) { im.data[k * 4] = im.data[k * 4 + 1] = im.data[k * 4 + 2] = 255; im.data[k * 4 + 3] = Math.floor(Math.random() * 3); }
    x.putImageData(im, 0, 0);
    el.style.setProperty('--' + name, 'url(' + c.toDataURL() + ')');
    el.style.setProperty('--' + name + '-size', n / (window.devicePixelRatio || 1) + 'px');
  }
  window.ColobriLight = { sm, edge, glow, at, grow, bezier, dither, ground };
})();
