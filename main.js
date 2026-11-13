/* davidhjalmarlindberg.com: the lines set as wide as the page, the picture that travels to its page, and Copy address.
   Every page that uses style.css loads this file with <script src="/main.js" defer></script>. */
(function () {
  'use strict';
  var root = document.documentElement;

  /* ---------- lines set as wide as the page ----------
     The front page's headline (class "fit") and every page's address are set exactly as wide as the page: their size is the page's width
     divided by the width of their letters. style.css holds that measure for Helvetica Neue. Here the words are measured in the font
     the visitor really has, and as they now read (the headline can be changed in the site editor), and the measure is passed to
     style.css in --fit (the width of the letters, in em) and --fit-left (where the first letter's ink begins, in em). */
  var fits = document.querySelectorAll('.fit, .email');
  var measure = function () {
    var ctx;
    try { ctx = document.createElement('canvas').getContext('2d'); } catch (e) {}
    if (!ctx || !('letterSpacing' in ctx)) return;   // (older browsers keep the measure in style.css)
    [].forEach.call(fits, function (el) {
      var cs = getComputedStyle(el), size = parseFloat(cs.fontSize);
      if (!size) return;
      ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' 200px ' + cs.fontFamily;
      ctx.letterSpacing = ((parseFloat(cs.letterSpacing) || 0) / size * 200) + 'px';
      var left = Infinity, right = -Infinity;
      (el.innerText || el.textContent || '').split('\n').forEach(function (line) {
        line = line.replace(/\s+/g, ' ').trim();
        if (!line) return;
        var box = ctx.measureText(line);
        left = Math.min(left, -box.actualBoundingBoxLeft);
        right = Math.max(right, box.actualBoundingBoxRight);
      });
      if (!(right - left > 20)) return;
      el.style.setProperty('--fit', ((right - left) / 200 * 1.0006).toFixed(4));   // (a hair wider than measured, so rounding never pushes it past the edge)
      el.style.setProperty('--fit-left', (left / 200).toFixed(4));
    });
  };
  if (fits.length) {
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  }

  /* ---------- settled ----------
     Once a page has arrived at its place, <html> gets the class "settled": from then on links within the page glide.
     Before that it would show as the page finds its place (at #work, or where it was left), which is not something the visitor did. */
  var settle = function () { setTimeout(function () { root.classList.add('settled'); }, 150); };
  if (document.readyState === 'complete') settle(); else window.addEventListener('load', settle);

  /* ---------- a project's picture travels to the top of its page ----------
     style.css gives the picture at the top of a project page the name "picture". The picture pressed here gets the same name,
     so the browser moves the one into the other (where it can; elsewhere the page just loads). */
  var name = function (frame) {
    [].forEach.call(document.querySelectorAll('.project .image-frame'), function (f) { f.style.viewTransitionName = ''; });
    if (frame) frame.style.viewTransitionName = 'picture';
  };
  document.addEventListener('click', function (e) {
    var link = e.target && e.target.closest && e.target.closest('a.project');
    if (link) name(link.querySelector('.image-frame'));
  }, true);
  // and back again: arriving from a project's page, its picture here takes the name
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition || !window.navigation || !navigation.activation || !navigation.activation.from) return;
    var from;
    try { from = new URL(navigation.activation.from.url).pathname.replace(/index\.html$/, ''); } catch (err) { return; }
    var match = null;
    [].forEach.call(document.querySelectorAll('a.project'), function (link) {
      if (new URL(link.href).pathname === from) match = link;
    });
    name(match && match.querySelector('.image-frame'));
  });

  /* ---------- Copy address ---------- */
  var copy = document.querySelector('.copy'), address = document.querySelector('.email');
  if (copy && address && navigator.clipboard && navigator.clipboard.writeText) {
    var label = copy.textContent, timer;
    copy.hidden = false;
    copy.addEventListener('click', function () {
      navigator.clipboard.writeText(address.textContent.trim()).then(function () {
        copy.textContent = copy.getAttribute('data-done') || label;
        copy.classList.add('done');
        clearTimeout(timer);
        timer = setTimeout(function () { copy.textContent = label; copy.classList.remove('done'); }, 2000);
      }).catch(function () {});
    });
  }
})();
