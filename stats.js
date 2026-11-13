/* davidhjalmarlindberg.com: the site's own statistics. Every page loads this file with
   <script src="/stats.js" defer></script>.

   It sends each count to the site's collector, a Google Apps Script web app (its source is
   /stats-collector.gs), which adds the counts up per day in the Google Sheet "Statistik för
   davidhjalmarlindberg.com" in David's Drive. The statistics dashboard in Claude reads that sheet.

   Nothing is stored on the visitor's device and nothing identifies them: no cookie, no id, and the
   request goes without cookies, so Google can't tie it to a Google account. Apps Script never sees
   the IP address. A visit is a page view that came from outside the site. The country comes from
   the time zone, the device, browser and system from the browser's own description of itself.

   Counted:
     page view           per page (missing pages as 404, with the address that was asked for)
     visit               a page view from outside the site: where it came from (the referring site,
                         or utm_source; utm_campaign), time zone, device, browser, system, language
     from the site       a page view of Andrum or Colobri that came from another part of the site
     time on the page    the seconds the page was in view
     download            a click on a download (.dmg .exe .zip .pkg .msi under /download/)
     buy                 a click on Buy (and Andrum's in-app Buy button, which opens /andrum/buy/)
     notify              a click on "Tell me when it's on sale"
     mail, out           a click on an e-mail link, or on a link to another site
     use, exp            in Colobri in the browser (/colobri/app/): a frame or a clip opened, Generate and variations made
                         (use: bild, klipp, generera, variationer), and each export by kind (exp: lut, capcut, png, jpg,
                         klipp). The app hands them over through window.colobriStat (its tally()); what it did before this
                         file ran waits in window.__colobriStats. Nothing about the images is sent.

   ?stats=off on any page stops the counting in that browser (a flag in localStorage, set only when
   asked for) and ?stats=on starts it again. ?stats=test sends that page's counts to the sheet's
   Test tab instead. */
(function () {
  'use strict';
  var COLLECTOR = 'https://script.google.com/macros/s/AKfycbzAxRBJJ3Ye9d7uVjYTOEIfM--ebkrDToTGJ05YVL8s1462Mr4qS8DPadJ7mMQ_NW7Q/exec';
  var HOST = 'davidhjalmarlindberg.com';
  var OFF = 'davidhjalmarlindberg.stats.off';

  if (location.protocol !== 'https:' || location.hostname !== HOST) return;   // (previews and copies elsewhere are not counted)
  try { if (window.top !== window.self) return; } catch (e) { return; }      // (nor pages shown inside another page)

  var flag = (/[?&]stats=(off|on|test)(&|$)/.exec(location.search) || [])[1];
  try {
    if (flag === 'off') localStorage.setItem(OFF, '1');
    if (flag === 'on') localStorage.removeItem(OFF);
    if (localStorage.getItem(OFF) === '1') return;
  } catch (e) {}

  var ua = navigator.userAgent || '';
  if (navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly/i.test(ua)) return;

  var path = location.pathname.replace(/\/index\.html$/, '/');
  var missing = !!document.querySelector('main.lost');   // the 404 page
  var test = flag === 'test';

  function send(hit) {
    hit.v = 1;
    hit.p = path;
    if (missing) hit.nf = 1;
    if (test) hit.test = 1;
    var body = JSON.stringify(hit);
    try {
      fetch(COLLECTOR, { method: 'POST', body: body, mode: 'no-cors', credentials: 'omit', keepalive: true }).catch(function () {});
    } catch (e) {
      try { navigator.sendBeacon(COLLECTOR, body); } catch (e2) {}
    }
  }

  function zone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
  }
  var touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;   // an iPad that asks for the desktop site
  function device() {
    if (/iPad|Tablet/.test(ua) || touchMac || (/Android/.test(ua) && !/Mobile/.test(ua))) return 't';
    if (/Mobi|iPhone|iPod|Android/.test(ua)) return 'm';
    return 'd';
  }
  function browser() {
    if (/Instagram/.test(ua)) return 'Instagram';
    if (/FBAN|FBAV|FB_IAB|FBIOS/.test(ua)) return 'Facebook';
    if (/Edg(e|A|iOS)?\//.test(ua)) return 'Edge';
    if (/OPR\/|Opera/.test(ua)) return 'Opera';
    if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
    if (/Firefox\/|FxiOS/.test(ua)) return 'Firefox';
    if (/Chrome\/|CriOS/.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua)) return 'Safari';
    return '';
  }
  function system() {
    if (/iPad/.test(ua) || touchMac) return 'iPadOS';
    if (/iPhone|iPod/.test(ua)) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    if (/CrOS/.test(ua)) return 'ChromeOS';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Macintosh|Mac OS X/.test(ua)) return 'macOS';
    if (/Linux/.test(ua)) return 'Linux';
    return '';
  }
  function source(host, params) {
    var tagged = (params.get('utm_source') || params.get('ref') || '').trim().toLowerCase();
    if (tagged) return tagged.slice(0, 60);
    if (host) {
      host = host.replace(/^(www|m|l|lm|mobile)\./, '');
      if (/^google\.|\.google\.|^com\.google\.android\.googlequicksearchbox$/.test(host)) return 'google.com';
      if (host === 'com.google.android.gm') return 'gmail.com';
      if (host === 't.co') return 'x.com';
      if (host === 'lnkd.in') return 'linkedin.com';
      return host.slice(0, 60);
    }
    if (/Instagram/.test(ua)) return 'instagram.com';
    if (/FBAN|FBAV|FB_IAB|FBIOS/.test(ua)) return 'facebook.com';
    if (params.has('fbclid')) return 'facebook.com';   // a link from Facebook or Instagram, opened elsewhere
    return '';                                          // typed, a bookmark, or an app: counted as direct
  }

  function countView() {
    var params = new URLSearchParams(location.search), from = null;
    try { if (document.referrer) from = new URL(document.referrer); } catch (e) {}
    var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
    var again = nav.type === 'reload' || nav.type === 'back_forward';
    var inside = from && (from.hostname === HOST || from.hostname === 'www.' + HOST);
    var fromApp = inside && /^\/andrum\/buy(\/|\/index\.html)?$/.test(from.pathname);   // Buy in the Andrum app opens /andrum/buy/, which comes here
    var hit = { k: 'pv' };
    if (inside && !fromApp) {
      if (!again) hit.r = from.pathname;
    } else if (!again) {
      hit.e = 1;
      hit.s = fromApp ? 'andrum-appen' : source(from && from.protocol !== 'file:' ? from.hostname.toLowerCase() : '', params);
      var campaign = params.get('utm_campaign');
      if (campaign) hit.c = campaign.trim().slice(0, 60);
      hit.z = zone();
      hit.d = device();
      hit.b = browser();
      hit.o = system();
      hit.l = (navigator.language || '').toLowerCase().split('-')[0];
    }
    send(hit);
    if (fromApp && !again) send({ k: 'ev', n: 'buy', x: 'andrum-appen' });
  }

  // Time on the page: the seconds it is in view, sent each time it goes out of view.
  var shownAt = document.visibilityState === 'visible' ? Date.now() : 0, ms = 0, first = true;
  function sendTime() {
    if (shownAt) { ms += Date.now() - shownAt; shownAt = 0; }
    var seconds = Math.round(ms / 1000);
    if (seconds < 1) return;
    send({ k: 't', sec: Math.min(seconds, 1800), f: first ? 1 : 0 });
    first = false;
    ms = 0;
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') sendTime();
    else if (!shownAt) shownAt = Date.now();
  });
  window.addEventListener('pagehide', sendTime);

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch (err) { return; }

    if (/\/download\/[^/]+\.(dmg|exe|zip|pkg|msi)$/i.test(url.pathname)) {
      send({ k: 'ev', n: 'dl', x: decodeURIComponent(url.pathname.split('/').pop()), z: zone() });
    } else if (a.hasAttribute('data-cb-buy') || a.hasAttribute('data-an-buy') || a.getAttribute('data-cb-track') === 'InitiateCheckout' || /(^|\.)lemonsqueezy\.com$/.test(url.hostname)) {
      send({ k: 'ev', n: 'buy' });
    } else if (url.protocol === 'mailto:') {
      if (/sale/i.test(decodeURIComponent(url.search))) send({ k: 'ev', n: 'notify' });
      else send({ k: 'ev', n: 'mail', x: decodeURIComponent(url.pathname) });
    } else if (/^https?:$/.test(url.protocol) && url.hostname !== location.hostname) {
      send({ k: 'ev', n: 'out', x: url.hostname.replace(/^www\./, '') });
    }
  }, true);

  // Colobri in the browser counts what is done in it (above): from here on its tally() sends each through window.colobriStat
  if (/^\/colobri\/app\/$/.test(path)) {
    var APP = { use: /^(bild|klipp|generera|variationer)$/, exp: /^(lut|capcut|png|jpg|klipp)$/ };
    var appCount = function (n, x) { if (APP.hasOwnProperty(n) && typeof x === 'string' && APP[n].test(x)) send({ k: 'ev', n: n, x: x }); };
    var waiting = window.__colobriStats;
    window.colobriStat = appCount;
    if (waiting && waiting.length) { for (var i = 0; i < waiting.length; i++) appCount(waiting[i][0], waiting[i][1]); waiting.length = 0; }
  }

  if (document.prerendering) document.addEventListener('prerenderingchange', countView, { once: true });
  else countView();
})();
