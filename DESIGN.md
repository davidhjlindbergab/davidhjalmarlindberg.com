# davidhjalmarlindberg.com: the design language

> The portfolio of David Hjalmar Lindberg, creative director, filmmaker and artist, for the people who might work with him.

This covers the front page, the project pages, Plugins, Privacy and `404.html`, which share `style.css` and `main.js`. The Andrum and Colobri product pages have their own looks and are not covered here.

## 1. Visual theme

**Theme statement:** quiet, luminous, screening room.

**Character:** Every page is a dark room where pictures are shown. The ground is nearly black, and on it lie two very large, very soft fields of light, like light spilling from a screen; they drift and slowly change colour, too slowly to watch. Nothing decorates: one typeface, a dark with only a trace of light in it, and the pictures carry the colour.

**References:** the Swiss typographic style (one sans, flush left); a cinema with the house lights down; the neutral dark surround of a colour grading suite; a gallery's wall labels.

## 2. Colour

Every page is dark (David, 13 Nov 2026: "Remove the white completely and only have the dark gradients"). There is no paper state any more; only print turns the page to white.

| Token | Value | Use |
|---|---|---|
| `--paper` | `#0c0c0b` | the ground (the name is kept so that older rules still work) |
| `--ink` | `#f4f3ef` | headings, names, filled buttons, the focus ring |
| `--muted` | `#98978f` | captions, labels, small print |
| `--body-copy` | `#b4b3ab` | paragraphs |
| `--line` | `#2b2b28` | hairlines |
| `--frame` | `#161615` | a picture's place before it has loaded |

- **The glow** (`body::before` in `style.css`): two radial fields, `--glow-a` low on the left and `--glow-b` high on the right, each at no more than 27%. `--glow-a` wanders amber, rose, plum, violet over 2 minutes; `--glow-b` blue, teal, deep green, indigo over 2.6 minutes; both back and forth, so the pair never repeats the same way. The layer drifts and turns over 70 seconds. A fine grain (`body::after`, 5.5%) keeps the dark gradients from banding. Keep it this faint, and don't add a third field.
- There is no accent colour and there are no status colours.
- Contrast on the ground: ink 17.6 : 1, paragraphs 9.3 : 1, captions 6.7 : 1; on the brightest part of the glow about a fifth lower.

## 3. Typography

Helvetica Neue throughout: `"Helvetica Neue", Helvetica, Arial, sans-serif`. Regular (400) everywhere; only the wordmark is 500.

| Role | Size | Line height | Letter spacing | Where |
|---|---|---|---|---|
| Display | `clamp(64px, 8.35vw, 148px)` | 0.98 | -0.065em | `h1` |
| Address | the width of the page / 12.19 | 1.1 | -0.055em | the e-mail address in the footer |
| Title | `clamp(36px, 4.6vw, 84px)` | 1.05 | -0.055em | Next project |
| Lead | `clamp(24px, 2.6vw, 42px)` | 1.25 | -1.1px | a block's first paragraph, figures |
| Name | 22px, 28px for the two wide projects | 1.2 | -0.65px | project names |
| Note | `clamp(14px, 1.15vw, 18px)` | 1.6 | -0.25px | the sentence beside a headline |
| Button | 17px | 1.18 | -0.01em | pills |
| Body | 16px, at most 540px wide | 1.7 | 0 | paragraphs |
| Small | 13px | 1.5 | 0 | captions, the menu |
| Label | 12px | 1.6 | 0 to 0.03em | slate lines, section labels, the colophon |

Nothing is set smaller than 12px. Headings balance their lines (`text-wrap: balance`).

## 4. Components

| Component | Class | What it is |
|---|---|---|
| Masthead | `.masthead` | wordmark, menu, place. Plugins rolls Andrum and Colobri down under it |
| Intro | `.intro` | the page's headline and one sentence beside it |
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
- **Grid:** two equal columns 28px apart for pictures; text blocks are one third label, two thirds text. Everything is flush left.
- **Corners:** `--radius` on tiles and `--radius-lg` on full-width pictures (both 16px on phones).
- **Rhythm:** 84px between rows of projects, 96px above a block, 128px above the last part of a page.

## 6. Depth

None. Nothing casts a shadow (the phones on the Aware page are pictures of objects and keep theirs). The only thing above the page is the Plugins menu (`z-index: 10`).

## 7. Do and don't

**Do**
- Keep every page dark; text sits straight on the ground.
- Write every colour with the six tokens.
- Let a picture be the cue to scroll: place it so its top shows on the first screen.
- Keep the address in the footer exactly as wide as the page.

**Don't**
- Add a light section or a white background, an accent colour, a shadow, or any gradient or glow besides the two fields of light.
- Add a second typeface or a bold weight.
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
- Don't change David's own words (the headline, the taglines, the About text) without being asked.

**Not decided:** the Andrum and Colobri product pages keep their own design languages.

## 10. Motion

What moves is light and focus, never position.

| Moment | What happens | Timing |
|---|---|---|
| A page opens | its headline is pulled into focus (blur to sharp), then its sentence fades in | 1.1s, once |
| The glow | its two fields drift and turn, and their colours change | 70s; 2 and 2.6 minutes, back and forth |
| A project is hovered | its picture brightens, takes its full colour and grows 2.5% | 0.55s |
| From page to page | the pages dissolve, and a project's picture travels from the front page to the top of its page | 0.4s and 0.6s |
| A link is hovered | a hairline draws under it | 0.25s |

**Reduced motion:** nothing moves or changes size and pages change at once; the glow stays in place and only its colours change.

## 11. Voice

Short, plain and a little cinematic; British spelling (the Colobri product keeps its own "color"). Sentence case everywhere. A caption is a name, one line and a kind. A button says what it does or where it goes ("Watch The Days", "Copy address", "nakaya.world"). The page says what happened and what to do next ("This page has moved, or it never existed." "Go to the front page").
