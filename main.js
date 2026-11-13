/* davidhjalmarlindberg.com: the lights, the picture that travels to its page, and Copy address.
   Every page that uses style.css loads this file with <script src="/main.js" defer></script>.

   The lights. A part of a page marked data-lights="down" (the work on the front page) turns the lights down
   while it fills the screen, and a part marked data-lights="up" (the footer of a project page) turns them up.
   Everywhere else a page keeps the state it began in: paper, or black on the pages whose <html> has data-lights="down".
   The state is the data-lights attribute on <html>, which style.css reads. Without this file a page simply stays as it began. */
(function () {
  'use strict';
  var root = document.documentElement;

  /* ---------- the lights ---------- */
  var zones = [].slice.call(document.querySelectorAll('body [data-lights]'));
  if (zones.length) {
    var base = zones[0].getAttribute('data-lights') === 'up' ? 'down' : 'up';
    var theme = document.querySelector('meta[name="theme-color"]');
    var ground = { up: '#f4f3ef', down: '#000000' };   // the browser's own bars follow the ground

    var wanted = function () {
      var vh = window.innerHeight, state = base;
      // a page opens in its own light whatever the size of the screen: the lights only change once it has been scrolled a little
      var furthest = document.documentElement.scrollHeight - vh;
      if (furthest <= 0 || window.scrollY < Math.min(120, furthest)) return state;
      zones.forEach(function (zone) {
        var r = zone.getBoundingClientRect(), kind = zone.getAttribute('data-lights');
        if (kind === 'down') {
          // down once the part has risen past the upper two fifths of the screen, up again when its end has
          if (r.top < vh * 0.4 && r.bottom > vh * 0.6) state = 'down';
        } else if (vh - r.top > Math.min(r.height * 0.6, vh * 0.4)) {
          state = 'up';   // up when most of the part is in view
        }
      });
      return state;
    };
    var set = function () {
      var state = wanted();
      if (root.getAttribute('data-lights') !== state) root.setAttribute('data-lights', state);
      if (theme && theme.content !== ground[state]) theme.content = ground[state];
      // this place in the browser's history remembers its light, so that coming back to the page or reloading it does not start in the wrong one
      // (kept with the page's history entry, not stored on the device)
      try {
        if (!history.state || history.state.lights !== state) history.replaceState(Object.assign({}, history.state, { lights: state }), '');
      } catch (e) {}
    };

    var queued = false;
    var onScroll = function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; set(); });
    };
    // (not set here at once: a page that opens at #work, or is reloaded half way down, is not at its place yet,
    //  and the line in its <head> has already given it the light it was left in)
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('pageshow', set);
    if (document.readyState === 'complete') set(); else window.addEventListener('load', set);
  }

  /* ---------- settled ----------
     Once a page has arrived at its place, <html> gets the class "settled": from then on the lights fade and links within the page glide.
     Before that both would show as the page finds its place (at #work, or where it was left), which is not something the visitor did. */
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
