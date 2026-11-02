/* The phone on the front page: David's Instagram, folding in from the right edge.
   It reads feed.json beside this file, which scripts/instagram_sync.py rewrites every night (or by hand).
   Computers: on a first visit the phone swings in like a door on a hinge; folded away it stays ajar at the
   edge, showing the newest post, and knocks once when there is something new since the visitor's last look.
   Phones and tablets: a round button with the newest post opens the same screen as a sheet from below.
   No Instagram scripts, cookies or embeds: everything comes from this site. */
(() => {
  'use strict';

  const here = new URL('.', (document.currentScript && document.currentScript.src) || location.href);
  const FEED = new URL('feed.json', here);
  const KEY = 'ig-phone-v1';
  const SLIDE_MS = 6000;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const roomy = matchMedia('(min-width: 900px) and (min-height: 600px) and (hover: hover) and (pointer: fine)');

  /* ---------- small helpers ---------- */
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } },
    set(patch) { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(store.get(), patch))); } catch (e) { /* private mode */ } }
  };

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }

  const ICONS = {
    out: ['0 0 16 16', '<path d="M3.5 12.5 12.5 3.5M5.2 3.5h7.3v7.3" fill="none" stroke="currentColor" stroke-width="1.6"/>'],
    back: ['0 0 16 16', '<path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    left: ['0 0 12 12', '<path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.3"/>'],
    right: ['0 0 12 12', '<path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.3"/>'],
    close: ['0 0 16 16', '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    pause: ['0 0 16 16', '<rect x="4" y="3" width="2.6" height="10" rx=".6" fill="currentColor"/><rect x="9.4" y="3" width="2.6" height="10" rx=".6" fill="currentColor"/>'],
    play: ['0 0 16 16', '<path d="M5 3.2v9.6L12.6 8z" fill="currentColor"/>'],
    muted: ['0 0 16 16', '<path d="M2.5 6h2.6L8.5 3.2v9.6L5.1 10H2.5z" fill="currentColor"/><path d="M11 6.2l3.4 3.6M14.4 6.2 11 9.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'],
    sound: ['0 0 16 16', '<path d="M2.5 6h2.6L8.5 3.2v9.6L5.1 10H2.5z" fill="currentColor"/><path d="M10.6 5.6a3.4 3.4 0 0 1 0 4.8M12.4 3.8a6 6 0 0 1 0 8.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'],
    check: ['0 0 14 14', '<circle cx="7" cy="7" r="7" fill="currentColor"/><path d="M4.2 7.2l1.9 1.9 3.8-4" fill="none" stroke="#0e0e0d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'],
    reel: ['0 0 12 12', '<path d="M3.5 2.2v7.6L9.8 6z" fill="#f4f3ef"/>'],
    pin: ['0 0 12 12', '<path d="M4.3 1.6h3.4l-.5 3.1 1.8 1.7H3l1.8-1.7zM6 6.4v4.2" fill="none" stroke="#f4f3ef" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"/>'],
    stack: ['0 0 12 12', '<rect x="1.8" y="3.6" width="6.6" height="6.6" rx="1.4" fill="none" stroke="#f4f3ef" stroke-width="1.1"/><path d="M4 1.8h4.8a1.4 1.4 0 0 1 1.4 1.4V8" fill="none" stroke="#f4f3ef" stroke-width="1.1"/>'],
    link: ['0 0 16 16', '<path d="M6.6 9.4l2.8-2.8M7.4 4.6l1-1a2.6 2.6 0 0 1 3.7 3.7l-1 1M8.6 11.4l-1 1a2.6 2.6 0 0 1-3.7-3.7l1-1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>']
  };
  function icon(name) {
    const [box, body] = ICONS[name];
    const t = document.createElement('template');
    t.innerHTML = `<svg viewBox="${box}" aria-hidden="true" focusable="false">${body}</svg>`;
    return t.content.firstChild;
  }

  const url = (u) => (u && /^(https?:)?\/\/|^[\w./-]+$/.test(u) ? new URL(u, FEED).href : null);
  const color = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#2a2925');
  const time = (m) => Date.parse(m && m.time) || 0;
  function ago(iso, short) {
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (!isFinite(s) || s < 0) return '';
    const d = s / 86400, w = Math.round(d / 7);
    if (short) return s < 3600 ? Math.max(1, Math.round(s / 60)) + 'm' : s < 86400 ? Math.round(s / 3600) + 'h' : d < 6.5 ? Math.round(d) + 'd' : d < 365 ? w + 'w' : Math.floor(d / 365) + 'y';
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    if (d < 6.5) return Math.round(d) + (Math.round(d) === 1 ? ' day ago' : ' days ago');
    if (d < 32) return w + (w === 1 ? ' week ago' : ' weeks ago');
    return new Date(iso).toLocaleDateString('en-GB', d > 300 ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'long' });
  }
  function picture(src, alt, eager) {
    const el = h('img', { alt: alt || '', decoding: 'async', loading: eager ? 'eager' : 'lazy', 'data-loading': '' });
    const done = () => el.removeAttribute('data-loading');
    el.addEventListener('load', done, { once: true });
    el.addEventListener('error', done, { once: true });
    const u = url(src);
    if (u) el.src = u; else done();
    return el;
  }
  const link = (href, attrs, ...kids) => h('a', Object.assign({ href: url(href) || 'https://www.instagram.com/', target: '_blank', rel: 'noopener' }, attrs), ...kids);
  /* in the reading order right after the opening, so the keyboard meets it there */
  function after(el) {
    const intro = document.querySelector('.intro');
    if (intro) intro.after(el); else document.body.append(el);
  }
  function focusables(root) {
    return [...root.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])')]
      .filter((el) => !el.closest('[inert]') && !el.hidden && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  }

  /* ---------- the screen: a profile, and the latest posts played like stories ---------- */
  function buildView(feed, isNew, onTint) {
    const p = feed.profile;
    const profileUrl = p.url || `https://www.instagram.com/${p.username}/`;
    const media = (feed.media || []).filter((m) => m && m.id && (m.thumb || m.image));
    const latest = media.filter((m) => !m.pinned).sort((a, b) => time(b) - time(a)).slice(0, 6);

    const view = h('div', { class: 'ig-view', 'data-page': 'profile' });

    /* profile */
    const title = h('h2', { class: 'ig-handle', tabindex: '-1' },
      h('span', { class: 'ig-user', text: p.username }),
      p.verified ? h('span', { class: 'ig-check', role: 'img', 'aria-label': 'Verified' }, icon('check')) : null);
    const avatar = h('span', { class: 'ig-avatar' + (isNew ? ' is-new' : '') }, picture(p.picture, `Profile picture of @${p.username}`, true));
    const toLatest = latest.length
      ? h('button', { type: 'button', class: 'ig-btn', onclick: () => showLatest(0, true) }, 'Latest posts')
      : link(profileUrl, { class: 'ig-btn' }, 'Reels');
    const website = url(p.website);
    const profile = h('section', { class: 'ig-page ig-profile', 'aria-label': `@${p.username} on Instagram` },
      h('div', { class: 'ig-head' },
        h('div', { class: 'ig-topbar' }, title, link(profileUrl, { class: 'ig-icon-link', 'aria-label': 'Open in Instagram' }, icon('out'))),
        h('div', { class: 'ig-who' }, avatar,
          h('dl', { class: 'ig-stats' },
            h('div', null, h('dt', { text: 'posts' }), h('dd', { text: p.posts })),
            h('div', null, h('dt', { text: 'followers' }), h('dd', { text: p.followers })))),
        p.name ? h('p', { class: 'ig-name', text: p.name }) : null,
        p.category ? h('p', { class: 'ig-category', text: p.category }) : null,
        website ? link(website, { class: 'ig-website' }, icon('link'), h('span', { text: new URL(website).hostname.replace(/^www\./, '') })) : null,
        h('div', { class: 'ig-actions' }, link(profileUrl, { class: 'ig-btn ig-btn-solid' }, 'Follow'), toLatest),
        (feed.highlights || []).length
          ? h('div', { class: 'ig-highlights' }, feed.highlights.slice(0, 4).map((x) =>
            link(x.url || profileUrl, { class: 'ig-highlight', 'aria-label': `Highlight: ${x.title}` }, h('span', null, picture(x.cover, '', true)), h('span', { text: x.title, 'aria-hidden': 'true' }))))
          : null),
      h('div', { class: 'ig-grid' }, media.slice(0, 12).map((m, i) =>
        link(m.url, { class: 'ig-tile', style: `--c:${color(m.color)}` },
          picture(m.thumb || m.image, (m.pinned ? 'Pinned: ' : m.type === 'reel' ? 'Reel: ' : '') + (m.alt || m.caption || 'Post'), i < 6),
          m.pinned ? icon('pin') : m.type === 'reel' ? icon('reel') : m.type === 'carousel' ? icon('stack') : null))),
      h('div', { class: 'ig-more' }, link(profileUrl, { class: 'ig-btn' }, `See all ${p.posts} posts`, icon('out'))));

    /* latest */
    const n = latest.length;
    const slides = latest.map((m, i) => h('div', { class: 'ig-slide', role: 'group', 'aria-roledescription': 'slide', 'aria-label': `${i + 1} of ${n}` }));
    const segs = latest.map(() => h('span', { class: 'ig-seg' }, h('i')));
    const counter = h('small');
    const pauseBtn = h('button', { type: 'button', class: 'ig-round', 'aria-label': 'Pause' }, icon('pause'));
    const soundBtn = h('button', { type: 'button', class: 'ig-round', 'aria-label': 'Sound on', hidden: true }, icon('muted'));
    const backBtn = h('button', { type: 'button', class: 'ig-round', 'aria-label': 'Back to the profile', onclick: () => showProfile(true) }, icon('back'));
    const backdrop = h('img', { class: 'ig-backdrop', alt: '', 'aria-hidden': 'true' });
    const when = h('span');
    const caption = h('p', { class: 'ig-caption' });
    const watch = link(profileUrl, { class: 'ig-btn ig-btn-solid ig-watch' }, 'Watch on Instagram', icon('out'));
    const prevZone = h('button', { type: 'button', class: 'ig-zone ig-zone-prev', 'aria-label': 'Previous post' });
    const nextZone = h('button', { type: 'button', class: 'ig-zone ig-zone-next', 'aria-label': 'Next post' });
    const foot = h('div', { class: 'ig-foot' },
      h('div', { class: 'ig-by' }, picture(p.picture, '', false), h('b', { text: p.username }), when), caption, watch);
    const latestEl = h('section', { class: 'ig-page ig-latest', 'aria-label': 'Latest posts', 'aria-roledescription': 'carousel' },
      backdrop, h('div', { class: 'ig-slides', 'aria-live': 'off' }, slides), prevZone, nextZone,
      h('div', { class: 'ig-bar' },
        h('div', { class: 'ig-segs', 'aria-hidden': 'true' }, segs),
        h('div', { class: 'ig-barrow' }, backBtn, h('p', { class: 'ig-bartitle' }, 'Latest', counter), h('div', { class: 'ig-barend' }, soundBtn, pauseBtn))),
      foot);
    latestEl.inert = true;
    view.append(profile, latestEl);

    /* the player */
    let i = 0, elapsed = 0, last = 0, raf = 0, running = false, userPaused = false, held = false, reading = false, video = null;
    const fill = (m) => m.w && m.h && m.w / m.h < 0.62;
    const paused = () => userPaused || held || reading || document.hidden || reduce.matches;
    function mediaAt(k) {
      const m = latest[k], slide = slides[k];
      if (!slide.firstChild) {
        if (m.video && url(m.video)) {
          const v = h('video', { src: url(m.video), poster: url(m.image || m.thumb), playsinline: true, muted: true, preload: 'metadata', 'aria-label': m.alt || m.caption || 'Reel' });
          v.muted = true;
          v.addEventListener('ended', () => { if (running && latest[i] === m) go(i + 1); });
          slide.append(v);
        } else {
          slide.append(picture(m.image || m.thumb, m.alt || m.caption || 'Post', true));
        }
      }
      return slide.firstChild;
    }
    function go(k, byHand) {
      if (!n) return;
      k = (k + n) % n;
      slides[i].classList.remove('is-on');
      if (video) video.pause();
      i = k; elapsed = 0;
      const m = latest[i], el = mediaAt(i);
      mediaAt((i + 1) % n);
      slides[i].classList.add('is-on');
      latestEl.classList.toggle('is-fill', !!fill(m));
      backdrop.src = url(m.thumb || m.image) || '';
      counter.textContent = `${i + 1} / ${n}`;
      when.textContent = '· ' + ago(m.time, true);
      when.title = ago(m.time);
      caption.textContent = m.caption || '';
      caption.classList.remove('is-in'); void caption.offsetWidth; caption.classList.add('is-in');
      watch.href = url(m.url) || profileUrl;
      segs.forEach((s, j) => s.firstChild.style.setProperty('--p', j < i ? 1 : 0));
      video = el && el.tagName === 'VIDEO' ? el : null;
      soundBtn.hidden = !video;
      if (video) { try { video.currentTime = 0; } catch (e) { /* not loaded yet */ } }
      onTint(m.color);
      if (byHand) last = 0;
    }
    function frame(now) {
      if (!running) return;
      const dt = last ? Math.min(now - last, 100) : 0;
      last = now;
      let progress;
      if (video) {
        if (paused()) { if (!video.paused) video.pause(); }
        else if (video.paused) video.play().catch(() => {});
        const dur = isFinite(video.duration) && video.duration ? Math.min(video.duration, 15) : SLIDE_MS / 1000;
        progress = Math.min(1, (video.currentTime || 0) / dur);
      } else {
        if (!paused()) elapsed += dt;
        progress = Math.min(1, elapsed / SLIDE_MS);
      }
      segs[i].firstChild.style.setProperty('--p', progress);
      if (progress >= 1 && !paused()) go(i + 1);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (running || !n) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); if (video) video.pause(); }

    function setPaused(v) {
      userPaused = v;
      pauseBtn.setAttribute('aria-label', v ? 'Play' : 'Pause');
      pauseBtn.replaceChildren(icon(v ? 'play' : 'pause'));
    }
    pauseBtn.addEventListener('click', () => setPaused(!userPaused));
    soundBtn.addEventListener('click', () => {
      if (!video) return;
      video.muted = !video.muted;
      soundBtn.setAttribute('aria-label', video.muted ? 'Sound on' : 'Sound off');
      soundBtn.replaceChildren(icon(video.muted ? 'muted' : 'sound'));
    });
    /* tap to move, press and hold to pause, like stories */
    for (const [zone, step] of [[prevZone, -1], [nextZone, 1]]) {
      let timer = 0, long = false;
      zone.addEventListener('pointerdown', () => { long = false; timer = setTimeout(() => { long = true; held = true; }, 260); });
      const lift = () => { clearTimeout(timer); held = false; };
      zone.addEventListener('pointerup', lift);
      zone.addEventListener('pointercancel', lift);
      zone.addEventListener('pointerleave', lift);
      zone.addEventListener('click', (e) => { if (long) { e.preventDefault(); long = false; return; } go(i + step, true); });
    }
    foot.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') reading = true; });
    foot.addEventListener('pointerleave', () => { reading = false; });
    latestEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1, true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1, true); }
    });

    function showLatest(k, byHand) {
      view.dataset.page = 'latest';
      profile.inert = true; latestEl.inert = false;
      go(k || 0, true);
      start();
      if (byHand) setTimeout(() => backBtn.focus({ preventScroll: true }), 80);
    }
    function showProfile(byHand) {
      view.dataset.page = 'profile';
      latestEl.inert = true; profile.inert = false;
      stop();
      onTint((latest[0] || media[0] || {}).color);
      if (byHand) setTimeout(() => title.focus({ preventScroll: true }), 80);
    }

    return {
      el: view,
      title,
      newest: latest[0] || media[0],
      seen() { avatar.classList.remove('is-new'); },
      resume() { if (view.dataset.page === 'latest') start(); },
      pause: stop,
      showProfile
    };
  }

  /* ---------- computers: the phone at the edge ---------- */
  function desktop(feed, view, isNew, newestIso, tint) {
    const p = feed.profile;
    const first = !store.get().v;
    const stage = h('div', { class: 'ig ig-stage' + (first ? ' is-waking' : ''), 'data-state': 'hidden' });
    const glow = h('div', { class: 'ig-glow', 'aria-hidden': 'true' });
    tint.target = glow;
    const glass = h('span', { class: 'ig-glass', 'aria-hidden': 'true' });
    const screen = h('div', { class: 'ig-screen' }, view.el,
      h('div', { class: 'ig-cover', 'aria-hidden': 'true' }, picture((view.newest || {}).image || (view.newest || {}).thumb, '', false)),
      h('span', { class: 'ig-camera', 'aria-hidden': 'true' }), glass);
    const tilt = h('div', { class: 'ig-tilt' },
      ['l1', 'l2', 'l3', 'r'].map((k) => h('span', { class: `ig-key ig-key-${k}`, 'aria-hidden': 'true' })),
      h('div', { class: 'ig-body' }, screen));
    const label = `Open @${p.username} on Instagram` + (isNew ? ', new posts' : '');
    const hit = h('button', { type: 'button', class: 'ig-hit', tabindex: '-1', 'aria-hidden': 'true' });  /* for the pointer; the tab is the keyboard's way in */
    const phone = h('div', { class: 'ig-phone', role: 'region', 'aria-label': `Instagram: @${p.username}` }, tilt, hit);
    const fold = h('button', { type: 'button', class: 'ig-fold' }, 'Fold away', icon('right'));
    const newDot = isNew ? h('span', { class: 'ig-tab-new', 'aria-hidden': 'true' }) : null;
    const tab = h('button', { type: 'button', class: 'ig-tab', 'aria-label': label }, icon('left'), newDot, h('span', { class: 'ig-tab-label', text: '@' + p.username, 'aria-hidden': 'true' }));
    stage.append(h('div', { class: 'ig-veil', 'aria-hidden': 'true' }), glow, h('div', { class: 'ig-shade', 'aria-hidden': 'true' }), phone, fold, tab);
    after(stage);
    view.el.inert = true;
    tint.apply((view.newest || {}).color);

    /* Where the folded phone rests. The stage is the screen, seen in perspective (1800px) from 45% across, so the
       phone's far edge lands where edge() says. Beside the intro text when the phone and its tab fit there, as a door
       left ajar; otherwise lower, in the corner under the 'Selected work' line, so it never covers the text. */
    const P = 1800, ORIGIN = 0.45, TAB = 34, GAP = 12;
    const note = document.querySelector('.intro-note');
    const line = document.querySelector('#work .section-line') || document.querySelector('.intro');
    function edge(W, w, tx, deg) {
      const r = deg * Math.PI / 180, x0 = W * ORIGIN;
      const X = W + tx - w * Math.cos(r), Z = w * Math.sin(r);
      return x0 + (X - x0) * P / (P - Z);
    }
    function layout() {
      const W = stage.clientWidth, H = stage.clientHeight, w = phone.offsetWidth, tall = phone.offsetHeight, top = phone.offsetTop;
      if (!W || !w) return;
      const rest = edge(W, w, W * 0.03, -72), lean = edge(W, w, W * 0.022, -63);
      const clear = note ? note.getBoundingClientRect().right + 16 : -Infinity;
      let y = 0;
      if (lean - GAP - TAB < clear) {
        let low = H - tall * 0.52;
        if (line) low = Math.max(low, line.getBoundingClientRect().bottom + scrollY + 24);
        y = Math.round(Math.min(low, H - tall * 0.3) - top);
      }
      const shownTop = top + y, shownBottom = Math.min(H, top + y + tall);
      stage.style.setProperty('--ig-ajar-y', y + 'px');
      stage.style.setProperty('--ig-tab-top', Math.round((shownTop + shownBottom) / 2 - 106) + 'px');
      stage.style.setProperty('--ig-tab-right', Math.round(W - rest + GAP) + 'px');
      stage.style.setProperty('--ig-tab-dx', Math.round(lean - rest) + 'px');
    }
    layout();
    let laying = 0;
    const onResize = () => { cancelAnimationFrame(laying); laying = requestAnimationFrame(layout); };
    addEventListener('resize', onResize);

    function set(state, byHand) {
      const was = stage.dataset.state;
      if (state === was) return;
      stage.dataset.state = state;
      view.el.inert = state !== 'open';
      if (state === 'open') {
        if (was === 'hidden') setTimeout(() => stage.classList.remove('is-waking'), 650);
        else stage.classList.remove('is-waking');
        store.set({ v: 1, seen: newestIso });
        view.seen();
        if (newDot) newDot.remove();
        tab.setAttribute('aria-label', `Open @${p.username} on Instagram`);
        view.resume();
        if (byHand) setTimeout(() => view.title.focus({ preventScroll: true }), 420);
      } else {
        stage.classList.remove('is-waking');
        view.pause();
        resetTilt();
        if (byHand && state === 'ajar') { store.set({ v: 1, folded: true }); tab.focus({ preventScroll: true }); }
      }
    }
    const open = () => set('open', true);
    hit.addEventListener('click', open);
    tab.addEventListener('click', open);
    fold.addEventListener('click', () => set('ajar', true));
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && stage.dataset.state === 'open') { e.preventDefault(); set('ajar', true); }
    });

    /* the phone leans toward the pointer, and the light on its glass follows */
    let tiltFrame = 0;
    function resetTilt() {
      phone.classList.remove('is-tilting');
      for (const k of ['--ig-tx', '--ig-ty']) phone.style.removeProperty(k);
      for (const k of ['--ig-gx', '--ig-gy']) glass.style.removeProperty(k);
    }
    phone.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || stage.dataset.state !== 'open' || reduce.matches) return;
      const r = phone.getBoundingClientRect();
      const x = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5));
      const y = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5));
      cancelAnimationFrame(tiltFrame);
      tiltFrame = requestAnimationFrame(() => {
        phone.classList.add('is-tilting');
        phone.style.setProperty('--ig-ty', (x * 9).toFixed(2) + 'deg');
        phone.style.setProperty('--ig-tx', (-y * 6).toFixed(2) + 'deg');
        glass.style.setProperty('--ig-gx', (50 + x * 90).toFixed(1) + '%');
        glass.style.setProperty('--ig-gy', (50 + y * 90).toFixed(1) + '%');
      });
    });
    phone.addEventListener('pointerleave', () => { cancelAnimationFrame(tiltFrame); resetTilt(); });

    function knock() {
      if (reduce.matches || stage.dataset.state !== 'ajar') return;
      phone.classList.remove('is-knocking'); void phone.offsetWidth; phone.classList.add('is-knocking');
      setTimeout(() => phone.classList.remove('is-knocking'), 1600);
    }

    /* the phone belongs to the opening screen: scrolling on into the work swings it shut, scrolling back opens it ajar */
    const deep = () => scrollY > innerHeight * 0.32;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const s = stage.dataset.state;
        if (s === 'hidden') return;
        if (deep()) { if (s === 'open' || s === 'ajar') set('away'); }
        else if (s === 'away') set('ajar');
      });
    }
    addEventListener('scroll', onScroll, { passive: true });

    /* enter: open on a first visit (unless the visitor is already reading further down), else ajar */
    const twoFrames = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));
    let timer = setTimeout(() => {
      store.set({ v: 1 });
      if (deep()) { stage.dataset.next = 'ajar'; twoFrames(() => set('away')); return; }
      if (first) { twoFrames(() => set('open')); return; }
      stage.dataset.next = 'ajar';
      twoFrames(() => set('ajar'));
      if (isNew) timer = setTimeout(knock, 1500);
    }, first ? 900 : 350);

    return {
      destroy() {
        clearTimeout(timer);
        removeEventListener('resize', onResize);
        removeEventListener('scroll', onScroll);
        view.pause();
        stage.remove();
      }
    };
  }

  /* ---------- phones and tablets: a round button and a sheet ---------- */
  function handheld(feed, view, isNew, newestIso, tint) {
    const p = feed.profile;
    const label = `@${p.username} on Instagram` + (isNew ? ', new posts' : '');
    const dot = isNew ? h('span', { class: 'ig-dock-new', 'aria-hidden': 'true' }) : null;
    const dock = h('button', { type: 'button', class: 'ig ig-dock', 'aria-label': label, 'aria-haspopup': 'dialog' },
      picture((view.newest || {}).thumb, '', true), dot);
    const scrim = h('div', { class: 'ig ig-scrim', 'aria-hidden': 'true' });
    const grab = h('div', { class: 'ig-grab', 'aria-hidden': 'true' });
    const close = h('button', { type: 'button', class: 'ig-round ig-close', 'aria-label': 'Close' }, icon('close'));
    const sheet = h('div', { class: 'ig ig-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': `@${p.username} on Instagram` }, grab, close, view.el);
    after(dock);
    document.body.append(scrim, sheet);
    tint.target = null;

    let lastFocus = null;
    function openSheet() {
      lastFocus = document.activeElement;
      sheet.classList.add('is-open'); scrim.classList.add('is-open');
      document.documentElement.style.overflow = 'hidden';
      store.set({ v: 1, seen: newestIso });
      view.seen();
      if (dot) dot.remove();
      dock.setAttribute('aria-label', `@${p.username} on Instagram`);
      view.el.inert = false;
      view.resume();
      setTimeout(() => view.title.focus({ preventScroll: true }), 120);
    }
    function closeSheet() {
      sheet.classList.remove('is-open'); scrim.classList.remove('is-open');
      document.documentElement.style.overflow = '';
      view.pause();
      view.el.inert = true;
      (lastFocus && lastFocus.isConnected ? lastFocus : dock).focus({ preventScroll: true });
    }
    view.el.inert = true;
    dock.addEventListener('click', openSheet);
    close.addEventListener('click', closeSheet);
    scrim.addEventListener('click', closeSheet);
    sheet.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
      if (e.key !== 'Tab') return;
      const list = focusables(sheet);
      if (!list.length) return;
      const firstEl = list[0], lastEl = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === firstEl || !sheet.contains(document.activeElement))) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    });

    /* pull the sheet down to close it */
    let y0 = null, dy = 0, t0 = 0;
    grab.addEventListener('pointerdown', (e) => { y0 = e.clientY; dy = 0; t0 = performance.now(); sheet.classList.add('is-dragging'); grab.setPointerCapture(e.pointerId); });
    grab.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sheet.style.setProperty('--ig-drag', dy + 'px'); });
    const drop = () => {
      if (y0 == null) return;
      const fast = dy / Math.max(1, performance.now() - t0) > 0.6;
      sheet.classList.remove('is-dragging');
      sheet.style.removeProperty('--ig-drag');
      if (dy > 110 || (fast && dy > 30)) closeSheet();
      y0 = null;
    };
    grab.addEventListener('pointerup', drop);
    grab.addEventListener('pointercancel', drop);

    /* the button shows while the opening screen or the contact footer is in view */
    const watched = [document.querySelector('.intro'), document.querySelector('footer')].filter(Boolean);
    const inView = new Set();
    let io = null;
    if (watched.length && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        for (const en of entries) en.isIntersecting ? inView.add(en.target) : inView.delete(en.target);
        dock.classList.toggle('is-shown', inView.size > 0);
      }, { threshold: 0.15 });
      watched.forEach((el) => io.observe(el));
    } else {
      dock.classList.add('is-shown');
    }
    store.set({ v: 1 });

    return {
      destroy() {
        if (io) io.disconnect();
        if (sheet.classList.contains('is-open')) document.documentElement.style.overflow = '';
        view.pause();
        dock.remove(); scrim.remove(); sheet.remove();
      }
    };
  }

  /* ---------- start, after the page itself has loaded ---------- */
  function loadStyles() {
    return new Promise((done) => {
      if (document.querySelector('link[data-ig]')) return done();
      const l = h('link', { rel: 'stylesheet', href: new URL('phone.css', here).href, 'data-ig': '' });
      l.addEventListener('load', done, { once: true });
      l.addEventListener('error', done, { once: true });
      document.head.append(l);
    });
  }

  async function init() {
    let feed;
    try {
      const r = await fetch(FEED, { cache: 'no-cache' });
      if (!r.ok) return;
      feed = await r.json();
    } catch (e) { return; }
    if (!feed || !feed.profile || !feed.profile.username || !(feed.media || []).length) return;
    await loadStyles();

    const newest = (feed.media || []).filter((m) => !m.pinned).sort((a, b) => time(b) - time(a))[0] || feed.media[0];
    const newestIso = newest.time || '';
    const seen = store.get().seen;
    const isNew = !!seen && time(newest) > Date.parse(seen);

    /* one tint, set from the post on screen: the light the phone casts on the paper */
    const tint = {
      target: null,
      apply(c) { if (this.target) this.target.style.setProperty('--ig-tint', color(c)); }
    };

    let mode = null, ctrl = null;
    const mount = () => {
      const want = roomy.matches ? 'desktop' : 'handheld';
      if (want === mode) return;
      if (ctrl) ctrl.destroy();
      mode = want;
      const view = buildView(feed, isNew, (c) => tint.apply(c));
      ctrl = (want === 'desktop' ? desktop : handheld)(feed, view, isNew, newestIso, tint);
    };
    mount();
    (roomy.addEventListener ? roomy.addEventListener('change', mount) : roomy.addListener(mount));
  }

  const begin = () => ('requestIdleCallback' in window ? requestIdleCallback(init, { timeout: 2500 }) : setTimeout(init, 300));
  if (document.readyState === 'complete') begin();
  else addEventListener('load', begin, { once: true });
})();
