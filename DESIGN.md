# davidhjalmarlindberg.com: the design language

> The portfolio of David Hjalmar Lindberg, creative director, filmmaker and artist, for the people who might work with him.

This covers the front page, the project pages, Plugins, Privacy and `404.html`, which share `style.css` and `main.js`. The Andrum and Colobri product pages have their own looks and are not covered here.

## 1. Visual theme

**Theme statement:** quiet, luminous, screening room.

**Character:** Every page is a dark room where pictures are shown. The ground is nearly black, and on it lie two very large, very soft fields of light, like light spilling from a screen; they drift and slowly change colour, too slowly to watch. Nothing decorates: one typeface in two weights, a dark with only a trace of light in it, and the pictures carry the colour.

**References:** apple.com (its type, its bar, its buttons); a cinema with the house lights down; the neutral dark surround of a colour grading suite; a gallery's wall labels.

## 2. Colour

Every page is dark (David, 13 Nov 2026: "Remove the white completely and only have the dark gradients"). There is no paper state any more; only print turns the page to white.

| Token | Value | Use |
|---|---|---|
| `--paper` | `#0c0c0b` | the ground (the name is kept so that older rules still work) |
| `--ink` | `#f5f5f7` | headings, names, filled buttons, the focus ring |
| `--muted` | `#86868b` | captions, labels, small print |
| `--body-copy` | `#a1a1a6` | paragraphs |
| `--line` | `#333336` | hairlines |
| `--frame` | `#161617` | a picture's place before it has loaded |

- **The glow** (`body::before` in `style.css`): two radial fields, `--glow-a` low on the left and `--glow-b` high on the right, each at no more than 27%. `--glow-a` wanders amber, rose, plum, violet over 2 minutes; `--glow-b` blue, teal, deep green, indigo over 2 minutes 40; both back and forth, so the pair never repeats the same way. The layer drifts and turns over 80 seconds. A fine grain (`body::after`, 5.5%) keeps the dark gradients from banding. Keep it this faint, and don't add a third field.
  - The page grows a little darker as you scroll down from the header: the glow fades to 55% over the first screen (`deepen`, a scroll-driven animation).
  - It keeps time with the clock: a one-line script in each page's `<head>` sets `--t` (seconds since midnight, UTC) and the animations begin that far in. The light is the same on every page and does not start over between pages.
- There is no accent colour and there are no status colours.
- The greys are apple.com's (`#f5f5f7`, `#a1a1a6`, `#86868b`). Contrast on the ground: ink 17.9 : 1, paragraphs 7.6 : 1, captions 5.4 : 1; on the brightest part of the glow about a fifth lower.

## 3. Typography

apple.com's typography (David, 14 Nov 2026: study apple.com/se's typefaces, sizes, weights, spacing and design and apply it to every page). Measured on apple.com/se that day.

**Typeface:** SF Pro on Apple devices, which is their system font (`-apple-system, BlinkMacSystemFont`); Inter (`fonts/inter-var-latin.woff`, as on the Colobri and Lika pages) everywhere else; then Helvetica Neue. SF Pro itself may not be served as a web font. **Weights:** headlines, names and labels that head something are 600; text is 400. Nothing else.

**Apple's scale** (size / line height / letter spacing): 96 / 1.05 / -0.015em · 80 / 1.05 / -0.015em · 56 / 1.0714 / -0.005em · 48 / 1.0834 / -0.003em · 40 / 1.1 / 0 · 28 / 1.1429 / 0.007em · 24 / 1.1667 / 0.009em · 21 / 1.19 / 0.011em (1.381 for running text) · 19 / 1.4211 / 0.012em · 17 / 1.47059 / -0.022em · 14 / 1.42859 / -0.016em · 12 / 1.33337 / -0.01em.

| Role | Size | Weight | Where |
|---|---|---|---|
| Statement | the width of the page / the width of its letters (about 210px on a laptop), -0.025em | 600 | the front page's headline, exactly as wide as the page |
| Display | `clamp(56px, 6.7vw, 96px)`; 48px on phones | 600 | `h1` on the other pages |
| Address | the width of the page / the width of its letters, -0.02em | 600 | the e-mail address in the footer |
| Fields | `clamp(24px, 2.6vw, 40px)`, in `--muted` | 600 | the line under the front page's headline |
| Title | `clamp(40px, 4.6vw, 80px)` | 600 | Next project |
| Lead | `clamp(28px, 3.3vw, 48px)`; 28px on phones | 600 | a block's first paragraph, figures |
| Name | 28px, 40px for the two wide projects, 24px on phones | 600 | project names |
| Wordmark | 21px (19px on tablets, 17px on phones) | 600 | the masthead |
| Note | `clamp(17px, 1.35vw, 21px)`, 1.381; 19px on phones | 400 | the sentence beside a headline |
| Button | 17px | 400 | pills |
| Body | 17px / 1.47059 / -0.022em, at most 600px wide | 400 | paragraphs, a project's line |
| Small | 14px | 400 (labels 600) | captions, figure labels, block labels, the Plugins list |
| Label | 12px | 400 (section names 600) | the menu, slate lines, kinds, the colophon |

Nothing is set smaller than 12px. Headings balance their lines (`text-wrap: balance`).

## 4. Components

| Component | Class | What it is |
|---|---|---|
| Masthead | `.masthead` | after apple.com's bar: 52px high (48px on phones), it stays at the top of the window and the page shows through it, blurred. Wordmark, menu, place. Plugins rolls Andrum, Lika and Colobri down under it, on a panel of the same glass |
| Opening | `.intro-home`, `.fit`, `.intro-fields` | the front page: one sentence as wide as the page; under it the fields the work is made in, and one sentence about who is speaking |
| Intro | `.intro` | the other pages: the headline and one sentence beside it |
| Slate line | `.section-line` | a hairline and two or three short facts across the page (kind, name, years) |
| Project | `.project`, `.caption` | a picture in a frame, its name, one line and its kind |
| Block | `.block` | a label on the left and text on the right, under a hairline |
| Buttons | `.links a` | 44px pills, the first filled and the rest outlined |
| Figures, list | `.figures`, `.list` | three numbers with labels; rows of name and place |
| Gallery | `.gallery` | one, two or three pictures in a row |
| Next | `.next` | the next project's name, large |
| Footer | `.footer`, `.email`, `.copy` | the address as wide as the page, Copy address, the colophon |

## 5. Layout

- **Width:** `.wrap`, with gutters of 4.5vw (22px on phones) and a maximum of 1600px.
- **Grid:** two equal columns 20px apart for pictures; text blocks are one third label, two thirds text. Everything is flush left.
- **Corners:** `--radius` on tiles and `--radius-lg` on full-width pictures (both 16px on phones).
- **Rhythm:** 80px between rows of projects, 100px above a block, 140px above the last part of a page.

## 6. Depth

None. Nothing casts a shadow (the phones on the Aware page are pictures of objects and keep theirs). The only things above the page are the masthead, a sheet of blurred glass (`z-index: 20`), and the Plugins menu in it.

## 7. Do and don't

**Do**
- Keep every page dark; text sits straight on the ground.
- Write every colour with the six tokens.
- Let a picture be the cue to scroll: place it so its top shows on the first screen.
- Keep the front page's headline and the address in the footer exactly as wide as the page (`main.js` measures the words, so they fit in any font and after any edit; keep the headline to one short line).

**Don't**
- Add a light section or a white background, an accent colour, a shadow, or any gradient or glow besides the two fields of light.
- Add a second typeface, or any weight besides 400 and 600.
- Join keywords with middle dots, add arrows that only say "scroll", or number things that are not a sequence.
- Make things slide, bounce or fly in. See Motion.
- Set text smaller than 12px.

## 8. Responsive

| Width | What changes |
|---|---|
| up to 1050px | the place name leaves the masthead; captions stack |
| up to 800px | the sentence moves under the headline |
| up to 650px | one column, 22px gutters, 16px corners, the menu shows Selected work and Plugins |


## 9. For agents

- Read `README.md` first: several sessions and David's own site editor change these pages, so pull `main` before editing.
- New pages need nothing for the dark: it comes with `style.css`. Give them `<meta name="theme-color" content="#0c0c0b">` so the browser's bars match.
- Every page loads `/main.js` and `/stats.js`.
- To hide something on a page, take it out of the HTML rather than hiding it with styles and fixing the page's height; a fixed height lets the end of the page run into the footer.
- The picture at the top of a project page is `.hero-frame` (or `.stage`, or the frame in `.listen`): it is the one a front-page picture travels to.
- Don't change David's own words (the headline, the taglines, the About text) without being asked. He chose "A movie in the making" and "Music" himself.

**Not decided:** the Andrum and Colobri product pages keep their own design languages.

## 10. Motion

What moves is light and focus, never position.

| Moment | What happens | Timing |
|---|---|---|
| A page opens | its headline is pulled into focus (blur to sharp), then the lines under or beside it fade in | 1.1s, once |
| The glow | its two fields drift and turn, and their colours change, in time with the clock; it fades to 55% as you scroll down the first screen | 80s; 2 minutes and 2 minutes 40, back and forth |
| A project is hovered | the light comes first and the picture follows: it brightens and takes its full colour, then grows 3%, starting gently and slowing to a stop, like a slow push-in. Each picture is on its own layer from the start (`will-change`), so nothing is redrawn when the growth begins or ends | 0.6s for the light, 1s for the growth |
| From page to page | the pages dissolve, and a project's picture travels from the front page to the top of its page | 0.4s and 0.6s |
| A link is hovered | a hairline draws under it (a full line scaled from the left, so it costs no layout) | 0.25s |

**Reduced motion:** nothing moves or changes size and pages change at once; the glow stays in place and only its colours change.

## 11. Voice

- **First person, everywhere.** The site is David speaking: "I build worlds.", "I'm the creative director of DINOS", "I was part of creating Norrsken". Never "David did".
- **Short, plain and a little cinematic.** British spelling (the Colobri product keeps its own "color"). Sentence case everywhere.
- **The front page says it once.** The headline is the claim ("I build worlds."), the line under it is what the worlds are made in ("Film, art, music, software"), the sentence beside that is who is speaking. Below, "light, sound and code" names the same things as materials.
- **A project page says three different things in its three places:** the note at the top says what the project is, the large line says the most interesting thing about it, the small text says what David did. No sentence is said twice on a page.
- **A caption** is a name, one line and a kind. A line that only repeats the name is not a line ("Norrsken / Norrsken Foundation").
- **A button** says what it does or where it goes ("Watch The Days", "Copy address", "Invite me to speak", "nakaya.world").
- **A page that fails** says what happened and what to do next, and may smile once ("This world doesn't exist." "The page has moved, or it was never built." "Go to the front page").
- **Facts on the Plugins page** are copied from the product pages (Andrum: free for 7 days; 14 days is its money-back time). Check them there when they change.
