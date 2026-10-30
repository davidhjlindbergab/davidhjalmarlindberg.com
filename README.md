# davidhjalmarlindberg.com

The website of David Hjalmar Lindberg: the front page, plus product pages for Andrum (`/andrum/`) and Nyans (`/nyans/`).

Plain HTML, CSS and JavaScript with no build step. Served by GitHub Pages from the root of `main`; `CNAME` holds the custom domain.

## Nyans: selling and tracking

- **Buy** (`nyans/index.html`, the link with `data-ny-buy`): its `href` is the Lemon Squeezy checkout for Nyans. Until the store is activated it opens an e-mail instead; once it is live, set it to the live product's checkout link (Lemon Squeezy, Products, Nyans, Share). After paying, Lemon Squeezy sends buyers to `/nyans/thanks/`.
- **Meta pixel** (`nyans/site.js`, `PIXEL_ID`): empty means no cookie banner and no pixel. With an ID, visitors are asked first, and the pixel loads only for those who accept. It counts PageView, ViewContent, StartTrial (downloads and Open Nyans), InitiateCheckout (Buy) and Purchase (the thank-you page, once, after Buy).
- **Downloads** (`nyans/download/`): the plugins zip and its `SHA256.txt`. A new version also needs the two links to it in `nyans/index.html` and `nyans/thanks/index.html`.
- **The browser app** (`nyans/app/index.html`): the standalone build of the Nyans app, with the same 7-day trial and licence as the plugins.

