/*
  Buying Andrum on this page.

  Every Buy button goes to Polar's checkout (Polar sells Andrum for us as merchant of record).
  Without JavaScript the buttons go to buy/, which forwards there too. After paying, Polar sends
  the buyer back here with ?bought=<the checkout's id>, and the price panel says where the licence
  key went and how to add it.

  CHECKOUT is the Andrum product's checkout link (Polar: Products, Checkout Links, "Website (Buy
  button)"; its success URL is https://davidhjalmarlindberg.com/andrum/?bought={CHECKOUT_ID}#buy).
  The same link is in ../../buy/index.html: change both together.

  Campaign names (utm_source, utm_medium, utm_campaign, utm_content, utm_term in the address an ad
  links to) go along to the checkout, which keeps them with the order, so each order shows which
  campaign it came from. Nothing is stored on the visitor's computer for that.

  Measuring ads is in pixel.js (the Meta pixel, loaded only for visitors who accept it, one question
  for the whole site). This file tells it when a checkout opens (InitiateCheckout) and when an order
  is paid (Purchase, at the list price: the page isn't told what a discount took off).
*/
(function () {
  "use strict";

  var CHECKOUT = "https://buy.polar.sh/polar_cl_GzJkmjeg0Qgc7hVDs9MoLwPK0VM4AX0NuDO241KhMyZ";
  var PRICE = 59, CURRENCY = "EUR";

  var doc = document;
  var CAMPAIGN = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

  function checkoutUrl() {
    var url = CHECKOUT + (CHECKOUT.indexOf("?") < 0 ? "?" : "&") + "theme=dark";
    var q;
    try { q = new URLSearchParams(window.location.search); } catch (e) { return url; }
    for (var i = 0; i < CAMPAIGN.length; i++) {
      var v = q.get(CAMPAIGN[i]);
      if (v) url += "&" + CAMPAIGN[i] + "=" + encodeURIComponent(v.slice(0, 120));
    }
    return url;
  }

  // ---------------------------------------------------------------------------------- the checkout
  function buyButton(t) {
    return t && t.closest ? t.closest("[data-an-buy]") : null;
  }

  doc.addEventListener("click", function (e) {
    var a = buyButton(e.target);
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    var url = checkoutUrl();
    track("checkout");
    // a moment for the pixel to send the count before the page goes
    window.setTimeout(function () { window.location.href = url; }, typeof window.andrumPixel === "function" ? 300 : 0);
  });

  // back from the checkout, paid: ?bought=<checkout id>
  (function () {
    var id = "";
    try { id = new URLSearchParams(window.location.search).get("bought") || ""; } catch (e) { return; }
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return;
    try {   // the address without ?bought, so a reload or a shared link doesn't count it again
      var u = new URL(window.location.href);
      u.searchParams.delete("bought");
      window.history.replaceState(null, "", u.pathname + u.search + (u.hash || "#buy"));
    } catch (e) { /* fine as it is */ }
    var seen = false, mark = "andrum-bought-" + id;
    try { seen = window.localStorage.getItem(mark) === "1"; window.localStorage.setItem(mark, "1"); } catch (e) { /* counted once per visit */ }
    // after the page's other scripts (pixel.js comes after this file)
    function done() {
      if (!seen) track("purchase", { id: id, value: PRICE, currency: CURRENCY });
      showThanks("");
    }
    if (doc.readyState === "complete") done();
    else doc.addEventListener("DOMContentLoaded", done);
  })();

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
