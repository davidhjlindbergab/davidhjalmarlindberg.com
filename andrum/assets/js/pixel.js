/* Andrum on davidhjalmarlindberg.com: the cookie choice and the Meta pixel, the same pixel as the Colobri pages.
   The pixel loads only after a visitor accepts it. The choice is shared with the Colobri pages (one site, one question):
   a visitor who answered there is not asked again here, and the other way round.
   Events: PageView and ViewContent on the Andrum page, StartTrial on the Mac and Windows downloads and on
   "Send the link to my computer" (a phone's way to the trial; content_category says which), Lead on
   "Tell me when it's on sale", and from the store (store.js, through window.andrumPixel)
   InitiateCheckout when the checkout opens and Purchase when an order is paid. */
(function () {
  'use strict';
  var PIXEL_ID = '4475247569405091';   // the Meta pixel, the dataset named davidhjalmarlindberg.com in the David HJ Lindberg AB business portfolio (as in colobri/site.js). Empty: no banner, no pixel.
  var KEY = 'colobri.cookies';         // 'yes' or 'no': the visitor's choice, kept in this browser (the key the Colobri pages use)
  var PRODUCT = { content_name: 'Andrum', content_type: 'product', value: 59, currency: 'EUR' };

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* (private window: asked again next time) */ } }

  var queue = [], loaded = false;
  function load() {
    if (loaded || !PIXEL_ID) return;
    loaded = true;
    /* Meta's pixel base code */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
    for (var i = 0; i < queue.length; i++) send(queue[i][0], queue[i][1], queue[i][2]);
    queue = [];
  }
  function send(name, params, options) {
    if (options) window.fbq('track', name, params || {}, options); else window.fbq('track', name, params || {});
  }
  /** count an event: at once if the visitor accepted, held until they choose if they have not, never if they declined.
      options: Meta's fourth argument, e.g. { eventID: the order's id } so an order is counted once */
  function track(name, params, options) {
    if (!PIXEL_ID) return;
    var c = get(KEY);
    if (c === 'yes') { load(); send(name, params, options); }
    else if (c == null) queue.push([name, params || {}, options]);
  }
  window.andrumPixel = track;   // (the store: assets/js/store.js)

  // ------------------------------------------------------------------------------------------------ the banner (in the Andrum page's own look)
  var css = '.anc{position:fixed;z-index:60;left:max(16px,env(safe-area-inset-left,0px));right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));max-width:470px;padding:20px 22px;border-radius:16px;background:#0e0f1b;border:1px solid rgba(255,255,255,0.12);box-shadow:0 24px 60px rgba(0,0,0,0.6);color:#9aa3b4;font:400 14px/1.5 "Andrum Text","Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}'
    + '.anc p{margin:0;text-wrap:pretty}.anc strong{color:#f3f5f9;font-weight:500}.anc a{color:#f3f5f9;text-underline-offset:3px}'
    + '.anc__btns{display:flex;gap:10px;margin-top:16px}'
    + '.anc button{flex:1 1 0;min-height:44px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,255,255,0.22);background:transparent;color:#f3f5f9;font:inherit;font-size:15px;cursor:pointer;transition:background .2s ease,border-color .2s ease}'
    + '.anc button:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.5)}.anc button:focus-visible,.anc a:focus-visible{outline:2px solid #b4b3da;outline-offset:3px}'
    + '@media (prefers-reduced-motion:reduce){.anc button{transition:none}}';
  var box = null;
  function close() { if (box) { box.remove(); box = null; } }
  function forgetMeta() {   // (a visitor who takes back their yes: Meta's cookies go, and the page reloads without the pixel)
    var host = location.hostname.replace(/^www\./, ''), names = ['_fbp', '_fbc'];
    for (var i = 0; i < names.length; i++) {
      document.cookie = names[i] + '=; Max-Age=0; path=/';
      document.cookie = names[i] + '=; Max-Age=0; path=/; domain=.' + host;
    }
  }
  function choose(v) {
    var was = get(KEY);
    put(KEY, v);
    close();
    if (v === 'yes') { load(); return; }
    queue = [];
    if (was === 'yes') { forgetMeta(); location.reload(); }
  }
  function ask() {
    if (box || !PIXEL_ID) return;
    if (!document.getElementById('anc-css')) { var st = document.createElement('style'); st.id = 'anc-css'; st.textContent = css; document.head.appendChild(st); }
    box = document.createElement('section');
    box.className = 'anc';
    box.setAttribute('aria-label', 'Cookies');
    box.innerHTML = '<p><strong>May we use a Meta pixel?</strong> It shows us which of our Instagram and Facebook ads bring people here, and it lets Meta set cookies. Nothing is sent unless you accept. <a href="/privacy/#cookies">Read more</a></p>'
      + '<div class="anc__btns"><button type="button" data-v="no">Decline</button><button type="button" data-v="yes">Accept</button></div>';
    box.addEventListener('click', function (e) { var b = e.target.closest('button[data-v]'); if (b) choose(b.getAttribute('data-v')); });
    document.body.appendChild(box);
  }

  // ------------------------------------------------------------------------------------------------ what the page counts
  function ready() {
    if (!PIXEL_ID) return;
    var links = document.querySelectorAll('[data-an-cookies]');   // "Cookie settings" in the footer
    for (var i = 0; i < links.length; i++) {
      links[i].hidden = false;
      links[i].addEventListener('click', function (e) { e.preventDefault(); close(); ask(); var b = box && box.querySelector('button'); if (b) b.focus(); });
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (/download\/[^/]+\.(dmg|exe)$/i.test(href)) track('StartTrial', { content_name: 'Andrum', content_category: /\.exe$/i.test(href) ? 'Windows' : 'Mac' });
      else if (a.hasAttribute('data-an-send-link')) track('StartTrial', { content_name: 'Andrum', content_category: 'Link to a computer' });
      else if (/^mailto:/i.test(href) && /sale/i.test(decodeURIComponent(href))) track('Lead', { content_name: 'Andrum' });
    });
    track('ViewContent', PRODUCT);
    var c = get(KEY);
    if (c === 'yes') load(); else if (c == null) ask();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
