/*
  Andrum's product page: the listening demo, Andrum's picture in the hero, the live window and the dock.

  - The demo is one 16-second loop in two versions, with and without Andrum, decoded once and played
    together in step (Web Audio), so switching between them is instant and seamless.
  - The hero is Andrum's own picture of that loop (spectrum.js), drawn from what the plug-in measured,
    with its readouts: the deepest cut, and how clear the voice is with Andrum and without it. While
    the demo plays, the picture follows the sound; otherwise it runs on silently.
  - The window video is Andrum's own window on the same loop; while the demo plays it follows the sound.

  Nothing here is needed for the page to read well: without WebGL 2 the hero keeps its picture,
  without Web Audio the players hide, and with reduced motion nothing moves by itself.

  The assets' folder comes from <main class="andrum" data-andrum-assets="assets/">.
*/
(function () {
  "use strict";

  const LOOP = 16;        // the demo loop, in seconds
  const START = 11.4;     // where the picture rests (the posters show this moment)
  const RATE = 30;        // Andrum's clarity readings per second, in spectrum.js
  const ASKED = 86;       // the clarity the demo asked for
  const MINUS = "−";

  const root = document.querySelector(".andrum");
  if (!root) return;
  root.classList.add("an-js");
  const ASSETS = (root.getAttribute("data-andrum-assets") || "assets/").replace(/\/?$/, "/");
  const motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const reduced = () => !!(motionQuery && motionQuery.matches);
  const wrap = (t) => ((t % LOOP) + LOOP) % LOOP;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const state = {
    on: true,             // With Andrum (true) or Without (false)
    onAmount: 1,          // the picture's room, 0..1, following `on`
    playing: false, loading: false, cancel: false, failed: false, everPlayed: false,
    motionPaused: false,
    t: START,             // where in the loop we are (seconds)
  };
  let pageVisible = !document.hidden;
  const views = [];
  const render = () => views.forEach((v) => v());

  // ------------------------------------------------------------------------------ the sound
  const AC = window.AudioContext || window.webkitAudioContext;
  const sound = { ctx: null, clips: null, buffers: null, decoding: null, chain: null };
  if (!AC) root.classList.add("no-audio");

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
    return out.buffer;
  }
  function fetchClips() {
    if (!sound.clips) {
      const get = (name) => fetch(ASSETS + "audio/" + name).then((r) => {
        if (!r.ok) throw new Error(name + ": " + r.status);
        return r.arrayBuffer();
      });
      sound.clips = Promise.all([get("demo-with.mp3"), get("demo-without.mp3")]).catch(() =>
        // opened straight from the disk (file://), where fetch isn't allowed: the clips are in a script too
        loadScript(ASSETS + "data/demo-audio.js").then(() =>
          [fromBase64(window.ANDRUM_AUDIO.with), fromBase64(window.ANDRUM_AUDIO.without)]));
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
  /** Fetches and decodes both clips (once). Decoding uses an offline context, so it can happen before
      anyone presses play. */
  function prepare() {
    if (!AC) return Promise.reject(new Error("no Web Audio"));
    if (!sound.decoding) {
      const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      let ctx = sound.ctx;
      if (!ctx && Offline) { try { ctx = new Offline(2, 4800, 48000); } catch (e) { ctx = null; } }
      if (!ctx) return fetchClips();            // decoded at the first press, with the real context
      sound.decoding = fetchClips()
        .then((clips) => Promise.all(clips.map((c) => decodeOne(ctx, c))))
        .then((buffers) => { sound.buffers = buffers; return buffers; });
      sound.decoding.catch(() => { sound.decoding = null; });
    }
    return sound.decoding;
  }

  function play(from) {
    if (!AC || state.playing) return;
    if (state.loading) { state.cancel = false; return; }
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* older Safari */ }
    if (!sound.ctx) {
      try { sound.ctx = new AC({ latencyHint: "playback" }); } catch (e) { sound.ctx = new AC(); }
    }
    const ctx = sound.ctx;
    // still inside the press: wake the context up and play a moment of silence (iOS needs both)
    if (ctx.state !== "running") ctx.resume();
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    blip.connect(ctx.destination);
    blip.start();
    if (typeof from === "number" && isFinite(from)) state.t = wrap(from);
    state.failed = false; state.cancel = false;
    state.loading = !sound.buffers;
    render();
    const go = () => {
      state.loading = false;
      if (state.cancel) { state.cancel = false; render(); return; }
      start(state.t);
      state.playing = true; state.everPlayed = true;
      render(); wake();
    };
    if (sound.buffers) { go(); return; }
    prepare().then((buffers) => {
      if (!sound.buffers) {
        // decoded with the real context (no offline one): do it now
        return Promise.all(buffers.map((c) => decodeOne(ctx, c))).then((b) => { sound.buffers = b; go(); });
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

  /** Where in the loop the listener is now (what comes out of the speakers, not what is being mixed). */
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
  let clarityWith = null, clarityWithout = null;
  function readClarity() {
    if (clarityWith || !window.ANDRUM_SPECTRUM) return;
    clarityWith = new Uint8Array(fromBase64(window.ANDRUM_SPECTRUM.clarityWith));
    clarityWithout = new Uint8Array(fromBase64(window.ANDRUM_SPECTRUM.clarityWithout));
  }
  function clarityAt(t, on) {
    const a = on ? clarityWith : clarityWithout;
    if (!a || !a.length) return on ? 84 : 41;        // the loop's averages, until the readings arrive
    const p = wrap(t) * RATE, i = Math.floor(p) % a.length, f = p - Math.floor(p);
    return a[i] + (a[(i + 1) % a.length] - a[i]) * f;
  }

  // ------------------------------------------------------------------------------ the players
  const video = root.querySelector(".an-window__video");
  const hint = root.querySelector("[data-an-hint]");
  const hintText = hint ? hint.textContent : "";
  root.querySelectorAll("[data-an-player]").forEach((el) => {
    const button = el.querySelector("[data-an-play]");
    const radios = Array.prototype.slice.call(el.querySelectorAll("[data-an-ab]"));
    const followsVideo = el.hasAttribute("data-an-follow-video");
    if (button) {
      button.addEventListener("click", () => {
        if (state.playing || state.loading) pause();
        else play(followsVideo && video && video.readyState >= 2 ? video.currentTime : undefined);
      });
      ["pointerenter", "focus", "touchstart"].forEach((type) =>
        button.addEventListener(type, () => { prepare().catch(() => {}); }, { once: true, passive: true }));
    }
    radios.forEach((radio) => {
      radio.addEventListener("click", () => setOn(radio.getAttribute("data-an-ab") === "with"));
      radio.addEventListener("keydown", (e) => {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(e.key) < 0) return;
        e.preventDefault();
        const next = radios[(radios.indexOf(radio) + 1) % radios.length];
        setOn(next.getAttribute("data-an-ab") === "with");
        next.focus();
      });
    });
    views.push(() => {
      el.classList.toggle("is-playing", state.playing);
      el.classList.toggle("is-loading", state.loading);
      if (button) {
        button.setAttribute("aria-label", state.loading ? "Loading the demo, press to cancel"
          : state.playing ? "Pause the demo" : "Play the demo");
      }
      radios.forEach((radio) => {
        const selected = (radio.getAttribute("data-an-ab") === "with") === state.on;
        radio.setAttribute("aria-checked", selected ? "true" : "false");
        radio.tabIndex = selected ? 0 : -1;
      });
    });
  });
  views.push(() => {
    if (!hint) return;
    hint.textContent = state.failed ? "The demo didn't load. Check your connection and press play again." : hintText;
    hint.parentNode.classList.toggle("is-error", state.failed);
  });

  // ------------------------------------------------------------------------------ the instrument
  const instEl = root.querySelector("[data-an-inst]");
  const inst = {
    el: instEl,
    stage: instEl ? instEl.querySelector("[data-an-stage]") : null,
    canvas: instEl ? instEl.querySelector(".an-inst__canvas") : null,
    bar: instEl ? instEl.querySelector("[data-an-bar]") : null,
    sp: null, visible: true, dirty: true, slow: 0, drawn: 0, scale: 1, w: 0, h: 0, px: 1,
    hover: null,            // { x, y } in CSS px over the stage, while the pointer is there
    hoverA: 0,
  };
  const readout = {
    deepest: instEl ? instEl.querySelector("[data-an-deepest]") : null,
    kc: instEl ? { with: instEl.querySelector('[data-an-kc="with"]'), without: instEl.querySelector('[data-an-kc="without"]') } : null,
    kcBar: instEl ? { with: instEl.querySelector('[data-an-kc-bar="with"]'), without: instEl.querySelector('[data-an-kc-bar="without"]') } : null,
    hold: 0, timer: 0, shown: null, since: 1,
    smooth: { with: null, without: null }, kcShown: { with: null, without: null }, kcSince: 1,
  };
  const bubble = {
    el: instEl ? instEl.querySelector("[data-an-hover]") : null,
    hz: instEl ? instEl.querySelector("[data-an-hover-hz]") : null,
    voice: instEl ? instEl.querySelector("[data-an-hover-voice]") : null,
    music: instEl ? instEl.querySelector("[data-an-hover-music]") : null,
  };

  function instInit() {
    if (!inst.canvas || !window.AndrumSpectrum || !window.ANDRUM_SPECTRUM) return;
    try {
      inst.sp = new window.AndrumSpectrum(inst.canvas, window.ANDRUM_SPECTRUM);
    } catch (e) {
      inst.sp = null;                       // no WebGL 2: the poster stays
      return;
    }
    inst.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      inst.sp = null;
      instEl.classList.remove("is-live");
    });
    inst.scale = Math.min(window.devicePixelRatio || 1, 2);
    instLayout();
    if (window.ResizeObserver) new ResizeObserver(instLayout).observe(inst.stage);
    else window.addEventListener("resize", instLayout);
    if (window.IntersectionObserver) {
      new IntersectionObserver((entries) => {
        inst.visible = entries[entries.length - 1].isIntersecting;
        if (inst.visible) { inst.dirty = true; wake(); }
      }).observe(inst.stage);
    }
    hoverInit();
    inst.dirty = true;
    wake();
  }

  /** The graph sits under the readouts' row and stands on the stage's lower edge; its scale follows
      its height, as if the window's picture were drawn this tall. */
  function instLayout() {
    if (!inst.sp) return;
    const r = inst.stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const s = Math.min(inst.scale, Math.sqrt(5e6 / (r.width * r.height)), 4096 / r.width);
    const top = inst.bar ? inst.bar.offsetHeight + 8 : 100;
    const bottom = r.height - 1;
    const unit = clamp((bottom - top) / window.AndrumSpectrum.DESIGN_GRAPH_H, 0.8, 1.6);
    const lineUnit = clamp(Math.sqrt(unit), 0.95, 1.22);
    inst.sp.resize(r.width * s, r.height * s, s);
    inst.sp.layout({ top: top, bottom: bottom, fLo: 20, fHi: 20480, unit: unit, lineUnit: lineUnit });
    inst.stage.style.setProperty("--ring", (16 * lineUnit + 1).toFixed(1) + "px");
    inst.w = r.width; inst.h = r.height; inst.px = s; inst.top = top; inst.bottom = bottom;
    inst.dirty = true;
    wake();
  }

  function instDraw(dt) {
    const hover = inst.hover && inst.hoverA > 0 ? { x: inst.hover.x, a: inst.hoverA } : null;
    inst.sp.frame(state.t, state.onAmount, hover);
    inst.dirty = false;
    // if frames keep taking longer than 1/36 s, draw fewer pixels (after the first second's warm-up)
    inst.drawn++;
    if (inst.drawn > 60 && dt > 1 / 36) inst.slow++; else inst.slow = Math.max(0, inst.slow - 1);
    if (inst.slow > 40 && inst.scale > 0.6) { inst.scale *= 0.8; inst.slow = 0; instLayout(); }
    if (!instEl.classList.contains("is-live")) requestAnimationFrame(() => instEl.classList.add("is-live"));
  }

  // ---- the readouts
  const fmt1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  function updateReadouts(dt) {
    let moving = false;
    if (readout.deepest && inst.sp) {
      // the window's hold: a new peak shows at once; a lower one only after 1.2 s, and then eases down
      const peak = inst.sp.read(state.t, state.onAmount).deepest;
      if (!state.on) { readout.hold = peak; readout.timer = 0; }      // without Andrum there is no cut to hold
      readout.timer += dt;
      if (peak >= readout.hold || readout.timer > 1.2) {
        const k = peak >= readout.hold ? 1 : 1 - Math.pow(0.85, dt * 60);
        readout.hold += (peak - readout.hold) * k;
        if (peak >= readout.hold) readout.timer = 0;
      }
      readout.since += dt;
      const text = readout.hold > 0.05 ? MINUS + fmt1(readout.hold) : "0.0";
      if (text !== readout.shown && readout.since > 0.06) { readout.deepest.textContent = text; readout.shown = text; readout.since = 0; }
      if (Math.abs(peak - readout.hold) > 0.05) moving = true;
    }
    if (readout.kc) {
      readout.kcSince += dt;
      const show = readout.kcSince > 0.1;
      ["with", "without"].forEach((k) => {
        const target = clarityAt(state.t, k === "with");
        const m = readout.smooth;
        if (m[k] === null) m[k] = target;
        m[k] += (target - m[k]) * (1 - Math.exp(-dt / 0.2));
        if (Math.abs(target - m[k]) > 0.3) moving = true;
        const v = Math.round(m[k]);
        if (show && v !== readout.kcShown[k] && readout.kc[k]) { readout.kc[k].textContent = String(v); readout.kcShown[k] = v; }
        if (readout.kcBar[k]) readout.kcBar[k].style.transform = "scaleX(" + clamp(m[k] / 100, 0, 1).toFixed(4) + ")";
      });
      if (show) readout.kcSince = 0;
    }
    return moving;
  }

  // ---- the hover bubble: what the window's own bubble says under the mouse
  function formatHz(hz) {
    if (hz >= 1000) {
      const k = hz / 1000;
      return (k >= 10 ? k.toFixed(1) : k.toFixed(2)).replace(/0+$/, "").replace(/\.$/, "") + " kHz";
    }
    return Math.round(hz) + " Hz";
  }
  function hoverInit() {
    const stage = inst.stage;
    const move = (e) => {
      const r = stage.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const inGraph = x >= 0 && x <= r.width && y >= (inst.top || 0) - 10 && y <= r.height;
      const overBar = inst.bar && e.target && inst.bar.contains(e.target) && e.target !== inst.bar;
      if (!inGraph || overBar) { leave(); return; }
      inst.hover = { x: x, y: y };
      wake();
    };
    const leave = () => { if (inst.hover) { inst.hover = null; wake(); } };
    stage.addEventListener("pointermove", (e) => { if (e.pointerType !== "touch" || e.buttons) move(e); });
    stage.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") move(e); });
    stage.addEventListener("pointerleave", leave);
    stage.addEventListener("pointerup", (e) => { if (e.pointerType === "touch") leave(); });
    stage.addEventListener("pointercancel", leave);
  }
  function updateHover(dt) {
    const want = inst.hover ? 1 : 0;
    const prev = inst.hoverA;
    inst.hoverA = want ? Math.min(1, prev + dt / 0.12) : Math.max(0, prev - dt / 0.15);
    if (!bubble.el || !inst.sp) return inst.hoverA !== prev;
    bubble.el.classList.toggle("is-shown", !!inst.hover);
    if (inst.hover) {
      const h = inst.hover;
      const info = inst.sp.inspect(state.t, state.onAmount, h.x);
      bubble.hz.textContent = formatHz(info.hz);
      const silent = info.key < -110;
      bubble.voice.textContent = "Voice " + (silent ? "silent" : MINUS + Math.round(Math.abs(info.key)) + " dB")
        + (!silent && info.keep < 0.95 ? ", " + Math.round((1 - info.keep) * 100) + " % left out" : "");
      const untouched = Math.abs(info.cut) < 0.05;
      bubble.music.textContent = untouched ? "Music untouched" : "Music down " + fmt1(Math.abs(info.cut)) + " dB";
      bubble.music.classList.toggle("is-untouched", untouched);
      const bw = bubble.el.offsetWidth, bh = bubble.el.offsetHeight;
      let bx = h.x + 16;
      if (bx + bw > inst.w - 8) bx = h.x - 16 - bw;
      const by = clamp(h.y - bh / 2, (inst.top || 0) + 4, inst.h - bh - 26);
      bubble.el.style.transform = "translate(" + Math.round(bx) + "px," + Math.round(by) + "px)";
    }
    return inst.hoverA !== prev;
  }

  views.push(() => { if (instEl) instEl.classList.toggle("is-off", !state.on); });

  // ------------------------------------------------------------------------------ the window video
  const videoToggle = root.querySelector("[data-an-video-toggle]");
  // "auto": plays while on screen (with reduced motion, only while the demo plays); or as the visitor chose
  const vid = { near: false, visible: false, mode: "auto" };

  function updateVideo() {
    if (!video) return;
    const auto = state.playing || !reduced();
    const want = vid.visible && pageVisible && (vid.mode === "playing" || (vid.mode === "auto" && auto));
    if (want && video.paused) {
      if (state.playing) video.currentTime = state.t;
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    } else if (!want && !video.paused) {
      video.pause();
    }
    if (videoToggle) {
      const paused = vid.mode === "paused" || (vid.mode === "auto" && !auto);
      videoToggle.setAttribute("aria-label", paused ? "Play the window video" : "Pause the window video");
      videoToggle.classList.toggle("is-paused", paused);
    }
  }

  function syncVideo() {
    if (!video || !state.playing || video.paused || video.readyState < 2) return;
    let d = video.currentTime - state.t;
    if (d > LOOP / 2) d -= LOOP;
    if (d < -LOOP / 2) d += LOOP;
    if (Math.abs(d) > 0.12) video.currentTime = state.t;
  }

  if (video && window.IntersectionObserver) {
    new IntersectionObserver((entries) => {
      if (entries[entries.length - 1].isIntersecting && !vid.near) {
        vid.near = true;
        video.preload = "auto";
      }
    }, { rootMargin: "600px 0px" }).observe(video);
    new IntersectionObserver((entries) => {
      vid.visible = entries[entries.length - 1].isIntersecting;
      updateVideo();
    }, { threshold: 0.25 }).observe(video);
  }
  if (videoToggle) {
    videoToggle.addEventListener("click", () => {
      vid.mode = videoToggle.classList.contains("is-paused") ? "playing" : "paused";
      updateVideo();
    });
  }
  views.push(updateVideo);

  // ------------------------------------------------------------------------------ pausing the picture
  const motionButton = root.querySelector("[data-an-motion]");
  if (motionButton) {
    motionButton.addEventListener("click", () => {
      state.motionPaused = !state.motionPaused;
      render(); wake();
    });
    views.push(() => {
      motionButton.hidden = reduced() && !state.playing;
      motionButton.setAttribute("aria-pressed", state.motionPaused ? "true" : "false");
      motionButton.textContent = state.motionPaused ? "Move the picture" : "Pause the picture";
    });
  }

  // ------------------------------------------------------------------------------ the dock
  // Once the demo has been played, a small dock keeps it (and the download) in reach while no player is
  // on screen, until the price comes into view.
  const dock = root.querySelector("[data-an-dock]");
  if (dock && window.IntersectionObserver) {
    const players = Array.prototype.slice.call(root.querySelectorAll(".an-inst [data-an-player], .an-window"));
    const heroButtons = root.querySelector(".an-hero .an-actions");
    const price = root.querySelector(".an-price") || root.querySelector(".an-final");
    const setDock = (show) => {
      dock.classList.toggle("is-shown", show);
      if ("inert" in dock) dock.inert = !show; else dock.setAttribute("aria-hidden", show ? "false" : "true");
    };
    const onScreen = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; };
    const updateDock = () => {
      const pastHero = heroButtons && heroButtons.getBoundingClientRect().bottom < 0;
      const atPrice = price && price.getBoundingClientRect().top < window.innerHeight;
      setDock(state.everPlayed && !!pastHero && !atPrice && !players.some(onScreen));
    };
    setDock(false);
    dock.hidden = false;
    const io = new IntersectionObserver(updateDock);
    players.concat([heroButtons, price]).filter(Boolean).forEach((w) => io.observe(w));
    views.push(updateDock);
  }

  // ------------------------------------------------------------------------------ the clock
  // (For films of the page, source/tools/record_hero.py sets window.ANDRUM_CAPTURE before this runs and
  // then steps the clock itself, one frame at a time: AndrumCapture.step(ms).)
  const capture = window.ANDRUM_CAPTURE ? { now: 0 } : null;
  const schedule = (fn) => { if (!capture) requestAnimationFrame(fn); };
  let running = false, last = 0;
  function wake() {
    if (running || capture) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }
  if (capture) {
    window.AndrumCapture = {
      step: function (ms) { last = capture.now; capture.now += ms; tick(capture.now); return state.t; },
    };
  }
  function tick(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    const moving = !state.motionPaused && !reduced();
    const live = !!inst.sp && inst.visible && pageVisible;
    if (state.playing) state.t = soundTime();
    else if (moving && live) state.t = wrap(state.t + dt);
    const target = state.on ? 1 : 0;
    const easing = Math.abs(state.onAmount - target) > 0.002;
    if (easing) state.onAmount = reduced() ? target : state.onAmount + (target - state.onAmount) * (1 - Math.exp(-dt / 0.09));
    else state.onAmount = target;
    const hovering = updateHover(dt) || !!inst.hover;
    const animating = live && (moving || state.playing);
    if (live && (animating || easing || inst.dirty || hovering)) instDraw(dt);
    const readoutsMoving = updateReadouts(dt);
    syncVideo();
    if (animating || (live && easing) || state.playing || readoutsMoving || hovering) schedule(tick);
    else running = false;
  }

  document.addEventListener("visibilitychange", () => {
    pageVisible = !document.hidden;
    if (!pageVisible && state.playing) pause();
    updateVideo();
    if (pageVisible) { inst.dirty = true; wake(); }
  });
  if (motionQuery) {
    const onChange = () => { inst.dirty = true; render(); wake(); };
    if (motionQuery.addEventListener) motionQuery.addEventListener("change", onChange);
    else if (motionQuery.addListener) motionQuery.addListener(onChange);
  }

  // ------------------------------------------------------------------------------ start
  render();
  // the picture's renderer and Andrum's measurements load after the page (the poster stands in until then)
  const need = (src, ready) => (ready() ? Promise.resolve() : loadScript(ASSETS + src));
  Promise.all([need("js/spectrum.js", () => !!window.AndrumSpectrum), need("data/spectrum.js", () => !!window.ANDRUM_SPECTRUM)])
    .then(() => {
      readClarity();
      const go = () => setTimeout(instInit, 0);
      if (document.readyState === "complete") go(); else window.addEventListener("load", go, { once: true });
      wake();
    }, () => { /* no picture: the poster stays */ });
  // fetch the demo in the background once the page has settled, unless the visitor saves data
  const conn = navigator.connection || {};
  if (AC && !conn.saveData && !/(^|-)2g$/.test(conn.effectiveType || "")) {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2500));
    window.addEventListener("load", () => idle(() => prepare().catch(() => {}), { timeout: 5000 }), { once: true });
  }
})();
