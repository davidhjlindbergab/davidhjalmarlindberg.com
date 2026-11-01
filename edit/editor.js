// Site editor for davidhjalmarlindberg.com.
//
// Opens a page of the site straight from GitHub and shows it live. Click anything to change its text,
// font, size, colour, spacing, link or image; press Publish and the changes go back to the repository as
// one commit, which GitHub Pages puts live in about a minute.
//
// How it stays safe:
// - Every change is spliced into the page's own source text, so whatever you did not touch stays exactly as
//   it was, byte for byte. Nothing is rebuilt from the browser's version of the page.
// - Style changes live in one marked block per page (<style id="site-editor">) and, for "Every page", in one
//   marked block at the end of style.css. Deleting a block undoes all of its changes.
// - The preview runs in a sandbox with no access to this window, and everything it reports is treated as
//   untrusted (escaped, checked), so the page's own scripts never see your key.
// - The key only ever goes to api.github.com. The address settings below can be changed through the link only
//   when the editor runs on this computer for testing (localhost), never on the website.
// - Before saving, the editor checks that nobody else changed the same page in the meantime. If they did, it
//   moves your changes onto the newer version, or tells you which ones it could not keep.

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const Q = new URLSearchParams(LOCAL ? location.search : '');
const GITHUB_API = 'https://api.github.com';
const CFG = {
  owner: Q.get('owner') || 'davidhjlindbergab',
  repo: Q.get('repo') || 'davidhjalmarlindberg.com',
  branch: Q.get('branch') || 'main',
  site: (Q.get('site') || 'https://davidhjalmarlindberg.com/').replace(/\/?$/, '/'),
  api: (Q.get('api') || GITHUB_API).replace(/\/$/, ''),
};
if (!LOCAL && CFG.api !== GITHUB_API) throw new Error('The site editor only talks to GitHub.');
const DEVICES = { desktop: 1440, tablet: 820, phone: 390 };
const MEDIA = { tablet: '(max-width: 1068px)', phone: '(max-width: 734px)' };
const DEV_KEY = { desktop: 'all', tablet: 'tablet', phone: 'phone' };
const DEV_LABEL = { all: 'all screens', tablet: 'tablets and phones', phone: 'phones' };
const HIDDEN_PAGES = [/^edit\//, /^colobri\/app\//, /(^|\/)node_modules\//];
const SITE_CSS = 'style.css';
const TOKEN_KEY = 'site-editor.token';

const FONTS = [
  { name: 'System (SF Pro)', stack: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif', match: ['-apple-system', 'system-ui', 'sf pro', 'blinkmacsystemfont'] },
  { name: 'Helvetica Neue', stack: '"Helvetica Neue", Helvetica, Arial, sans-serif', match: ['helvetica neue', 'helvetica'] },
  { name: 'Inter', g: 'wght@100..900', fb: 'sans-serif' },
  { name: 'Inter Tight', g: 'wght@100..900', fb: 'sans-serif' },
  { name: 'Geist', g: 'wght@100..900', fb: 'sans-serif' },
  { name: 'Jost', g: 'wght@100..900', fb: 'sans-serif' },
  { name: 'Afacad Flux', g: 'wght@100..1000', fb: 'sans-serif' },
  { name: 'Manrope', g: 'wght@200..800', fb: 'sans-serif' },
  { name: 'DM Sans', g: 'wght@100..1000', fb: 'sans-serif' },
  { name: 'Plus Jakarta Sans', g: 'wght@200..800', fb: 'sans-serif' },
  { name: 'Hanken Grotesk', g: 'wght@100..900', fb: 'sans-serif' },
  { name: 'Familjen Grotesk', g: 'wght@400..700', fb: 'sans-serif' },
  { name: 'Space Grotesk', g: 'wght@300..700', fb: 'sans-serif' },
  { name: 'Work Sans', g: 'wght@100..900', fb: 'sans-serif' },
  { name: 'Outfit', g: 'wght@100..900', fb: 'sans-serif' },
  { name: 'Sora', g: 'wght@100..800', fb: 'sans-serif' },
  { name: 'Syne', g: 'wght@400..800', fb: 'sans-serif' },
  { name: 'Unbounded', g: 'wght@200..900', fb: 'sans-serif' },
  { name: 'Montserrat', g: 'wght@100..900', fb: 'sans-serif' },
  { name: 'Playfair Display', g: 'wght@400..900', fb: 'serif' },
  { name: 'Fraunces', g: 'wght@100..900', fb: 'serif' },
  { name: 'EB Garamond', g: 'wght@400..800', fb: 'serif' },
  { name: 'Cormorant Garamond', g: 'wght@300;400;500;600;700', fb: 'serif' },
  { name: 'Newsreader', g: 'wght@200..800', fb: 'serif' },
  { name: 'Bodoni Moda', g: 'wght@400..900', fb: 'serif' },
  { name: 'Instrument Serif', g: '', fb: 'serif' },
  { name: 'DM Serif Display', g: '', fb: 'serif' },
  { name: 'Lora', g: 'wght@400..700', fb: 'serif' },
  { name: 'DM Mono', g: 'wght@300;400;500', fb: 'monospace' },
  { name: 'JetBrains Mono', g: 'wght@100..800', fb: 'monospace' },
  { name: 'Geist Mono', g: 'wght@100..900', fb: 'monospace' },
];
const PROP_LABEL = {
  'font-family': 'Font', 'font-size': 'Size', 'font-weight': 'Weight', 'font-style': 'Italic', 'line-height': 'Line height',
  'letter-spacing': 'Letter spacing', color: 'Color', 'text-align': 'Alignment', 'text-transform': 'Case',
  'margin-top': 'Space above', 'margin-bottom': 'Space below', 'background-color': 'Background',
  'background-image': 'Background image', 'border-radius': 'Corners', display: 'Hidden', opacity: 'Opacity',
  height: 'Height', width: 'Width',
};
// Set together with a height or width so the number is the size you see (see setSize); not listed on their own.
const SIZE_HELPERS = new Set(['min-height', 'min-width', 'box-sizing']);
const ATTR_LABEL = { src: 'Image', alt: 'Image description', href: 'Link', target: 'Opens in', content: 'Text', srcset: 'Image', sizes: 'Image sizes', type: 'Image type', rel: 'Link' };

// ---------------------------------------------------------------- small helpers
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const clone = (o) => JSON.parse(JSON.stringify(o));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get(k) { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch { return null; } },
  set(k, v, remember) { try { (remember ? localStorage : sessionStorage).setItem(k, v); (remember ? sessionStorage : localStorage).removeItem(k); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch { /* ignore */ } },
};
function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64ToBytes(b64) {
  const s = atob(String(b64).replace(/\s/g, ''));
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
const textToB64 = (t) => bytesToB64(new TextEncoder().encode(t));
const b64ToText = (b) => new TextDecoder().decode(b64ToBytes(b));
const parser = new DOMParser();
const textOfHTML = (html) => parser.parseFromString('<!doctype html><body>' + html, 'text/html').body.textContent;
const decodeAttr = (s) => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };
const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
function rgbToHex(c) {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/.exec(c || '');
  if (!m) return null;
  const a = m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
  if (a === 0) return null;
  return '#' + [m[1], m[2], m[3]].map((v) => Math.round(+v).toString(16).padStart(2, '0')).join('');
}
const firstFamily = (ff) => (ff || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
const NAMES = { nakaya: 'Nakãya', dinos: 'DINOS', dj: 'DJ', aware: 'Aware App', buy: 'Buy', thanks: 'Thank you' };
const pageName = (path) => {
  if (path === 'index.html') return 'Front page';
  if (path === '404.html') return 'Page not found (404)';
  const parts = path.replace(/\/?index\.html$/, '').replace(/\.html$/, '').split('/');
  return parts.map((p) => NAMES[p] || p.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')).join(' › ');
};

// ---------------------------------------------------------------- GitHub
const gh = {
  token: null,
  async call(method, path, body) {
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (this.token && (LOCAL || CFG.api === GITHUB_API)) headers.Authorization = 'Bearer ' + this.token;
    if (body) headers['Content-Type'] = 'application/json';
    let r;
    try {
      r = await fetch(CFG.api + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    } catch {
      const err = new Error('GitHub could not be reached. Check the connection and try again.');
      err.status = 0;
      throw err;
    }
    const data = r.status === 204 ? null : await r.json().catch(() => null);
    if (!r.ok) {
      const err = new Error((data && data.message) || 'GitHub answered ' + r.status);
      err.status = r.status;
      err.data = data;
      throw err;
    }
    return data;
  },
  rp(p) { return `/repos/${CFG.owner}/${CFG.repo}${p}`; },
  repoInfo() { return this.call('GET', this.rp('')); },
  head() { return this.call('GET', this.rp(`/git/ref/heads/${encodeURIComponent(CFG.branch)}`)); },
  commit(sha) { return this.call('GET', this.rp(`/git/commits/${sha}`)); },
  tree(sha) { return this.call('GET', this.rp(`/git/trees/${sha}?recursive=1`)); },
  blob(sha) { return this.call('GET', this.rp(`/git/blobs/${sha}`)); },
  newBlob(b64) { return this.call('POST', this.rp('/git/blobs'), { content: b64, encoding: 'base64' }); },
  newTree(base, entries) { return this.call('POST', this.rp('/git/trees'), { base_tree: base, tree: entries }); },
  newCommit(message, tree, parent) { return this.call('POST', this.rp('/git/commits'), { message, tree, parents: [parent] }); },
  move(sha) { return this.call('PATCH', this.rp(`/git/refs/heads/${encodeURIComponent(CFG.branch)}`), { sha, force: false }); },
  async snapshot() {
    const ref = await this.head();
    const head = ref.object.sha;
    const commit = await this.commit(head);
    const tree = await this.tree(commit.tree.sha);
    const files = new Map();
    for (const e of tree.tree) if (e.type === 'blob') files.set(e.path, e.sha);
    return { head, tree: commit.tree.sha, files };
  },
  async text(sha) { const b = await this.blob(sha); return b64ToText(b.content); },
};

// ---------------------------------------------------------------- reading the source
// A small tokenizer that records where every start tag, its attributes and its end tag sit in the source text.
// The preview gets the same tags numbered (data-ve), so a click in the preview points at an exact place in the file.
const VOID = new Set('area base br col embed hr img input link meta param source track wbr keygen command basefont bgsound frame image'.split(' '));
const RAW = new Set('script style textarea title xmp iframe noembed noframes noscript plaintext'.split(' '));
function mapSource(src) {
  const tags = [];
  const n = src.length;
  const stacks = new Map();
  const ws = (c) => c === ' ' || c === '\n' || c === '\t' || c === '\r' || c === '\f';
  let foreign = 0;
  let i = 0;
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) break;
    i = lt;
    const c1 = src[i + 1];
    if (src.startsWith('<!--', i)) { const e = src.indexOf('-->', i + 4); i = e < 0 ? n : e + 3; continue; }
    if (src.startsWith('<![CDATA[', i)) { const e = src.indexOf(']]>', i); i = e < 0 ? n : e + 3; continue; }
    if (c1 === '!' || c1 === '?') { const e = src.indexOf('>', i + 2); i = e < 0 ? n : e + 1; continue; }
    if (c1 === '/') {
      const m = /^<\/([a-zA-Z][^\s/>]*)[^>]*>/.exec(src.slice(i, i + 300));
      if (!m) { i += 2; continue; }
      const name = m[1].toLowerCase();
      const st = stacks.get(name);
      if (st && st.length) st.pop().close = { start: i, end: i + m[0].length };
      if ((name === 'svg' || name === 'math') && foreign > 0) foreign--;
      i += m[0].length;
      continue;
    }
    if (!c1 || !/[a-zA-Z]/.test(c1)) { i++; continue; }
    let j = i + 1;
    while (j < n && !ws(src[j]) && src[j] !== '/' && src[j] !== '>') j++;
    const t = { i: tags.length, name: src.slice(i + 1, j).toLowerCase(), start: i, nameEnd: j, attrs: [], selfClosing: false, end: n, close: null };
    for (;;) {
      while (j < n && ws(src[j])) j++;
      if (j >= n) break;
      if (src[j] === '>') { j++; break; }
      if (src[j] === '/') { if (src[j + 1] === '>') { t.selfClosing = true; j += 2; break; } j++; continue; }
      const a0 = j;
      if (src[j] === '=') j++;
      while (j < n && !ws(src[j]) && src[j] !== '/' && src[j] !== '>' && src[j] !== '=') j++;
      const name = src.slice(a0, j).toLowerCase();
      let k = j;
      while (k < n && ws(src[k])) k++;
      if (src[k] === '=') {
        k++;
        while (k < n && ws(src[k])) k++;
        const q = src[k];
        if (q === '"' || q === "'") {
          const e = src.indexOf(q, k + 1);
          const vEnd = e < 0 ? n : e;
          t.attrs.push({ name, start: a0, end: Math.min(n, vEnd + 1), value: src.slice(k + 1, vEnd) });
          j = Math.min(n, vEnd + 1);
        } else {
          const v0 = k;
          while (k < n && !ws(src[k]) && src[k] !== '>') k++;
          t.attrs.push({ name, start: a0, end: k, value: src.slice(v0, k) });
          j = k;
        }
      } else {
        t.attrs.push({ name, start: a0, end: j, value: '' });
      }
    }
    t.end = j;
    tags.push(t);
    i = j;
    if ((t.name === 'svg' || t.name === 'math') && !t.selfClosing) foreign++;
    if (RAW.has(t.name) && !(t.selfClosing && foreign)) {
      const re = new RegExp('</' + t.name + '(?=[\\s/>])', 'ig');
      re.lastIndex = i;
      const m = re.exec(src);
      if (m) { const e = src.indexOf('>', m.index); t.close = { start: m.index, end: e < 0 ? n : e + 1 }; i = t.close.end; } else i = n;
      continue;
    }
    const closes = VOID.has(t.name) || (t.selfClosing && foreign > 0);
    if (!closes) { let st = stacks.get(t.name); if (!st) stacks.set(t.name, (st = [])); st.push(t); }
  }
  return { src, tags };
}
const attrOf = (t, name) => t && t.attrs.find((a) => a.name === name);
const attrVal = (t, name) => { const a = attrOf(t, name); return a ? decodeAttr(a.value) : null; };

// ---------------------------------------------------------------- state
const ui = { device: 'desktop', scope: 'this', selIdx: 0, gesture: false, connected: false, preparing: 0 };
let busy = false; // publishing: the page and the controls hold still until it is done
let S = null; // the open page
let pages = [];
let tree = null; // { head, tree, files }
let siteCache = null; // { sha, src }

const emptyRules = () => ({ all: {}, tablet: {}, phone: {} });
function parseRules(css) {
  const rs = emptyRules();
  if (!css || !css.trim()) return rs;
  let sheet;
  try { sheet = new CSSStyleSheet(); sheet.replaceSync(css); } catch { return rs; }
  const take = (rule, dev) => {
    const d = rs[dev][rule.selectorText] || (rs[dev][rule.selectorText] = {});
    for (let i = 0; i < rule.style.length; i++) { const p = rule.style[i]; d[p] = rule.style.getPropertyValue(p).trim(); }
  };
  for (const r of sheet.cssRules) {
    if (r instanceof CSSStyleRule) take(r, 'all');
    else if (r instanceof CSSMediaRule) {
      const mt = r.media.mediaText;
      const dev = mt.includes('734') ? 'phone' : mt.includes('1068') ? 'tablet' : null;
      if (dev) for (const c of r.cssRules) if (c instanceof CSSStyleRule) take(c, dev);
    }
  }
  return rs;
}
function parseFontsHref(href) {
  const m = new Map();
  if (!href) return m;
  try {
    for (const f of new URL(href).searchParams.getAll('family')) {
      const [name, spec] = f.split(':');
      m.set(name.replace(/\+/g, ' '), spec || '');
    }
  } catch { /* ignore */ }
  return m;
}
function usedFonts(scope) {
  const css = JSON.stringify(S.rules[scope]);
  return new Map([...S.fonts[scope]].filter(([n]) => css.includes(n)));
}
const fontsHref = (map) => (map.size ? 'https://fonts.googleapis.com/css2?' + [...map].map(([n, spec]) => 'family=' + n.trim().replace(/ /g, '+') + (spec ? ':' + spec : '')).join('&') + '&display=swap' : '');
function cssText(rs, mode) {
  const val = (v) => v;
  const block = (rules, pad) => Object.entries(rules)
    .filter(([, d]) => Object.keys(d).length)
    .map(([sel, d]) => `${pad}${sel} { ${Object.entries(d).map(([p, v]) => `${p}: ${val(v)} !important;`).join(' ')} }`).join('\n');
  let out = block(rs.all, '');
  for (const dev of ['tablet', 'phone']) {
    const b = block(rs[dev], '  ');
    if (b) out += (out ? '\n' : '') + `@media ${MEDIA[dev]} {\n${b}\n}`;
  }
  return out;
}
function siteBlocks(src) {
  const blk = /\/\* site-editor:start[\s\S]*?\*\/\n?([\s\S]*?)\/\* site-editor:end \*\//.exec(src);
  const imp = /^@import url\("([^"]*)"\);[ \t]*\/\* site-editor:fonts \*\//m.exec(src);
  return { css: blk ? blk[1] : '', fonts: imp ? imp[1] : '' };
}

// The page's own block of editor styles and its font link.
function pageBlock(src, map) {
  const styleTag = map.tags.find((t) => t.name === 'style' && attrVal(t, 'id') === 'site-editor');
  const linkTag = map.tags.find((t) => t.name === 'link' && attrVal(t, 'id') === 'site-editor-fonts');
  const css = styleTag && styleTag.close ? src.slice(styleTag.end, styleTag.close.start).replace(/\/\*[\s\S]*?\*\//, '') : '';
  return { rules: parseRules(css), fonts: parseFontsHref(linkTag ? attrVal(linkTag, 'href') : '') };
}
const siteCssLinks = (map, path) => map.tags.filter((t) => t.name === 'link' && /(^|\s)stylesheet(\s|$)/i.test(attrVal(t, 'rel') || '') && resolvesTo(attrVal(t, 'href'), path, SITE_CSS));
function newState(path, sha, src) {
  const map = mapSource(src);
  const usesSiteCss = siteCssLinks(map, path).length > 0;
  const own = pageBlock(src, map);
  const rules = { page: own.rules, site: emptyRules() };
  const fonts = { page: own.fonts, site: new Map() };
  if (usesSiteCss && siteCache) {
    const b = siteBlocks(siteCache.src);
    rules.site = parseRules(b.css);
    fonts.site = parseFontsHref(b.fonts);
  }
  return {
    path, sha, src, map, dir: path.includes('/') ? path.replace(/[^/]*$/, '') : '',
    usesSiteCss,
    edits: new Map(),
    rules, fonts,
    loaded: clone({ rules, fonts: { page: [...fonts.page].filter(([n]) => JSON.stringify(rules.page).includes(n)), site: [...fonts.site].filter(([n]) => JSON.stringify(rules.site).includes(n)) } }),
    uploads: new Map(),
    previews: (S && S.previews) || new Map(),
    textOk: new Map(),
    touched: new Set(), // elements changed at some point, so the preview knows what to put back
    htmlIds: new Set(), // elements whose text was changed at some point
    inner: new Map(), // element -> its inside as the preview first had it
    editing: new Set(), // texts the preview was asked to open for typing
    markers: new Map(), // element -> the data-se marker picked for it
    gen: 0, // goes up whenever the elements are numbered anew (a newer version of the page)
    past: [], future: [],
    sel: null, scrollY: 0, ready: false,
  };
}
function resolvesTo(href, pagePath, target) {
  if (!href) return false;
  try {
    const base = new URL('https://x.invalid/' + pagePath);
    const u = new URL(href, base);
    return u.host === 'x.invalid' && u.pathname === '/' + target;
  } catch { return false; }
}
const pageRulesChanged = () => JSON.stringify(S.rules.page) !== JSON.stringify(S.loaded.rules.page) || JSON.stringify([...usedFonts('page')]) !== JSON.stringify(S.loaded.fonts.page);
const siteRulesChanged = () => S.usesSiteCss && (JSON.stringify(S.rules.site) !== JSON.stringify(S.loaded.rules.site) || JSON.stringify([...usedFonts('site')]) !== JSON.stringify(S.loaded.fonts.site));

// ---------------------------------------------------------------- history
function snap() { return JSON.stringify({ e: [...S.edits], r: S.rules, f: { page: [...S.fonts.page], site: [...S.fonts.site] } }); }
function restore(json) {
  const o = JSON.parse(json);
  S.edits = new Map(o.e);
  S.rules = o.r;
  S.fonts = { page: new Map(o.f.page), site: new Map(o.f.site) };
}
function record() {
  S.past.push(snap());
  if (S.past.length > 300) S.past.shift();
  S.future = [];
}
// A slider drag or a typed number is one step of history: record once at the start of the gesture.
function begin() { if (!ui.gesture) { record(); ui.gesture = true; } }
function end() { ui.gesture = false; updateBar(); }
function undo() { if (!S || busy || !S.past.length) return; S.future.push(snap()); restore(S.past.pop()); sync(); renderPanel(); }
function redo() { if (!S || busy || !S.future.length) return; S.past.push(snap()); restore(S.future.pop()); sync(); renderPanel(); }

// ---------------------------------------------------------------- the preview
const frame = $('#frame');
const stage = $('#stage');
const canvas = $('#canvas');
let reqN = 0;
const pending = new Map();
function post(msg) { if (frame.contentWindow) frame.contentWindow.postMessage(Object.assign({ __se: 1 }, msg), '*'); }
function ask(msg, ms = 4000) {
  const req = ++reqN;
  return new Promise((resolve) => {
    pending.set(req, resolve);
    post(Object.assign({ req }, msg));
    setTimeout(() => { if (pending.has(req)) { pending.delete(req); resolve(null); } }, ms);
  });
}

// style.css as the preview gets it: without the editor's block, whose rules come from the editor itself, so a
// rule taken back shows as gone at once. Addresses inside it are made absolute, since it is loaded from memory.
function siteCssForPreview() {
  if (!siteCache) return null;
  if (S.cssData && S.cssData.sha === siteCache.sha) return S.cssData.url;
  const base = CFG.site + SITE_CSS;
  const abs = (u) => { try { return new URL(u.trim(), base).href; } catch { return u; } };
  const css = siteCache.src
    .replace(/^@import url\("[^"]*"\);[ \t]*\/\* site-editor:fonts \*\/\n?/m, '')
    .replace(/\n*\/\* site-editor:start[\s\S]*?\/\* site-editor:end \*\/\n?/, '\n')
    .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (all, q, u) => (/^\s*(data:|#)/i.test(u) ? all : `url("${abs(u)}")`))
    .replace(/@import\s+(['"])([^'"]+)\1/g, (all, q, u) => `@import url("${abs(u)}")`);
  S.cssData = { sha: siteCache.sha, url: 'data:text/css;base64,' + textToB64(css) };
  return S.cssData.url;
}
function previewSource() {
  const { src, tags } = S.map;
  const ins = [];
  for (const t of tags) ins.push([t.nameEnd, ` data-ve="${t.i}"`]);
  if (S.usesSiteCss && siteCache) {
    const url = siteCssForPreview();
    for (const t of siteCssLinks(S.map, S.path)) { const a = attrOf(t, 'href'); if (a) ins.push([a.start, `href="${escAttr(url)}"`, a.end]); }
  }
  const head = tags.find((t) => t.name === 'head');
  if (!tags.some((t) => t.name === 'base')) {
    const at = head ? head.end : (tags.find((t) => t.name === 'html') || { end: 0 }).end;
    ins.push([at, `<base href="${escAttr(CFG.site + S.dir)}">`]);
  }
  const body = tags.find((t) => t.name === 'body');
  const at = body && body.close ? body.close.start : src.length;
  ins.push([at, `<script>(${agent.toString()})();<\/script>`]);
  ins.sort((a, b) => a[0] - b[0]);
  let out = '';
  let last = 0;
  for (const [pos, s, upTo] of ins) { out += src.slice(last, pos) + s; last = upTo == null ? pos : upTo; }
  return out + src.slice(last);
}
function render() {
  S.ready = false;
  $('#loading').hidden = false;
  const fwd = S.map.tags.find((t) => t.name === 'meta' && (attrVal(t, 'http-equiv') || '').toLowerCase() === 'refresh');
  if (fwd) {
    frame.srcdoc = '';
    const raw = (/url\s*=\s*['"]?([^'"\s]+)/i.exec(attrVal(fwd, 'content') || '') || [])[1] || '';
    let to = null;
    try {
      const u = new URL(raw, CFG.site + S.dir);
      const root = new URL(CFG.site);
      if (raw && u.origin === root.origin && u.pathname.startsWith(root.pathname)) {
        let p = decodeURI(u.pathname.slice(root.pathname.length));
        if (p === '' || p.endsWith('/')) p += 'index.html';
        if (pages.includes(p) && p !== S.path) to = p;
      }
    } catch { /* not an address on this site */ }
    const box = $('#loading');
    box.textContent = 'This page only sends visitors on to ' + (to ? pageName(to) : raw || 'another page') + ', so there is nothing on it to edit.';
    if (to) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = 'Open ' + pageName(to);
      b.addEventListener('click', () => openPage(to));
      box.append(b);
    }
    return;
  }
  $('#loading').textContent = 'Loading ' + pageName(S.path) + '…';
  frameLoads = 0;
  frame.srcdoc = previewSource();
}
let frameLoads = 0;
frame.addEventListener('load', () => {
  if (!S || !frame.srcdoc) return;
  if (++frameLoads > 1) { // the page's own script sent the preview somewhere else
    S.ready = false;
    $('#loading').hidden = false;
    $('#loading').textContent = 'This page sends visitors on to another address, so it can’t be shown here.';
  }
});
let syncQueued = false;
function sync() {
  if (!S || syncQueued) return;
  syncQueued = true;
  requestAnimationFrame(() => {
    syncQueued = false;
    if (!S.ready) return;
    for (const [id, e] of S.edits) if (e.html != null) S.htmlIds.add(id);
    const ids = new Set([...S.touched, ...S.edits.keys()]);
    post({
      type: 'state',
      edits: [...ids].map((id) => {
        const e = S.edits.get(id) || {};
        return [String(id), { html: e.html ?? null, attrs: previewAttrs(e.attrs), orig: S.htmlIds.has(id) ? previewInner(id) : null }];
      }),
      css: { site: S.usesSiteCss ? cssText(S.rules.site, 'preview') : '', page: cssText(S.rules.page, 'preview') },
      fonts: [fontsHref(usedFonts('site')), fontsHref(usedFonts('page'))].filter(Boolean),
    });
    updateBar();
  });
}
const previewAttrs = (attrs) => Object.assign({}, attrs || {});
// An element's inside as the preview first showed it: the file's text, with the preview's element numbers.
function previewInner(id) {
  if (S.inner.has(id)) return S.inner.get(id);
  const t = S.map.tags[id];
  let out = null;
  if (t && t.close) {
    out = '';
    let last = t.end;
    for (let k = id + 1; k < S.map.tags.length; k++) {
      const c = S.map.tags[k];
      if (c.start >= t.close.start) break;
      out += S.src.slice(last, c.nameEnd) + ` data-ve="${c.i}"`;
      last = c.nameEnd;
    }
    out += S.src.slice(last, t.close.start);
  }
  S.inner.set(id, out);
  return out;
}
function sendPreviews() { for (const [src, p] of S.previews) post({ type: 'image', src, mime: p.mime, bytes: p.bytes }); }
function layout() {
  const W = DEVICES[ui.device];
  const cw = canvas.clientWidth - 48;
  const ch = canvas.clientHeight - 48;
  const scale = Math.min(1, cw / W);
  const H = Math.max(480, Math.round(ch / scale));
  frame.style.width = W + 'px';
  frame.style.height = H + 'px';
  frame.style.transform = scale < 1 ? `scale(${scale})` : 'none';
  stage.style.width = Math.round(W * scale) + 'px';
  stage.style.height = Math.round(H * scale) + 'px';
  stage.style.transform = 'translateX(-50%)';
  stage.classList.toggle('phone', ui.device === 'phone');
}
addEventListener('resize', layout);

// Anything the preview reports could also come from a script on the page itself, so it is reduced to plain,
// checked values before it is used: numbers become numbers, references must look like references, selectors
// must look like the ones the editor makes, and every text is escaped wherever it is shown.
const str = (v, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const refOk = (v) => (typeof v === 'string' && /^t?\d{1,7}$/.test(v) ? v : null);
const idOk = (v) => (typeof v === 'string' && /^\d{1,7}$/.test(v) ? v : null);
const SEL_OK = /^(?:\.[A-Za-z_][\w-]*\s)?[a-z][a-z0-9-]*(?:\.[A-Za-z_][\w-]*){0,8}$/;
const SE_OK = /^[a-z0-9]{1,16}$/;
const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
function cleanBrief(b) {
  b = b && typeof b === 'object' ? b : {};
  const tag = str(b.tag, 40);
  return { ref: refOk(b.ref), id: idOk(b.id), tag: /^[a-z][a-z0-9-]*$/.test(tag) ? tag : 'element', cls: list(b.cls, 12).map((c) => str(c, 80)).filter(Boolean) };
}
function cleanInfo(i) {
  if (!i || typeof i !== 'object' || !refOk(i.ref)) return null;
  const c = i.css && typeof i.css === 'object' ? i.css : {};
  const css = {};
  for (const k of ['ff', 'fs', 'fw', 'fst', 'lh', 'ls', 'color', 'ta', 'tt', 'bg', 'mt', 'mb', 'br', 'display']) css[k] = str(c[k], 300);
  let img = null;
  if (i.img && typeof i.img === 'object') {
    const g = i.img;
    const cur = str(g.cur, 4000);
    img = {
      src: str(g.src, 4000), cur: /^https?:\/\//i.test(cur) || /^data:image\//i.test(cur) ? cur : '', alt: str(g.alt, 2000),
      w: Math.round(num(g.w)), h: Math.round(num(g.h)), srcset: !!g.srcset, sizes: !!g.sizes, wAttr: !!g.wAttr, hAttr: !!g.hAttr,
      sources: list(g.sources, 12).map((s) => ({ ref: refOk(s && s.ref), id: idOk(s && s.id), type: !!(s && s.type) })),
    };
  }
  const l = i.link && typeof i.link === 'object' ? i.link : null;
  const base = cleanBrief(i);
  return {
    ref: base.ref, id: base.id, tag: base.tag, cls: base.cls,
    se: typeof i.se === 'string' && SE_OK.test(i.se) ? i.se : null,
    textBlock: !!i.textBlock, text: str(i.text, 6000), css, img,
    bgUrl: i.bgUrl ? str(i.bgUrl, 4000) : null,
    link: l && refOk(l.ref) ? { ref: refOk(l.ref), id: idOk(l.id), href: str(l.href, 4000), target: str(l.target, 40) } : null,
    ancestors: list(i.ancestors, 80).map(cleanBrief).filter((b) => b.ref),
    sugg: list(i.sugg, 12).map((s) => ({ sel: str(s && s.sel, 300), n: Math.max(0, Math.round(num(s && s.n))) })).filter((s) => SEL_OK.test(s.sel)),
    stack: i.stack ? list(i.stack, 8).map(cleanBrief).filter((b) => b.ref) : undefined,
    w: Math.round(num(i.w)), h: Math.round(num(i.h)),
  };
}
// Edited text goes onto the website, so it may not bring anything that runs: no new scripts, frames, styles,
// forms or event handlers beyond what the element already had in the file.
const RISKY_TAGS = new Set(['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'link', 'meta', 'base', 'form', 'input', 'textarea', 'select', 'button', 'template', 'noscript', 'portal', 'title', 'head', 'body', 'html']);
function risk(html) {
  const doc = parser.parseFromString('<!doctype html><body>' + html, 'text/html');
  let n = 0;
  for (const el of doc.body.querySelectorAll('*')) {
    if (RISKY_TAGS.has(el.localName)) n++;
    for (const a of el.attributes) {
      if (/^on/i.test(a.name) || a.name === 'srcdoc') n++;
      else if (/^(href|src|srcset|action|formaction|xlink:href|poster|data)$/i.test(a.name) && /^[\s\0-\x1f]*(javascript|vbscript|data:text\/html)/i.test(a.value)) n++;
    }
  }
  return n;
}
function acceptHTML(id, html) {
  const t = tagOf(id);
  if (typeof html !== 'string' || html.length > 300000 || !t || !t.close) return null;
  if (risk(html) > risk(S.src.slice(t.end, t.close.start))) { toast('That change can’t be saved: it would add something that runs on the page.', true); return null; }
  return html;
}

addEventListener('message', (e) => {
  if (e.source !== frame.contentWindow) return;
  const m = e.data;
  if (!m || typeof m !== 'object' || !m.__se || !S) return;
  switch (m.type) {
    case 'ready':
      if (S.ready) break;
      S.ready = true;
      $('#loading').hidden = true;
      sendPreviews();
      sync();
      if (S.scrollY) post({ type: 'scroll', y: S.scrollY });
      break;
    case 'select': { const info = cleanInfo(m.info); if (info) onSelect(info); break; }
    case 'info': { const info = cleanInfo(m.info); if (S.sel && info && info.ref === S.sel.ref) { S.sel = Object.assign(info, { stack: S.sel.stack }); renderPanel(true); } break; }
    case 'deselect': S.sel = null; renderPanel(); break;
    case 'dbl': if (refOk(m.ref)) editTextOf(m.ref); break;
    case 'text': onText(m); break;
    case 'scrolled': S.scrollY = num(m.y); break;
    case 'key':
      if (busy) break;
      if (m.key === 'z' && !m.shift) undo();
      else if ((m.key === 'z' && m.shift) || m.key === 'y') redo();
      break;
    case 'reply': { const r = pending.get(m.req); if (r) { pending.delete(m.req); r(m); } break; }
  }
});

// ---------------------------------------------------------------- editing model
function editOf(id) { let e = S.edits.get(id); if (!e) S.edits.set(id, (e = {})); S.touched.add(id); return e; }
function prune(id) { const e = S.edits.get(id); if (e && e.html == null && !Object.keys(e.attrs || {}).length) S.edits.delete(id); }
const tagOf = (id) => (id == null ? null : S.map.tags[+id]);
// The nearest element (the target itself or above it) whose text was edited: everything inside that element is
// saved as part of its text. The chain comes from the selection, so it also works for the link around it.
function ownerAbove(targetRef, info = S.sel) {
  if (!info) return null;
  const chain = [info, ...(info.ancestors || [])];
  const ti = chain.findIndex((a) => a.ref === targetRef);
  if (ti < 0) return null;
  for (let k = ti; k < chain.length; k++) {
    const a = chain[k];
    if (a.id != null && S.edits.get(+a.id) && S.edits.get(+a.id).html != null) return a;
  }
  return null;
}
const ownerOf = (info) => ownerAbove(info.ref, info);
function canEditText(info) {
  if (!info || info.id == null) return false;
  const id = +info.id;
  if (S.textOk.has(id)) return S.textOk.get(id);
  const t = tagOf(id);
  let ok = false;
  if (t && t.close && !RAW.has(t.name) && info.textBlock) ok = norm(textOfHTML(S.src.slice(t.end, t.close.start))) === norm(info.text);
  S.textOk.set(id, ok);
  return ok;
}
function onSelect(info) {
  S.sel = info;
  if (info.id != null) canEditText(info); // remember whether its text matches the file before anything changes
  ui.selIdx = 0;
  if (ui.scope !== 'this' && !scopeOptions(info).length) ui.scope = 'this';
  renderPanel();
}
// Set attributes on the selected element (or the link around it). Inside edited text, the change is made in
// the preview and the edited text is saved again with it.
async function setAttrs(target, attrs, info = S.sel) {
  const owner = ownerAbove(target.ref, info);
  if (owner && owner.ref !== target.ref) {
    begin();
    const r = await ask({ type: 'direct', ref: target.ref, owner: owner.ref, attrs });
    const html = r && r.ok ? acceptHTML(+owner.id, r.html) : null;
    if (html != null) { editOf(+owner.id).html = html; foldInto(+owner.id); }
    end(); sync(); renderPanel();
    return;
  }
  if (target.id == null) { toast('This part is made by the page’s script, so it can’t be changed here.', true); return; }
  const cur = (S.edits.get(+target.id) || {}).attrs || {};
  const t0 = tagOf(+target.id);
  const same = Object.entries(attrs).every(([k, v]) => (k in cur ? cur[k] : attrVal(t0, k)) === (v ?? null));
  if (same) return;
  begin();
  const e = editOf(+target.id);
  e.attrs = e.attrs || {};
  const t = tagOf(+target.id);
  for (const [k, v] of Object.entries(attrs)) {
    const orig = attrVal(t, k);
    if ((v ?? null) === orig) delete e.attrs[k]; else e.attrs[k] = v;
  }
  prune(+target.id);
  end(); sync(); renderPanel(true);
}
function foldInto(id) {
  // Edits recorded earlier on elements inside this one are part of its new text now.
  const t = tagOf(id);
  if (!t || !t.close) return;
  for (const k of [...S.edits.keys()]) {
    if (k === id) continue;
    const c = tagOf(k);
    if (c && c.start >= t.end && c.start < t.close.start) S.edits.delete(k);
  }
}
function onText(m) {
  // Only the text the editor asked to be edited comes back, and only once.
  const sid = idOk(m.id);
  if (sid == null || busy || m.ref !== sid || !S.editing.has(sid)) return;
  S.editing.delete(sid);
  const id = +sid;
  const t = tagOf(id);
  S.touched.add(id);
  const html = acceptHTML(id, m.html);
  if (html == null) { sync(); return; }
  record();
  const orig = t && t.close ? S.src.slice(t.end, t.close.start) : null;
  const e = editOf(id);
  if (html === orig) delete e.html; else e.html = html;
  foldInto(id);
  prune(id);
  updateBar(); sync(); renderPanel(true);
}
async function editTextOf(ref) {
  if (busy) return;
  const info = S.sel && S.sel.ref === ref ? S.sel : null;
  if (!info) return;
  const owner = ownerOf(info);
  if (owner) { S.editing.add(owner.ref); post({ type: 'edit', ref: owner.ref }); return; }
  if (canEditText(info)) { S.editing.add(ref); post({ type: 'edit', ref }); return; }
  if (info.id == null) toast('This text is made by the page’s script, so it can’t be changed here.', true);
  else if (!info.textBlock) toast('Double-click the text itself to change it.', true);
  else toast('This text is changed by the page’s script after it loads, so it can’t be edited here.', true);
}

// Where a style change goes: this element, everything like it on this page, or every page (style.css).
function similarOptions(info) { return (info.sugg || []).filter((s) => s.n >= 2); }
// For every page, a match needn't repeat here: a page title is alone on each page but shared by all of them.
function siteOptions(info) { return (info.sugg || []).filter((s) => s.n >= 1); }
const scopeOptions = (info) => (ui.scope === 'site' ? siteOptions(info) : similarOptions(info));
function styleTarget() {
  const info = S.sel;
  if (!info) return null;
  const dev = DEV_KEY[ui.device];
  if (ui.scope === 'this') {
    const se = info.se || markerFor(info);
    return { scope: 'page', dev, sel: `[data-se="${se}"]`, se, needsMarker: !hasMarker(info, se) };
  }
  const opts = scopeOptions(info);
  const pick = opts[Math.min(ui.selIdx, opts.length - 1)];
  if (!pick) return null;
  return { scope: ui.scope === 'site' && S.usesSiteCss ? 'site' : 'page', dev, sel: pick.sel };
}
function hasMarker(info, se) {
  const owner = ownerOf(info);
  if (owner && owner.ref !== info.ref) return (S.edits.get(+owner.id).html || '').includes(`data-se="${se}"`);
  if (info.id == null) return false;
  const e = S.edits.get(+info.id);
  if (e && e.attrs && 'data-se' in e.attrs) return e.attrs['data-se'] === se;
  return attrVal(tagOf(+info.id), 'data-se') === se;
}
// A marker is only ever used by one element: never one that is already in the file, in a change or in a rule.
function markerTaken(m) {
  const q = `data-se="${m}"`;
  if (S.src.includes(q) || [...S.markers.values()].includes(m)) return true;
  for (const e of S.edits.values()) if ((e.attrs && e.attrs['data-se'] === m) || (e.html && e.html.includes(q))) return true;
  return JSON.stringify(S.rules).includes(m);
}
function markerFor(info) {
  const had = S.markers.get(info.ref);
  if (had) return had;
  let m;
  do { m = Math.random().toString(36).slice(2, 7); } while (!SE_OK.test(m) || m.length < 5 || markerTaken(m));
  S.markers.set(info.ref, m);
  return m;
}
async function setStyle(prop, value, opts = {}) {
  const target = styleTarget();
  if (!target) return;
  if (target.needsMarker) {
    const info = S.sel;
    const owner = ownerOf(info);
    if (info.id == null && !owner) { toast('This part is made by the page’s script, so it can’t be styled on its own. Try “All like this”.', true); return; }
    begin();
    if (owner && owner.ref !== info.ref) {
      const r = await ask({ type: 'direct', ref: info.ref, owner: owner.ref, attrs: { 'data-se': target.se } });
      const html = r && r.ok ? acceptHTML(+owner.id, r.html) : null;
      if (html == null) { end(); return; }
      editOf(+owner.id).html = html; foldInto(+owner.id);
    } else {
      const e = editOf(+info.id);
      e.attrs = Object.assign(e.attrs || {}, { 'data-se': target.se });
    }
    S.sel.se = target.se;
  } else begin();
  const R = S.rules[target.scope][target.dev];
  const d = R[target.sel] || (R[target.sel] = {});
  if (value == null || value === '') delete d[prop]; else d[prop] = value;
  if (!Object.keys(d).length) delete R[target.sel];
  if (opts.font) addFont(target.scope, opts.font);
  if (!opts.live) end();
  sync();
}
// Height and width are the size you see: padding and border included (box-sizing), and the page's own
// smallest size (min-height, as on the site's buttons) can't hold it bigger.
async function setSize(p, v) {
  await setStyle(p, v, { live: true });
  await setStyle('min-' + p, v, { live: true });
  if (v != null) await setStyle('box-sizing', 'border-box', { live: true });
  else if (ruleValue(p === 'height' ? 'width' : 'height') == null) await setStyle('box-sizing', null, { live: true });
}
function ruleValue(prop) {
  const t = styleTarget();
  if (!t) return null;
  const d = S.rules[t.scope][t.dev][t.sel];
  return d ? d[prop] ?? null : null;
}
function addFont(scope, font) {
  if (!font.g && font.g !== '') return;
  S.fonts[scope].set(font.name, font.g);
}
const fontSpecCache = new Map();
async function findFontSpec(name) {
  // Google Fonts refuses a weight range a font does not have; try the likely ones in turn.
  if (fontSpecCache.has(name)) return fontSpecCache.get(name);
  for (const spec of ['wght@100..900', 'wght@200..800', 'wght@300..700', 'wght@400..700', 'wght@300;400;500;600;700', 'wght@400;700', '']) {
    const url = 'https://fonts.googleapis.com/css2?family=' + name.trim().replace(/ /g, '+') + (spec ? ':' + spec : '') + '&display=swap';
    if (await linkLoads(url)) { fontSpecCache.set(name, spec); return spec; }
  }
  fontSpecCache.set(name, null);
  return null;
}

function linkLoads(url) {
  return new Promise((resolve) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = url;
    let settled = false;
    const done = (ok) => { if (settled) return; settled = true; l.remove(); resolve(ok); };
    l.onload = () => done(true);
    l.onerror = () => done(false);
    setTimeout(() => done(false), 8000);
    document.head.appendChild(l);
  });
}

// ---------------------------------------------------------------- images
const picker = $('#filePick');
async function prepareImage(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext0 = (file.name.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
  const out = { bytes, type: file.type, ext: ext0 || (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg'), note: '' };
  let w = 0, h = 0;
  try { const bmp = await createImageBitmap(file); w = bmp.width; h = bmp.height; out.w = w; out.h = h; bmp.close && bmp.close(); } catch { /* svg or unknown */ }
  const big = Math.max(w, h) > 2560 || bytes.length > 1.5 * 1048576;
  if (big && /^image\/(jpeg|png|webp)$/.test(file.type) && w) {
    // Large pictures are made web-ready: at most 2560 px on the long side, WebP.
    const scale = Math.min(1, 2560 / Math.max(w, h));
    const cw = Math.round(w * scale), ch = Math.round(h * scale);
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const bmp = await createImageBitmap(file);
    c.getContext('2d').drawImage(bmp, 0, 0, cw, ch);
    let blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.86));
    if (blob && blob.size > 2 * 1048576) blob = (await new Promise((r) => c.toBlob(r, 'image/webp', 0.72))) || blob; // very detailed pictures: a little more compression
    if (blob && blob.type === 'image/webp' && blob.size < bytes.length) {
      out.bytes = new Uint8Array(await blob.arrayBuffer());
      out.type = 'image/webp'; out.ext = 'webp'; out.w = cw; out.h = ch;
      out.note = `Made web-ready: ${cw} × ${ch} px, WebP, ${kb(out.bytes.length)} (was ${kb(bytes.length)}).`;
    }
  }
  return out;
}
function uniquePath(dir, base, ext) {
  const taken = (p) => (tree && tree.files.has(p)) || S.uploads.has(p);
  let name = `${base}.${ext}`;
  for (let k = 2; taken(dir + name); k++) name = `${base}-${k}.${ext}`;
  return dir + name;
}
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'image';
async function replaceImage(kind) {
  const info = S.sel;
  if (!info || busy) return;
  picker.value = '';
  const file = await new Promise((resolve) => { picker.onchange = () => resolve(picker.files[0] || null); picker.click(); });
  if (!file) return;
  if (!/^image\//.test(file.type)) { toast('Pick a picture file (JPG, PNG, WebP, GIF, SVG or AVIF).', true); return; }
  const S0 = S;
  const gen0 = S.gen;
  ui.preparing++;
  updateBar();
  toast('Preparing the picture…');
  let img;
  try { img = await prepareImage(file); } finally { ui.preparing--; updateBar(); }
  // the page may have been published or opened anew meanwhile: then the element is not where it was
  if (S !== S0 || S.gen !== gen0 || busy) { toast('The page changed while the picture was prepared. Select the picture and pick the file again.', true); return; }
  const base = slug(file.name.replace(/\.[^.]+$/, ''));
  let dir, srcValue;
  const pageUrl = new URL(CFG.site + S.dir);
  if (kind === 'img') {
    const cur = info.img.src;
    let u = null;
    try { u = new URL(cur, pageUrl); } catch { /* data: or broken */ }
    if (u && u.origin === pageUrl.origin && !cur.startsWith('data:')) {
      dir = decodeURIComponent(u.pathname.slice(1).replace(/[^/]*$/, ''));
      const path = uniquePath(dir, base, img.ext);
      srcValue = cur.replace(/[^/]*$/, '') + path.slice(dir.length);
      S.uploads.set(path, { b64: bytesToB64(img.bytes), size: img.bytes.length, src: srcValue });
    } else {
      dir = S.dir + 'images/';
      const path = uniquePath(dir, base, img.ext);
      srcValue = 'images/' + path.slice(dir.length);
      S.uploads.set(path, { b64: bytesToB64(img.bytes), size: img.bytes.length, src: srcValue });
    }
  } else {
    dir = S.dir + 'images/';
    const path = uniquePath(dir, base, img.ext);
    srcValue = '/' + path;
    S.uploads.set(path, { b64: bytesToB64(img.bytes), size: img.bytes.length, src: srcValue });
  }
  S.previews.set(srcValue, { bytes: img.bytes, mime: img.type });
  post({ type: 'image', src: srcValue, mime: img.type, bytes: img.bytes });
  if (kind === 'img') {
    const attrs = { src: srcValue };
    if (info.img.srcset) attrs.srcset = null;
    if (info.img.sizes) attrs.sizes = null;
    if (img.w && info.img.wAttr && info.img.hAttr) { attrs.width = String(img.w); attrs.height = String(img.h); }
    begin();
    await setAttrs(info, attrs);
    for (const s of info.img.sources || []) {
      if (s.id == null) continue;
      const e = editOf(+s.id);
      e.attrs = Object.assign(e.attrs || {}, { srcset: srcValue }, s.type ? { type: null } : {});
    }
    end(); sync();
  } else {
    await setStyle('background-image', `url("${srcValue}")`);
  }
  toast(img.note || 'Picture replaced. It goes live when you publish.');
}

// ---------------------------------------------------------------- building the files
function rebuildStartTag(src, t, changes) {
  let tag = src.slice(t.start, t.end);
  const off = t.start;
  const ops = [];
  for (const [name, val] of Object.entries(changes)) {
    const a = attrOf(t, name);
    if (a) {
      if (val == null) { let s = a.start - off; while (s > 0 && /\s/.test(tag[s - 1])) s--; ops.push([s, a.end - off, '']); }
      else ops.push([a.start - off, a.end - off, `${name}="${escAttr(val)}"`]);
    } else if (val != null) {
      let p = tag.length - 1;
      if (tag[p - 1] === '/') p--;
      while (p > 0 && /\s/.test(tag[p - 1])) p--;
      ops.push([p, p, ` ${name}="${escAttr(val)}"`]);
    }
  }
  ops.sort((x, y) => y[0] - x[0] || y[1] - x[1]);
  for (const [a, b, s] of ops) tag = tag.slice(0, a) + s + tag.slice(b);
  return tag;
}
function splice(src, reps) {
  reps.sort((a, b) => b.a - a.a || b.b - a.b);
  let out = src;
  let floor = Infinity;
  for (const r of reps) {
    if (r.b > floor) continue; // overlapping edit: the outer one already holds it
    out = out.slice(0, r.a) + r.s + out.slice(r.b);
    floor = r.a;
  }
  return out;
}
function usedMarkers() {
  const used = new Set();
  const walk = (rs) => { for (const dev of ['all', 'tablet', 'phone']) for (const sel of Object.keys(rs[dev])) { const m = /^\[data-se="([^"]+)"\]$/.exec(sel); if (m) used.add(m[1]); } };
  walk(S.rules.page);
  return used;
}
function buildPage(src, map, edits) {
  const reps = [];
  const textRanges = [];
  for (const [id, e] of edits) { const t = map.tags[id]; if (t && e.html != null && t.close) textRanges.push([t.end, t.close.start]); }
  const inside = (t) => textRanges.some(([a, b]) => t.start >= a && t.start < b);
  const used = usedMarkers();
  for (const [id, e] of edits) {
    const t = map.tags[id];
    if (!t || inside(t)) continue;
    const attrs = Object.assign({}, e.attrs || {});
    if (attrs['data-se'] && !used.has(attrs['data-se']) && !attrOf(t, 'data-se')) delete attrs['data-se'];
    if (Object.keys(attrs).length) reps.push({ a: t.start, b: t.end, s: rebuildStartTag(src, t, attrs) });
    if (e.html != null && t.close) reps.push({ a: t.end, b: t.close.start, s: e.html });
  }
  if (pageRulesChanged()) {
    const css = cssText(S.rules.page, 'publish');
    const href = fontsHref(usedFonts('page'));
    const styleTag = map.tags.find((t) => t.name === 'style' && attrVal(t, 'id') === 'site-editor');
    const linkTag = map.tags.find((t) => t.name === 'link' && attrVal(t, 'id') === 'site-editor-fonts');
    const head = map.tags.find((t) => t.name === 'head');
    const headEnd = head && head.close ? head.close.start : (map.tags.find((t) => t.name === 'body') || { start: 0 }).start;
    const block = css ? `<style id="site-editor">\n/* Style changes from the site editor (/edit/). Remove this block to undo all of them. */\n${css}\n</style>` : '';
    const link = href ? `<link id="site-editor-fonts" rel="stylesheet" href="${escAttr(href)}">` : '';
    const cut = (t) => ({ a: t.start, b: src[(t.close || t).end] === '\n' ? (t.close || t).end + 1 : (t.close || t).end });
    if (linkTag) reps.push(Object.assign(cut(linkTag), { s: link ? link + '\n' : '' }));
    else if (link) reps.push({ a: headEnd, b: headEnd, s: link + '\n', order: 0 });
    if (styleTag) reps.push(Object.assign(cut(styleTag), { s: block ? block + '\n' : '' }));
    else if (block) reps.push({ a: headEnd, b: headEnd, s: block + '\n', order: 1 });
  }
  // two insertions at the same place: keep the font link before the style block
  const atHead = reps.filter((r) => r.order != null);
  if (atHead.length === 2) { reps.splice(reps.indexOf(atHead[0]), 1); reps.splice(reps.indexOf(atHead[1]), 1); reps.push({ a: atHead[0].a, b: atHead[0].b, s: atHead[0].s + atHead[1].s }); }
  return splice(src, reps);
}
function buildSiteCss(src) {
  let out = src;
  const href = fontsHref(usedFonts('site'));
  out = out.replace(/^@import url\("[^"]*"\);[ \t]*\/\* site-editor:fonts \*\/\n?/m, '');
  if (href) out = `@import url("${href}"); /* site-editor:fonts */\n` + out;
  out = out.replace(/\n*\/\* site-editor:start[\s\S]*?\/\* site-editor:end \*\/\n?/, '\n');
  const css = cssText(S.rules.site, 'publish');
  if (css) out = out.replace(/\s*$/, '\n') + `\n/* site-editor:start (style changes from the site editor at /edit/; remove this block to undo them) */\n${css}\n/* site-editor:end */\n`;
  return out;
}
function referenced(src) {
  const inAttrs = [...S.edits.values()].some((e) => Object.values(e.attrs || {}).some((v) => v === src) || (e.html && e.html.includes(src)));
  const inCss = JSON.stringify(S.rules).includes(`url(\\"${src}\\")`);
  return inAttrs || inCss;
}
function outputFiles() {
  const files = [];
  const page = buildPage(S.src, S.map, S.edits);
  if (page !== S.src) files.push({ path: S.path, text: page, kind: 'page' });
  if (siteRulesChanged() && siteCache) {
    const css = buildSiteCss(siteCache.src);
    if (css !== siteCache.src) files.push({ path: SITE_CSS, text: css, kind: 'css' });
  }
  for (const [path, u] of S.uploads) if (referenced(u.src)) files.push({ path, b64: u.b64, size: u.size, kind: 'image' });
  return files;
}

// ---------------------------------------------------------------- the list of changes
function changeList() {
  const L = [];
  for (const [id, e] of S.edits) {
    const t = tagOf(id);
    if (e.html != null) L.push({ k: 'html', id, label: t && t.name === 'title' ? 'Page title' : 'Text', detail: norm(textOfHTML(e.html)).slice(0, 70) || '(empty)' });
    for (const [a, v] of Object.entries(e.attrs || {})) {
      if (a === 'data-se' || (t && t.name === 'source')) continue;
      if (a === 'srcset' || a === 'sizes' || ((a === 'width' || a === 'height') && t && t.name === 'img')) continue;
      const isMeta = t && t.name === 'meta';
      L.push({ k: 'attr', id, attr: a, label: isMeta ? metaLabel(t) : ATTR_LABEL[a] || a, detail: v == null ? 'removed' : String(v).replace(/^data:.*/, 'new picture').slice(0, 70) });
    }
  }
  for (const scope of ['page', 'site']) {
    for (const dev of ['all', 'tablet', 'phone']) {
      const now = S.rules[scope][dev];
      const was = S.loaded.rules[scope][dev];
      const sels = new Set([...Object.keys(now), ...Object.keys(was)]);
      for (const sel of sels) {
        const props = new Set([...Object.keys(now[sel] || {}), ...Object.keys(was[sel] || {})]);
        for (const p of props) {
          if (SIZE_HELPERS.has(p)) continue;
          const v = (now[sel] || {})[p];
          const w = (was[sel] || {})[p];
          if (v === w) continue;
          const where = (sel.startsWith('[data-se=') ? 'one element' : sel) + (dev !== 'all' ? ' · ' + DEV_LABEL[dev] : '') + (scope === 'site' ? ' · every page' : '');
          const what = p === 'display' && v === 'none' ? 'hidden' : v == null ? 'back to the original' : p === 'font-family' ? firstFamily(v) : String(v).replace(/url\("[^"]*"\)/, 'new picture');
          L.push({ k: 'rule', scope, dev, sel, prop: p, label: p === 'display' ? 'Hidden' : PROP_LABEL[p] || p, detail: `${what} · ${where}` });
        }
      }
    }
  }
  return L;
}
function sourcesOf(id) {
  const img = S.map.tags[id];
  if (!img) return [];
  for (let k = id - 1; k >= 0 && k >= id - 40; k--) {
    const c = S.map.tags[k];
    if (c.name !== 'picture' || !c.close) continue;
    if (c.close.start < img.start) continue; // a picture that ended before this one
    return S.map.tags.filter((t) => t.name === 'source' && t.start > c.end && t.start < c.close.start);
  }
  return [];
}
function metaLabel(t) {
  const n = attrVal(t, 'name') || attrVal(t, 'property') || '';
  return { description: 'Page description', 'og:title': 'Share title', 'og:description': 'Share description' }[n] || n;
}
function revertChange(c) {
  record();
  if (c.k === 'html') { const e = S.edits.get(c.id); if (e) delete e.html; prune(c.id); }
  else if (c.k === 'attr') {
    const e = S.edits.get(c.id);
    if (e && e.attrs) { delete e.attrs[c.attr]; if (c.attr === 'src') { delete e.attrs.srcset; delete e.attrs.sizes; delete e.attrs.width; delete e.attrs.height; } }
    prune(c.id);
    // a picture inside <picture> also changed its <source>s (other screens): they go back with it
    if (c.attr === 'src') for (const t of sourcesOf(c.id)) { const se = S.edits.get(t.i); if (se && se.attrs) { delete se.attrs.srcset; delete se.attrs.type; prune(t.i); } }
  }
  else if (c.k === 'rule') {
    const R = S.rules[c.scope][c.dev];
    const back = (prop) => {
      const w = ((S.loaded.rules[c.scope][c.dev] || {})[c.sel] || {})[prop];
      if (w == null) { if (R[c.sel]) { delete R[c.sel][prop]; if (!Object.keys(R[c.sel]).length) delete R[c.sel]; } }
      else (R[c.sel] || (R[c.sel] = {}))[prop] = w;
    };
    back(c.prop);
    if (c.prop === 'height' || c.prop === 'width') {
      back('min-' + c.prop);
      const d = R[c.sel] || {};
      if (d.height == null && d.width == null) back('box-sizing');
    }
  } else if (c.k === 'font') S.fonts[c.scope].delete(c.name);
  sync(); renderPanel();
}

// ---------------------------------------------------------------- the inspector
const panel = $('#panel');
function kindOf(info) {
  if (info.img) return 'Picture';
  if (/^h[1-6]$/.test(info.tag)) return 'Heading';
  if (info.tag === 'a') return 'Link';
  if (info.tag === 'button') return 'Button';
  if (info.textBlock) return 'Text';
  if (info.bgUrl) return 'Box with picture';
  return 'Box';
}
const shortName = (b) => b.tag + (b.cls && b.cls.length ? '.' + b.cls.slice(0, 2).join('.') : '');
function renderPanel(soft) {
  if (!S) { panel.innerHTML = ''; return; }
  const active = document.activeElement;
  // Don't redraw under the pointer (a press on a button would be lost) or under a field being typed in.
  if (soft && (pressing || (active && panel.contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName)))) { S.panelStale = true; return; }
  S.panelStale = false;
  const scrollTop = panel.scrollTop;
  panel.innerHTML = S.sel ? elementPanel(S.sel) : pagePanel();
  panel.scrollTop = soft ? scrollTop : 0;
  updateBar();
}
let pressing = false;
panel.addEventListener('pointerdown', () => { pressing = true; });
addEventListener('pointerup', () => setTimeout(() => { pressing = false; if (S && S.panelStale) renderPanel(true); }, 0));
panel.addEventListener('focusout', () => setTimeout(() => { if (S && S.panelStale && !pressing && !panel.contains(document.activeElement)) renderPanel(true); }, 0));

function pagePanel() {
  const L = changeList();
  const titleTag = S.map.tags.find((t) => t.name === 'title');
  const metas = [['description', 'Description'], ['og:title', 'Share title'], ['og:description', 'Share description']]
    .map(([key, label]) => [S.map.tags.find((t) => t.name === 'meta' && (attrVal(t, 'name') === key || attrVal(t, 'property') === key)), label])
    .filter(([t]) => t);
  const titleNow = titleTag ? (S.edits.get(titleTag.i) && S.edits.get(titleTag.i).html != null ? decodeAttr(S.edits.get(titleTag.i).html) : decodeAttr(S.src.slice(titleTag.end, titleTag.close ? titleTag.close.start : titleTag.end))) : '';
  const metaNow = (t) => { const e = S.edits.get(t.i); return e && e.attrs && 'content' in e.attrs ? e.attrs.content : attrVal(t, 'content') || ''; };
  const hidden = [];
  for (const dev of ['all', 'tablet', 'phone']) for (const [sel, d] of Object.entries(S.rules.page[dev])) if (d.display === 'none') hidden.push({ dev, sel });
  return `
  <div class="empty">
    <h2>${esc(pageName(S.path))}</h2>
    <p>Click anything on the page to change it. Double-click text to rewrite it.</p>
    <p class="hint"><span class="kbd">⌘Z</span> undoes, <span class="kbd">Esc</span> lets go of a selection.</p>
  </div>
  <div class="group">
    <div class="g-title">Changes to publish</div>
    ${L.length ? `<ul class="changes">${L.map((c, i) => `<li><div class="what"><b>${esc(c.label)}</b><span>${esc(c.detail)}</span></div><button type="button" data-act="revert" data-i="${i}" title="Undo this change" aria-label="Undo this change">↺</button></li>`).join('')}</ul>` : '<p class="hint" style="margin:0">Nothing yet.</p>'}
  </div>
  ${hidden.length ? `<div class="group"><div class="g-title">Hidden on this page</div>${hidden.map((h, i) => `<div class="row"><div class="grow">${esc(h.sel.startsWith('[data-se') ? 'An element' : h.sel)} <span class="hint">· ${esc(DEV_LABEL[h.dev])}</span></div><button class="btn" type="button" data-act="unhide" data-i="${i}">Show</button></div>`).join('')}</div>` : ''}
  <div class="group">
    <div class="g-title">Page details</div>
    ${titleTag ? `<div class="row" style="align-items:flex-start"><label for="pTitle" style="padding-top:6px">Title</label><textarea class="field grow" id="pTitle" data-act="ptitle" data-id="${titleTag.i}" rows="2">${esc(titleNow)}</textarea></div>` : ''}
    ${metas.map(([t, label]) => `<div class="row" style="align-items:flex-start"><label style="padding-top:6px">${esc(label)}</label><textarea class="field grow" data-act="pmeta" data-id="${t.i}" rows="3">${esc(metaNow(t))}</textarea></div>`).join('')}
    <p class="hint">The title shows in the browser tab and in search results; the share texts show when the page is shared.</p>
  </div>
  <div class="group">
    <div class="g-title">Website</div>
    <p class="hint" style="margin:0 0 10px">Saving to <b>${esc(CFG.owner)}/${esc(CFG.repo)}</b> (${esc(CFG.branch)}). GitHub puts it live in about a minute.</p>
    <button class="btn" type="button" data-act="disconnect">Disconnect this computer</button>
  </div>`;
}
let pageChanges = [];

function elementPanel(info) {
  const css = info.css || {};
  const fs = parseFloat(css.fs) || 16;
  const lh = css.lh === 'normal' ? 1.2 : (parseFloat(css.lh) / fs);
  const ls = css.ls === 'normal' ? 0 : (parseFloat(css.ls) / fs);
  const owner = ownerOf(info);
  const scriptMade = info.id == null && !owner;
  const textOK = owner ? true : canEditText(info);
  const fam = firstFamily(css.ff);
  const known = FONTS.find((f) => f.name.toLowerCase() === fam.toLowerCase() || (f.match && f.match.some((m) => fam.toLowerCase().includes(m))));
  const sim = similarOptions(info);
  const site = siteOptions(info);
  const opts = scopeOptions(info);
  const target = styleTarget();
  const dev = DEV_KEY[ui.device];
  const set = (p) => (ruleValue(p) != null ? 'on' : '');
  const crumbs = (info.ancestors || []).slice(0, 4).reverse();
  const bgHex = rgbToHex(css.bg);
  const colorHex = rgbToHex(css.color) || '#000000';
  const hiddenNow = ruleValue('display') === 'none';
  const link = info.link;
  // inline elements (a word in a sentence) have no height or width of their own; buttons and boxes do
  const sizable = !/^(inline|contents|none)$/.test(css.display || '');
  const sizeNow = (p) => { const v = parseFloat(ruleValue(p)); return Number.isFinite(v) ? Math.round(v) : (p === 'height' ? info.h : info.w); };
  return `
  <div class="p-head">
    <div class="crumbs">${crumbs.map((b) => `<button type="button" data-act="pick" data-ref="${esc(b.ref)}" title="Select ${esc(shortName(b))}">${esc(shortName(b))}</button><span class="sep">›</span>`).join('')}<span>${esc(shortName(info))}</span></div>
    <div class="el-name"><span class="el-kind">${esc(kindOf(info))}</span><span class="grow" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(info.tag === 'img' ? (info.img.alt || 'Picture') : '')}</span><button class="btn quiet" type="button" data-act="done" title="Done (Esc)">Done</button></div>
    ${info.text && !info.img ? `<div class="el-text">${esc(norm(info.text).slice(0, 160))}</div>` : ''}
  </div>
  ${scriptMade ? `<div class="group"><p class="hint" style="margin:0">This part is drawn by the page’s own script, so it can only be changed with “All like this”.</p></div>` : ''}
  ${info.textBlock && !scriptMade ? `<div class="group">
    <div class="g-title">Text</div>
    ${textOK ? `<button class="btn wide" type="button" data-act="edittext">Edit text</button><p class="hint">Or double-click it on the page. <span class="kbd">Enter</span> finishes, <span class="kbd">⇧ Enter</span> starts a new line, <span class="kbd">Esc</span> cancels.</p>` : `<p class="hint" style="margin:0">The page’s script changes this text after it loads, so it can’t be edited here.</p>`}
  </div>` : ''}
  ${link ? `<div class="group">
    <div class="g-title">Link</div>
    <div class="row"><label>Goes to</label><input class="field grow" data-act="href" value="${esc(link.href)}" spellcheck="false"></div>
    <label class="check" style="margin-top:4px"><input type="checkbox" data-act="newtab" ${link.target === '_blank' ? 'checked' : ''}> Opens in a new tab</label>
  </div>` : ''}
  ${info.img ? `<div class="group">
    <div class="g-title">Picture</div>
    <img class="thumb" src="${esc(thumbFor(info.img))}" alt="">
    <div class="meta">${info.img.w ? `${info.img.w} × ${info.img.h} px · ` : ''}${esc((info.img.src.split('/').pop() || '').replace(/^data:.*/, 'new picture').slice(0, 48))}</div>
    <button class="btn wide" type="button" data-act="replaceimg">Replace picture…</button>
    <div class="row" style="margin-top:10px;align-items:flex-start"><label style="padding-top:6px">Description</label><textarea class="field grow" data-act="alt" rows="2" placeholder="What the picture shows">${esc(info.img.alt)}</textarea></div>
    <p class="hint">Read aloud to people who can’t see it, and used by search engines.</p>
  </div>` : ''}
  ${info.bgUrl && !info.img ? `<div class="group"><div class="g-title">Background picture</div><button class="btn wide" type="button" data-act="replacebg">Replace background picture…</button></div>` : ''}
  <div class="group">
    <div class="g-title">Apply style changes to</div>
    ${ui.device !== 'desktop' ? `<p class="device-note">${esc(ui.device === 'phone' ? 'Phone view: changes apply to phones only (up to 734 px wide).' : 'Tablet view: changes apply to tablets and phones (up to 1068 px wide).')}</p>` : ''}
    <div class="scope" role="group">
      <button type="button" data-act="scope" data-v="this" aria-pressed="${ui.scope === 'this'}">Just this</button>
      <button type="button" data-act="scope" data-v="similar" aria-pressed="${ui.scope === 'similar'}" ${sim.length ? '' : 'disabled'}>All like this${sim.length ? ` (${sim[Math.min(ui.selIdx, sim.length - 1)].n})` : ''}</button>
      <button type="button" data-act="scope" data-v="site" aria-pressed="${ui.scope === 'site'}" ${site.length && S.usesSiteCss ? '' : 'disabled'} title="${S.usesSiteCss ? 'Every page that uses the site’s stylesheet' : 'This page has its own styles, so its changes stay on it'}">Every page</button>
    </div>
    ${ui.scope !== 'this' && opts.length > 1 ? `<div class="row" style="margin-top:8px"><label>Match</label><select class="field grow" data-act="selidx">${opts.map((s, i) => `<option value="${i}" ${i === ui.selIdx ? 'selected' : ''}>${esc(s.sel)} (${s.n} here)</option>`).join('')}</select></div>` : ''}
    ${ui.scope !== 'this' && target ? `<p class="hint">Changes everything that matches <code>${esc(target.sel)}</code>${ui.scope === 'site' ? ' on every page' : ' on this page'}.</p>` : ''}
  </div>
  <div class="group">
    <div class="g-title">Type</div>
    <div class="row"><label>Font</label>
      <select class="field grow" data-act="font">
        ${known ? '' : `<option selected>${esc(fam || 'Page font')}</option>`}
        ${FONTS.map((f) => `<option value="${esc(f.name)}" ${known && known.name === f.name ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
        <option value="__other">Other Google font…</option>
      </select><button class="reset ${set('font-family')}" data-act="reset" data-p="font-family" title="Back to the original">×</button></div>
    <div class="row"><label>Size</label><input class="field num" type="number" min="6" max="400" step="1" data-act="num" data-p="font-size" data-u="px" value="${Math.round(fs * 10) / 10}"><input type="range" min="8" max="160" step="1" data-act="range" data-p="font-size" data-u="px" value="${Math.round(fs)}"><button class="reset ${set('font-size')}" data-act="reset" data-p="font-size">×</button></div>
    <div class="row"><label>Weight</label><select class="field grow" data-act="sel" data-p="font-weight">${[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => `<option value="${w}" ${String(w) === String(css.fw) ? 'selected' : ''}>${w} · ${({ 100: 'Thin', 200: 'Extra light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra bold', 900: 'Black' })[w]}</option>`).join('')}</select><button class="reset ${set('font-weight')}" data-act="reset" data-p="font-weight">×</button></div>
    <div class="row"><label>Line height</label><input class="field num" type="number" min="0.5" max="4" step="0.05" data-act="num" data-p="line-height" data-u="" value="${Math.round(lh * 100) / 100}"><span class="grow"></span><button class="reset ${set('line-height')}" data-act="reset" data-p="line-height">×</button></div>
    <div class="row"><label>Letter spacing</label><input class="field num" type="number" min="-0.2" max="1" step="0.005" data-act="num" data-p="letter-spacing" data-u="em" value="${Math.round(ls * 1000) / 1000}"><span class="unit">em</span><span class="grow"></span><button class="reset ${set('letter-spacing')}" data-act="reset" data-p="letter-spacing">×</button></div>
    <div class="row"><label>Color</label><div class="color"><input type="color" data-act="color" data-p="color" value="${colorHex}"><input class="field" data-act="colortext" data-p="color" value="${esc(colorHex)}" spellcheck="false"></div><button class="reset ${set('color')}" data-act="reset" data-p="color">×</button></div>
    <div class="row"><label>Alignment</label><div class="chips">${[['left', 'Left', 'M2 3h12M2 6.5h8M2 10h12M2 13.5h8'], ['center', 'Center', 'M2 3h12M4 6.5h8M2 10h12M4 13.5h8'], ['right', 'Right', 'M2 3h12M6 6.5h8M2 10h12M6 13.5h8']].map(([v, l, d]) => `<button type="button" class="chip icon" data-act="chip" data-p="text-align" data-v="${v}" title="${l}" aria-label="${l}" aria-pressed="${(css.ta === v || (v === 'left' && css.ta === 'start'))}"><svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="${d}"/></svg></button>`).join('')}</div><span class="grow"></span><button class="reset ${set('text-align')}" data-act="reset" data-p="text-align">×</button></div>
    <div class="row"><label>Style</label><div class="chips">
      <button type="button" class="chip" data-act="toggle" data-p="text-transform" data-on="uppercase" data-off="none" aria-pressed="${css.tt === 'uppercase'}">CAPS</button>
      <button type="button" class="chip" data-act="toggle" data-p="font-style" data-on="italic" data-off="normal" aria-pressed="${css.fst === 'italic'}"><i>Italic</i></button>
    </div><span class="grow"></span><button class="reset ${set('text-transform') || set('font-style')}" data-act="reset2" data-p="text-transform,font-style">×</button></div>
  </div>
  <div class="group">
    <div class="g-title">Box</div>
    ${sizable ? ['height', 'width'].map((p) => `<div class="row"><label>${p === 'height' ? 'Height' : 'Width'}</label><input class="field num" type="number" min="0" step="1" data-act="size" data-p="${p}" value="${sizeNow(p)}"><span class="unit">px</span><span class="grow"></span><button class="reset ${set(p)}" data-act="sizereset" data-p="${p}" title="Back to the original">×</button></div>`).join('') : ''}
    <div class="row"><label>Space above</label><input class="field num" type="number" step="1" data-act="num" data-p="margin-top" data-u="px" value="${Math.round(parseFloat(css.mt) || 0)}"><span class="unit">px</span><span class="grow"></span><button class="reset ${set('margin-top')}" data-act="reset" data-p="margin-top">×</button></div>
    <div class="row"><label>Space below</label><input class="field num" type="number" step="1" data-act="num" data-p="margin-bottom" data-u="px" value="${Math.round(parseFloat(css.mb) || 0)}"><span class="unit">px</span><span class="grow"></span><button class="reset ${set('margin-bottom')}" data-act="reset" data-p="margin-bottom">×</button></div>
    <div class="row"><label>Background</label><div class="color"><input type="color" data-act="color" data-p="background-color" value="${bgHex || '#ffffff'}"><input class="field" data-act="colortext" data-p="background-color" value="${esc(bgHex || 'none')}" spellcheck="false"></div><button class="reset ${set('background-color')}" data-act="reset" data-p="background-color">×</button></div>
    <div class="row"><label>Corners</label><input class="field num" type="number" min="0" step="1" data-act="num" data-p="border-radius" data-u="px" value="${Math.round(parseFloat(css.br) || 0)}"><span class="unit">px</span><span class="grow"></span><button class="reset ${set('border-radius')}" data-act="reset" data-p="border-radius">×</button></div>
    <div class="row" style="margin-top:12px"><button class="btn ${hiddenNow ? '' : 'danger'}" type="button" data-act="hide">${hiddenNow ? 'Show it again' : (dev === 'all' ? 'Hide it' : `Hide it on ${DEV_LABEL[dev]}`)}</button></div>
  </div>
  ${info.stack && info.stack.length > 1 ? `<div class="group"><div class="g-title">Under the pointer</div><div class="stack-list">${info.stack.map((b) => `<button type="button" data-act="pick" data-ref="${esc(b.ref)}" aria-current="${b.ref === info.ref}"><span class="t">${esc(b.tag)}</span>${esc((b.cls || []).slice(0, 2).join(' '))}</button>`).join('')}</div><p class="hint">Pick what you meant if something lies on top of it.</p></div>` : ''}
  <div class="group"><button class="btn quiet" type="button" data-act="done">Done</button></div>`;
}

const thumbs = new Map();
function thumbFor(img) {
  const p = S.previews.get(img.src);
  if (!p) return img.cur;
  if (!thumbs.has(img.src)) thumbs.set(img.src, URL.createObjectURL(new Blob([p.bytes], { type: p.mime })));
  return thumbs.get(img.src);
}
let fontAsk = null;
panel.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || !S) return;
  const act = b.dataset.act;
  if (act === 'revert') { pageChanges = changeList(); revertChange(pageChanges[+b.dataset.i]); }
  else if (act === 'unhide') {
    const hidden = [];
    for (const dev of ['all', 'tablet', 'phone']) for (const [sel, d] of Object.entries(S.rules.page[dev])) if (d.display === 'none') hidden.push({ dev, sel });
    const h = hidden[+b.dataset.i];
    if (h) { record(); delete S.rules.page[h.dev][h.sel].display; if (!Object.keys(S.rules.page[h.dev][h.sel]).length) delete S.rules.page[h.dev][h.sel]; sync(); renderPanel(); }
  } else if (act === 'disconnect') { if (await confirmBox('Disconnect this computer?', 'The editor forgets the key. You can paste it again later.', 'Disconnect')) { store.del(TOKEN_KEY); location.reload(); } }
  else if (act === 'pick') post({ type: 'select', ref: b.dataset.ref });
  else if (act === 'done') { post({ type: 'deselect' }); S.sel = null; renderPanel(); }
  else if (act === 'edittext') editTextOf(S.sel.ref);
  else if (act === 'replaceimg') replaceImage('img');
  else if (act === 'replacebg') replaceImage('bg');
  else if (act === 'scope') { ui.scope = b.dataset.v; ui.selIdx = 0; renderPanel(true); }
  else if (act === 'chip') setStyle(b.dataset.p, b.dataset.v);
  else if (act === 'toggle') setStyle(b.dataset.p, b.getAttribute('aria-pressed') === 'true' ? b.dataset.off : b.dataset.on);
  else if (act === 'reset') setStyle(b.dataset.p, null);
  else if (act === 'sizereset') { begin(); await setSize(b.dataset.p, null); end(); }
  else if (act === 'reset2') { begin(); for (const p of b.dataset.p.split(',')) await setStyle(p, null, { live: true }); end(); }
  else if (act === 'hide') setStyle('display', ruleValue('display') === 'none' ? null : 'none');
  else if (act === 'newtab') { /* handled on change */ }
});
// While a field is being typed in the panel isn't redrawn, so its × (back to the original) is shown at once here.
const showReset = (p) => { for (const r of panel.querySelectorAll(`[data-act="reset"][data-p="${p}"], [data-act="sizereset"][data-p="${p}"]`)) r.classList.add('on'); };
panel.addEventListener('input', (e) => {
  const el = e.target;
  const act = el.dataset.act;
  if (!S || !S.sel) return;
  if (act === 'size' || act === 'range' || act === 'num' || act === 'color') showReset(el.dataset.p);
  if (act === 'size') {
    const v = el.value;
    if (v === '' || !(+v >= 0)) return;
    begin();
    setSize(el.dataset.p, Math.round(+v) + 'px');
    return;
  }
  if (act === 'range' || act === 'num') {
    const v = el.value;
    if (v === '') return;
    const p = el.dataset.p;
    begin();
    setStyle(p, v + (el.dataset.u || ''), { live: true });
    const twin = panel.querySelector(`[data-p="${p}"][data-act="${act === 'range' ? 'num' : 'range'}"]`);
    if (twin) twin.value = v;
  } else if (act === 'color') {
    begin();
    setStyle(el.dataset.p, el.value, { live: true });
    const twin = panel.querySelector(`[data-act="colortext"][data-p="${el.dataset.p}"]`);
    if (twin) twin.value = el.value;
  }
});
panel.addEventListener('change', async (e) => {
  const el = e.target;
  const act = el.dataset.act;
  if (!S) return;
  if (act === 'range' || act === 'num' || act === 'color' || act === 'size') { end(); return; }
  if (act === 'ptitle') {
    const id = +el.dataset.id;
    const t = tagOf(id);
    const now = escText(el.value.replace(/\s+/g, ' ').trim());
    const orig = S.src.slice(t.end, t.close ? t.close.start : t.end);
    const was = S.edits.get(id) && S.edits.get(id).html != null ? S.edits.get(id).html : orig;
    if (now === was) return;
    record();
    if (now === orig) { const x = S.edits.get(id); if (x) delete x.html; prune(id); } else editOf(id).html = now;
    updateBar(); sync(); renderPanel(true);
  } else if (act === 'pmeta') {
    const id = +el.dataset.id;
    const t = tagOf(id);
    const now = el.value.replace(/\s+/g, ' ').trim();
    const cur = (S.edits.get(id) || {}).attrs || {};
    if (('content' in cur ? cur.content : attrVal(t, 'content')) === now) return;
    record();
    const e2 = editOf(id);
    e2.attrs = e2.attrs || {};
    if (now === attrVal(t, 'content')) delete e2.attrs.content; else e2.attrs.content = now;
    prune(id);
    updateBar(); renderPanel(true);
  }
  if (!S.sel) return;
  if (act === 'sel') setStyle(el.dataset.p, el.value);
  else if (act === 'selidx') { ui.selIdx = +el.value; renderPanel(true); }
  else if (act === 'colortext') {
    const v = el.value.trim();
    if (v === '' || v === 'none') setStyle(el.dataset.p, el.dataset.p === 'background-color' ? 'transparent' : null);
    else if (CSS.supports('color', v)) setStyle(el.dataset.p, v);
    else toast('That is not a color the browser knows. Try #1d1d1f or rgb(29, 29, 31).', true);
  } else if (act === 'font') {
    let font = FONTS.find((f) => f.name === el.value);
    if (el.value === '__other') {
      const name = await promptBox('Use another Google font', 'Type its name as it appears on fonts.google.com, for example “Bricolage Grotesque”.', 'Font name');
      if (!name) { renderPanel(true); return; }
      if (!/^[A-Za-z0-9][A-Za-z0-9 ]{0,59}$/.test(name.trim())) { toast('Font names on Google Fonts have only letters, numbers and spaces.', true); renderPanel(true); return; }
      toast('Looking it up on Google Fonts…');
      const spec = await findFontSpec(name);
      if (spec == null) { toast(`Google Fonts has no font called “${esc(name)}”.`, true); renderPanel(true); return; }
      font = { name: name.trim(), g: spec, fb: 'sans-serif' };
    }
    if (!font) return;
    const stack = font.stack || `"${font.name}", ${font.fb}`;
    setStyle('font-family', stack, { font: font.g != null && !font.stack ? font : null });
  } else if (act === 'href') { const link = S.sel.link; if (link) setAttrs(link, { href: el.value.trim() }); }
  else if (act === 'newtab') { const link = S.sel.link; if (link) setAttrs(link, el.checked ? { target: '_blank', rel: 'noopener' } : { target: null, rel: null }); }
  else if (act === 'alt') setAttrs(S.sel, { alt: el.value.replace(/\s+/g, ' ').trim() });
});
void fontAsk;

// ---------------------------------------------------------------- bar, dialogs, toast
function setBusy(on) {
  busy = on;
  for (const el of document.querySelectorAll('.bar, .main')) el.inert = on;
  document.body.classList.toggle('busy', on);
  updateBar();
}
function updateBar() {
  const n = S ? changeList().length : 0;
  $('#publish').disabled = busy || ui.preparing > 0 || !n;
  $('#pubCount').hidden = !n;
  $('#pubCount').textContent = n;
  $('#undo').disabled = !S || !S.past.length;
  $('#redo').disabled = !S || !S.future.length;
  if (S) $('#viewLive').href = CFG.site + S.dir + (S.path.endsWith('index.html') ? '' : S.path.split('/').pop());
}
let toastTimer = 0;
function toast(html, bad, ms = 3600) {
  const t = $('#toast');
  t.innerHTML = html;
  t.classList.toggle('bad', !!bad);
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}
function dialog(html, wire) {
  const d = $('#dialog');
  $('#dialogBody').innerHTML = html;
  d.hidden = false;
  return new Promise((resolve) => {
    const done = (v) => { d.hidden = true; d.onclick = null; document.removeEventListener('keydown', key); resolve(v); };
    const key = (e) => { if (e.key === 'Escape') done(null); };
    document.addEventListener('keydown', key);
    d.onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) done(b.dataset.v); else if (e.target === d) done(null); };
    if (wire) wire(done);
  });
}
function confirmBox(title, text, yes, no = 'Cancel') {
  return dialog(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="actions"><button class="btn" data-v="">${esc(no)}</button><button class="btn primary" data-v="yes">${esc(yes)}</button></div>`).then((v) => v === 'yes');
}
function promptBox(title, text, placeholder) {
  return dialog(`<h2>${esc(title)}</h2><p>${esc(text)}</p><input class="field" id="pv" placeholder="${esc(placeholder)}"><div class="actions"><button class="btn" data-v="">Cancel</button><button class="btn primary" id="pvOk">Use it</button></div>`, (done) => {
    const i = $('#pv');
    i.focus();
    const go = () => done(i.value.trim() || null);
    $('#pvOk').onclick = go;
    i.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  });
}

// ---------------------------------------------------------------- publishing
$('#publish').addEventListener('click', publish);
async function publish() {
  if (!S || busy) return;
  if (ui.preparing) { toast('Wait a moment: the picture is still being prepared.', true); return; }
  await ask({ type: 'finish' }, 1500); // text still being typed is part of what gets published
  if (!S || busy) return;
  const files = outputFiles();
  if (!files.length) { toast('Nothing to publish yet.'); return; }
  const L = changeList();
  const words = [];
  const texts = L.filter((c) => c.k === 'html').length;
  if (texts) words.push(`${texts} text${texts > 1 ? 's' : ''}`);
  const styles = L.filter((c) => c.k === 'rule').length;
  if (styles) words.push(`${styles} style change${styles > 1 ? 's' : ''}`);
  const imgs = files.filter((f) => f.kind === 'image').length;
  if (imgs) words.push(`${imgs} new picture${imgs > 1 ? 's' : ''}`);
  const other = L.filter((c) => c.k === 'attr' && !(imgs && c.attr === 'src')).length;
  if (other) words.push(`${other} other change${other > 1 ? 's' : ''}`);
  const msg0 = `Site editor: ${pageName(S.path)} (${words.join(', ') || 'changes'})`;
  const v = await dialog(`<h2>Publish ${esc(pageName(S.path))}</h2>
    <p>These files are saved to the website. GitHub puts them live in about a minute.</p>
    <ul class="files">${files.map((f) => `<li><code>${esc(f.path)}</code><span>${f.kind === 'image' ? 'new picture · ' + kb(f.size) : f.kind === 'css' ? 'style for every page' : 'this page'}</span></li>`).join('')}</ul>
    <div class="row" style="margin-top:14px"><label for="pmsg">Note</label><input class="field grow" id="pmsg" value="${esc(msg0)}"></div>
    <div class="actions"><button class="btn" data-v="">Cancel</button><button class="btn primary" id="pubGo">Publish</button></div>`, (done) => {
    $('#pubGo').onclick = () => done($('#pmsg').value.trim() || msg0);
  });
  if (!v) return;
  await doPublish(v);
}
async function doPublish(message) {
  setBusy(true);
  toast('Publishing…', false, 60000);
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const snapNow = await gh.snapshot();
      tree = snapNow;
      // Did someone else change these files since they were opened?
      const pageMoved = snapNow.files.get(S.path) !== S.sha;
      const cssMoved = siteRulesChanged() && siteCache && snapNow.files.get(SITE_CSS) !== siteCache.sha;
      if (cssMoved) {
        // style.css changed meanwhile: keep what is in it now, with this session's style changes laid over it
        siteCache = { sha: snapNow.files.get(SITE_CSS), src: await gh.text(snapNow.files.get(SITE_CSS)) };
        const b = siteBlocks(siteCache.src);
        rebase('site', parseRules(b.css), parseFontsHref(b.fonts));
      }
      if (pageMoved) {
        const r = await catchUp(snapNow);
        if (r === 'reopened') { toast('Opened the newer version of the page.'); return; }
        if (r !== 'ok') { toast('Not published. Your changes are still here.', true); return; }
      }
      for (const [p, u] of [...S.uploads]) {
        if (snapNow.files.has(p)) { // a file with that name appeared meanwhile: pick another name
          const dir = p.replace(/[^/]*$/, '');
          const m = /^(.*)\.([^.]+)$/.exec(p.slice(dir.length));
          const np = uniquePath(dir, m[1], m[2]);
          const nsrc = u.src.replace(/[^/]*$/, np.slice(dir.length));
          S.uploads.delete(p);
          S.uploads.set(np, Object.assign({}, u, { src: nsrc }));
          renameSrc(u.src, nsrc);
        }
      }
      const files = outputFiles();
      const entries = [];
      for (const f of files) {
        const b = await gh.newBlob(f.b64 || textToB64(f.text));
        entries.push({ path: f.path, mode: '100644', type: 'blob', sha: b.sha, f });
      }
      const nt = await gh.newTree(snapNow.tree, entries.map(({ f, ...x }) => x));
      const nc = await gh.newCommit(message, nt.sha, snapNow.head);
      try {
        await gh.move(nc.sha);
      } catch (e) {
        if (e.status === 422 || e.status === 409) continue; // the branch moved on: start again from the newest version
        throw e;
      }
      afterPublish(entries, nc.sha);
      const live = $('#viewLive').href;
      toast(`Published. Live in about a minute. <a href="${esc(live)}" target="_blank" rel="noopener">View page</a>`, false, 9000);
      return;
    }
    throw new Error('The website kept changing while publishing. Try again in a moment.');
  } catch (e) {
    toast(friendly(e), true, 9000);
  } finally {
    setBusy(false);
  }
}
function friendly(e) {
  if (e.status === 401) { setTimeout(() => showConnect('GitHub no longer accepts the key. Paste a new one.'), 300); return 'GitHub no longer accepts the key.'; }
  if (e.status === 403 || e.status === 404) return 'The key can’t save to the website. Check that it has Contents: Read and write for ' + CFG.repo + '.';
  return 'Not published: ' + esc(e.message);
}
function renameSrc(from, to) {
  for (const e of S.edits.values()) {
    for (const k of Object.keys(e.attrs || {})) if (e.attrs[k] === from) e.attrs[k] = to;
    if (e.html) e.html = e.html.split(`="${escAttr(from)}"`).join(`="${escAttr(to)}"`);
  }
  const s = JSON.stringify(S.rules).split(`url(\\"${from}\\")`).join(`url(\\"${to}\\")`);
  S.rules = JSON.parse(s);
  if (S.previews.has(from)) { S.previews.set(to, S.previews.get(from)); post({ type: 'image', src: to, mime: S.previews.get(to).mime, bytes: S.previews.get(to).bytes }); }
}
// The page changed on GitHub since it was opened (another chat, another computer): move the edits onto it.
async function catchUp(snapNow) {
  const newSha = snapNow.files.get(S.path);
  if (!newSha) { await confirmBox('This page was removed', 'Someone removed or renamed this page on GitHub since you opened it, so your changes can’t be saved to it.', 'OK', 'Close'); return 'stop'; }
  const newSrc = await gh.text(newSha);
  const newMap = mapSource(newSrc);
  // Find each changed element in the newer file. It must have the same start tag and the same inside (or, for an
  // element without an inside, the same surroundings); among several such, the k-th is the k-th, but only if
  // both versions have the same number of them. A change that leaves the inside alone may also follow a start
  // tag that is the only one of its kind in both versions. Anything else can't be placed for sure.
  const tagText = (map, t) => map.src.slice(t.start, t.end);
  const ctx = (map, t) => (t.close ? map.src.slice(t.end, t.close.start) : map.src.slice(Math.max(0, t.start - 200), t.start) + '\u0001' + map.src.slice(t.end, t.end + 200));
  const wanted = new Set([...S.edits.keys()].map((id) => S.map.tags[id] && tagText(S.map, S.map.tags[id])));
  const group = (map) => {
    const g = new Map();
    for (const t of map.tags) { const tt = tagText(map, t); if (!wanted.has(tt)) continue; if (!g.has(tt)) g.set(tt, []); g.get(tt).push(t); }
    return g;
  };
  const GA = group(S.map);
  const GB = group(newMap);
  const moved = new Map();
  const lost = [];
  const place = (id, e) => {
    const t1 = S.map.tags[id];
    if (!t1) return null;
    const tt = tagText(S.map, t1);
    const A = GA.get(tt) || [];
    const B = GB.get(tt) || [];
    if (e.html == null && A.length === 1 && B.length === 1) return B[0];
    const c1 = ctx(S.map, t1);
    const sameA = A.filter((t) => ctx(S.map, t) === c1);
    const sameB = B.filter((t) => ctx(newMap, t) === c1);
    if (!sameB.length || sameA.length !== sameB.length) return null;
    return sameB[sameA.indexOf(t1)] || null;
  };
  for (const [id, e] of S.edits) {
    const t2 = place(id, e);
    if (t2 && !moved.has(t2.i)) moved.set(t2.i, e);
    else lost.push(e.html != null ? 'Text: “' + norm(textOfHTML(e.html)).slice(0, 50) + '”' : Object.keys(e.attrs || {}).filter((k) => k !== 'data-se').map((k) => ATTR_LABEL[k] || k).join(', ') || 'A style marker');
  }
  if (lost.length && !moved.size && !pageRulesChanged()) {
    const go = await dialog(`<h2>The page changed meanwhile</h2><p>Someone changed the same parts of this page on GitHub since you opened it, so your changes no longer fit:</p><ul>${lost.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><p>Open the newer version and make your changes on it.</p><div class="actions"><button class="btn" data-v="">Not now</button><button class="btn primary" data-v="open">Open the newer version</button></div>`);
    if (go === 'open') { S.edits = new Map(); S.rules = clone(S.loaded.rules); await openPage(S.path, true); return 'reopened'; }
    return 'stop';
  }
  if (lost.length) {
    const go = await dialog(`<h2>The page changed meanwhile</h2><p>Someone changed this page on GitHub since you opened it. Most of your changes still fit, but these were on parts that changed and can’t be kept:</p><ul>${lost.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><div class="actions"><button class="btn" data-v="">Don’t publish</button><button class="btn primary" data-v="yes">Publish the rest</button></div>`);
    if (go !== 'yes') return 'stop';
  }
  // Style changes published meanwhile stay: this session's own style changes are laid over the newer block.
  const theirs = pageBlock(newSrc, newMap);
  rebase('page', theirs.rules, theirs.fonts);
  // a rule for a marked element that is gone (its change could not be kept) goes with it
  const marks = JSON.stringify([...moved.values()]);
  for (const dev of ['all', 'tablet', 'phone']) {
    for (const sel of Object.keys(S.rules.page[dev])) {
      const m = /^\[data-se="([^"]+)"\]$/.exec(sel);
      if (m && !newSrc.includes(`data-se="${m[1]}"`) && !marks.includes(m[1])) delete S.rules.page[dev][sel];
    }
  }
  S.src = newSrc;
  S.map = newMap;
  S.sha = newSha;
  S.edits = moved;
  S.textOk = new Map();
  S.inner = new Map();
  S.touched = new Set(moved.keys());
  S.htmlIds = new Set([...moved].filter(([, e]) => e.html != null).map(([i]) => i));
  S.editing = new Set();
  S.markers = new Map();
  for (const [i, e] of moved) if (e.attrs && e.attrs['data-se']) S.markers.set(String(i), e.attrs['data-se']);
  S.gen++;
  S.sel = null;
  S.past = []; S.future = [];
  render();
  renderPanel();
  return 'ok';
}
function mergeRules(base, mine, theirs) {
  // theirs, with every property this session changed (set or removed) taken from mine
  const out = clone(theirs);
  for (const dev of ['all', 'tablet', 'phone']) {
    const B = base[dev] || {};
    const M = mine[dev] || {};
    for (const sel of new Set([...Object.keys(B), ...Object.keys(M)])) {
      const b = B[sel] || {};
      const m = M[sel] || {};
      for (const p of new Set([...Object.keys(b), ...Object.keys(m)])) {
        if (b[p] === m[p]) continue;
        const d = out[dev][sel] || (out[dev][sel] = {});
        if (m[p] == null) delete d[p]; else d[p] = m[p];
        if (!Object.keys(d).length) delete out[dev][sel];
      }
    }
  }
  return out;
}
function rebase(scope, theirs, theirFonts) {
  S.rules[scope] = mergeRules(S.loaded.rules[scope], S.rules[scope], theirs);
  S.fonts[scope] = new Map([...theirFonts, ...S.fonts[scope]]);
  S.loaded.rules[scope] = clone(theirs);
  S.loaded.fonts[scope] = [...theirFonts].filter(([n]) => JSON.stringify(theirs).includes(n));
}
function afterPublish(entries, commitSha) {
  const pageEntry = entries.find((x) => x.f.kind === 'page');
  const cssEntry = entries.find((x) => x.f.kind === 'css');
  if (cssEntry) siteCache = { sha: cssEntry.sha, src: cssEntry.f.text };
  for (const x of entries) tree.files.set(x.path, x.sha);
  tree.head = commitSha;
  const src = pageEntry ? pageEntry.f.text : S.src;
  const sha = pageEntry ? pageEntry.sha : S.sha;
  const keepPrev = S.previews;
  const scrollY = S.scrollY;
  const dev = ui.device;
  S = newState(S.path, sha, src);
  S.previews = keepPrev;
  S.scrollY = scrollY;
  ui.device = dev;
  render();
  renderPanel();
}

// ---------------------------------------------------------------- pages
const pick = $('#pagePick');
async function loadPages() {
  tree = await gh.snapshot();
  pages = [...tree.files.keys()].filter((p) => p.endsWith('.html') && !HIDDEN_PAGES.some((r) => r.test(p)))
    .sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : pageName(a).localeCompare(pageName(b))));
  pick.innerHTML = pages.map((p) => `<option value="${esc(p)}">${esc(pageName(p))}</option>`).join('');
}
async function openPage(path, fresh) {
  if (fresh) tree = await gh.snapshot();
  if (S && !fresh && (S.edits.size || pageRulesChanged() || siteRulesChanged()) && path !== S.path) {
    const go = await confirmBox('Leave without publishing?', 'Your changes on ' + pageName(S.path) + ' are not published yet. They are lost if you open another page.', 'Discard them', 'Stay');
    if (!go) { pick.value = S.path; return; }
  }
  pick.value = path;
  $('#loading').hidden = false;
  $('#loading').textContent = 'Loading ' + pageName(path) + '…';
  try {
    const sha = tree.files.get(path);
    const src = await gh.text(sha);
    const cssSha = tree.files.get(SITE_CSS);
    if (cssSha && (!siteCache || siteCache.sha !== cssSha)) siteCache = { sha: cssSha, src: await gh.text(cssSha) };
    S = newState(path, sha, src);
    history.replaceState(null, '', '#' + encodeURI(path));
    store.set('site-editor.page', path, true);
    render();
    renderPanel();
    layout();
  } catch (e) {
    $('#loading').textContent = 'Could not open the page: ' + e.message;
  }
}
pick.addEventListener('change', () => openPage(pick.value));
$('#devices').addEventListener('click', (e) => {
  const b = e.target.closest('[data-device]');
  if (!b) return;
  ui.device = b.dataset.device;
  for (const x of $('#devices').children) x.setAttribute('aria-pressed', String(x === b));
  layout();
  setTimeout(() => { post({ type: 'refresh' }); renderPanel(true); }, 120);
});
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
addEventListener('keydown', (e) => {
  const inField = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !inField) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y' && !inField) { e.preventDefault(); redo(); }
  else if (e.key === 'Escape' && !inField && S && S.sel && $('#dialog').hidden) { post({ type: 'deselect' }); S.sel = null; renderPanel(); }
});
addEventListener('beforeunload', (e) => { if (S && !$('#publish').disabled) { e.preventDefault(); e.returnValue = ''; } });

// ---------------------------------------------------------------- connecting
function showConnect(err) {
  $('#connect').hidden = false;
  $('#cErr').textContent = err || '';
  $('#cRepo').textContent = CFG.repo;
  setTimeout(() => $('#cToken').focus(), 50);
}
$('#cGo').addEventListener('click', connect);
$('#cToken').addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });
async function connect() {
  const token = $('#cToken').value.trim();
  if (!token) { $('#cErr').textContent = 'Paste the key first.'; return; }
  $('#cErr').textContent = 'Checking…';
  gh.token = token;
  try {
    await gh.repoInfo();
    // Can it save? Making a tiny unused file object needs Contents: Read and write and changes nothing on the site.
    try { await gh.newBlob(textToB64('site editor check')); } catch (e) {
      if (e.status === 403 || e.status === 404) throw Object.assign(new Error('This key can only read the website. Give it Contents: Read and write.'), { status: 'ro' });
      throw e;
    }
    store.set(TOKEN_KEY, token, $('#cRemember').checked);
    $('#connect').hidden = true;
    $('#cToken').value = '';
    if (S) {
      // a new key in the middle of work (the old one ran out): keep everything that is open
      await loadPages();
      pick.value = S.path;
      updateBar();
      toast('Connected again. Your changes are still here; press Publish to save them.');
    } else await start();
  } catch (e) {
    gh.token = null;
    $('#cErr').textContent = e.status === 401 ? 'GitHub doesn’t accept this key. Copy it again from GitHub.' : e.status === 404 ? 'This key can’t see ' + CFG.repo + '. Give it access to that repository.' : e.message;
  }
}
async function start() {
  await loadPages();
  const want = decodeURI(location.hash.slice(1)) || store.get('site-editor.page') || 'index.html';
  await openPage(pages.includes(want) ? want : pages[0]);
}
async function boot() {
  layout();
  const token = store.get(TOKEN_KEY);
  if (!token) { showConnect(); $('#loading').textContent = ''; return; }
  gh.token = token;
  try { await start(); } catch (e) {
    if (e.status === 401) { store.del(TOKEN_KEY); showConnect('GitHub no longer accepts the saved key. Paste a new one.'); }
    else $('#loading').textContent = 'Could not reach the website’s files: ' + e.message;
  }
}
if (Q.has('debug')) window.__seDebug = { state: () => S, mapSource, textOfHTML, norm, outputFiles, changeList };
boot();

// ---------------------------------------------------------------- inside the preview
// This function runs inside the sandboxed preview. It draws the selection, reports what was clicked and applies
// changes the editor sends. It must stand alone: it can't see anything in this file.
function agent() {
  if (window.__seAgent) return;
  window.__seAgent = 1;
  const send = (m) => { try { m.__se = 1; parent.postMessage(m, '*'); } catch (e) { /* closed */ } };
  const previews = new Map(); // address in the file -> blob URL made here
  const reverse = new Map();
  const shown = (v) => (v != null && previews.has(v) ? previews.get(v) : v);
  const subCss = (css) => String(css || '').replace(/url\("([^"]+)"\)/g, (all, u) => (previews.has(u) ? 'url("' + previews.get(u) + '")' : all));
  let lastCss = { page: '', site: '' };
  const INLINE = new Set(['A', 'ABBR', 'B', 'BDI', 'BDO', 'BR', 'CITE', 'CODE', 'DATA', 'DFN', 'EM', 'I', 'KBD', 'MARK', 'Q', 'S', 'SAMP', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U', 'VAR', 'WBR', 'DEL', 'INS', 'LABEL']);
  const NOTEXT = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'CANVAS', 'VIDEO', 'AUDIO', 'IMG', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'PICTURE', 'HTML', 'BODY', 'HEAD', 'svg', 'math', 'OBJECT', 'EMBED', 'SOURCE']);
  const host = document.createElement('div');
  host.setAttribute('data-se-ui', '');
  host.style.cssText = 'all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
  const root = host.attachShadow ? host.attachShadow({ mode: 'closed' }) : host;
  root.innerHTML = '<style>.b{position:fixed;pointer-events:none;box-sizing:border-box;border-radius:3px;display:none}.h{border:1px solid rgba(0,113,227,.85);background:rgba(0,113,227,.05)}.s{border:2px solid #0071e3;box-shadow:0 0 0 1px rgba(255,255,255,.7)}.s.e{border-style:dashed}.t{position:fixed;pointer-events:none;display:none;font:600 11px/1.2 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;color:#fff;background:#0071e3;padding:3px 6px;border-radius:4px;white-space:nowrap;letter-spacing:0;text-transform:none}</style><div class="b h"></div><div class="b s"></div><div class="t"></div>';
  const [hov, selBox, tag] = root.querySelectorAll('div');
  const mount = () => { if (!host.isConnected) document.documentElement.appendChild(host); };
  mount();
  // The cookie question would sit over the page while editing; it stays on the real site.
  const quiet = document.createElement('style');
  quiet.setAttribute('data-se-ui', 'quiet');
  quiet.textContent = 'section.cbc{display:none!important}';
  (document.head || document.documentElement).appendChild(quiet);
  let hovEl = null;
  let selEl = null;
  let selRef = null;
  let editing = null;
  let editBefore = '';
  let cleanBefore = '';
  let label = '';
  const tmp = new Map();
  const tmpOf = new WeakMap();
  let tmpN = 0;
  const refOf = (el) => {
    const v = el.getAttribute('data-ve');
    if (v != null) return v;
    let r = tmpOf.get(el);
    if (!r) { r = 't' + ++tmpN; tmpOf.set(el, r); tmp.set(r, el); }
    return r;
  };
  const byRef = (r) => {
    if (r == null) return null;
    r = String(r);
    if (r[0] === 't') { const el = tmp.get(r); return el && el.isConnected ? el : null; }
    return document.querySelector('[data-ve="' + r + '"]');
  };
  const brief = (el) => ({ ref: refOf(el), id: el.getAttribute('data-ve'), tag: el.tagName.toLowerCase(), cls: [...el.classList].slice(0, 3) });

  function isTextBlock(el) {
    if (NOTEXT.has(el.tagName) || el.closest('svg')) return false;
    let text = false;
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { if (/\S/.test(n.data)) text = true; continue; }
      if (n.nodeType !== 1) continue;
      if (n.tagName === 'IMG' || n.tagName === 'svg' || n.tagName === 'BR' || n.tagName === 'WBR') continue;
      if (!INLINE.has(n.tagName)) return false;
      for (const d of n.querySelectorAll('*')) if (!INLINE.has(d.tagName) && d.tagName !== 'IMG' && !d.closest('svg')) return false;
      if (/\S/.test(n.textContent)) text = true;
    }
    return text;
  }
  const STATE = /^(is-|has-|js-|active$|open$|visible$|show$|shown$|in$|on$|current$|selected$|hover$|focus$|loaded$|ready$)/;
  function safeCount(sel) { try { return document.querySelectorAll(sel).length; } catch (e) { return 0; } }
  function suggest(el) {
    const name = el.tagName.toLowerCase();
    const clean = (c) => /^[A-Za-z_][\w-]*$/.test(c) && !STATE.test(c);
    const cls = [...el.classList].filter(clean);
    const out = [];
    if (cls.length) out.push(name + cls.map((c) => '.' + CSS.escape(c)).join(''));
    if (cls.length > 1) out.push(name + '.' + CSS.escape(cls[0]));
    for (let a = el.parentElement, depth = 0; a && a !== document.body && depth < 6; a = a.parentElement, depth++) {
      const ac = [...a.classList].filter(clean)[0];
      if (ac) { out.push('.' + CSS.escape(ac) + ' ' + (cls.length ? name + '.' + CSS.escape(cls[0]) : name)); break; }
    }
    if (!cls.length && name !== 'div' && name !== 'span') out.push(name);
    return [...new Set(out)].map((sel) => ({ sel, n: safeCount(sel) }));
  }
  function describe(el) {
    const cs = getComputedStyle(el);
    const anc = [];
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) anc.push(brief(a));
    let img = null;
    if (el.tagName === 'IMG') {
      const pic = el.parentElement && el.parentElement.tagName === 'PICTURE' ? el.parentElement : null;
      img = {
        src: el.getAttribute('src') || '', cur: el.currentSrc || el.src || '', alt: el.getAttribute('alt') || '',
        w: el.naturalWidth, h: el.naturalHeight, srcset: el.hasAttribute('srcset'), sizes: el.hasAttribute('sizes'),
        wAttr: el.hasAttribute('width'), hAttr: el.hasAttribute('height'),
        sources: pic ? [...pic.querySelectorAll('source')].map((s) => ({ ref: refOf(s), id: s.getAttribute('data-ve'), type: s.hasAttribute('type') })) : [],
      };
      // a picture replaced this session shows from memory; report the address it will have in the file
      if (reverse.has(img.src)) img.src = reverse.get(img.src);
    }
    const bgm = /url\(["']?([^"')]+)["']?\)/.exec(cs.backgroundImage || '');
    const a = el.closest('a[href]');
    const r = el.getBoundingClientRect();
    return {
      ref: refOf(el), id: el.getAttribute('data-ve'), tag: el.tagName.toLowerCase(), cls: [...el.classList], se: el.getAttribute('data-se'),
      textBlock: isTextBlock(el), text: (el.textContent || '').slice(0, 6000),
      css: { ff: cs.fontFamily, fs: cs.fontSize, fw: cs.fontWeight, fst: cs.fontStyle, lh: cs.lineHeight, ls: cs.letterSpacing, color: cs.color, ta: cs.textAlign, tt: cs.textTransform, bg: cs.backgroundColor, mt: cs.marginTop, mb: cs.marginBottom, br: cs.borderTopLeftRadius, display: cs.display },
      img, bgUrl: bgm ? bgm[1] : null,
      link: a ? { ref: refOf(a), id: a.getAttribute('data-ve'), href: a.getAttribute('href') || '', target: a.getAttribute('target') || '' } : null,
      ancestors: anc, sugg: suggest(el), w: Math.round(r.width), h: Math.round(r.height),
    };
  }
  function labelFor(el) {
    const cs = getComputedStyle(el);
    const n = el.tagName.toLowerCase();
    if (n === 'img') return 'Picture · ' + el.naturalWidth + ' × ' + el.naturalHeight;
    if (isTextBlock(el)) return n + ' · ' + Math.round(parseFloat(cs.fontSize)) + ' px';
    const r = el.getBoundingClientRect();
    return n + ' · ' + Math.round(r.width) + ' × ' + Math.round(r.height);
  }
  function select(el, x, y) {
    selEl = el;
    selRef = refOf(el);
    label = labelFor(el);
    const info = describe(el);
    if (x != null) {
      info.stack = document.elementsFromPoint(x, y).filter((e) => e !== document.documentElement && e !== document.body && e !== host).slice(0, 6).map(brief);
    }
    send({ type: 'select', info });
  }
  let refreshQueued = false;
  function refresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      if (selEl && !selEl.isConnected) { selEl = byRef(selRef); if (!selEl) { send({ type: 'deselect' }); return; } }
      if (selEl) { label = labelFor(selEl); send({ type: 'info', info: describe(selEl) }); }
    });
  }
  function place(box, el) {
    if (!el || !el.isConnected) { box.style.display = 'none'; return null; }
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) { box.style.display = 'none'; return null; }
    box.style.display = 'block';
    box.style.left = r.left + 'px';
    box.style.top = r.top + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
    return r;
  }
  (function loop() {
    mount();
    place(hov, hovEl && hovEl !== selEl && !editing ? hovEl : null);
    const r = place(selBox, selEl);
    if (r && !editing) {
      tag.style.display = 'block';
      tag.textContent = label;
      tag.style.left = Math.max(4, r.left) + 'px';
      tag.style.top = Math.max(4, r.top > 26 ? r.top - 22 : r.top + 4) + 'px';
    } else tag.style.display = 'none';
    requestAnimationFrame(loop);
  })();

  // editing text in place
  function onPaste(e) {
    e.preventDefault();
    // Plain text only, with its line breaks as <br>: the browser would otherwise wrap the lines in <div>s.
    const t = String((e.clipboardData || window.clipboardData).getData('text/plain') || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    const s = getSelection();
    if (!s.rangeCount) return;
    const r = s.getRangeAt(0);
    if (!editing || !editing.contains(r.commonAncestorContainer)) return;
    r.deleteContents();
    const frag = document.createDocumentFragment();
    t.split('\n').forEach((line, i) => { if (i) frag.appendChild(document.createElement('br')); if (line) frag.appendChild(document.createTextNode(line)); });
    const last = frag.lastChild;
    r.insertNode(frag);
    if (last) { const after = document.createRange(); after.setStartAfter(last); after.collapse(true); s.removeAllRanges(); s.addRange(after); }
  }
  // What typing can add that a page should never get: <div>/<p> wrappers (Enter in some places, dropped text)
  // become line breaks, and the browser's own style spans and <font> tags are taken away around their text.
  function tidyTyped(el, had) {
    for (const x of [...el.querySelectorAll('*')]) {
      if (had.has(x) || !x.isConnected) continue;
      const n = x.localName;
      if (n === 'div' || n === 'p') {
        const isBr = (y) => y && y.nodeType === 1 && y.localName === 'br';
        const prev = x.previousSibling;
        const next = x.nextSibling;
        if (prev && !isBr(prev)) x.before(document.createElement('br'));
        if (next && !isBr(next) && !isBr(x.lastChild)) x.after(document.createElement('br'));
        x.replaceWith(...x.childNodes);
      } else if (n === 'font' || (n === 'span' && !x.attributes.length) || (n === 'span' && x.attributes.length === 1 && x.hasAttribute('style'))) {
        x.replaceWith(...x.childNodes);
      }
    }
    el.normalize();
  }
  function showPreviews(root) {
    for (const x of root.querySelectorAll('img[src], img[srcset], source[srcset]')) {
      for (const a of ['src', 'srcset']) { const v = x.getAttribute(a); if (v != null && previews.has(v)) x.setAttribute(a, previews.get(v)); }
    }
  }
  function cleanHTML(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('[data-ve]').forEach((x) => x.removeAttribute('data-ve'));
    c.querySelectorAll('[contenteditable]').forEach((x) => x.removeAttribute('contenteditable'));
    c.querySelectorAll('[data-se-ui]').forEach((x) => x.remove());
    // pictures replaced this session show from memory here; the file gets their real addresses
    c.querySelectorAll('img[src], img[srcset], source[srcset]').forEach((x) => {
      for (const a of ['src', 'srcset']) { const v = x.getAttribute(a); if (v != null && reverse.has(v)) x.setAttribute(a, reverse.get(v)); }
    });
    return c.innerHTML;
  }
  let hadBefore = new WeakSet();
  function startEdit(el) {
    if (!el) return;
    if (editing) finish(true);
    orig(el);
    editing = el;
    editBefore = el.innerHTML;
    cleanBefore = cleanHTML(el);
    hadBefore = new WeakSet(el.querySelectorAll('*'));
    el.querySelectorAll('img, svg').forEach((x) => x.setAttribute('contenteditable', 'false'));
    el.setAttribute('contenteditable', 'true');
    el.addEventListener('paste', onPaste, true);
    selBox.classList.add('e');
    el.focus({ preventScroll: true });
    const s = getSelection();
    if (!s.rangeCount || !el.contains(s.anchorNode)) {
      const rg = document.createRange();
      rg.selectNodeContents(el);
      rg.collapse(false);
      s.removeAllRanges();
      s.addRange(rg);
    }
  }
  function finish(keep) {
    const el = editing;
    if (!el) return;
    editing = null;
    selBox.classList.remove('e');
    el.removeAttribute('contenteditable');
    el.querySelectorAll('[contenteditable]').forEach((x) => x.removeAttribute('contenteditable'));
    el.removeEventListener('paste', onPaste, true);
    try { getSelection().removeAllRanges(); } catch (e) { /* ignore */ }
    if (!keep) { el.innerHTML = editBefore; refresh(); return; }
    tidyTyped(el, hadBefore);
    const html = cleanHTML(el);
    if (html !== cleanBefore) {
      const ap = applied.get(el) || { html: null, attrs: {} };
      ap.html = html;
      applied.set(el, ap);
      send({ type: 'text', ref: refOf(el), id: el.getAttribute('data-ve'), html });
    }
    refresh();
  }

  // applying the editor's state
  const origs = new WeakMap();
  const applied = new Map();
  function orig(el) {
    let o = origs.get(el);
    if (!o) { o = { html: el.innerHTML, attrs: new Map() }; origs.set(el, o); }
    return o;
  }
  function applyAttrs(el, attrs) {
    const o = orig(el);
    const prev = applied.get(el) || { html: null, attrs: {} };
    const names = new Set([...Object.keys(prev.attrs || {}), ...Object.keys(attrs)]);
    for (const n of names) {
      if (!o.attrs.has(n)) o.attrs.set(n, el.hasAttribute(n) ? el.getAttribute(n) : null);
      const v = Object.prototype.hasOwnProperty.call(attrs, n) ? attrs[n] : o.attrs.get(n);
      const sv = n === 'src' || n === 'srcset' ? shown(v) : v;
      try { if (sv == null) el.removeAttribute(n); else if (el.getAttribute(n) !== sv) el.setAttribute(n, sv); } catch (e) { /* not a valid attribute name */ }
    }
    applied.set(el, { html: prev.html ?? null, attrs: Object.assign({}, attrs) });
  }
  function resetEl(el) {
    const o = origs.get(el);
    const prev = applied.get(el);
    if (!o || !prev) return;
    if (prev.html != null) { el.innerHTML = o.html; showPreviews(el); }
    for (const n of Object.keys(prev.attrs || {})) { const v = o.attrs.get(n); if (v == null) el.removeAttribute(n); else el.setAttribute(n, v); }
  }
  // The editor sends every element it ever changed. Texts go first, outermost first, since a new inside replaces
  // the elements in it; a text going back uses the inside as it is in the file (orig), not as it looked here.
  // Elements inside a changed text belong to that text, so they are left as it has them.
  function applyState(list) {
    const items = list.map(([ref, st]) => ({ ref: String(ref), st: st || {} }));
    const depth = (el) => { let d = 0; for (let a = el; a; a = a.parentElement) d++; return d; };
    let owners = [];
    const findOwners = () => { owners = []; for (const x of items) if (x.st.html != null) { const el = byRef(x.ref); if (el) owners.push(el); } };
    const inOwner = (el) => owners.some((o) => o !== el && o.contains(el));
    findOwners();
    const texts = items.map((x) => ({ x, el: byRef(x.ref) })).filter((y) => y.el).sort((a, b) => depth(a.el) - depth(b.el));
    for (const { x } of texts) {
      const el = byRef(x.ref);
      if (!el) continue;
      if (inOwner(el)) { applied.delete(el); continue; }
      const prev = applied.get(el) || { html: null, attrs: {} };
      const want = x.st.html ?? null;
      if (want === (prev.html ?? null)) continue;
      if (want != null) { orig(el); el.innerHTML = want; }
      else { const o = origs.get(el); el.innerHTML = x.st.orig != null ? x.st.orig : (o ? o.html : el.innerHTML); }
      showPreviews(el);
      applied.set(el, { html: want, attrs: prev.attrs || {} });
    }
    findOwners();
    const seen = new Set();
    for (const x of items) {
      const el = byRef(x.ref);
      if (!el) continue;
      seen.add(el);
      if (inOwner(el)) { applied.delete(el); continue; }
      applyAttrs(el, x.st.attrs || {});
    }
    for (const el of [...applied.keys()]) {
      if (seen.has(el)) continue;
      if (el.isConnected && !inOwner(el)) resetEl(el);
      applied.delete(el);
    }
  }
  function styleEl(key) {
    let el = key === 'page' ? document.getElementById('site-editor') : null;
    if (!el) el = document.querySelector('style[data-se-ui="' + key + '"]');
    if (!el) {
      el = document.createElement('style');
      el.setAttribute('data-se-ui', key);
      const head = document.head || document.documentElement;
      const pageEl = key === 'site' ? (document.getElementById('site-editor') || document.querySelector('style[data-se-ui="page"]')) : null;
      if (pageEl && pageEl.parentNode) pageEl.parentNode.insertBefore(el, pageEl); else head.appendChild(el);
    }
    return el;
  }
  function setFonts(hrefs) {
    const have = new Set([...document.querySelectorAll('link[data-se-ui="font"]')].map((l) => l.href));
    for (const h of hrefs) {
      if (have.has(h)) continue;
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = h;
      l.setAttribute('data-se-ui', 'font');
      (document.head || document.documentElement).appendChild(l);
      l.onload = () => refresh();
    }
  }

  // events: the page is for looking and pointing while editing, so its own buttons and links stay still
  addEventListener('mousemove', (e) => { hovEl = e.target instanceof Element ? e.target : null; }, true);
  document.addEventListener('mouseleave', () => { hovEl = null; });
  addEventListener('click', (e) => {
    if (editing && editing.contains(e.target)) { e.preventDefault(); return; }
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (editing) finish(true);
    if (e.target instanceof Element) select(e.target, e.clientX, e.clientY);
  }, true);
  for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'auxclick', 'submit', 'dragstart']) {
    addEventListener(type, (e) => {
      if (editing && editing.contains(e.target)) return;
      if (type === 'submit' || type === 'dragstart') e.preventDefault();
      e.stopPropagation();
    }, true);
  }
  addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (editing) return;
    if (!(e.target instanceof Element)) return;
    if (e.target !== selEl) select(e.target, e.clientX, e.clientY);
    send({ type: 'dbl', ref: refOf(e.target) });
  }, true);
  addEventListener('keydown', (e) => {
    if (editing) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      e.stopPropagation();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && /^[zy]$/i.test(e.key)) { e.preventDefault(); send({ type: 'key', key: e.key.toLowerCase(), shift: e.shiftKey }); }
    else if (e.key === 'Escape') { selEl = null; selRef = null; send({ type: 'deselect' }); }
    e.stopPropagation();
  }, true);
  let scrollT = 0;
  addEventListener('scroll', () => { clearTimeout(scrollT); scrollT = setTimeout(() => send({ type: 'scrolled', y: window.scrollY }), 150); }, true);
  addEventListener('resize', refresh);

  addEventListener('message', (e) => {
    if (e.source !== parent) return;
    const m = e.data;
    if (!m || !m.__se) return;
    const reply = (x) => send(Object.assign({ type: 'reply', req: m.req }, x));
    switch (m.type) {
      case 'image': {
        if (previews.has(m.src)) break;
        const url = URL.createObjectURL(new Blob([m.bytes], { type: m.mime || 'image/jpeg' }));
        previews.set(m.src, url);
        reverse.set(url, m.src);
        showPreviews(document);
        styleEl('page').textContent = subCss(lastCss.page);
        styleEl('site').textContent = subCss(lastCss.site);
        break;
      }
      case 'state':
        applyState(m.edits || []);
        if (m.css) { lastCss = m.css; styleEl('page').textContent = subCss(m.css.page); styleEl('site').textContent = subCss(m.css.site); }
        setFonts(m.fonts || []);
        refresh();
        break;
      case 'select': { const el = byRef(m.ref); if (el) { select(el); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } break; }
      case 'deselect': selEl = null; selRef = null; if (editing) finish(true); break;
      case 'edit': { const el = byRef(m.ref); if (el) { if (el !== selEl) select(el); startEdit(el); } break; }
      case 'refresh': refresh(); break;
      case 'finish': if (editing) finish(true); reply({ ok: true }); break;
      case 'scroll': window.scrollTo(0, m.y || 0); break;
      case 'get': { const el = byRef(m.ref); reply({ html: el ? cleanHTML(el) : null }); break; }
      case 'direct': {
        const el = byRef(m.ref);
        const owner = byRef(m.owner);
        if (!el || !owner) { reply({ ok: false }); break; }
        orig(owner);
        for (const [n, v] of Object.entries(m.attrs || {})) { if (v == null) el.removeAttribute(n); else el.setAttribute(n, v); }
        const html = cleanHTML(owner);
        const ap = applied.get(owner) || { html: null, attrs: {} };
        ap.html = html;
        applied.set(owner, ap);
        reply({ ok: true, html });
        refresh();
        break;
      }
    }
  });
  send({ type: 'ready' });
}
