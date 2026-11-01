# davidhjalmarlindberg.com

The website of David Hjalmar Lindberg: the front page, a page for each project, and product pages for Andrum (`/andrum/`) and Colobri (`/colobri/`).

Plain HTML, CSS and JavaScript with no build step. Served by GitHub Pages from the root of `main`; `CNAME` holds the custom domain.

## Pages

- **Front page** (`index.html`): ten projects in the order Nakãya, Andrum, Colobri, Avicii, The Last Testament, DINOS, Norrsken, Aware App, Talks, DJ. Each links to its page.
- **Project pages**: `nakaya/`, `avicii/`, `the-last-testament/`, `dinos/`, `norrsken/`, `aware/`, `talks/` and `dj/`, each an `index.html`. Andrum and Colobri link to their product pages.
- **Plugins** (`plugins/index.html`): Andrum and Colobri, each linking to its product page. Every page's menu reads Selected work, Plugins, About, Contact; phones show the first two.
- **One stylesheet** (`style.css`) for the front page, the project pages, the Plugins page and `404.html`: paper `#f4f3ef`, ink `#242420`, Helvetica Neue. Image corners come from `--radius` (tiles) and `--radius-lg` (full-width images), both 16px on phones.
- **Images**: front-page images in `img/work/`, each project's gallery in `img/<project>/`.
- **The DJ page** plays the Borderland 2026 set through SoundCloud's own player.

## Colobri: the page, selling and tracking

- **The page** (`colobri/index.html`, with `colobri.js` and `site.js`): plain HTML with its styles inside, no build step. The opening draws the bird live with the COLOBRI logo component (`colobri/colobri-logo.js`, the logo kit's own file: never edit it), alone and centred, with its light behind it: the bird a second time, larger and blurred, in one smooth bell (`colobri/colobri-light.js`, `live` and `bellMask`, the same file as in the app); without WebGL2 it shows the bird's still on the still light (`images/colobri-aura-glow.webp`). The terms, privacy and thank-you pages share `colobri/page.css`. The name COLOBRI is a drawing, not a font: the thin monoline David chose, kept once as the `cb-word` symbol in `colobri/index.html` (and inline on the smaller pages), stroked in white with round ends; it comes from `tools/colobri_monoline_svg.py` in the Colobri build.
- **The pictures** (`colobri/images/`): every graded frame is one of David's own grades, only scaled and saved as WebP, never graded again. They are made by `tools/colobri_site_images.py` and `tools/colobri_site_app.js` in the Colobri build.
- **Buy** (`colobri/index.html`, the link with `data-cb-buy`): its `href` is the Lemon Squeezy checkout. Until the store is activated it opens an e-mail instead; once it is live, set it to the live product's checkout link (Lemon Squeezy, Products, Share) and remove the line marked `data-cb-interim` under it. After paying, Lemon Squeezy sends buyers to `/colobri/thanks/`.
- **Meta pixel** (`colobri/site.js`, `PIXEL_ID`, 4475247569405091, in the David HJ Lindberg AB business portfolio): empty means no cookie banner and no pixel. With an ID, visitors are asked first, and the pixel loads only for those who accept. It counts PageView, ViewContent, StartTrial (the downloads and the browser app), InitiateCheckout (Buy) and Purchase (the thank-you page, once, after Buy).
- **Downloads** (`colobri/download/`): one zip for Mac and one for Windows (`Colobri-for-Mac-<version>.zip`, `Colobri-for-Windows-<version>.zip`, built by `build.js` in the Colobri build: the plugins with their installers, Read me first, the licence agreement, the release notes and the third-party notices) and their `SHA256.txt`. A new version also needs the links to them in `colobri/index.html` (the pricing) and `colobri/thanks/index.html`; `site.js` puts the visitor's own system first, and `404.html` sends an earlier download's address to the pricing.
- **CapCut**: it takes no plugins, so the app's Export menu has LUT for CapCut (one .cube and the three steps); the page's editors list and FAQ say so.
- **The browser app** (`colobri/app/index.html`): the standalone build of the Colobri app, with the same 7-day trial and licence as the plugins.

- **Meta domain verification**: the `facebook-domain-verification` meta tag in the front page's head (`index.html`) must stay.
