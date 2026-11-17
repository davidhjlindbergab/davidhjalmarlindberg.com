/* davidhjalmarlindberg.com: an e-mail address before a trial download.

   A link marked data-gate="<product>" (Andrum's Download for Mac, Download for Windows and, on a phone, Send the
   link to my computer) first asks for the visitor's e-mail address in a small dialog. The download starts the
   moment the address is in. /lika/download/ shows the same form in the page itself (DownloadGate.run with mount).

   The address goes to the site's collector, the same Google Apps Script web app as /stats.js. stats-collector.gs
   writes one row per download to the tab "E-post" in the Google Sheet "Statistik för davidhjalmarlindberg.com":
   time, address, product, file, where they came from and the page.

   The browser remembers the address (localStorage), so a visitor is asked once: their next download goes straight
   through and is written down with the same address. Buyers are never asked: back from the checkout (?bought=),
   or with Andrum's thank-you panel showing, or a purchase remembered by Andrum's store.js.

   If the dialog can't be shown (a browser without <dialog>), the download goes through as before. The files
   themselves stay where they are, so a direct link to one still works: this asks, it doesn't lock.

   Link attributes:
     data-gate          the product: Andrum, Lika or Colobri
     data-gate-title    the dialog's heading (default "Download <product>")
     data-gate-text     the line under it
     data-gate-file     what is written in the sheet's Fil column (default: the file's name, from href)
     data-gate-mailto   an e-mail link to the visitor themselves: their address is put in as its recipient

   ?stats=test on the page sends the address to the tab "E-post test" instead. */
(function () {
  'use strict';
  var COLLECTOR = 'https://script.google.com/macros/s/AKfycbzAxRBJJ3Ye9d7uVjYTOEIfM--ebkrDToTGJ05YVL8s1462Mr4qS8DPadJ7mMQ_NW7Q/exec';
  var HOST = 'davidhjalmarlindberg.com';
  var KEY = 'davidhjalmarlindberg.email';
  var ADDRESS = /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\.]{2,}$/;

  function valid(email) { return typeof email === 'string' && email.length <= 254 && ADDRESS.test(email); }

  function remembered() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      return v && valid(v.e) ? v : null;
    } catch (e) { return null; }
  }
  function remember(email) {
    try { localStorage.setItem(KEY, JSON.stringify({ e: email })); } catch (e) {}
  }

  function storedKey(prefix) {
    try {
      for (var i = 0; i < localStorage.length; i++) if ((localStorage.key(i) || '').indexOf(prefix) === 0) return true;
    } catch (e) {}
    return false;
  }
  function bought(product) {
    if (/[?&]bought=/.test(location.search)) return true;
    if (product === 'Andrum') {
      var thanks = document.querySelector('[data-an-thanks]');
      if (thanks && !thanks.hidden) return true;
      return storedKey('andrum-bought-');
    }
    return false;
  }

  function source(q) {
    var s = q.get('utm_source');
    if (s) return s;
    try {
      var r = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
      return r && r !== HOST ? r : '';
    } catch (e) { return ''; }
  }

  /* One message that both versions of the collector understand. The one from before 17 Nov 2026 knows nothing of
     addresses: it reads k, n, x, p and test, and files the address as a download (nedladdning) in its tab Test.
     The new one (stats-collector.gs) sees lead: 1, writes the
     whole row to the tab E-post, and moves what the old one filed there once. */
  function send(product, file, email) {
    var q = new URLSearchParams(location.search), test = q.get('stats') === 'test';
    var lead = {
      v: 1, k: 'ev', n: test ? 'out' : 'dl', x: email, test: 1,
      lead: 1, e: email, pr: product, f: file || '',
      p: location.pathname.replace(/\/index\.html$/, '/'), s: source(q), c: q.get('utm_campaign') || ''
    };
    if (test) lead.lt = 1;
    if (location.protocol !== 'https:' || location.hostname !== HOST) {   // (previews and copies elsewhere send nothing)
      if (window.console) console.info('[download-gate] would send', lead);
      return;
    }
    var body = JSON.stringify(lead);
    try {
      fetch(COLLECTOR, { method: 'POST', body: body, mode: 'no-cors', credentials: 'omit', keepalive: true }).catch(function () {});
    } catch (e) {
      try { navigator.sendBeacon(COLLECTOR, body); } catch (e2) {}
    }
  }

  // ------------------------------------------------------------------------------------------------ the look
  var CSS = [
    '.dg{box-sizing:border-box;width:min(440px,calc(100vw - 32px));max-width:none;max-height:calc(100dvh - 32px);margin:auto;padding:0;border:0;border-radius:22px;background:transparent;color:var(--dg-ink,#f5f5f7);font:inherit;overflow:visible}',
    '.dg::backdrop{background:rgba(0,0,0,.62);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}',
    '.dg__form{position:relative;box-sizing:border-box;max-height:calc(100dvh - 32px);overflow:auto;padding:30px 28px 26px;border-radius:22px;background:var(--dg-panel,rgba(22,22,24,.96));box-shadow:inset 0 0 0 1px var(--dg-line,rgba(255,255,255,.14)),0 30px 80px rgba(0,0,0,.55);text-align:left}',
    '.dg__form--inline{max-width:440px;max-height:none;overflow:visible;margin:28px 0 0;padding:0;background:none;box-shadow:none}',
    '.dg__title{margin:0 44px 8px 0;font-family:var(--dg-title-font,inherit);font-size:var(--dg-title-size,24px);font-weight:var(--dg-title-weight,600);line-height:1.2;letter-spacing:-.015em;color:var(--dg-ink,#f5f5f7)}',
    '.dg__text{margin:0 0 22px;font-size:17px;line-height:1.45;color:var(--dg-mist,rgba(245,245,247,.72))}',
    '.dg__label{display:block;margin:0 0 8px;font-size:14px;font-weight:500;line-height:1.3;color:var(--dg-mist,rgba(245,245,247,.72))}',
    '.dg__input{display:block;box-sizing:border-box;width:100%;height:50px;margin:0;padding:0 16px;border:0;border-radius:14px;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px var(--dg-line,rgba(255,255,255,.16));color:var(--dg-ink,#f5f5f7);font-family:inherit;font-size:17px;line-height:50px;-webkit-appearance:none;appearance:none}',
    '.dg__input::placeholder{color:var(--dg-dim,rgba(245,245,247,.42))}',
    '.dg__input:focus{outline:none;box-shadow:inset 0 0 0 1.5px var(--dg-focus,#f5f5f7)}',
    '.dg__input[aria-invalid="true"]{box-shadow:inset 0 0 0 1.5px var(--dg-error,#ff9b8f)}',
    '.dg__error{margin:8px 0 0;font-size:14px;line-height:1.4;color:var(--dg-error,#ff9b8f)}',
    '.dg__go{display:inline-flex;align-items:center;justify-content:center;height:44px;margin:22px 0 0;padding:0 22px;border:0;border-radius:22px;background:var(--dg-ink,#f5f5f7);color:var(--dg-on-ink,#000);font-family:inherit;font-size:17px;font-weight:400;line-height:1;white-space:nowrap;cursor:pointer;transition:background .2s}',
    '.dg__go:hover{background:var(--dg-hover,#fff)}',
    '.dg__go:focus-visible,.dg__close:focus-visible,.dg__fine a:focus-visible{outline:2px solid var(--dg-focus,#f5f5f7);outline-offset:3px}',
    '.dg__fine{margin:18px 0 0;font-size:13px;line-height:1.45;color:var(--dg-dim,rgba(245,245,247,.5))}',
    '.dg__fine a{color:inherit;text-decoration:underline;text-underline-offset:2px}',
    '.dg__close{position:absolute;top:16px;right:16px;display:grid;place-items:center;width:36px;height:36px;margin:0;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:var(--dg-mist,rgba(245,245,247,.72));cursor:pointer;transition:background .2s,color .2s}',
    '.dg__close:hover{background:rgba(255,255,255,.14);color:var(--dg-ink,#f5f5f7)}',
    '.dg__hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}',
    '@media (max-width:480px){.dg__form{padding:26px 20px 22px}.dg__form--inline{padding:0}}',
    '@media (prefers-reduced-motion:no-preference){.dg[open]{animation:dg-in .3s ease-out}.dg[open]::backdrop{animation:dg-fade .3s ease-out}}',
    '@keyframes dg-in{from{opacity:0;filter:blur(8px)}}',
    '@keyframes dg-fade{from{opacity:0}}'
  ].join('\n');

  function style() {
    if (document.getElementById('dg-style')) return;
    var s = document.createElement('style');
    s.id = 'dg-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  var uid = 0;
  // the form: heading (in the dialog), a line, the address, the button, the small print
  function form(o, inline, done) {
    var id = 'dg-' + (++uid);
    var f = el('form', 'dg__form' + (inline ? ' dg__form--inline' : ''));
    f.noValidate = true;
    f.setAttribute('aria-label', o.title || 'Download ' + o.product);
    if (!inline) {
      var close = el('button', 'dg__close');
      close.type = 'button';
      close.setAttribute('aria-label', 'Close');
      close.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>';
      f.appendChild(close);
      var h = el('h2', 'dg__title', o.title || 'Download ' + o.product);
      h.id = id + '-title';
      f.appendChild(h);
    }
    if (o.text !== '') f.appendChild(el('p', 'dg__text', o.text || 'Leave your e-mail address and the download starts straight away.'));

    var label = el('label', 'dg__label', 'E-mail address');
    label.htmlFor = id + '-email';
    var input = el('input', 'dg__input');
    input.type = 'email'; input.id = id + '-email'; input.name = 'email'; input.required = true;
    input.autocomplete = 'email'; input.setAttribute('inputmode', 'email'); input.setAttribute('autocapitalize', 'off');
    input.spellcheck = false; input.placeholder = 'you@example.com'; input.maxLength = 254;
    var error = el('p', 'dg__error', 'That doesn’t look like an e-mail address.');
    error.id = id + '-error'; error.hidden = true; error.setAttribute('role', 'alert');
    input.setAttribute('aria-describedby', error.id);

    var hp = el('div', 'dg__hp');   // left empty by people; filled in by robots, whose addresses are not sent
    hp.setAttribute('aria-hidden', 'true');
    var trap = el('input');
    trap.type = 'text'; trap.name = 'website'; trap.tabIndex = -1; trap.autocomplete = 'off';
    hp.appendChild(trap);

    var go = el('button', 'dg__go', o.button || 'Download');
    go.type = 'submit';

    var fine = el('p', 'dg__fine', 'I use it to follow up on your trial and to send news about my tools now and then. Unsubscribe any time; I never share it. ');
    var a = el('a', '', 'Privacy');
    a.href = '/privacy/#downloads';
    a.target = '_blank';
    fine.appendChild(a);

    [label, input, error, hp, go, fine].forEach(function (n) { f.appendChild(n); });

    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true' && valid(input.value.trim())) { input.removeAttribute('aria-invalid'); error.hidden = true; }
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = input.value.trim();
      if (!valid(email)) {
        input.setAttribute('aria-invalid', 'true');
        error.hidden = false;
        input.focus();
        return;
      }
      if (!trap.value) { remember(email); send(o.product, o.file, email); }
      done(email);   // in the same click as the button, so a download, a share menu or a mail app may open
    });
    return { form: f, input: input, close: close };
  }

  function supported() { return typeof HTMLDialogElement === 'function' && 'showModal' in HTMLDialogElement.prototype; }

  function dialog(o, done) {
    style();
    var d = el('dialog', 'dg');
    var finished = false;
    var parts = form(o, false, function (email) {
      finished = true;
      d.close();
      done(email);
    });
    d.appendChild(parts.form);
    d.setAttribute('aria-labelledby', parts.form.querySelector('.dg__title').id);
    parts.close.addEventListener('click', function () { d.close(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });   // a click beside the panel
    d.addEventListener('close', function () { d.remove(); });
    document.body.appendChild(d);
    d.showModal();
    parts.input.focus();
    return d;
  }

  /* Ask for the address, then call done(email). With o.mount the form goes into that element instead of a dialog.
     A buyer, a visitor whose address is known, or a browser without <dialog> goes straight on (done(known address or null)). */
  function run(o, done) {
    if (bought(o.product)) return done(null);
    var known = remembered();
    if (known) { send(o.product, o.file, known.e); return done(known.e); }
    if (o.mount) {
      style();
      var parts = form(o, true, done);
      o.mount.textContent = '';
      o.mount.appendChild(parts.form);
      return;
    }
    if (!supported()) return done(null);
    dialog(o, done);
  }

  // ------------------------------------------------------------------------------------------------ the links
  function fileOf(a) {
    var f = a.getAttribute('data-gate-file');
    if (f) return f;
    try { return decodeURIComponent(new URL(a.href, location.href).pathname.split('/').pop()); } catch (e) { return ''; }
  }
  // an e-mail link the visitor sends to themselves: their address goes in as the recipient
  function address(a, email) {
    if (!email || !a.hasAttribute('data-gate-mailto')) return;
    if (!/^[^\s?&#%]+@[^\s?&#%]+$/.test(email)) return;
    var href = a.getAttribute('href') || '';
    if (/^mailto:/i.test(href)) a.setAttribute('href', href.replace(/^mailto:[^?]*/i, 'mailto:' + email));
  }

  var passing = null;   // the link let through after the address is in
  window.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[data-gate]');
    if (!a || e.button !== 0) return;
    if (passing === a) { passing = null; return; }
    var o = {
      product: a.getAttribute('data-gate'),
      file: fileOf(a),
      title: a.getAttribute('data-gate-title'),
      text: a.getAttribute('data-gate-text'),
      button: (a.textContent || '').replace(/\s+/g, ' ').trim()
    };
    if (bought(o.product)) return;
    var known = remembered();
    if (known) { send(o.product, o.file, known.e); address(a, known.e); return; }
    if (!supported()) return;
    // held back before the page's own listeners (statistics, pixel, share menu) see it; they see the click that follows
    e.preventDefault();
    e.stopImmediatePropagation();
    dialog(o, function (email) {
      address(a, email);
      passing = a;
      a.click();
    });
  }, true);

  window.DownloadGate = { run: run, remembered: remembered };
})();
