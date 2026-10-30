/*
  Buying Andrum on this page.

  Every Buy button opens Lemon Squeezy's checkout over the page. Its script (Lemon.js) loads only
  when someone reaches for a Buy button; if it can't load, the button goes to the checkout's own
  page instead, and without JavaScript the buttons go to buy/, which forwards there too. After a
  purchase, the price panel says where the licence key went and how to add it.

  CHECKOUT is the Andrum product's checkout link (Lemon Squeezy: Products, Andrum, Share). The same
  link is in ../../buy/index.html: change both when the store goes live.

  Campaign names (utm_source, utm_medium, utm_campaign, utm_content, utm_term in the address an ad
  links to) travel with the order as its custom data, so each order shows which campaign it came
  from. Nothing is stored on the visitor's computer for that.

  Measuring ads: put an id into MEASURE and the page asks each visitor once whether it may measure
  which ads bring people here. Only if they allow it does it load Meta's pixel and/or Google's tag,
  and report a download (StartTrial), a checkout opened (InitiateCheckout) and a purchase. With
  MEASURE empty, nothing loads and nobody is asked.
*/
(function () {
  "use strict";

  var CHECKOUT = "https://davidhjalmarlindberg.lemonsqueezy.com/checkout/buy/a5a37f02-4e39-4237-87ed-7d6af71e3e5b";
  var PRICE = 59, CURRENCY = "EUR";
  var MEASURE = {
    metaPixel: "",            // Meta (Facebook and Instagram) pixel id, e.g. "123456789012345"
    googleTag: "",            // Google tag id: "G-..." (Analytics) or "AW-..." (Google Ads)
    googleAdsPurchase: "",    // Google Ads conversion for a purchase: "AW-.../..."
    googleAdsTrial: ""        // Google Ads conversion for a download: "AW-.../..."
  };

  var doc = document;
  var CAMPAIGN = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

  function checkoutUrl() {
    var url = CHECKOUT + (CHECKOUT.indexOf("?") < 0 ? "?" : "&") + "dark=1";
    var q;
    try { q = new URLSearchParams(window.location.search); } catch (e) { return url; }
    for (var i = 0; i < CAMPAIGN.length; i++) {
      var v = q.get(CAMPAIGN[i]);
      if (v) url += "&" + encodeURIComponent("checkout[custom][" + CAMPAIGN[i] + "]") + "=" + encodeURIComponent(v.slice(0, 120));
    }
    return url;
  }

  // ---------------------------------------------------------------------------------- the checkout
  var lemon = null;

  function loadLemon() {
    if (lemon) return lemon;
    lemon = new Promise(function (resolve, reject) {
      var s = doc.createElement("script");
      s.src = "https://app.lemonsqueezy.com/js/lemon.js";
      s.async = true;
      s.onload = function () {
        try {
          if (!window.LemonSqueezy && typeof window.createLemonSqueezy === "function") window.createLemonSqueezy();
          window.LemonSqueezy.Setup({ eventHandler: onLemonEvent });
          resolve(window.LemonSqueezy);
        } catch (e) { reject(e); }
      };
      s.onerror = function () { lemon = null; reject(new Error("Lemon.js didn't load")); };
      doc.head.appendChild(s);
    });
    return lemon;
  }

  function buyButton(t) {
    return t && t.closest ? t.closest("[data-an-buy]") : null;
  }

  // reaching for a Buy button starts loading the checkout, so it opens at once on the click
  doc.addEventListener("pointerover", function (e) { if (buyButton(e.target)) loadLemon().catch(function () {}); }, { passive: true });
  doc.addEventListener("focusin", function (e) { if (buyButton(e.target)) loadLemon().catch(function () {}); });

  doc.addEventListener("click", function (e) {
    var a = buyButton(e.target);
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    var url = checkoutUrl();
    track("checkout");
    var settled = false;
    var fallback = window.setTimeout(function () {
      if (settled) return;
      settled = true;
      window.location.href = url;
    }, 5000);
    loadLemon().then(function (LS) {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallback);
      LS.Url.Open(url);
    }).catch(function () {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallback);
      window.location.href = url;
    });
  });

  function onLemonEvent(ev) {
    if (!ev || ev.event !== "Checkout.Success") return;
    var d = ev.data || {};
    var order = (d.order && d.order.data) || d.data || d;
    var at = (order && order.attributes) || {};
    var total = typeof at.total === "number" ? at.total / 100 : PRICE;
    track("purchase", {
      id: String(at.identifier || at.order_number || (order && order.id) || ""),
      value: total,
      currency: String(at.currency || CURRENCY).toUpperCase()
    });
    showThanks(at.user_email || "");
  }

  function showThanks(email) {
    var main = doc.querySelector("[data-an-price]");
    var thanks = doc.querySelector("[data-an-thanks]");
    if (!thanks) return;
    var who = thanks.querySelector("[data-an-thanks-email]");
    if (who && email) who.textContent = email;
    if (main) main.hidden = true;
    thanks.hidden = false;
    try { thanks.focus({ preventScroll: true }); } catch (e) { thanks.focus(); }
    thanks.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // ---------------------------------------------------------------------------------- measuring ads
  var CONSENT = "andrum-measure";          // "yes" or "no", once the visitor has chosen
  var measuring = !!(MEASURE.metaPixel || MEASURE.googleTag);
  var loaded = false;

  function choice() { try { return window.localStorage.getItem(CONSENT); } catch (e) { return null; } }
  function remember(v) { try { window.localStorage.setItem(CONSENT, v); } catch (e) { /* asked again next time */ } }

  function loadTags() {
    if (loaded) return;
    loaded = true;
    if (MEASURE.metaPixel) {
      /* Meta's pixel loader */
      var f = window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
      if (!window._fbq) window._fbq = f;
      f.push = f; f.loaded = true; f.version = "2.0"; f.queue = [];
      var m = doc.createElement("script");
      m.async = true; m.src = "https://connect.facebook.net/en_US/fbevents.js";
      doc.head.appendChild(m);
      window.fbq("init", MEASURE.metaPixel);
      window.fbq("track", "PageView");
    }
    if (MEASURE.googleTag) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("consent", "default", { ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "denied" });
      var g = doc.createElement("script");
      g.async = true; g.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(MEASURE.googleTag);
      doc.head.appendChild(g);
      window.gtag("js", new Date());
      window.gtag("config", MEASURE.googleTag);
    }
  }

  function track(what, o) {
    if (!loaded) return;
    o = o || {};
    var fb = window.fbq, gt = window.gtag;
    if (what === "trial") {
      if (fb) fb("track", "StartTrial", { value: 0, currency: CURRENCY });
      if (gt) {
        gt("event", "file_download", { file_name: o.file || "", link_text: "Download" });
        if (MEASURE.googleAdsTrial) gt("event", "conversion", { send_to: MEASURE.googleAdsTrial });
      }
    } else if (what === "checkout") {
      if (fb) fb("track", "InitiateCheckout", { value: PRICE, currency: CURRENCY });
      if (gt) gt("event", "begin_checkout", { value: PRICE, currency: CURRENCY, items: [{ item_name: "Andrum", price: PRICE }] });
    } else if (what === "purchase") {
      if (fb) fb("track", "Purchase", { value: o.value, currency: o.currency }, o.id ? { eventID: o.id } : undefined);
      if (gt) {
        gt("event", "purchase", { transaction_id: o.id, value: o.value, currency: o.currency, items: [{ item_name: "Andrum", price: o.value }] });
        if (MEASURE.googleAdsPurchase) gt("event", "conversion", { send_to: MEASURE.googleAdsPurchase, value: o.value, currency: o.currency, transaction_id: o.id });
      }
    }
  }

  doc.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href*="download/Andrum-"]') : null;
    if (a) track("trial", { file: (a.getAttribute("href") || "").split("/").pop() });
  });

  function banner() {
    var b = doc.querySelector("[data-an-consent]");
    if (b) return b;
    b = doc.createElement("section");
    b.className = "an-consent";
    b.setAttribute("data-an-consent", "");
    b.setAttribute("aria-label", "Measuring ads");
    b.innerHTML =
      '<p>May we measure which ads bring you here? If you allow it, ' +
      (MEASURE.metaPixel && MEASURE.googleTag ? "Meta and Google set cookies" : MEASURE.metaPixel ? "Meta sets cookies" : "Google sets cookies") +
      ' that tell us when an ad led to a download or a purchase. <a href="privacy/#ads">More about this</a></p>' +
      '<div class="an-consent__btns"><button type="button" class="an-btn an-btn--primary" data-v="yes">Allow</button>' +
      '<button type="button" class="an-btn an-btn--line" data-v="no">No thanks</button></div>';
    b.addEventListener("click", function (e) {
      var v = e.target && e.target.getAttribute && e.target.getAttribute("data-v");
      if (!v) return;
      remember(v);
      b.hidden = true;
      if (v === "yes") loadTags();
    });
    (doc.querySelector(".andrum") || doc.body).appendChild(b);
    return b;
  }

  if (measuring) {
    var c = choice();
    if (c === "yes") loadTags();
    else if (c !== "no") banner().hidden = false;
    var open = doc.querySelector("[data-an-consent-open]");
    if (open) {
      open.hidden = false;
      open.addEventListener("click", function () { banner().hidden = false; });
    }
  }

  // for checking the page: window.andrumStore.thanks("you@example.com") shows the note after a purchase
  window.andrumStore = { thanks: showThanks, checkoutUrl: checkoutUrl };
})();
