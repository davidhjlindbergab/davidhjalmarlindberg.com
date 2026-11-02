/*!
 * Colobri hues v1.0.0
 * The Colobri button and the look ring wear the colors of the look the COLOBRI logo is in (logo kit 2, "Multiple Hues"; 2.1 now).
 * Each look's colors were measured once from the logo itself, at the parts of the bird the button lays round its pill (the wing tip,
 * the upper wing, the back, the nape, the head, the throat, the belly, the lower wing) and in its glow (colobri-hues-data.js, made
 * by tools/colobri_hues.py); the original look is the button's own approved colors. Following a live logo, every frame:
 *   - its getLook(): the look at the heart of the bird, the one it is flowing into, and how far;
 *   - the two looks' colors blended part by part, the change travelling along the pill as a soft front, as it travels through the
 *     bird (a wing, the body and the head turn at different moments), each change in its own direction;
 *   - the result handed to ColobriButton.setPalette and ColobriRing.setPalette, so every button and ring on the page shows it.
 * A newer logo to follow (the opening's bird, then the Generate bird) takes over in 0.9 s from the colors on screen; while there is
 * none, the colors stay as they are. A 1.x logo (no looks) is not followed.
 *   ColobriHues.follow(logo)   follow this logo (the newest one followed leads)
 *   ColobriHues.drop(logo)     stop following it (before it is destroyed; a logo whose canvas has left the page is let go anyway)
 *   ColobriHues.show(look, next, mix) / release()   hold a look (for tests and screenshots) / follow again
 *   ColobriHues.state()        { look, next, mix, following, palette }
 *   ColobriHues.subscribe(f)   f(palette) with each new palette (the sky behind the bird wears its glow's hue); returns a let-go
 * Copyright (c) 2026 David HJ Lindberg AB. All rights reserved. For use in COLOBRI products.
 */
(function () {
  'use strict';
  const DATA = window.ColobriHuesData;
  if (!DATA || !DATA.original) return;
  const VERSION = '1.0.0';
  // the button's anchors round its pill (colobri-button.js): the front's position along it is measured from these
  const POS = [[-1, 0], [-0.7, -0.97], [-0.3, -1], [0.2, -1], [0.62, -0.95], [1, 0], [0.8, 0.86], [0.45, 1], [0, 1], [-0.42, 1], [-0.72, 0.93]];
  const FRONT = 0.6;          // the share of a change the front takes to cross the pill
  const HANDOVER = 900;       // ms
  // the directions a change travels in, mostly along the pill (degrees; 0 runs from the wing tip to the head)
  const DIRS = [0, 180, 18, 198, 342, 162, 0, 180];

  const sources = [];
  let raf = 0, held = null, shown = null, from = null, fromAt = 0, lead = null, lastKey = '', st = { look: 'original', next: 'original', mix: 0 };

  const pal = name => DATA[String(name)] || DATA.original;
  const sm = t => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const lerp = (a, b, m) => a + (b - a) * m;
  // (hues on the button's unbroken scale blend straight along it: a change between warm and cool passes through violet, as the
  // bird's own warm-meets-cool zones do, and never through the scale's ends)
  const mixHS = (a, b, m) => [lerp(a[0], b[0], m), lerp(a[1], b[1], m)];
  function hash(v) { const s = String(v); let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

  // the colors for a moment of the logo: the look at the heart, the next, and how far (0-1) it has flowed
  function paletteFor(s) {
    const A = pal(s.look), B = pal(s.next), m = +s.mix || 0;
    if (A === B || m <= 0) return { anchors: A.anchors.map(a => a.slice()), glow: A.glow.slice() };
    const ang = DIRS[(hash(s.look) * 3 + hash(s.next)) % DIRS.length] * Math.PI / 180, dx = Math.cos(ang), dy = Math.sin(ang) * 0.5;
    const anchors = A.anchors.map((a, i) => {
      // (0 where the change starts, 1 where it ends; every part is wholly the first look at 0 and wholly the next at 1)
      const f = Math.max(0, Math.min(1, ((POS[i][0] * dx + POS[i][1] * dy) / Math.hypot(dx, dy) + 1) / 2));
      return mixHS(a, B.anchors[i], sm(m * (1 + FRONT) - FRONT * f));
    });
    return { anchors, glow: mixHS(A.glow, B.glow, sm(m)) };
  }
  function blendPal(a, b, k) { return { anchors: a.anchors.map((x, i) => mixHS(x, b.anchors[i], k)), glow: mixHS(a.glow, b.glow, k) }; }
  const subs = [];
  function push(p) {
    [window.ColobriButton, window.ColobriRing].forEach(s => { if (s && typeof s.setPalette === 'function') { try { s.setPalette(p); } catch (e) { /* (next frame) */ } } });
    subs.forEach(f => { try { f(p); } catch (e) { /* (next frame) */ } });
  }
  // (anything else that wears the look's colors, as the sky behind the bird does: called with each new palette; returns a let-go)
  function subscribe(f) { subs.push(f); if (shown) { try { f(shown); } catch (e) { /* (next frame) */ } } return () => { const i = subs.indexOf(f); if (i >= 0) subs.splice(i, 1); }; }

  function current() {
    for (let i = 0; i < sources.length; i++) {
      const l = sources[i];
      if (l && l.canvas && l.canvas.isConnected) return l;
    }
    return null;
  }
  function kick() { if (!raf && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    let s = held, src = null;
    if (!s) {
      src = current();
      if (!src) return;                                       // nothing to follow: the colors stay as they are
      try { s = src.getLook(); } catch (e) { drop(src); kick(); return; }
      if (!s) { kick(); return; }
      if (src !== lead) {                                     // a newer logo leads: hand over from the colors on screen
        if (lead && shown) { from = shown; fromAt = now; }
        lead = src;
      }
    }
    st = { look: s.look, next: s.next, mix: +(+s.mix || 0).toFixed(4) };
    const k = from ? sm((now - fromAt) / HANDOVER) : 1;
    const key = st.look + '>' + st.next + '@' + st.mix + (from ? '/' + k.toFixed(3) : '');
    if (key !== lastKey) {
      lastKey = key;
      let p = paletteFor(st);
      if (from) { p = blendPal(from, p, k); if (k >= 1) from = null; }
      shown = p; push(p);
    }
    if (!held) kick();
  }

  function follow(logo) {
    if (!logo || typeof logo.getLook !== 'function') return false;   // (a 1.x logo has no looks to follow)
    const i = sources.indexOf(logo); if (i >= 0) sources.splice(i, 1);
    sources.unshift(logo); kick();
    return true;
  }
  function drop(logo) { const i = sources.indexOf(logo); if (i >= 0) sources.splice(i, 1); if (lead === logo) lead = null; kick(); }
  function show(look, next, mix) {
    held = { look: look == null ? 'original' : look, next: next == null ? (look == null ? 'original' : look) : next, mix: +mix || 0 };
    from = null; lastKey = ''; tick(performance.now());
  }
  function release() { held = null; lastKey = ''; kick(); }
  function state() { return { look: st.look, next: st.next, mix: st.mix, following: !!current() && !held, held: !!held, palette: shown }; }

  window.ColobriHues = Object.freeze({ follow, drop, show, release, state, paletteFor, subscribe, version: VERSION, looks: Object.keys(DATA) });
})();
