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

  Measuring ads is in pixel.js (the Meta pixel, loaded only for visitors who accept it, one question
  for the whole site). This file tells it when a checkout opens (InitiateCheckout) and when an order
  is paid (Purchase, with the order's amount); the downloads are counted there.
*/
(function () {
  "use strict";

  var CHECKOUT = "https://davidhjalmarlindberg.lemonsqueezy.com/checkout/buy/a5a37f02-4e39-4237-87ed-7d6af71e3e5b";
  var PRICE = 59, CURRENCY = "EUR";

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
  // pixel.js counts for visitors who accepted the Meta pixel, holds a count until a visitor has
  // answered, and drops it if they declined. Without pixel.js on the page nothing is counted.
  function track(what, o) {
    var count = window.andrumPixel;
    if (typeof count !== "function") return;
    o = o || {};
    if (what === "checkout") count("InitiateCheckout", { content_name: "Andrum", content_type: "product", value: PRICE, currency: CURRENCY });
    else if (what === "purchase") count("Purchase", { content_name: "Andrum", content_type: "product", value: o.value, currency: o.currency }, o.id ? { eventID: o.id } : undefined);
  }

  // for checking the page: window.andrumStore.thanks("you@example.com") shows the note after a purchase
  window.andrumStore = { thanks: showThanks, checkoutUrl: checkoutUrl };
})();
