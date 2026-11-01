/*
  Andrum's product page: the picture in the hero, the demo you can hear with and without Andrum,
  and the readouts beside it.

  - The demo is one 16-second loop in two versions, with and without Andrum, decoded once and played
    together in step (Web Audio), so switching between them is instant and seamless.
  - The picture is Andrum's own picture of that loop (aurora.js), drawn from what the plug-in measured
    while it ran on it. While the demo plays, the picture follows the sound; otherwise it runs on
    silently.
  - The readouts are the window's: the deepest cut, held the way the window holds it, and how clear
    the voice is, with Andrum or without it.

  Nothing here is needed for the page to read well: without WebGL 2 the picture's poster stays,
  without Web Audio the Listen button hides, and with reduced motion the picture stands still until
  Listen is pressed.

  The assets' folder comes from <main class="andrum" data-andrum-assets="assets/">.
*/
(function () {
  "use strict";

  const LOOP = 16;          // the demo loop, in seconds
  const START = 11.4;       // where the picture rests (the poster shows this moment)
  const MINUS = "−";

  const root = document.querySelector(".andrum");
  if (!root) return;
  const ASSETS = (root.getAttribute("data-andrum-assets") || "assets/").replace(/\/?$/, "/");
  const motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const reduced = () => !!(motionQuery && motionQuery.matches);
  const wrap = (t) => ((t % LOOP) + LOOP) % LOOP;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const state = {
    on: true,               // With Andrum (true) or Without (false)
    onAmount: 1,            // the picture's room, 0..1, easing toward `on`
    playing: false, loading: false, cancel: false, failed: false,
    motionPaused: false,    // the visitor stopped the silent picture
    t: START,               // where in the loop we are (seconds)
  };
  let pageVisible = !document.hidden;
  const views = [];
  const render = () => views.forEach((v) => v());

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.async = true; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function fromBase64(text) {
    const bin = atob(text), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ------------------------------------------------------------------------------ the sound
  const AC = window.AudioContext || window.webkitAudioContext;
  const sound = { ctx: null, clips: null, buffers: null, decoding: null, chain: null };
  if (!AC) root.classList.add("no-audio");

  function fetchClips() {
    if (!sound.clips) {
      const get = (name) => fetch(ASSETS + "audio/" + name).then((r) => {
        if (!r.ok) throw new Error(name + ": " + r.status);
        return r.arrayBuffer();
      });
      sound.clips = Promise.all([get("demo-with.mp3"), get("demo-without.mp3")]).catch(() =>
        // opened straight from the disk (file://), where fetch isn't allowed: the clips are in a script too
        loadScript(ASSETS + "data/demo-audio.js").then(() =>
          [fromBase64(window.ANDRUM_AUDIO.with).buffer, fromBase64(window.ANDRUM_AUDIO.without).buffer]));
      sound.clips.catch(() => { sound.clips = null; });
    }
    return sound.clips;
  }
  function decodeOne(ctx, data) {
    return new Promise((resolve, reject) => {
      const p = ctx.decodeAudioData(data, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
  }
  /** Fetches and decodes both clips, once. Decoding uses an offline context, so it can happen before
      anyone presses Listen. */
  function prepare() {
    if (!AC) return Promise.reject(new Error("no Web Audio"));
    if (!sound.decoding) {
      const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      let ctx = sound.ctx;
      if (!ctx && Offline) { try { ctx = new Offline(2, 4800, 48000); } catch (e) { ctx = null; } }
      if (!ctx) return fetchClips();            // decoded at the first press, with the real context
      sound.decoding = fetchClips()
        .then((clips) => Promise.all(clips.map((c) => decodeOne(ctx, c.slice(0)))))
        .then((buffers) => { sound.buffers = buffers; return buffers; });
      sound.decoding.catch(() => { sound.decoding = null; });
    }
    return sound.decoding;
  }

  function play() {
    if (!AC || state.playing) return;
    if (state.loading) { state.cancel = false; return; }
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* older Safari */ }
    if (!sound.ctx) {
      try { sound.ctx = new AC({ latencyHint: "playback" }); } catch (e) { sound.ctx = new AC(); }
    }
    const ctx = sound.ctx;
    // still inside the press: wake the context and play a moment of silence (iOS needs both)
    if (ctx.state !== "running") ctx.resume();
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    blip.connect(ctx.destination);
    blip.start();
    state.failed = false; state.cancel = false;
    state.loading = !sound.buffers;
    render();
    const go = () => {
      state.loading = false;
      if (state.cancel) { state.cancel = false; render(); return; }
      start(state.t);
      state.playing = true;
      render(); wake();
    };
    if (sound.buffers) { go(); return; }
    prepare().then((buffers) => {
      if (!sound.buffers) {
        // there was no offline context to decode with: decode with the real one now
        return Promise.all(buffers.map((c) => decodeOne(ctx, c.slice(0)))).then((b) => { sound.buffers = b; go(); });
      }
      go();
    }).catch(() => {
      state.loading = false; state.failed = true; render();
    });
  }

  function start(T) {
    const ctx = sound.ctx;
    const when = ctx.currentTime + 0.04;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(1, when + 0.05);
    out.connect(ctx.destination);
    const gains = [ctx.createGain(), ctx.createGain()];          // with, without
    gains[0].gain.value = state.on ? 1 : 0;
    gains[1].gain.value = state.on ? 0 : 1;
    gains.forEach((g) => g.connect(out));
    const offset = 0.5 + wrap(T);                                // the clips keep half a second either side
    const sources = sound.buffers.map((buffer, i) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true; src.loopStart = 0.5; src.loopEnd = 0.5 + LOOP;
      src.connect(gains[i]);
      src.start(when, offset);
      return src;
    });
    sound.chain = { out: out, gains: gains, sources: sources, when: when, T: wrap(T) };
  }

  function stop() {
    const c = sound.chain;
    if (!c) return;
    const now = sound.ctx.currentTime;
    c.out.gain.cancelScheduledValues(now);
    c.out.gain.setValueAtTime(c.out.gain.value, now);
    c.out.gain.linearRampToValueAtTime(0, now + 0.06);
    c.sources.forEach((s) => { try { s.stop(now + 0.08); } catch (e) { /* already stopped */ } });
    setTimeout(() => { try { c.out.disconnect(); } catch (e) { /* gone */ } }, 400);
    sound.chain = null;
  }

  /** Where in the loop the listener is now: what comes out of the speakers, not what is being mixed. */
  function soundTime() {
    const c = sound.chain, ctx = sound.ctx;
    const latency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    return wrap(c.T + Math.max(0, ctx.currentTime - latency - c.when));
  }

  function pause() {
    if (state.loading) { state.cancel = true; state.loading = false; render(); return; }
    if (!state.playing) return;
    state.t = soundTime();
    stop();
    state.playing = false;
    render(); wake();
  }

  function setOn(on) {
    if (state.on === on) return;
    state.on = on;
    const c = sound.chain;
    if (c) {
      const now = sound.ctx.currentTime;
      c.gains.forEach((g, i) => {
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime((i === 0) === on ? 1 : 0, now, 0.03);
      });
    }
    render(); wake();
  }

  // ------------------------------------------------------------------------------ Andrum's clarity readings
  let clarity = null;
  function readClarity(d) {
    if (!d || !d.clarityWith) return;
    clarity = { with: fromBase64(d.clarityWith), without: fromBase64(d.clarityWithout), rate: d.clarityRate || 30 };
  }
  function clarityAt(t, on) {
    const a = clarity && (on ? clarity.with : clarity.without);
    if (!a || !a.length) return null;
    const p = wrap(t) * clarity.rate, i = Math.floor(p) % a.length, f = p - Math.floor(p);
    return a[i] + (a[(i + 1) % a.length] - a[i]) * f;
  }

  // ------------------------------------------------------------------------------ the picture
  const pic = {
    el: root.querySelector("[data-picture]"),
    canvas: null, a: null, live: false, visible: true, dirty: true,
    scale: Math.min(window.devicePixelRatio || 1, 2), slow: 0, drawn: 0,
  };
  pic.canvas = pic.el ? pic.el.querySelector("canvas") : null;

  /** The graph fills the picture, its top (-10 dB, which the demo never reaches: its loudest band
      stands an eighth of the way down) a little above the picture's own; the light settles into the
      night toward the lower edge. Its scale follows its height, as if the window's picture were drawn
      that tall. (The posters are this picture, at START, drawn by this page.) */
  function layoutFor(w, h) {
    const top = -Math.round(h * 0.03), bottom = h;
    const unit = clamp((bottom - top) / window.AndrumAurora.DESIGN_GRAPH_H, 0.75, 1.9);
    return { top: top, bottom: bottom, fLo: 20, fHi: 20480, unit: unit, lineUnit: clamp(Math.sqrt(unit), 0.9, 1.3),
             veil: false, limits: false, fade: h * 0.46 };
  }

  function picInit() {
    if (!pic.canvas || !window.AndrumAurora || !window.ANDRUM_SPECTRUM) return;
    try {
      pic.a = new window.AndrumAurora(pic.canvas, window.ANDRUM_SPECTRUM);
    } catch (e) {
      pic.a = null;                         // no WebGL 2: the poster stays
      return;
    }
    pic.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      pic.a = null; pic.live = false;
      root.classList.remove("an-gl");
      render();
    });
    picLayout();
    if (window.ResizeObserver) new ResizeObserver(picLayout).observe(pic.el);
    else window.addEventListener("resize", picLayout);
    if (window.IntersectionObserver) {
      new IntersectionObserver((entries) => {
        pic.visible = entries[entries.length - 1].isIntersecting;
        if (pic.visible) { pic.dirty = true; wake(); }
      }).observe(pic.el);
    }
    pic.dirty = true;
    wake();
  }

  function picLayout() {
    if (!pic.a) return;
    const r = pic.el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const s = Math.min(pic.scale, Math.sqrt(4.5e6 / (r.width * r.height)), 4096 / r.width);
    pic.a.resize(r.width * s, r.height * s, s);
    pic.a.layout(layoutFor(r.width, r.height));
    pic.dirty = true;
    wake();
  }

  function picDraw(dt) {
    pic.a.frame(state.t, state.onAmount);
    pic.dirty = false;
    if (!pic.live) {
      // shown once the first frame is in: the canvas comes in over the poster
      pic.live = true;
      requestAnimationFrame(() => { root.classList.add("an-gl"); render(); });
    }
    // if frames keep taking longer than 1/36 s, draw fewer pixels (after the first second's warm-up)
    pic.drawn++;
    if (pic.drawn > 60 && dt > 1 / 36) pic.slow++; else pic.slow = Math.max(0, pic.slow - 1);
    if (pic.slow > 40 && pic.scale > 0.6) { pic.scale *= 0.8; pic.slow = 0; picLayout(); }
  }

  // ------------------------------------------------------------------------------ the readouts
  const read = {
    deepest: root.querySelector("[data-deepest]"),
    clarity: root.querySelector("[data-clarity]"),
    hold: null, timer: 0, since: 1, shown: null,
    smooth: null, cSince: 1, cShown: null,
  };
  const fmt1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const setNumber = (el, text) => { if (el && el.firstChild) el.firstChild.nodeValue = text; };

  function updateReadouts(dt) {
    let moving = false;
    if (read.deepest && pic.a) {
      // the window's hold: a deeper cut shows at once; a shallower one only after 1.2 s, and then eases up
      const peak = pic.a.read(state.t, state.on ? state.onAmount : 0).deepest;   // Without: no cut, at once
      if (read.hold === null || !state.on) { read.hold = peak; read.timer = 0; }
      read.timer += dt;
      if (peak >= read.hold || read.timer > 1.2) {
        const k = peak >= read.hold ? 1 : 1 - Math.pow(0.85, dt * 60);
        read.hold += (peak - read.hold) * k;
        if (peak >= read.hold) read.timer = 0;
      }
      read.since += dt;
      const text = read.hold > 0.05 ? MINUS + fmt1(read.hold) : "0.0";
      if (text !== read.shown && read.since > 0.06) { setNumber(read.deepest, text); read.shown = text; read.since = 0; }
      if (Math.abs(peak - read.hold) > 0.05) moving = true;
    }
    const target = clarityAt(state.t, state.on);
    if (read.clarity && target !== null) {
      if (read.smooth === null) read.smooth = target;
      read.smooth += (target - read.smooth) * (1 - Math.exp(-dt / 0.2));
      if (Math.abs(target - read.smooth) > 0.3) moving = true;
      read.cSince += dt;
      const v = String(Math.round(read.smooth));
      if (v !== read.cShown && read.cSince > 0.1) { setNumber(read.clarity, v); read.cShown = v; read.cSince = 0; }
    }
    return moving;
  }

  // ------------------------------------------------------------------------------ the player
  const player = root.querySelector("[data-player]");
  const playButton = root.querySelector("[data-play]");
  const playLabel = root.querySelector("[data-play-label]");
  const radios = Array.prototype.slice.call(root.querySelectorAll("[data-ab]"));
  const note = root.querySelector("[data-player-note]");

  if (playButton) {
    playButton.addEventListener("click", () => {
      if (state.playing || state.loading) pause(); else play();
    });
    ["pointerenter", "focus", "touchstart"].forEach((type) =>
      playButton.addEventListener(type, () => { prepare().catch(() => {}); }, { once: true, passive: true }));
  }
  radios.forEach((radio) => {
    radio.addEventListener("click", () => setOn(radio.getAttribute("data-ab") === "with"));
    radio.addEventListener("keydown", (e) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(e.key) < 0) return;
      e.preventDefault();
      const next = radios[(radios.indexOf(radio) + 1) % radios.length];
      setOn(next.getAttribute("data-ab") === "with");
      next.focus();
    });
  });
  views.push(() => {
    if (player) {
      player.classList.toggle("is-playing", state.playing);
      player.classList.toggle("is-loading", state.loading);
    }
    if (playButton) {
      playButton.setAttribute("aria-label", state.loading ? "Loading the demo. Press to cancel."
        : state.playing ? "Pause the demo" : "Listen to the demo");
    }
    if (playLabel) playLabel.textContent = state.loading ? "Loading" : state.playing ? "Pause" : "Listen";
    radios.forEach((radio) => {
      const selected = (radio.getAttribute("data-ab") === "with") === state.on;
      radio.setAttribute("aria-checked", selected ? "true" : "false");
      radio.tabIndex = selected ? 0 : -1;
    });
    if (note) note.hidden = !state.failed;
  });

  // ------------------------------------------------------------------------------ stopping the picture
  // While nothing plays, the picture runs on by itself; this stops it (and it never runs with reduced motion).
  const motion = root.querySelector("[data-motion]");
  if (motion) {
    motion.addEventListener("click", () => {
      state.motionPaused = !state.motionPaused;
      render(); wake();
    });
    views.push(() => {
      motion.hidden = !pic.live || state.playing || reduced();
      motion.classList.toggle("is-paused", state.motionPaused);
      motion.setAttribute("aria-label", state.motionPaused ? "Play the picture" : "Pause the picture");
    });
  }

  // ------------------------------------------------------------------------------ the download for this computer
  {
    const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    const rows = root.querySelectorAll(".get__row");
    if (/^win/i.test(platform) && rows.length === 2) {
      const mac = rows[0].querySelector(".btn"), win = rows[1].querySelector(".btn");
      if (mac && win) {
        rows[0].parentNode.insertBefore(rows[1], rows[0]);
        mac.classList.replace("btn--primary", "btn--ghost");
        win.classList.replace("btn--ghost", "btn--primary");
      }
    }
  }

  // ------------------------------------------------------------------------------ the clock
  let running = false, last = 0;
  function wake() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }
  function tick(now) {
    const dt = clamp((now - last) / 1000, 0, 0.1);
    last = now;
    const live = !!pic.a && pic.visible && pageVisible;
    const moving = !state.motionPaused && !reduced();
    if (state.playing) state.t = soundTime();
    else if (moving && live) state.t = wrap(state.t + dt);
    const target = state.on ? 1 : 0;
    const easing = Math.abs(state.onAmount - target) > 0.002;
    state.onAmount = easing && !reduced() ? state.onAmount + (target - state.onAmount) * (1 - Math.exp(-dt / 0.09)) : target;
    const animating = live && (moving || state.playing);
    if (live && (animating || easing || pic.dirty)) picDraw(dt);
    const readoutsMoving = updateReadouts(dt);
    if (animating || (live && easing) || state.playing || readoutsMoving) requestAnimationFrame(tick);
    else running = false;
  }

  document.addEventListener("visibilitychange", () => {
    pageVisible = !document.hidden;
    if (!pageVisible && state.playing) pause();
    if (pageVisible) { pic.dirty = true; wake(); }
  });
  if (motionQuery) {
    const onChange = () => { pic.dirty = true; render(); wake(); };
    if (motionQuery.addEventListener) motionQuery.addEventListener("change", onChange);
    else if (motionQuery.addListener) motionQuery.addListener(onChange);
  }

  // ------------------------------------------------------------------------------ start
  render();
  // the picture's renderer and Andrum's measurements (the poster stands in until they're here)
  const need = (src, ready) => (ready() ? Promise.resolve() : loadScript(ASSETS + src));
  Promise.all([need("js/aurora.js", () => !!window.AndrumAurora), need("data/spectrum.js", () => !!window.ANDRUM_SPECTRUM)])
    .then(() => {
      readClarity(window.ANDRUM_SPECTRUM);
      picInit();
      render(); wake();
    }, () => { /* no picture: the poster stays */ });
  // fetch the demo once the page has settled, unless the visitor saves data
  const conn = navigator.connection || {};
  if (AC && !conn.saveData && !/(^|-)2g$/.test(conn.effectiveType || "")) {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2500));
    const later = () => idle(() => prepare().catch(() => {}), { timeout: 5000 });
    if (document.readyState === "complete") later(); else window.addEventListener("load", later, { once: true });
  }
})();
