/*
  Buying Andrum on this page.

  Every Buy button goes to Polar's checkout (Polar sells Andrum for us as merchant of record).
  Without JavaScript the buttons go to buy/, which forwards there too. After paying, Polar sends
  the buyer back here with ?bought=<the checkout's id> (and a customer session), and the price panel
  shows the buyer's licence key and how to add it.

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
    var id = "", session = "";
    try {
      var q = new URLSearchParams(window.location.search);
      id = q.get("bought") || "";
      session = q.get("customer_session_token") || "";
    } catch (e) { return; }
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return;
    try {   // the address without ?bought (so a reload or a shared link doesn't count it again) and
            // without the customer_session_token Polar adds (it opens the buyer's portal: nobody else's business)
      var u = new URL(window.location.href);
      u.searchParams.delete("bought");
      u.searchParams.delete("customer_session_token");
      window.history.replaceState(null, "", u.pathname + u.search + (u.hash || "#buy"));
    } catch (e) { /* fine as it is */ }
    var seen = false, mark = "andrum-bought-" + id;
    try { seen = window.localStorage.getItem(mark) === "1"; window.localStorage.setItem(mark, "1"); } catch (e) { /* counted once per visit */ }
    // after the page's other scripts (pixel.js comes after this file)
    function done() {
      if (!seen) track("purchase", { id: id, value: PRICE, currency: CURRENCY });
      showThanks("");
      if (/^polar_cst_[A-Za-z0-9_-]{10,}$/.test(session)) showKey(session);
    }
    if (doc.readyState === "complete") done();
    else doc.addEventListener("DOMContentLoaded", done);
  })();

  // The buyer's licence key, shown on the page. Polar's receipt e-mail only links to it, so the key is
  // fetched here with the customer session Polar hands back (it can read this buyer's own keys and
  // nothing else; it stays in this page's memory). Polar grants the key a moment after the payment,
  // so it is asked a few times.
  var BENEFIT = "b58d6d29-3837-4055-93a5-edf64e787b80";      // Polar: the "Andrum licence key" benefit
  function showKey(session) {
    var box = doc.querySelector("[data-an-key]"), text = doc.querySelector("[data-an-key-text]");
    var wait = doc.querySelector("[data-an-key-wait]"), copy = doc.querySelector("[data-an-key-copy]");
    if (!box || !text || !window.fetch) return;
    var tries = 0;
    function ask() {
      tries++;
      fetch("https://api.polar.sh/v1/customer-portal/license-keys/?limit=10&benefit_id=" + BENEFIT, {
        headers: { Authorization: "Bearer " + session, Accept: "application/json" }
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        var keys = ((j && j.items) || []).filter(function (k) { return k.status === "granted" && k.key; });
        keys.sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
        if (!keys.length) { if (tries < 8) window.setTimeout(ask, 1500 * tries); return; }
        text.textContent = keys[0].key;
        box.hidden = false;
        if (wait) wait.innerHTML = 'Polar also e-mails you a link to it: <span class="ui">Access purchase</span> in your receipt.';
      }).catch(function () { if (tries < 8) window.setTimeout(ask, 1500 * tries); });
    }
    ask();
    if (copy) copy.addEventListener("click", function () {
      var key = text.textContent, label = copy.textContent;
      function shown() { copy.textContent = copy.getAttribute("data-done") || "Copied"; window.setTimeout(function () { copy.textContent = label; }, 1800); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(key).then(shown, select);
      else select();
      function select() { var r = doc.createRange(); r.selectNodeContents(text); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
    });
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
