# davidhjalmarlindberg.com

The website of David Hjalmar Lindberg: the front page, a page for each project, and product pages for Andrum (`/andrum/`) and Nyans (`/nyans/`).

Plain HTML, CSS and JavaScript with no build step. Served by GitHub Pages from the root of `main`; `CNAME` holds the custom domain.

## Pages

- **Front page** (`index.html`): ten projects in the order Nakãya, Andrum, Nyans, Avicii, The Last Testament, DINOS, Norrsken, Aware App, Talks, DJ. Each links to its page.
- **Project pages**: `nakaya/`, `avicii/`, `the-last-testament/`, `dinos/`, `norrsken/`, `aware/`, `talks/` and `dj/`, each an `index.html`. Andrum and Nyans link to their product pages.
- **One stylesheet** (`style.css`) for the front page, the project pages and `404.html`: paper `#f4f3ef`, ink `#242420`, Helvetica Neue.
- **Images**: front-page images in `img/work/`, each project's gallery in `img/<project>/`.
- **The DJ page** plays the Borderland 2026 set through SoundCloud's own player.

## Nyans: selling and tracking

- **Buy** (`nyans/index.html`, the link with `data-ny-buy`): its `href` is the Lemon Squeezy checkout for Nyans. Until the store is activated it opens an e-mail instead; once it is live, set it to the live product's checkout link (Lemon Squeezy, Products, Nyans, Share). After paying, Lemon Squeezy sends buyers to `/nyans/thanks/`.
- **Meta pixel** (`nyans/site.js`, `PIXEL_ID`, now the dataset "Nyans", 4475247569405091, in the David HJ Lindberg AB business portfolio): empty means no cookie banner and no pixel. With an ID, visitors are asked first, and the pixel loads only for those who accept. It counts PageView, ViewContent, StartTrial (downloads and Open Nyans), InitiateCheckout (Buy) and Purchase (the thank-you page, once, after Buy).
- **Downloads** (`nyans/download/`): the plugins zip and its `SHA256.txt`. A new version also needs the two links to it in `nyans/index.html` and `nyans/thanks/index.html`.
- **The browser app** (`nyans/app/index.html`): the standalone build of the Nyans app, with the same 7-day trial and licence as the plugins.

- **Meta domain verification**: the `facebook-domain-verification` meta tag in the front page's head (`index.html`) must stay.
