/*
  The Andrum page: the demo at the top, and a phone's way to the trial.

  The demo is 16 seconds of the song from Andrum's ads, going round, three ways: the music untouched, the
  whole track turned down until the voice is as clear as Andrum makes it, and Andrum. The three recordings
  (../audio) share one gain, and the picture is drawn from Andrum's own measurements of the song
  (../data/demo-data.js): the music and the voice in 60 bands 30 times a second, and the cut Andrum made.

  Buying is store.js. The cookie choice and the Meta pixel are pixel.js.
*/
(function () {
  "use strict";

  var doc = document, win = window;
  var reduce = !!(win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches);

  phone();

  var D = win.ANDRUM_DEMO;
  var stage = doc.querySelector("[data-stage]");
  var canvas = doc.querySelector("[data-picture]");
  var g = canvas && canvas.getContext ? canvas.getContext("2d") : null;
  if (!D || !stage || !g) return;

  // ------------------------------------------------------------------------------ the measurements
  var B = D.bands, R = D.rows, RATE = D.rate, LOOP = D.loop, LEAD = D.lead;
  var music, voice, cut;
  (function () {
    var raw = win.atob(D.data), n = B * R;
    function plane(at, scale, offset) {
      var a = new Float32Array(n);
      for (var i = 0; i < n; i++) a[i] = raw.charCodeAt(at + i) / scale - offset;
      return a;
    }
    // the loop goes round, so the smoothing does too (once round to settle, once to write)
    function settle(a, k) {
      for (var b = 0; b < B; b++) {
        var o = b * R, y = a[o + R - 1];
        for (var pass = 0; pass < 2; pass++) for (var r = 0; r < R; r++) { y += (a[o + r] - y) * k; if (pass) a[o + r] = y; }
      }
    }
    music = plane(0, D.level.scale, D.level.offset);
    voice = plane(n, D.level.scale, D.level.offset);
    cut = plane(2 * n, D.cut.scale, 0);
    settle(music, 0.3);
    settle(voice, 0.55);
  })();

  function at(a, b, pos) {                     // band b at loop time pos (seconds), between two rows
    var x = pos * RATE, r0 = Math.floor(x), t = x - r0;
    r0 = ((r0 % R) + R) % R;
    var r1 = r0 + 1 === R ? 0 : r0 + 1, o = b * R;
    return a[o + r0] * (1 - t) + a[o + r1] * t;
  }

  // ------------------------------------------------------------------------------ the three ways
  var WAYS = ["untouched", "ducked", "andrum"];
  var CLEAR = { untouched: D.clarity.without, ducked: D.clarity.ducked, andrum: D.clarity.andrum };
  var MUSIC = { untouched: "as it was", ducked: D.musicDrop.ducked + "\u00a0dB quieter", andrum: D.musicDrop.andrum + "\u00a0dB quieter" };
  var SAYS = {
    untouched: "Untouched. The music covers the voice.",
    ducked: "Turned down " + D.duckDb + "\u00a0dB. The voice comes through, and the song is gone.",
    andrum: "Andrum. The voice is just as clear, and the song is still there."
  };
  var TOUR = [
    { way: "untouched", says: "First, untouched. The music covers the voice." },
    { way: "ducked", says: "Then the whole track turned down " + D.duckDb + "\u00a0dB. The voice comes through, and the song is gone." },
    { way: "andrum", says: "Now Andrum. The voice is just as clear, and the song is still there. Switch between the three yourself." }
  ];
  var TOUR_STEP = 4;                           // seconds on each of the first two: one sung line
  var ROOM = { ducked: "Where the music was", andrum: "The room Andrum makes" };

  var way = "andrum", wDuck = 0, wAndrum = 1, shownClear = CLEAR.andrum;
  var playing = false, busy = false, slow = false, played = false, chose = false, closed = false, tour = null;

  var playButtons = doc.querySelectorAll("[data-play]");
  var playLabel = doc.querySelector("[data-play-label]");
  var wayButtons = doc.querySelectorAll("button[data-way]");
  var clarityOut = doc.querySelectorAll("[data-clarity]");
  var musicOut = doc.querySelector("[data-music]");
  var note = doc.querySelector("[data-note]");
  var roomKey = doc.querySelector("[data-key-room]");
  var dock = doc.querySelector("[data-dock]");
  var view = doc.querySelector("[data-view]") || canvas;

  function say(text) { if (note && note.textContent !== text) note.textContent = text; }

  function setWay(name, says) {
    var from = way;
    way = name;
    stage.setAttribute("data-way", name);
    for (var i = 0; i < wayButtons.length; i++) wayButtons[i].setAttribute("aria-pressed", wayButtons[i].getAttribute("data-way") === name ? "true" : "false");
    if (musicOut) musicOut.textContent = MUSIC[name];
    if (roomKey && ROOM[name]) roomKey.textContent = ROOM[name];
    say(says || SAYS[name]);
    if (playing && from !== name) soundWay(from);
    wake();
  }

  function showPlay() {
    for (var i = 0; i < playButtons.length; i++) {
      var b = playButtons[i];
      b.classList.toggle("is-playing", playing);
      if (busy) b.setAttribute("aria-busy", "true"); else b.removeAttribute("aria-busy");
      if (b.hasAttribute("aria-label")) b.setAttribute("aria-label", playing ? "Pause" : "Listen");
    }
    if (playLabel) playLabel.textContent = playing ? "Pause" : slow ? "Loading" : "Listen";
    showDock();
  }

  for (var i = 0; i < wayButtons.length; i++) wayButtons[i].addEventListener("click", function () {
    chose = true;
    tour = null;
    setWay(this.getAttribute("data-way"));
  });
  for (i = 0; i < playButtons.length; i++) playButtons[i].addEventListener("click", function () {
    if (busy) return;
    if (playing) pause(); else play();
  });

  // ------------------------------------------------------------------------------ the sound
  var FILES = { untouched: "assets/audio/listen-untouched.mp3", ducked: "assets/audio/listen-turned-down.mp3", andrum: "assets/audio/listen-andrum.mp3" };
  var AC = win.AudioContext || win.webkitAudioContext;
  var sound = { mode: "", ctx: null, master: null, bytes: null, buffers: null, sources: [], gains: [], t0: 0, at: 0, tags: null };

  function fetchFiles() {
    if (!sound.bytes) {
      sound.bytes = Promise.all(WAYS.map(function (w) {
        return win.fetch(FILES[w]).then(function (r) { if (!r.ok) throw new Error("audio " + r.status); return r.arrayBuffer(); });
      }));
      sound.bytes.catch(function () { sound.bytes = null; });          // asked again on the next press
    }
    return sound.bytes;
  }
  function decode(ctx, bytes) {
    return new Promise(function (ok, no) {
      var p = ctx.decodeAudioData(bytes.slice(0), ok, no);
      if (p && p.then) p.then(ok, no);
    });
  }
  function within(promise, ms) {
    return new Promise(function (ok, no) {
      var t = win.setTimeout(function () { no(new Error("timeout")); }, ms);
      promise.then(function (v) { win.clearTimeout(t); ok(v); }, function (e) { win.clearTimeout(t); no(e); });
    });
  }

  // Three sources started on the same sample and looped over the same 16 seconds; a way is a gain.
  function startWeb() {
    if (!AC || !win.fetch || !win.Promise) return Promise.reject(new Error("no web audio"));
    if (!sound.ctx) {
      sound.ctx = new AC();
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* a phone's silent switch then mutes it */ }
      sound.master = sound.ctx.createGain();
      sound.master.connect(sound.ctx.destination);
    }
    var ctx = sound.ctx;
    var running = ctx.state === "running" ? Promise.resolve() : within(ctx.resume(), 4000);      // asked for inside the click
    var ready = sound.buffers ? Promise.resolve(sound.buffers) : fetchFiles().then(function (list) {
      return Promise.all(list.map(function (bytes) { return decode(ctx, bytes); }));
    }).then(function (buffers) { sound.buffers = buffers; return buffers; });
    return Promise.all([ready, running]).then(function (got) {
      var buffers = got[0], when = ctx.currentTime + 0.06;
      sound.sources = []; sound.gains = [];
      for (var i = 0; i < WAYS.length; i++) {
        var s = ctx.createBufferSource(), gn = ctx.createGain();
        s.buffer = buffers[i]; s.loop = true; s.loopStart = LEAD; s.loopEnd = LEAD + LOOP;
        gn.gain.value = WAYS[i] === way ? 1 : 0;
        s.connect(gn); gn.connect(sound.master);
        s.start(when, LEAD + sound.at);
        sound.sources.push(s); sound.gains.push(gn);
      }
      var m = sound.master.gain;
      m.cancelScheduledValues(0); m.setValueAtTime(0, ctx.currentTime); m.setValueAtTime(0, when); m.linearRampToValueAtTime(1, when + 0.04);
      sound.t0 = when - sound.at;
      sound.mode = "web";
    });
  }

  // Without Web Audio: one <audio> for each way, and only the chosen one plays.
  function startTags() {
    if (!win.Audio) return Promise.reject(new Error("no audio"));
    if (!sound.tags) {
      sound.tags = {};
      for (var i = 0; i < WAYS.length; i++) { var a = new win.Audio(FILES[WAYS[i]]); a.preload = "auto"; sound.tags[WAYS[i]] = a; }
    }
    var tag = sound.tags[way];
    try { tag.currentTime = LEAD + sound.at; } catch (e) { /* from the start then */ }
    var p = tag.play();
    sound.mode = "tag";
    return p && p.then ? p : Promise.resolve();
  }

  function soundWay(from) {
    if (sound.mode === "web") {
      var now = sound.ctx.currentTime;
      for (var i = 0; i < WAYS.length; i++) {
        var p = sound.gains[i].gain;
        p.cancelScheduledValues(now);
        p.setTargetAtTime(WAYS[i] === way ? 1 : 0, now, 0.012);
      }
    } else if (sound.mode === "tag") {
      var a = sound.tags[from], b = sound.tags[way];
      try { b.currentTime = a.currentTime; } catch (e) { /* its own place then */ }
      var q = b.play(); if (q && q.catch) q.catch(function () {});
      a.pause();
    }
  }

  function soundAt() {                          // where in the loop the listener is, in seconds
    var p = sound.at;
    if (sound.mode === "web") {
      var late = sound.ctx.outputLatency || sound.ctx.baseLatency || 0;
      p = Math.max(sound.at, sound.ctx.currentTime - sound.t0 - late);
    } else if (sound.mode === "tag") {
      var tag = sound.tags[way];
      if (tag.currentTime >= LEAD + LOOP) { try { tag.currentTime -= LOOP; } catch (e) { /* plays to its end */ } }
      p = tag.currentTime - LEAD;
    }
    p %= LOOP;
    return p < 0 ? p + LOOP : p;
  }

  function play() {
    busy = true; closed = false; showPlay();
    var waiting = win.setTimeout(function () { slow = true; showPlay(); }, 300);
    function settled() { win.clearTimeout(waiting); slow = false; busy = false; }
    startWeb().catch(function () { return startTags(); }).then(function () {
      settled(); playing = true;
      if (!played && !chose) {                  // the first time: the three ways, one after the other
        tour = { since: win.performance.now(), step: -1 };
        tourOn();
      }
      played = true;
      showPlay(); wake();
    }, function () {
      settled(); playing = false; sound.mode = "";
      showPlay();
      say("The sound didn\u2019t start. Check your connection and press Listen again.");
    });
  }

  function pause() {
    var here = soundAt();
    playing = false; tour = null;
    if (sound.mode === "web") {
      var ctx = sound.ctx, old = sound.sources;
      sound.master.gain.cancelScheduledValues(0);
      sound.master.gain.setTargetAtTime(0, ctx.currentTime, 0.012);
      busy = true;
      win.setTimeout(function () {
        for (var i = 0; i < old.length; i++) { try { old[i].stop(); old[i].disconnect(); } catch (e) { /* already gone */ } }
        if (!playing && ctx.suspend) ctx.suspend();
        busy = false; showPlay();
      }, 90);
    } else if (sound.mode === "tag") {
      for (var w in sound.tags) sound.tags[w].pause();
    }
    sound.at = here; idle = here; sound.mode = "";
    say(SAYS[way]);
    showPlay(); wake();
  }

  function tourOn() {
    if (!tour) return;
    var step = Math.min(TOUR.length - 1, Math.floor((win.performance.now() - tour.since) / 1000 / TOUR_STEP));
    if (step !== tour.step) { tour.step = step; setWay(TOUR[step].way, TOUR[step].says); }
    if (step === TOUR.length - 1) tour = null;
  }

  // fetched ahead once the page has settled, so Listen answers at once
  win.addEventListener("load", function () {
    var c = navigator.connection;
    if (!win.fetch || (c && c.saveData)) return;
    win.setTimeout(function () { fetchFiles().catch(function () {}); }, 1200);
  });

  // ------------------------------------------------------------------------------ the picture
  var W = 0, H = 0, ratio = 1;
  var TOP_DB = -13, FLOOR_DB = -58;            // of the tilted levels
  var fLo = 40, fHi = 16000, b0 = 0, count = 0;
  var xs, yMusic, yAfter, yVoice;
  var across, mask, voiceInk, roomInk, labelFont = "12px sans-serif";
  var seen = true, idle = 0.9, raf = 0, last = 0, skip = false;

  function size() {
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    var k = Math.min(win.devicePixelRatio || 1, 2);
    if (w === W && h === H && k === ratio) return;
    W = w; H = h; ratio = k;
    canvas.width = Math.round(W * ratio); canvas.height = Math.round(H * ratio);
    g.setTransform(ratio, 0, 0, ratio, 0, 0);

    if (W < 560) { fLo = 60; fHi = 12000; } else { fLo = 40; fHi = 16000; }
    var first = Math.max(0, Math.floor(D.perOctave * Math.log2(fLo / D.f0)) - 1);
    var lastBand = Math.min(B - 1, Math.ceil(D.perOctave * Math.log2(fHi / D.f0)) + 1);
    b0 = first; count = lastBand - first + 1;
    xs = new Float32Array(count); yMusic = new Float32Array(count); yAfter = new Float32Array(count); yVoice = new Float32Array(count);
    for (var i = 0; i < count; i++) xs[i] = xOf(D.f0 * Math.pow(2, (b0 + i) / D.perOctave));

    across = g.createLinearGradient(0, 0, W, 0);
    across.addColorStop(0, "#2f55ff"); across.addColorStop(0.3, "#5b5cff"); across.addColorStop(0.55, "#8f5cff");
    across.addColorStop(0.8, "#d273f0"); across.addColorStop(1, "#ff9ad5");
    mask = g.createLinearGradient(0, 0, 0, H);
    mask.addColorStop(0, "rgba(0,0,0,1)"); mask.addColorStop(0.42, "rgba(0,0,0,0.9)"); mask.addColorStop(0.8, "rgba(0,0,0,0.28)"); mask.addColorStop(1, "rgba(0,0,0,0)");
    voiceInk = g.createLinearGradient(0, yOf(-34), 0, H);
    voiceInk.addColorStop(0, "rgba(255,255,255,1)"); voiceInk.addColorStop(0.75, "rgba(255,255,255,0.3)"); voiceInk.addColorStop(1, "rgba(255,255,255,0)");
    roomInk = g.createLinearGradient(0, 0, W, 0);
    labelFont = (W < 560 ? "11px " : "12px ") + (win.getComputedStyle(doc.body).fontFamily || "sans-serif");
    roomInk.addColorStop(0, "rgba(170,186,255,1)"); roomInk.addColorStop(0.55, "rgba(214,198,255,1)"); roomInk.addColorStop(1, "rgba(255,214,238,1)");
  }
  function xOf(f) { return Math.log(f / fLo) / Math.log(fHi / fLo) * W; }
  function yOf(db) {
    var t = (db - FLOOR_DB) / (TOP_DB - FLOOR_DB);
    return H - (t < 0 ? 0 : t > 1.04 ? 1.04 : t) * (H - 10);
  }

  // a soft line through the bands: each band pulls the curve, and it passes midway between neighbours
  function line(ys, back) {
    var n = count, i;
    if (!back) {
      g.lineTo(xs[0], ys[0]);
      for (i = 1; i < n - 1; i++) g.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[i + 1]) / 2, (ys[i] + ys[i + 1]) / 2);
      g.lineTo(xs[n - 1], ys[n - 1]);
    } else {
      g.lineTo(xs[n - 1], ys[n - 1]);
      for (i = n - 2; i > 0; i--) g.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[i - 1]) / 2, (ys[i] + ys[i - 1]) / 2);
      g.lineTo(xs[0], ys[0]);
    }
  }
  var INNER = [64, 50, 38, 28, 19, 12, 6], INNER_A = [0.024, 0.026, 0.028, 0.03, 0.034, 0.04, 0.05];
  function open(ys) { g.beginPath(); g.moveTo(xs[0], ys[0]); line(ys, false); }
  function glow(ys, ink, widths, alphas) {
    g.strokeStyle = ink; g.lineJoin = "round"; g.lineCap = "round";
    for (var i = 0; i < widths.length; i++) { g.globalAlpha = alphas[i]; g.lineWidth = widths[i]; open(ys); g.stroke(); }
    g.globalAlpha = 1;
  }

  function draw(pos) {
    var i, b, m;
    for (i = 0; i < count; i++) {
      b = b0 + i; m = at(music, b, pos);
      yMusic[i] = yOf(m);
      yAfter[i] = yOf(m - wDuck * D.duckDb - wAndrum * at(cut, b, pos));
      yVoice[i] = yOf(at(voice, b, pos));
    }
    g.clearRect(0, 0, W, H);

    // the music, as it is after whatever was done to it: lit along its top, falling away to black
    open(yAfter); g.lineTo(W + 2, H + 2); g.lineTo(-2, H + 2); g.closePath();
    g.fillStyle = across; g.fill();
    g.save();
    g.clip();
    glow(yAfter, "#ffffff", INNER, INNER_A);
    g.restore();
    g.globalCompositeOperation = "destination-in";
    g.fillStyle = mask; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";

    // what was taken away: lit where Andrum made room, only an outline where the track was turned down
    var gone = Math.max(wDuck, wAndrum);
    if (gone > 0.004) {
      if (wAndrum > 0.004) {
        g.beginPath(); g.moveTo(xs[0], yMusic[0]); line(yMusic, false); line(yAfter, true); g.closePath();
        g.globalAlpha = 0.3 * wAndrum; g.fillStyle = across; g.fill();
        g.globalAlpha = 0.11 * wAndrum; g.fillStyle = roomInk; g.fill();
      }
      g.globalAlpha = 0.4 * wAndrum + 0.42 * wDuck;
      g.strokeStyle = "#ffffff"; g.lineWidth = 1;
      if (wDuck > wAndrum) g.setLineDash([2, 6]);
      open(yMusic); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
    }
    glow(yAfter, across, [9, 4, 1.5], [0.12, 0.22, 0.95]);

    // the voice: faint where the music is over it, bright where it stands clear
    glow(yVoice, voiceInk, [1.25], [0.34]);
    g.save();
    g.beginPath(); g.moveTo(-2, -2); g.lineTo(xs[0], -2); g.lineTo(xs[0], yAfter[0]); line(yAfter, false); g.lineTo(W + 2, yAfter[count - 1]); g.lineTo(W + 2, -2); g.closePath();
    g.clip();
    glow(yVoice, voiceInk, [13, 9, 6, 3.5, 1.75], [0.05, 0.07, 0.1, 0.16, 1]);
    g.restore();

    // where on the keyboard this is
    g.font = labelFont;
    g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillStyle = "rgba(255,255,255,0.4)";
    var marks = [[100, "100 Hz"], [1000, "1 kHz"], [10000, "10 kHz"]];
    for (i = 0; i < marks.length; i++) g.fillText(marks[i][1], xOf(marks[i][0]), H - 9);
  }

  function wake() { if (!raf) raf = win.requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (tour) tourOn();

    var toDuck = way === "ducked" ? 1 : 0, toAndrum = way === "andrum" ? 1 : 0;
    var k = reduce ? 1 : 1 - Math.exp(-dt / 0.1);
    wDuck += (toDuck - wDuck) * k; wAndrum += (toAndrum - wAndrum) * k;
    if (Math.abs(toDuck - wDuck) < 0.002) wDuck = toDuck;
    if (Math.abs(toAndrum - wAndrum) < 0.002) wAndrum = toAndrum;

    var clear = CLEAR[way];
    shownClear += (clear - shownClear) * (reduce ? 1 : 1 - Math.exp(-dt / 0.13));
    if (Math.abs(clear - shownClear) < 0.3) shownClear = clear;
    var text = String(Math.round(shownClear));
    for (var i = 0; i < clarityOut.length; i++) if (clarityOut[i].textContent !== text) clarityOut[i].textContent = text;

    var pos;
    if (playing) pos = soundAt();
    else { if (!played && !reduce && seen) idle = (idle + dt) % LOOP; pos = idle; }
    var moving = wDuck !== toDuck || wAndrum !== toAndrum || shownClear !== clear;
    var atRest = !playing && !played && !reduce && seen;     // moving on its own, before Listen is pressed
    skip = atRest && !moving && !skip;                       // then every other frame is enough
    if (seen && !skip) { size(); draw(pos); }

    if (playing || moving || atRest) wake(); else last = 0;
  }

  if (win.IntersectionObserver) {
    new win.IntersectionObserver(function (entries) {
      seen = entries[entries.length - 1].isIntersecting;
      showDock();
      if (seen) wake();
    }, { threshold: 0.12 }).observe(view);
  }
  win.addEventListener("resize", function () { wake(); placeDock(); });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(wake);

  // ------------------------------------------------------------------------------ the dock
  // Once the demo has been started, the three ways follow the reader down the page, until it is closed.
  function showDock() {
    if (!dock) return;
    var want = played && !seen && !closed;
    if (dock.hidden === !want) return;
    dock.hidden = !want;
    placeDock();
  }
  function placeDock() {                        // above the cookie question, when the two would meet
    if (!dock || dock.hidden) return;
    var lift = 0, question = doc.querySelector(".anc");
    if (question) {
      var q = question.getBoundingClientRect(), d = dock.getBoundingClientRect();
      if (d.left < q.right && d.right > q.left) lift = Math.max(0, Math.round(win.innerHeight - q.top - 4));
    }
    dock.style.setProperty("--lift", lift + "px");
  }
  doc.addEventListener("click", function () { win.setTimeout(placeDock, 0); });
  var closeDock = doc.querySelector("[data-dock-close]");
  if (closeDock) closeDock.addEventListener("click", function () {
    closed = true;
    if (playing && !busy) pause(); else showDock();
  });

  setWay(way, note ? note.textContent : "");
  wake();

  // ------------------------------------------------------------------------------ on a phone
  // Andrum runs on a computer. A phone or a tablet gets a way to send the page there (the share menu, or a
  // new message in the mail app with the link in it), and the downloads step back.
  function phone() {
    var ua = navigator.userAgent || "";
    var handheld = /iPhone|iPod|iPad|Android/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var send = doc.querySelector("[data-an-send]");
    var link = send && send.querySelector("[data-an-send-link]"), i;
    if (!handheld || !link) return;
    send.hidden = false;
    var solid = doc.querySelectorAll("[data-downloads] .btn--solid");
    for (i = 0; i < solid.length; i++) { solid[i].classList.remove("btn--solid"); solid[i].classList.add("btn--line"); }
    // The address that is sent: the download on this page. An ad's campaign names travel with it (as they do
    // with an order, see store.js), so a download or an order on the computer still shows which ad it came from.
    var page;
    try {
      page = new URL("https://davidhjalmarlindberg.com/andrum/");
      var q = new URLSearchParams(win.location.search), keys = ["utm_source", "utm_campaign", "utm_content", "utm_term"];
      for (i = 0; i < keys.length; i++) { var v = q.get(keys[i]); if (v) page.searchParams.set(keys[i], v.slice(0, 120)); }
      page.searchParams.set("utm_medium", "sent-from-phone");
      page.hash = "download";
    } catch (e) { return; }                      // the link in the page as it is
    var subject = "Andrum: the free 7-day trial", text = "Download Andrum on your Mac or Windows computer:";
    link.href = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text + "\n" + page.href);
    link.addEventListener("click", function (e) {
      if (!navigator.share) return;                                            // the mail app
      e.preventDefault();
      navigator.share({ title: subject, text: text, url: page.href }).catch(function (err) {
        if (!err || err.name !== "AbortError") win.location.href = link.href;  // sharing isn't allowed here: the mail app
      });
    });
  }
})();
