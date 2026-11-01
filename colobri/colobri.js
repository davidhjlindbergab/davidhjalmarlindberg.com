/* Colobri's page: the bird live in the opening, one frame in its looks, before and after, the gallery, and the sections rising into
   place. The bird is the COLOBRI logo component (colobri-logo.js, as it came); everything else is plain DOM. */
(function () {
  'use strict';
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var touch = window.matchMedia ? window.matchMedia('(hover: none)').matches : false;
  var sm = function (t) { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); };   // (smootherstep)
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var IMG = 'images/';

  // the birds' colors, for the dot beside a look's name
  var BIRD = { Rubythroat: '#c8464b', Firecrown: '#d06a3c', Topaz: '#cf8e3e', Sungem: '#c9ae45', Metaltail: '#8f9a45', Emerald: '#4f9a5b', Sylph: '#3a9a8f',
    Hillstar: '#3b98bd', Sapphirewing: '#4a6fd0', Violetear: '#7656cc', Woodstar: '#a552c1', Coronet: '#a64f8f', Sunangel: '#c4506f', Jacobin: '#8a8a90', Hermit: '#b4b4b8' };
  function dotFor(name) { var c = BIRD[String(name).split(' ')[0]]; return c ? '<span class="dot" style="--sw:' + c + '"></span>' : ''; }

  // ---------------------------------------------------------------------------------------------- the bar
  var bar = $('#bar');
  function onScroll() { if (bar) bar.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ---------------------------------------------------------------------------------------------- the opening
  // The logo as David set it: the live bird alone (round 16), on a clear ground with only its own glow; its light is placed on
  // .hero-mark (1.03 of the bird's width across and 0.63 of it high), so the page's own layout decides where it is. Behind it lies its
  // light, alive (David, 1 Nov, round 16: half again as strong, a really smooth falloff, the bird's own colors and movement): the bird a
  // second time, larger and very soft, in one smooth bell round it (colobri-light.js, the same as in the app), gone well before the
  // page's edges and the opening's foot, so nothing shows as a part or an edge at any size. When the bird is ready it grows from half its
  // size to full over 2 s and its light comes up round it.
  (function hero() {
    var CL = window.ColobriLight;
    var hero = $('.hero'), mark = $('.hero-mark'), box = $('.hero-logo'), scene = $('.hero-scene'), glow = $('.hero-glow'), dith = $('.hero-dither');
    if (!hero || !mark || !box || !scene || !CL) { if (hero) hero.classList.add('live'); return; }
    var BIRD_W = 3378, FIT_W = 4650, FIT_H = 2950, LIGHT_UP = 0.325;
    var MARK_W = 0.76, MARK_CX = 0.517, MARK_CY = 0.489, MARK_AR = 688 / 900;   // (where the bird is in the transparent still, colobri-mark.webp)
    var L = null, logo = null, flat = false, ready = false, intro = true, growing = null;
    var gs = reduce.matches ? 1 : 0.5;   // (while the opening grows the bird: its share of its full size)
    function layout() {
      var h = hero.getBoundingClientRect(), m = mark.getBoundingClientRect(), bw = m.width / 1.03;
      return { w: h.width, h: h.height, bw: bw, cx: m.left - h.left + m.width / 2, cy: m.top - h.top + LIGHT_UP * bw };
    }
    function padFor() { return Math.max(0, Math.min(2, (BIRD_W * Math.min(L.w / FIT_W, L.h / FIT_H) / Math.max(1, L.bw * gs) - 1) / 2)); }
    function posFor() { return [(L.cx + 0.0232 * L.bw) / Math.max(1, L.w), L.cy / Math.max(1, L.h)]; }

    // the light, alive: the bird a second time, 1.6 its size, blurred by 0.22 of its width, at 0.58, in one smooth bell 2.3 bird widths
    // out each way and 1.25 up and down, and in any case gone by the page's edges and the opening's foot (where the page goes on), so it
    // meets the page unseen; it moves as the bird moves and follows the pointer as the bird does (half again as strong as the still
    // light it replaces, measured as in the app)
    var LIGHT_SCALE = 1.6, LIGHT_BLUR = 0.22, LIGHT_A = 0.58, FOOT = 0.86;
    var air = $('.hero-air'), lightBox = null, light = null, syncTimer = 0;
    function reach() { return { rx: Math.max(1, Math.min(2.3 * L.bw, L.cx, L.w - L.cx)), ry: Math.max(1, Math.min(1.25 * L.bw, L.cy, FOOT * L.h - L.cy)) }; }
    function startLight() {
      if (!CL.live || !air || !logo) return;
      lightBox = document.createElement('div'); lightBox.className = 'hero-light'; air.insertBefore(lightBox, air.firstChild);
      light = CL.live(lightBox, { k: 5, scale: LIGHT_SCALE, blurBw: LIGHT_BLUR, motion: 0.6, startTime: 6 });
      if (!light.start(L, gs)) { light.destroy(); light = null; lightBox.remove(); lightBox = null; return; }
      lightBox.style.opacity = LIGHT_A;
      if (logo.canvas) light.follow(logo.canvas);
      syncTimer = setInterval(function () { if (light && logo) light.sync(logo); }, 2500);   // (the two keep one time)
    }
    function stopLight() { clearInterval(syncTimer); if (light) { light.destroy(); light = null; } if (lightBox) { lightBox.remove(); lightBox = null; } }
    // the still light, without WebGL2: the bird's colors made very soft, one bell round the bird at a third of their strength (fetched
    // only when it is needed)
    var glowImg = null, glowTimer = 0, glowOn = false;
    function stillGlow() {
      if (!glow) return;
      if (glowImg) { if (L) paintGlow(); return; }
      glowImg = new Image(); glowImg.onload = function () { if (L) paintGlow(); }; glowImg.src = IMG + 'colobri-aura-glow.webp';
    }
    function paintGlow() {
      if (!glow || !glowImg || !glowImg.naturalWidth || light) return;
      if (CL.glow(glow, glowImg, { w: L.w, h: L.h, cx: L.cx, cy: L.cy, a: 0.32, from: 0, to: 1, rx: 2.3 * L.bw, ry: 1.25 * L.bw, foot: 0.86, cap: 5.2 * L.bw, ground: CL.ground(hero), anchor: true })) glowOn = true;
    }
    if (dith) CL.dither(dith, 'dither');

    // the grow is the logo's own padding (so its haze grows with it and its canvas never shows as a shape); the still grows in CSS
    function opened() {
      if (ready) return; ready = true; hero.classList.add('live');
      if (reduce.matches) { gs = 1; setTimeout(function () { intro = false; }, 700); return; }
      if (flat) { gs = 1; return; }
      growing = CL.grow({ step: function (s) { gs = s; if (logo) logo.setPadding(padFor()); if (light) light.place(L, gs); }, done: function () { gs = 1; intro = false; growing = null; } });
    }
    scene.addEventListener('animationend', function (e) { if (flat && e.animationName === 'hero-grow') intro = false; });

    // without WebGL2: the still of the bird with its glow on a clear ground, on the same light, opening the same way
    var still = null;
    function toFlat() {
      if (flat) return; flat = true; hero.classList.add('flat');
      if (growing) { growing.finish(); growing = null; }
      if (logo) { try { logo.destroy(); } catch (e) { /* (already gone) */ } logo = null; }
      stopLight(); stillGlow();
      still = document.createElement('img'); still.className = 'hero-still'; still.alt = ''; still.src = IMG + 'colobri-mark.webp';
      box.remove(); scene.appendChild(still); place();
      if (still.decode) still.decode().then(opened, opened); else still.onload = opened;
    }
    function place() {
      L = layout();
      hero.style.setProperty('--bird-x', Math.round(L.cx) + 'px'); hero.style.setProperty('--bird-y', Math.round(L.cy) + 'px');
      if (logo) { if (logo.resize) logo.resize(); logo.setPadding(padFor()); logo.setPosition(posFor()); }
      if (light) { light.place(L, gs); CL.bellMask(lightBox, Object.assign({ cx: L.cx, cy: L.cy }, reach())); }
      if (still) { var iw = L.bw / MARK_W, ih = iw * MARK_AR; still.style.width = iw + 'px'; still.style.height = ih + 'px'; still.style.left = (L.cx - MARK_CX * iw) + 'px'; still.style.top = (L.cy - MARK_CY * ih) + 'px'; }
      // (while the window changes size the light stays centred on the bird at the size it was painted, and is painted again after)
      if (glow) CL.at(glow, L.cx, L.cy);
      clearTimeout(glowTimer); glowTimer = setTimeout(paintGlow, glowOn ? 140 : 0);
    }
    L = layout();
    if (window.ColobriLogo && window.ColobriLogo.isSupported()) {
      try {
        logo = window.ColobriLogo.create(box, { background: 'transparent', interactive: true, padding: padFor(), position: posFor(), motion: 0.6, ariaLabel: '', startTime: 6, fadeIn: 0,
          onReady: opened, onError: toFlat });
      } catch (e) { toFlat(); }
      if (logo && !flat) startLight();
    } else toFlat();
    if (!light) stillGlow();
    // (if the bird has not woken in 2.5 s, the page does not wait for it)
    setTimeout(function () { if (!ready) opened(); }, 2500);
    place();
    if ('ResizeObserver' in window) new ResizeObserver(function () { place(); }).observe(hero);
    else window.addEventListener('resize', place);
    window.__cbHero = { logo: function () { return logo; }, layout: function () { return L; }, flat: function () { return flat; }, glow: function () { return glowOn ? glow.width + 'x' + glow.height : ''; },
      light: function () { return light && light.logo ? 'live' : glowOn ? 'still' : ''; }, lightLogo: function () { return light && light.logo; },
      lightOnly: function (on) { [logo && logo.canvas, still].forEach(function (el) { if (el) el.style.opacity = on ? '0' : ''; }); },
      stillLight: function () { stopLight(); stillGlow(); },
      at: function (t) { [logo, light && light.logo].forEach(function (l) { if (l) { l.pause(); l.setTime(t); } }); },   // (for screenshots: one moment)
      ready: function () { return ready; }, intro: function () { return intro; }, gs: function () { return gs; },
      grow: function (ms) { if (growing) growing.hold(ms); }, growOn: function () { if (growing) growing.go(); } };
  })();

  // ---------------------------------------------------------------------------------------------- one frame, many looks
  (function looks() {
    var LOOKS = [
      { name: 'As shot', file: 'l-ungraded' },
      { name: 'Sapphirewing 6:8', file: 'l-sapphirewing-6-8' },
      { name: 'Hillstar 4:7', file: 'l-hillstar-4-7' },
      { name: 'Sylph 5:8', file: 'l-sylph-5-8' },
      { name: 'Violetear 5:6', file: 'l-violetear-5-6' },
      { name: 'Hermit 5:5', file: 'l-hermit-5-5' },
      { name: 'Hillstar 5:7', file: 'l-hillstar-5-7' },
      { name: 'Sylph 5:6', file: 'l-sylph-5-6' }
    ];
    var stage = $('#vStage'), strip = $('#strip'), nameEl = $('#vName'), viewer = $('#viewer');
    if (!stage || !strip) return;
    var layers = [$('.v-a', stage), $('.v-b', stage)], front = 0, cur = -1, want = -1, auto = !reduce.matches, timer = 0, seen = false;
    var srcImg = $('.v-src', stage);
    function size() { var w = stage.getBoundingClientRect().width * (window.devicePixelRatio || 1); return w > 1400 ? 2400 : 1280; }
    function url(i) { return IMG + 'looks/' + LOOKS[i].file + '-' + size() + '.webp'; }
    var btns = LOOKS.map(function (lk, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'look'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false'); b.tabIndex = -1;
      b.innerHTML = '<span class="pic lit"><img src="' + IMG + 'looks/' + lk.file + '-t.webp" alt="" width="400" height="224" loading="lazy" decoding="async"></span><span class="nm' + (i ? ' code' : '') + '">' + lk.name + '</span>';
      b.addEventListener('click', function () { stop(); show(i, false); });
      strip.appendChild(b); return b;
    });
    // the picked look's ring: the Colobri button's light round the picture (colobri-ring.js); without WebGL2 the CSS ring stays
    var rings = btns.map(function (b) { var pic = b.querySelector('.pic'); try { return window.ColobriRing ? window.ColobriRing.create(pic) : null; } catch (e) { return null; } });
    function keep(i) {   // bring the picked look into the strip's view, without moving the page
      var b = btns[i], sr = strip.getBoundingClientRect(), r = b.getBoundingClientRect(), pad = 24;
      if (r.left < sr.left + pad) strip.scrollBy({ left: r.left - sr.left - pad, behavior: reduce.matches ? 'auto' : 'smooth' });
      else if (r.right > sr.right - pad) strip.scrollBy({ left: r.right - sr.right + pad, behavior: reduce.matches ? 'auto' : 'smooth' });
    }
    function show(i, focus) {
      if (i === cur) return; cur = i; want = i;
      btns.forEach(function (b, k) { b.setAttribute('aria-checked', k === i ? 'true' : 'false'); b.tabIndex = k === i ? 0 : -1; });
      rings.forEach(function (r, k) { if (r && r.supported) r.setOn(k === i); });
      if (focus) btns[i].focus({ preventScroll: true });
      keep(i);
      nameEl.innerHTML = (i ? dotFor(LOOKS[i].name) : '') + '<span' + (i ? ' class="code"' : '') + '>' + LOOKS[i].name + '</span>';
      var back = layers[1 - front], u = url(i);
      back.alt = i ? 'The frame graded in ' + LOOKS[i].name + '.' : 'A creature with spiral horns and a pale, patterned face, as shot.';
      var go = function () { if (want !== i) return; back.style.opacity = 1; layers[front].style.opacity = 0; front = 1 - front; };
      if (back.getAttribute('src') === u) { go(); return; }
      back.src = u;
      if (back.decode) back.decode().then(go, go); else back.onload = go;
    }
    layers[1].style.opacity = 0;
    show(1);
    strip.addEventListener('keydown', function (e) {
      var k = e.key, n = btns.length, i = cur;
      if (k === 'ArrowRight' || k === 'ArrowDown') i = (cur + 1) % n; else if (k === 'ArrowLeft' || k === 'ArrowUp') i = (cur - 1 + n) % n; else if (k === 'Home') i = 0; else if (k === 'End') i = n - 1; else return;
      e.preventDefault(); stop(); show(i, true);
    });
    // hold the picture to see the frame as shot
    function hold(on) { if (on && !srcImg.getAttribute('src')) srcImg.src = url(0); stage.classList.toggle('holding', on); if (on) stop(); }
    stage.addEventListener('pointerdown', function (e) { if (e.button) return; hold(true); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { stage.addEventListener(ev, function () { hold(false); }); });
    stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    // while it is in view and no one has touched it, it steps through the looks by itself
    function stop() { auto = false; clearInterval(timer); timer = 0; }
    function step() { show(cur >= LOOKS.length - 1 ? 0 : cur + 1); }
    function preload() { for (var i = 0; i < LOOKS.length; i++) { var im = new Image(); im.decoding = 'async'; im.src = url(i); } }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !seen) { seen = true; setTimeout(preload, 300); }
          if (e.isIntersecting && auto && !timer) timer = setInterval(step, 3400);
          if (!e.isIntersecting && timer) { clearInterval(timer); timer = 0; }
        });
      }, { threshold: 0.55 }).observe(viewer);
    } else preload();
    viewer.addEventListener('keydown', stop);
    window.__cbLooks = { show: function (i) { stop(); show(i); }, cur: function () { return cur; }, count: LOOKS.length };
  })();

  // ---------------------------------------------------------------------------------------------- before and after
  (function compare() {
    var fig = $('#compare'); if (!fig) return;
    var input = $('input', fig), down = false;
    function set(p) { p = Math.max(0, Math.min(100, p)); fig.style.setProperty('--split', p + '%'); if (input) input.value = String(p); }
    function at(e) { var r = fig.getBoundingClientRect(); set((e.clientX - r.left) / r.width * 100); }
    fig.addEventListener('pointerdown', function (e) { if (e.button) return; down = true; at(e); if (e.pointerType !== 'touch') fig.setPointerCapture(e.pointerId); });
    fig.addEventListener('pointermove', function (e) { if (down) at(e); });
    ['pointerup', 'pointercancel'].forEach(function (ev) { fig.addEventListener(ev, function () { down = false; }); });
    if (input) input.addEventListener('input', function () { set(+input.value); });
    set(50);
  })();

  // ---------------------------------------------------------------------------------------------- the gallery
  (function gallery() {
    var GAL = [
      { f: 'h', name: 'Jacobin 5:6', alt: 'Houses with red roofs built on a mossy cliff above a misty valley.', big: true },
      { f: 'a', name: 'Hillstar 5:7', alt: 'A face framed by pale, intricately carved shell forms.' },
      { f: 'd', name: 'Hillstar 5:8', alt: 'Small pink flowers growing from a weathered, porous stone.' }
    ];
    var gal = $('#gal'); if (!gal) return;
    if (touch) { var hh = $('.hint-hover'), ht = $('.hint-touch'); if (hh) hh.hidden = true; if (ht) ht.hidden = false; }
    GAL.forEach(function (g) {
      var fig = document.createElement('figure'); if (g.big) fig.className = 'big';
      fig.tabIndex = 0; fig.setAttribute('role', 'button'); fig.setAttribute('aria-pressed', 'false');
      fig.setAttribute('aria-label', g.name + '. Show the frame as shot.');
      var sizes = g.big ? '(max-width: 1280px) 100vw, 1240px' : '(max-width: 700px) 100vw, 420px';
      var src = function (kind) { return 'srcset="' + IMG + 'gallery/' + g.f + '-' + kind + '-960.webp 960w, ' + IMG + 'gallery/' + g.f + '-' + kind + '-1456.webp 1456w" sizes="' + sizes + '" src="' + IMG + 'gallery/' + g.f + '-' + kind + '-1456.webp"'; };
      fig.innerHTML = '<img ' + src('best') + ' width="1456" height="816" alt="' + g.alt + ' Graded in ' + g.name + '." loading="lazy" decoding="async">' +
        '<img class="src" ' + src('ungraded') + ' width="1456" height="816" alt="" loading="lazy" decoding="async">' +
        '<span class="chip bl"><span class="gr">' + dotFor(g.name) + '<span class="code">' + g.name + '</span></span><span class="as">As shot</span></span>';
      var toggle = function () { var on = !fig.classList.contains('as-shot'); fig.classList.toggle('as-shot', on); fig.setAttribute('aria-pressed', on ? 'true' : 'false'); };
      fig.addEventListener('click', function () { if (touch) toggle(); });
      fig.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      gal.appendChild(fig);
    });
    gal.classList.add('rise');
  })();

  // ---------------------------------------------------------------------------------------------- the bird at the end, made when it is near
  (function endBird() {
    var el = $('#endBird'); if (!el) return;
    var made = false;
    function still() { el.innerHTML = '<img src="' + IMG + 'colobri-mark.webp" alt="">'; }
    function make() {
      if (made) return; made = true;
      if (!(window.ColobriLogo && window.ColobriLogo.isSupported())) { still(); return; }
      try { window.ColobriLogo.create(el, { background: 'transparent', interactive: true, padding: 0.06, motion: 0.6, ariaLabel: '', startTime: 21, onError: still }); } catch (e) { still(); }
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es, o) { if (es.some(function (e) { return e.isIntersecting; })) { o.disconnect(); make(); } }, { rootMargin: '600px 0px' }).observe(el);
    else make();
  })();

  // ---------------------------------------------------------------------------------------------- sections rising into place
  (function rise() {
    var els = document.querySelectorAll('.rise');
    if (!('IntersectionObserver' in window) || reduce.matches) { for (var i = 0; i < els.length; i++) els[i].classList.add('in'); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    for (var j = 0; j < els.length; j++) io.observe(els[j]);
    window.__cbRiseAll = function () { for (var k = 0; k < els.length; k++) els[k].classList.add('in'); };
  })();
})();
