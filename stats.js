/* davidhjalmarlindberg.com: the site's statistics, with GoatCounter (https://www.goatcounter.com).
   GoatCounter sets no cookies and keeps nothing that identifies a visitor, so it needs no cookie question and every visit counts.
   It counts every page view, and these as events:
     download/<file>        a download, per file and version (Andrum and Colobri, Mac and Windows)
     buy/<product>          a press on Buy
     notify/andrum          "Tell me when it's on sale" on the Andrum page
     email                  an e-mail link
     out/<site>             a link to another site (Instagram, SoundCloud, the App Store ...)
   The numbers are at https://davidhjalmarlindberg.goatcounter.com (the dashboard; sign in there).
   Every page loads this file with <script src="/stats.js" defer></script>. */
(function () {
  'use strict';
  var CODE = 'davidhjalmarlindberg';   // the GoatCounter site code: davidhjalmarlindberg.goatcounter.com
  if (location.protocol !== 'https:' || !/davidhjalmarlindberg\.com$/.test(location.hostname)) return;   // (previews and copies elsewhere are not counted)

  var gc = document.createElement('script');
  gc.async = true;
  gc.src = 'https://gc.zgo.at/count.js';
  gc.setAttribute('data-goatcounter', 'https://' + CODE + '.goatcounter.com/count');
  document.head.appendChild(gc);

  function product() {
    var m = /^\/(andrum|colobri)\//.exec(location.pathname);
    return m ? m[1] : 'site';
  }
  function count(path, title) {
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: path, title: title, event: true });
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href'), url;
    try { url = new URL(href, location.href); } catch (err) { return; }

    if (/\/download\/[^/]+\.(dmg|exe|zip|pkg)$/i.test(url.pathname)) {
      var file = decodeURIComponent(url.pathname.split('/').pop());
      count('download/' + file, 'Download: ' + file);
    } else if (a.hasAttribute('data-cb-buy') || a.getAttribute('data-cb-track') === 'InitiateCheckout' || /lemonsqueezy\.com$/.test(url.hostname)) {
      count('buy/' + product(), 'Buy: ' + product());
    } else if (url.protocol === 'mailto:') {
      if (/sale/i.test(decodeURIComponent(url.search))) count('notify/' + product(), 'Tell me when it is on sale: ' + product());
      else count('email', 'E-mail');
    } else if (/^https?:$/.test(url.protocol) && url.hostname !== location.hostname) {
      var site = url.hostname.replace(/^www\./, '');
      count('out/' + site, 'Link out: ' + site);
    }
  }, true);
})();
