/* Colobri on davidhjalmarlindberg.com: the cookie choice and the Meta pixel.
   The pixel loads only after a visitor accepts it, and only when PIXEL_ID is set: until then there is no banner and nothing is tracked.
   Events: PageView on every Colobri page, ViewContent on the Colobri page, StartTrial on the plugin downloads and on the browser app,
   InitiateCheckout on Buy, and Purchase on the thank-you page, once, for a visitor who came to it through Buy. */
(function () {
  'use strict';
  var PIXEL_ID = '4475247569405091';   // the Meta pixel (the product's dataset in the David HJ Lindberg AB business portfolio). Empty: no banner, no pixel.
  var KEY = 'colobri.cookies';       // 'yes' or 'no': the visitor's choice, kept in this browser
  var BOUGHT = 'colobri.checkout';   // when a visitor who accepted pressed Buy, so the thank-you page counts that purchase once
  var PRICE = { value: 59, currency: 'EUR' };

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
    for (var i = 0; i < queue.length; i++) window.fbq('track', queue[i][0], queue[i][1]);
    queue = [];
  }
  /** count an event: at once if the visitor accepted, held until they choose if they have not, never if they declined */
  function track(name, params) {
    if (!PIXEL_ID) return false;
    var c = get(KEY);
    if (c === 'yes') { load(); window.fbq('track', name, params || {}); return true; }
    if (c == null) queue.push([name, params || {}]);
    return false;
  }
  window.cbTrack = track;

  // ------------------------------------------------------------------------------------------------ the banner
  var css = '.cbc{position:fixed;z-index:60;left:max(16px,env(safe-area-inset-left,0px));right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));max-width:470px;padding:20px 22px;border-radius:14px;background:#151517;border:1px solid rgba(255,255,255,0.12);box-shadow:0 24px 60px rgba(0,0,0,0.55);color:#CFCFCF;font:400 14px/1.42859 -apple-system,BlinkMacSystemFont,\'Inter Web\',\'Helvetica Neue\',Helvetica,Arial,sans-serif;letter-spacing:-0.0055em;-webkit-font-smoothing:antialiased}'
    + '.cbc p{margin:0;text-wrap:pretty}.cbc strong{color:#EFEFEF;font-weight:500}.cbc a{color:#EFEFEF;text-underline-offset:3px}'
    + '.cbc__btns{display:flex;gap:10px;margin-top:16px}'
    + '.cbc button{flex:1 1 0;min-height:46px;padding:0 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.22);background:transparent;color:#EFEFEF;font:inherit;font-weight:500;cursor:pointer;transition:background .2s ease,border-color .2s ease}'
    + '.cbc button:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.5)}.cbc button:focus-visible,.cbc a:focus-visible{outline:2px solid #BACAFB;outline-offset:3px}'
    + '@media (prefers-reduced-motion:reduce){.cbc button{transition:none}}';
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
    put(BOUGHT, null);
    if (was === 'yes') { forgetMeta(); location.reload(); }
  }
  function ask() {
    if (box || !PIXEL_ID) return;
    if (!document.getElementById('cbc-css')) { var st = document.createElement('style'); st.id = 'cbc-css'; st.textContent = css; document.head.appendChild(st); }
    box = document.createElement('section');
    box.className = 'cbc';
    box.setAttribute('aria-label', 'Cookies');
    box.innerHTML = '<p><strong>May we use a Meta pixel?</strong> It shows us which of our Instagram and Facebook ads bring people here, and it lets Meta set cookies. Nothing is sent unless you accept. <a href="/colobri/privacy/#cookies">Read more</a></p>'
      + '<div class="cbc__btns"><button type="button" data-v="no">Decline</button><button type="button" data-v="yes">Accept</button></div>';
    box.addEventListener('click', function (e) { var b = e.target.closest('button[data-v]'); if (b) choose(b.getAttribute('data-v')); });
    document.body.appendChild(box);
  }

  // ------------------------------------------------------------------------------------------------ what the page counts
  function wire() {
    if (!PIXEL_ID) return;
    var links = document.querySelectorAll('[data-cb-cookies]');
    for (var i = 0; i < links.length; i++) { links[i].hidden = false; links[i].addEventListener('click', function (e) { e.preventDefault(); close(); ask(); var b = box && box.querySelector('button'); if (b) b.focus(); }); }
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-cb-track]');
      if (!a) return;
      var ev = a.getAttribute('data-cb-track');
      if (ev === 'InitiateCheckout') {
        var sent = track('InitiateCheckout', { value: PRICE.value, currency: PRICE.currency, content_name: 'Colobri', content_type: 'product', num_items: 1 });
        if (sent) {
          put(BOUGHT, String(Date.now()));
          var href = a.getAttribute('href');   // (a moment for the event to leave before the checkout opens)
          if (href && /^https:/.test(href) && a.target !== '_blank' && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); setTimeout(function () { location.href = href; }, 300); }
        }
      } else if (ev === 'StartTrial') {
        track('StartTrial', { content_name: a.getAttribute('data-cb-what') || 'Colobri' });
      }
    });
    var page = document.body.getAttribute('data-cb-page');
    if (page === 'colobri') track('ViewContent', { value: PRICE.value, currency: PRICE.currency, content_name: 'Colobri', content_type: 'product' });
    if (page === 'thanks') {
      var t = Number(get(BOUGHT));
      if (t && Date.now() - t < 6 * 36e5 && get(KEY) === 'yes') { put(BOUGHT, null); track('Purchase', { value: PRICE.value, currency: PRICE.currency, content_name: 'Colobri', content_type: 'product', num_items: 1 }); }
    }
    var c = get(KEY);
    if (c === 'yes') load(); else if (c == null) ask();
  }
  // ------------------------------------------------------------------------------------------------ the downloads
  // the download for this visitor's system first (Download for Mac, Download for Windows: data-cb-os)
  function order() {
    var plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '', win = /win/i.test(plat) || /Windows NT/.test(navigator.userAgent || '');
    if (!win) return;
    var wins = document.querySelectorAll('[data-cb-os="win"]');
    for (var i = 0; i < wins.length; i++) { var mac = wins[i].parentNode.querySelector('[data-cb-os="mac"]'); if (mac) wins[i].parentNode.insertBefore(wins[i], mac); }
  }
  function ready() { order(); wire(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
