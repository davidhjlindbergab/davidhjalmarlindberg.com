# davidhjalmarlindberg.com: the design language

> The portfolio of David Hjalmar Lindberg, creative director, filmmaker and artist, for the people who might work with him.

This covers the front page, the project pages, Plugins, Privacy and `404.html`, which share `style.css` and `main.js`. The Andrum and Colobri product pages have their own looks and are not covered here.

## 1. Visual theme

**Theme statement:** quiet, luminous, screening room.

**Character:** Words are read on paper and pictures are seen in the dark. A page opens calm and typographic; while the work is on screen the lights go down, the way they do in a cinema or a grading suite; and they come up again for the words at the end. Nothing decorates: one typeface, flat paper, a dark that has only a trace of light in it, and the pictures carry the colour.

**References:** the Swiss typographic style (one sans, flush left, flat fields); a cinema's house lights; the neutral dark surround of a colour grading suite; a gallery's wall labels.

## 2. Colour

Six tokens in two states. `:root` is the paper state; `:root[data-lights="down"]` is the dark one. The names stay the same in both, so every rule written with them works in both.

| Token | Lights up | Lights down | Use |
|---|---|---|---|
| `--paper` | `#f4f3ef` | `#0c0c0b` | the ground |
| `--ink` | `#242420` | `#f4f3ef` | headings, names, filled buttons, the focus ring |
| `--muted` | `#6c6c65` | `#98978f` | captions, labels, small print |
| `--body-copy` | `#6d6d65` | `#b4b3ab` | paragraphs |
| `--line` | `#d6d5ce` | `#2b2b28` | hairlines |
| `--frame` | `#e7e5de` | `#161615` | a picture's place before it has loaded |

- There is no accent colour and there are no status colours: the site has no forms or alerts that would need them.
- Contrast on the ground: ink 14.0 : 1 and 17.6 : 1, paragraphs 4.7 : 1 and 9.3 : 1, captions 4.8 : 1 and 6.7 : 1 (up and down). On the brightest part of the glow the dark figures are about a fifth lower.
- The dark ground is nearly black, not black, and it is not flat: two very large, very soft fields of light lie on it, a warm one low on the left (`rgb(96 62 36)`) and a cool one high on the right (`rgb(40 62 104)`), each at no more than 27% strength, under a fine grain that keeps them from banding. They are the room's light, not decoration: keep them this faint, and don't add a third.

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
| Lights | `data-lights` | on a part of a page: `down` dims the page while that part fills the screen, `up` brings the lights back |

## 5. Layout

- **Width:** `.wrap`, with gutters of 4.5vw (22px on phones) and a maximum of 1600px.
- **Grid:** two equal columns 28px apart for pictures; text blocks are one third label, two thirds text. Everything is flush left.
- **Corners:** `--radius` on tiles and `--radius-lg` on full-width pictures (both 16px on phones).
- **Rhythm:** 84px between rows of projects, 96px above a block, 128px above the last part of a page.

## 6. Depth

None. Nothing casts a shadow (the phones on the Aware page are pictures of objects and keep theirs). The only thing above the page is the Plugins menu (`z-index: 10`).

## 7. Do and don't

**Do**
- Show pictures with the lights down and long text on paper.
- Keep a page to one change of light each way.
- Write every colour with the six tokens, so it works in both states.
- Let a picture be the cue to scroll: place it so its top shows on the first screen.
- Keep the address in the footer exactly as wide as the page.

**Don't**
- Add an accent colour, a shadow, or any gradient or glow besides the two fields of light on the dark ground.
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

The lights behave the same at every size. A page always opens in its own light, whatever the size of the screen; the light changes only after the page has been scrolled 120px.

## 9. For agents

- Read `README.md` first: several sessions and David's own site editor change these pages, so pull `main` before editing.
- New pages that show work start dark: `<html lang="en" data-lights="down">`, `<meta name="theme-color" content="#000000">`, and `data-lights="up"` on the footer. Pages of words (like Privacy) leave all three out.
- Every page loads `/main.js` and `/stats.js`, and the pages with lights carry the one-line script after the stylesheet that restores the light a page was left in.
- The picture at the top of a project page is `.hero-frame` (or `.stage`, or the frame in `.listen`): it is the one a front-page picture travels to.
- Don't change David's own words (the headline, the taglines, the About text) without being asked.

**Not decided:** the Andrum and Colobri product pages keep their own design languages.

## 10. Motion

What moves is light and focus, never position.

| Moment | What happens | Timing |
|---|---|---|
| A page opens | its headline is pulled into focus (blur to sharp), then its sentence fades in | 1.1s, once |
| The lights | one dissolve: the ground, the words, the lines and the glow fade together, over the same time and on the same curve (`--fade`, `--fade-ease`). Nothing changes on its own or snaps | 1.3s down, 1s up |
| The dark | its two fields of light drift and turn, too slowly to see | 70s, back and forth |
| A project is hovered | its picture brightens, takes its full colour and grows 2.5% | 0.55s |
| From page to page | the pages dissolve, and a project's picture travels from the front page to the top of its page | 0.4s and 0.6s |
| A link is hovered | a hairline draws under it | 0.25s |

**Reduced motion:** nothing moves or changes size, the glow stays still, and pages change at once. The lights still fade, because a fade is gentler than a flash.

## 11. Voice

Short, plain and a little cinematic; British spelling (the Colobri product keeps its own "color"). Sentence case everywhere. A caption is a name, one line and a kind. A button says what it does or where it goes ("Watch The Days", "Copy address", "nakaya.world"). The page says what happened and what to do next ("This page has moved, or it never existed." "Go to the front page").
