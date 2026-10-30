# davidhjalmarlindberg.com

The website of David Hjalmar Lindberg: the front page, plus product pages for Andrum (`/andrum/`) and Nyans (`/nyans/`).

Plain HTML, CSS and JavaScript with no build step. Served by GitHub Pages from the root of `main`; `CNAME` holds the custom domain.

## Andrum's store

- `andrum/buy/` forwards to the Lemon Squeezy checkout. The plug-in's Buy button opens it, so the
  checkout can change without a new Andrum. The checkout link is in `andrum/buy/index.html` and
  `andrum/assets/js/store.js` (`CHECKOUT`): when the store goes live, replace the test-mode link in
  both with the live product's link (Lemon Squeezy: Products, Andrum, Share).
- The Buy buttons on the page open the checkout over the page; after a purchase the price panel
  says how to add the licence. Ads' campaign names (`utm_…` in the link) travel with each order.
- `andrum/license/` explains how to add a licence and, for a computer without internet, turns a
  licence key into the signed licence. `andrum/license/service.json` says where the licence service
  is (Andrum reads it too): set `url` once the service is online (andrum repository, `service/`).
- `andrum/terms/` (with the refunds) and `andrum/privacy/` are linked from the page's footer.
- Measuring ads: put a Meta pixel id or a Google tag id into `MEASURE` in `andrum/assets/js/store.js`.
  The page then asks each visitor once (a small banner) and loads nothing unless they allow it.
