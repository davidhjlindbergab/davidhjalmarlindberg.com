/*!
 * Colobri button v1.0.1
 * The Try button drawn in the COLOBRI bird's own light: an iridescent ribbon round the pill (cool tips, warm belly,
 * a white throat), the bird's electric-blue glow strongest at the two ends, focus that drifts in and out, a slow
 * turbulent undulation, a light that trails the pointer and drags the colors, and a ripple of light on press.
 * Same 40 s seamless loop, pointer spring and ripple shape as the COLOBRI logo (colobri-logo-kit v1.1).
 * One shared WebGL2 context draws every button on the page; without WebGL2 the CSS ring in colobri-button.css stays.
 * Copyright (c) 2026 David HJ Lindberg AB. All rights reserved. For use in COLOBRI products.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.ColobriButton = factory();
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const VERSION = '1.0.1';
const LOOP = 40;                        // every ambient motion repeats seamlessly after 40 s, as in the logo

const DEFAULTS = Object.freeze({
  motion: 0.6,                          // strength of the ambient animation (0.6 is the COLOBRI setting, 0 = still)
  speed: 1,                             // time scale of the loop
  halo: 1.15,                           // how far the glow reaches beyond the pill, in button heights
  interactive: true,                    // pointer light, color drag and press ripples
  quality: 1,                           // render resolution multiplier, 0.4-1
  maxPixelRatio: 2,
  startTime: null,                      // seconds into the loop; null staggers the buttons on a page
  ground: null,                         // the color behind the button; null reads it from the page
  respectReducedMotion: true,           // halves the speed and calms the undulation when the OS asks
  fadeIn: 900                           // ms, the light fades up once the first frame is drawn
});

/* ---------------------------------------------------------------------- *
 *  Shader                                                                 *
 * ---------------------------------------------------------------------- */
const VS = `#version 300 es
void main(){
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes;          // canvas size in device px
uniform float uPx;          // device px per CSS px
uniform vec2 uHalf;         // the pill's half width and half height (CSS px)
uniform float uUnit;        // the pill's height (CSS px): every size below scales with it
uniform float uReach;       // how far the canvas reaches beyond the pill (CSS px)
uniform float uRw;          // ribbon width (CSS px)
uniform float uMotion;
uniform vec4 uO12, uO34;    // slow looping offsets: color flow (two scales), hue weather, glow breathing
uniform vec2 uWarpAmp;      // color flow amplitude, two scales (CSS px)
uniform vec3 uHue;          // global drift, warm/cool counter-drift, local weather amplitude (degrees)
uniform float uGlowHue;
uniform vec4 uGlowW;        // breathing of the four glow radii
uniform vec4 uTurb;         // amount (CSS px), 1/size, z, z - loop
uniform float uTurbMix;
uniform vec3 uSweep;        // sheen: position, width (CSS px), strength
uniform vec2 uSweepDir, uLightDir;
uniform vec4 uBlobA;        // depth of field: blur of the four soft zones (CSS px)
uniform vec4 uBlobX;        // their drifting positions along the pill
uniform vec3 uPtr;          // pointer (CSS px from the pill's centre), presence
uniform vec2 uDrag;         // color drag from pointer motion (CSS px)
uniform vec4 uRip[4];       // ripples: x, y, age (s), amplitude
uniform float uRipV;        // ripple speed (CSS px / s)
uniform float uFocus;       // keyboard focus 0-1
uniform float uBusy;        // 0-1
uniform vec3 uGround;       // the page behind the button, and the button's own fill: the light is added to them
uniform vec3 uFill;
out vec4 outColor;

vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float snoise3(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
// looping turbulence: two noise times cross-faded with constant total variance
float turb(vec3 a, vec3 b){ return cos(uTurbMix) * snoise3(a) + sin(uTurbMix) * snoise3(b); }

// the logo's color model: hue in degrees (185-398 runs cyan, blue, violet, magenta, coral, ember, peach),
// saturation toward white, always at full value: the color is light
vec3 hsv1(float hdeg, float s){
  vec3 p = abs(fract(hdeg / 360.0 + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
  return mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), s);
}
float sdPill(vec2 p, vec2 h){
  vec2 q = vec2(max(abs(p.x) - (h.x - h.y), 0.0), p.y);
  return length(q) - h.y;
}
// the nearest point on the pill's outline: the glow is light emitted along the outline, as in the logo
vec2 nearestOnPill(vec2 p, vec2 h){
  float cx = h.x - h.y;
  if (abs(p.x) <= cx) return vec2(p.x, p.y >= 0.0 ? h.y : -h.y);
  vec2 cc = vec2(sign(p.x) * cx, 0.0), v = p - cc;
  float l = length(v);
  return cc + (l > 1e-4 ? v / l : vec2(sign(p.x), 0.0)) * h.y;
}
// a gaussian edge, as the logistic fit the logo uses
float edgeF(float x){ return 1.0 / (1.0 + exp(clamp(-1.702 * x, -60.0, 60.0))); }

// The bird laid round the pill: cool wing tip at the left end, blue and violet along the back (top),
// the head's blue at the right end, a white throat at the lower right, then the warm belly along the bottom.
// x, y in pill coordinates (-1..1), hue, saturation.
const int NA = 11;
const vec4 AN[NA] = vec4[NA](
  vec4(-1.00,  0.00, 198.0, 0.30),   // wing tip: pale cyan
  vec4(-0.70, -0.97, 224.0, 0.88),   // upper wing: azure
  vec4(-0.30, -1.00, 258.0, 0.80),   // back: indigo
  vec4( 0.20, -1.00, 274.0, 0.70),   // back: violet
  vec4( 0.62, -0.95, 236.0, 0.90),   // nape: blue
  vec4( 1.00,  0.00, 210.0, 0.82),   // head and beak: the head's blue
  vec4( 0.80,  0.86, 300.0, 0.10),   // throat: white
  vec4( 0.45,  1.00, 386.0, 0.42),   // belly: peach
  vec4( 0.00,  1.00, 375.0, 0.70),   // belly: ember
  vec4(-0.42,  1.00, 356.0, 0.72),   // belly: coral
  vec4(-0.72,  0.93, 318.0, 0.70)    // lower wing: orchid
);

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 p = vec2(fc.x - 0.5*uRes.x, 0.5*uRes.y - fc.y) / uPx;     // CSS px from the pill's centre, y down
  float U = uUnit;
  float d0 = sdPill(p, uHalf);
  if (d0 > uReach + 2.0) { outColor = vec4(0.0); return; }

  // triangular dither: keeps the long glow gradients free of banding
  float n1 = fract(52.9829189 * fract(dot(fc, vec2(0.06711056, 0.00583715))));
  float n2 = fract(sin(dot(fc, vec2(12.9898, 78.233))) * 43758.5453);
  float dith = (n1 + n2 - 1.0) / 255.0;

  // ---- pointer and ripples
  vec2 dp = p - uPtr.xy; float dp2 = dot(dp, dp);
  float sF = 0.80 * U, sW = 1.25 * U, sD = 1.0 * U;
  float kFocus = uPtr.z * exp(-dp2 / (2.0*sF*sF));
  float kWide  = uPtr.z * exp(-dp2 / (2.0*sW*sW));
  float kDrag  = uPtr.z * exp(-dp2 / (2.0*sD*sD));
  float ring = 0.0; vec2 push = vec2(0.0);
  for (int i = 0; i < 4; i++){
    vec4 r = uRip[i];
    if (r.w <= 0.0) continue;
    vec2 dr = p - r.xy; float dist = length(dr);
    float rad = uRipV * r.z + 0.05 * U;
    // a soft front with a short glowing wake behind it: starts as a disc, opens into a ring, never a hole
    float wOut = U * (0.20 + 0.18 * r.z), wIn = wOut + 0.35 * rad;
    float gsh = (dist - rad) / (dist < rad ? wIn : wOut);
    float gg = exp(-gsh*gsh) * r.w * (dist < rad ? 0.85 + 0.15 * exp(-gsh*gsh) : 1.0);
    float gp = (dist - rad) / (U * (0.55 + 0.25 * r.z));
    ring += gg; push += dr / max(dist, 1.0) * min(dist / (0.45*U), 1.0) * exp(-gp*gp) * r.w;
  }
  ring = min(ring, 1.2);
  push /= max(1.0, length(push));

  // deep inside the pill nothing is drawn unless the pointer or a ripple lights the glass
  if (d0 < -0.48*U && kFocus < 0.004 && ring < 0.004) { outColor = vec4(0.0); return; }

  // ---- the whole light undulates: a slow turbulent displacement, calm at the pill's edge, freer in the glow
  vec3 tq = vec3(p * uTurb.y, 0.0);
  vec2 disp = vec2(turb(tq + vec3(0.0, 0.0, uTurb.z), tq + vec3(0.0, 0.0, uTurb.w)),
                   turb(tq + vec3(37.2, 11.9, uTurb.z + 5.3), tq + vec3(37.2, 11.9, uTurb.w + 5.3)));
  vec2 pp = p + disp * uTurb.x * mix(0.22, 1.0, smoothstep(0.0, 0.7*U, abs(d0))) * uMotion;
  float d = sdPill(pp, uHalf);
  vec2 c0 = pp / uHalf;                                          // pill coordinates: ends at x = -1, 1; top y = -1
  vec2 ce = nearestOnPill(pp, uHalf) / uHalf;                    // the same, for the nearest point of the outline

  // a slow light orbits once per loop: the side facing it runs whiter and its glow fuller;
  // a wide sheen crosses twice per loop
  vec2 dir = normalize(c0 * vec2(1.0, 0.75) + vec2(1e-4));
  float lit = dot(dir, uLightDir);
  float sz = (dot(pp, uSweepDir) - uSweep.x) / uSweep.y;
  float sw = exp(-sz*sz) * uSweep.z * uMotion;

  // the ribbon: a band of light over the pill's edge, finer toward the beak, a little fuller along the belly,
  // swelling where a ripple passes
  float rw = uRw * (1.0 - 0.36 * smoothstep(0.5, 1.0, c0.x)) * (1.0 + 0.14 * smoothstep(0.2, 1.0, c0.y)) * (1.0 + 0.55 * min(ring, 1.0));
  float ra = -0.56 * rw, rb = 0.44 * rw;
  float outside = smoothstep(-0.5*rw, 0.6*rw, d);

  vec3 Cr = vec3(0.0), Cin = vec3(0.0);
  float o = 0.0, cov = 0.0, aIn = 0.0, glass = 0.0;
  if (d < 0.2 * U) {                                             // the ribbon and the glass; out in the glow only the glow
    // ---- the colors flow slowly round the fixed pill; the pointer drags and swirls them; ripples push them outward
    vec2 s1 = pp / (2.4*U), s2 = pp / (1.05*U);
    vec2 w = uWarpAmp.x * vec2(snoise(s1 + uO12.xy), snoise(s1 + vec2(4.3, 1.9) - uO12.xy))
           + uWarpAmp.y * vec2(snoise(s2 + vec2(7.1, 3.3) + uO12.zw), snoise(s2 + vec2(1.5, 8.2) - uO12.zw));
    w *= uMotion;
    w += uDrag * kDrag + vec2(-dp.y, dp.x) * (0.20 * kDrag) + push * (0.16 * U);
    w.y *= 0.45;                                                 // flow runs mostly along the pill
    vec2 c = (pp + w) / uHalf;

    float sw0 = 0.0, H = 0.0, S = 0.0;
    for (int i = 0; i < NA; i++){
      vec2 e = (c - AN[i].xy) / vec2(0.27, 0.56);
      float k = exp(-0.5 * dot(e, e)) + 1e-6;
      sw0 += k; H += k * AN[i].z; S += k * AN[i].w;
    }
    H /= sw0; S /= sw0;
    float warm = smoothstep(318.0, 368.0, H);

    // slow hue life: a global drift, the cool tips and the warm belly breathing against each other, local weather
    float hn = snoise(pp / (2.9*U) + vec2(11.0, 3.0) + uO34.xy);
    H += (uHue.x + uHue.y * (2.0*warm - 1.0) + uHue.z * hn) * mix(1.0, 0.45, warm) * uMotion;
    H += (20.0 * ring + 5.0 * kFocus) * mix(1.0, 0.6, warm);
    H = clamp(H, 185.0, 398.0);

    // ---- depth of field: the back and the tips drift in and out of focus, the belly stays sharp;
    //      the pointer and keyboard focus pull everything sharp
    float soft = 0.22;
    vec2 b;
    b = (c0 - vec2(uBlobX.x, -1.0)) / vec2(0.34, 0.62); soft += uBlobA.x * exp(-0.5*dot(b, b));
    b = (c0 - vec2(-1.02, uBlobX.y)) / vec2(0.16, 0.70); soft += uBlobA.y * exp(-0.5*dot(b, b));
    b = (c0 - vec2(uBlobX.z, -0.92)) / vec2(0.18, 0.50); soft += uBlobA.z * exp(-0.5*dot(b, b));
    b = (c0 - vec2(uBlobX.w, 0.95)) / vec2(0.16, 0.40);  soft += uBlobA.w * exp(-0.5*dot(b, b));
    float focusPull = clamp(0.65 * min(kFocus, 1.0) + 0.35 * min(ring, 1.0) + 0.55 * uFocus, 0.0, 0.85);
    soft = 0.22 + max(soft - 0.22, 0.0) * (1.0 - focusPull);
    float aa = 0.62 / uPx;
    float sigma = sqrt(soft*soft + aa*aa);
    cov = clamp(edgeF((d - ra) / sigma) - edgeF((d - rb) / sigma), 0.0, 1.0);

    S = clamp(S, 0.0, 1.0);
    float Sr = S * max(1.0 - 0.20*sw - 0.20*max(lit, 0.0)*uMotion - (0.34*min(kFocus, 1.0) + 0.62*min(ring, 1.0)) - 0.22*uFocus, 0.12);
    Cr = hsv1(H, Sr);
    o = cov * clamp(0.90 + 0.10*lit*uMotion + 0.30*sw + 0.25*kFocus + 0.3*ring, 0.0, 1.0);

    // ---- light inside the glass, only along the edge (never behind the word): warm under the belly, cooler above
    float inner = 1.0 - smoothstep(-0.3*rw, 0.5*rw, d);
    float din = max(-d + ra, 0.0);
    float spill = 0.15 + 0.30 * smoothstep(-0.1, 0.95, ce.y) + 0.22 * smoothstep(0.62, 1.0, abs(ce.x));
    spill *= 1.0 + 1.1*min(kFocus, 1.0) + 1.0*min(ring, 1.0) + 0.5*uFocus + 0.15*sw;
    aIn = inner * spill * (0.72 * exp(-din / (0.085*U)) + 0.28 * exp(-din / (0.20*U)));
    Cin = hsv1(H, min(1.0, S*0.85 + 0.40));

    // ---- the glass catches the pointer's light faintly, and a ripple passes through it
    glass = (1.0 - outside) * (0.040 * min(kFocus, 1.0) + 0.085 * min(ring, 1.0));
  }

  // ---- the glow: electric blue, strongest at the wing tip and the beak, fuller along the back, none under the belly;
  //      it breathes, leans to the orbiting light, gathers under the pointer and flares with every ripple
  float eL = smoothstep(-0.50, -1.0, ce.x);
  float eR = smoothstep(0.64, 1.0, ce.x);
  float eT = smoothstep(0.30, -1.0, ce.y);
  float eB = smoothstep(0.10, 1.0, ce.y);
  float E = max(max(eL, 0.86*eR), 0.52*eT);
  E *= 1.0 - 0.92 * eB * (1.0 - max(eL, eR));
  float gn = snoise(pp / (2.2*U) + vec2(21.0, 7.0) + uO34.zw);
  float dOut = max(d - rb, 0.0);
  vec4 fall = exp(-dOut / (U * vec4(0.055, 0.15, 0.34, 0.70)));
  // the pointer and ripples brighten the glow close to the outline far more than its outer haze
  float boost = 1.5*kWide + 1.9*ring + 0.8*uFocus + 0.35*uBusy;
  vec4 wts = vec4(1.35, 0.70, 0.30, 0.10) * (1.0 + boost * vec4(1.0, 0.85, 0.45, 0.2));
  float L = dot(fall * uGlowW, wts) * E;
  L *= 1.0 + (0.30*gn + 0.45*lit)*uMotion + 0.22*sw;
  float gl = 1.0 - exp(-L);
  gl = gl * gl / (gl + 0.025);                                   // soft knee: the faintest haze falls away cleanly
  vec2 bp = min(fc, uRes - fc) / uPx;
  float edge = smoothstep(0.0, 0.6*uReach, min(bp.x, bp.y));     // gone before the canvas border
  edge *= edge;
  float ga = gl * outside * (1.0 - cov) * edge;
  float Hg = 240.0 - 26.6 * pow(clamp((gl - 0.25) / 0.75, 0.0, 1.0), 1.5) + (uGlowHue + 7.0*gn) * uMotion;
  vec3 Cg = hsv1(Hg, 1.0);
  vec3 Cgl = mix(vec3(1.0), hsv1(226.0, 1.0), 0.42);

  // ---- light is added, never laid over: the ribbon covers what is under it, the glow and the inner light only
  //      brighten the ground (the fill inside the pill, the page outside), so faint blue never dims it
  float aaF = 0.62 / uPx;
  vec3 G = mix(uGround, uFill, 1.0 - smoothstep(-aaF, aaF, d0));
  vec3 Ls = Cin * aIn + Cgl * glass + Cg * ga;
  vec3 F = min(Cr * o + (G + Ls) * (1.0 - o), vec3(1.0));
  F += dith;
  vec3 up = (F - G) / max(vec3(1.0) - G, vec3(1e-3));
  vec3 dn = (G - F) / max(G, vec3(1e-3));
  float a = clamp(max(o, max(max(max(up.r, up.g), up.b), max(max(dn.r, dn.g), dn.b))), 0.0, 1.0);
  vec3 P = clamp(F - G * (1.0 - a), vec3(0.0), vec3(a));
  outColor = vec4(P, a);
}`;

/* ---------------------------------------------------------------------- *
 *  The shared renderer: one WebGL2 context for every button               *
 * ---------------------------------------------------------------------- */
let R = null;
let rendererFailed = false;
const instances = [];
let raf = 0, lastNow = 0;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('ColobriButton shader: ' + gl.getShaderInfoLog(s));
  return s;
}
function setupProgram(r) {
  const gl = r.gl;
  const vs = compile(gl, gl.VERTEX_SHADER, VS), fs = compile(gl, gl.FRAGMENT_SHADER, FS);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('ColobriButton program: ' + gl.getProgramInfoLog(prog));
  gl.deleteShader(vs); gl.deleteShader(fs);
  gl.useProgram(prog);
  r.vao = gl.createVertexArray(); gl.bindVertexArray(r.vao);
  gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
  r.U = {};
  for (let i = 0, n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS); i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    r.U[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(prog, info.name);
  }
  r.prog = prog;
  r.ready = true;
}
function getRenderer() {
  if (R) return R;
  if (rendererFailed || typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 2;
    const gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
      preserveDrawingBuffer: false, powerPreference: 'low-power'
    });
    if (!gl) { rendererFailed = true; return null; }
    R = { canvas: canvas, gl: gl, prog: null, vao: null, U: {}, ready: false, scale: 1, times: [] };
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); if (R) R.ready = false; }, false);
    canvas.addEventListener('webglcontextrestored', function () {
      try { setupProgram(R); instances.forEach(function (i) { i.sizeKey = ''; }); kick(); }
      catch (err) { rendererFailed = true; console.warn('[ColobriButton]', err.message || err); }
    }, false);
    setupProgram(R);
    return R;
  } catch (err) {
    rendererFailed = true; R = null;
    if (typeof console !== 'undefined') console.warn('[ColobriButton]', err && err.message ? err.message : err);
    return null;
  }
}

function isSupported() {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch (e) { return false; }
}

/* Any CSS color to [r, g, b, a] in 0-1, by letting the browser paint it. */
let colorCtx = null;
function cssColor(str) {
  try {
    if (!colorCtx) { const c = document.createElement('canvas'); c.width = c.height = 1; colorCtx = c.getContext('2d', { willReadFrequently: true }); }
    colorCtx.clearRect(0, 0, 1, 1);
    colorCtx.fillStyle = 'rgba(0,0,0,0)';
    colorCtx.fillStyle = String(str);
    colorCtx.fillRect(0, 0, 1, 1);
    const d = colorCtx.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
  } catch (e) { return null; }
}
/* The color the button sits on: the first ancestor with a solid background (white if the page sets none). */
function findGround(el) {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const c = cssColor(getComputedStyle(n).backgroundColor);
    if (c && c[3] > 0.5) return [c[0], c[1], c[2]];
  }
  return [1, 1, 1];
}

/* ---------------------------------------------------------------------- *
 *  The loop: every visible button, one after another, in one frame        *
 * ---------------------------------------------------------------------- */
function kick() { if (!raf && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(loop); }
function loop() {
  raf = 0;
  const now = performance.now();                       // one clock for frames, ripples and pointer motion
  if (!R || !R.ready) { lastNow = 0; return; }
  const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
  lastNow = now;
  let drew = 0;
  for (let i = 0; i < instances.length; i++) {
    const b = instances[i];
    if (b.destroyed || !b.visible) continue;
    if (b.step(now, dt)) drew++;
  }
  // adaptive quality: lower the resolution of every button if frames get slow
  if (drew && dt > 0) {
    R.times.push(dt); if (R.times.length > 45) R.times.shift();
    if (R.times.length === 45) {
      const avg = R.times.reduce(function (s, v) { return s + v; }, 0) / 45;
      if (avg > 0.026 && R.scale > 0.55) { R.scale *= 0.85; R.times = []; instances.forEach(function (b) { b.sizeKey = ''; }); }
      else if (avg < 0.0135 && R.scale < 1) { R.scale = Math.min(1, R.scale / 0.85); R.times = []; instances.forEach(function (b) { b.sizeKey = ''; }); }
    }
  }
  if (drew) raf = requestAnimationFrame(loop); else lastNow = 0;
}

/* ---------------------------------------------------------------------- *
 *  Pointer: one listener for the page, so the light notices the pointer   *
 *  as it comes near, before it is over the button                         *
 * ---------------------------------------------------------------------- */
let pointerWired = false;
function wirePointer() {
  if (pointerWired) return;
  pointerWired = true;
  document.addEventListener('pointermove', function (e) {
    for (let i = 0; i < instances.length; i++) instances[i].onMove(e);
  }, { passive: true });
  document.addEventListener('pointerout', function (e) {
    if (!e.relatedTarget) for (let i = 0; i < instances.length; i++) instances[i].onLeave();
  }, { passive: true });
  window.addEventListener('blur', function () { for (let i = 0; i < instances.length; i++) instances[i].onLeave(); });
}

let stagger = 0;

/* ---------------------------------------------------------------------- *
 *  A button                                                               *
 * ---------------------------------------------------------------------- */
function create(target, options) {
  if (typeof target === 'string') target = document.querySelector(target);
  if (!target) throw new Error('ColobriButton.create: element not found');
  if (target.__colobriButton) return target.__colobriButton;
  const o = Object.assign({}, DEFAULTS);
  Object.keys(options || {}).forEach(function (k) { if (options[k] !== undefined) o[k] = options[k]; });
  const el = target;

  const api = {
    element: el, supported: false,
    setBusy: setBusy, ripple: ripple, setMotion: setMotion, setSpeed: setSpeed,
    setTime: setTime, getTime: getTime, play: play, pause: pause, destroy: destroy, resize: resize
  };
  el.__colobriButton = api;

  const r = getRenderer();
  if (!r) { el.classList.add('cb-no-webgl'); return api; }   // the CSS ring stays
  api.supported = true;

  const canvas = document.createElement('canvas');
  canvas.className = 'cb-light';
  canvas.setAttribute('aria-hidden', 'true');
  if (o.fadeIn > 0) canvas.style.transition = 'opacity ' + o.fadeIn + 'ms ease';
  el.insertBefore(canvas, el.firstChild);
  const ctx = canvas.getContext('2d');

  const reduce = (o.respectReducedMotion && window.matchMedia) ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const st = {
    t: o.startTime == null ? (stagger++ * 13.7) % LOOP : ((+o.startTime % LOOP) + LOOP) % LOOP,
    playing: true, speed: Math.max(0, +o.speed || 0), speedCur: 1,
    motion: clamp(+o.motion, 0, 1), motionCur: clamp(+o.motion, 0, 1),
    busy: 0, busyTarget: 0, focus: 0, focusTarget: 0,
    bw: 0, bh: 0, M: 0, cw: 0, ch: 0, px: 1, w: 1, h: 1,
    live: false
  };
  const ptr = { have: false, down: false, near: 0, tx: 0, ty: 0, x: 0, y: 0, vx: 0, vy: 0, pres: 0, lx: 0, ly: 0, lastT: 0, dragX: 0, dragY: 0 };
  const cols = { ground: [0, 0, 0], fill: [0.086, 0.086, 0.094] };
  function readColors() {
    const f = cssColor(getComputedStyle(el).backgroundColor);
    if (f && f[3] > 0.5) cols.fill = [f[0], f[1], f[2]];
    const g = o.ground ? cssColor(o.ground) : null;
    cols.ground = g && g[3] > 0.5 ? [g[0], g[1], g[2]] : findGround(el);
  }
  const ripples = [];
  const ripBuf = new Float32Array(16);

  const inst = {
    el: el, destroyed: false, visible: true, sizeKey: '',
    step: step, onMove: onMove, onLeave: onLeave
  };

  // ---- size: the canvas reaches beyond the pill by the halo
  function measure() {
    const bw = el.offsetWidth, bh = el.offsetHeight;
    const dpr = Math.min((window.devicePixelRatio || 1), o.maxPixelRatio) * clamp(+o.quality || 1, 0.4, 1) * R.scale;
    const key = bw + 'x' + bh + '@' + dpr.toFixed(3);
    if (key === inst.sizeKey) return bw > 0 && bh > 0;
    inst.sizeKey = key;
    readColors();
    st.bw = bw; st.bh = bh;
    st.M = Math.round(bh * o.halo);
    st.cw = bw + 2 * st.M; st.ch = bh + 2 * st.M;
    canvas.style.left = -st.M + 'px'; canvas.style.top = -st.M + 'px';
    canvas.style.width = st.cw + 'px'; canvas.style.height = st.ch + 'px';
    st.w = Math.max(1, Math.round(st.cw * dpr)); st.h = Math.max(1, Math.round(st.ch * dpr));
    if (canvas.width !== st.w || canvas.height !== st.h) { canvas.width = st.w; canvas.height = st.h; }
    st.px = st.w / Math.max(st.cw, 1);
    return bw > 0 && bh > 0;
  }

  function sdPill(x, y) {
    const A = st.bw / 2, Rr = st.bh / 2;
    const qx = Math.max(Math.abs(x) - (A - Rr), 0);
    return Math.hypot(qx, y) - Rr;
  }
  // pointer position in the pill's own CSS px, from its centre (the button may be scaled while pressed)
  function local(clientX, clientY) {
    const rc = el.getBoundingClientRect();
    const sx = rc.width / Math.max(el.offsetWidth, 1), sy = rc.height / Math.max(el.offsetHeight, 1);
    return [(clientX - (rc.left + rc.width / 2)) / (sx || 1), (clientY - (rc.top + rc.height / 2)) / (sy || 1)];
  }
  function aim(x, y) {
    if (!ptr.have) { ptr.x = x; ptr.y = y; ptr.vx = ptr.vy = 0; ptr.lx = x; ptr.ly = y; ptr.lastT = performance.now(); }
    ptr.have = true; ptr.tx = x; ptr.ty = y;
  }
  function onMove(e) {
    if (inst.destroyed || !o.interactive || !st.bw) return;
    if (e.pointerType === 'touch' && !ptr.down) return;          // on touch the light comes only with a press
    const q = local(e.clientX, e.clientY);
    const dd = sdPill(q[0], q[1]);
    if (dd > st.M) { if (ptr.have && !ptr.down) { ptr.have = false; kick(); } return; }
    ptr.near = dd <= 0 ? 1 : 0.85 * Math.pow(1 - dd / st.M, 1.5);
    aim(q[0], q[1]);
    kick();
  }
  function onLeave() { if (ptr.have || ptr.down) { ptr.have = false; ptr.down = false; kick(); } }
  function onDown(e) {
    if (!o.interactive) return;
    const q = local(e.clientX, e.clientY);
    ptr.near = 1; ptr.down = true; aim(q[0], q[1]);
    addRipple(q[0], q[1]);
  }
  function onUp(e) { ptr.down = false; if (e.pointerType !== 'mouse') ptr.have = false; kick(); }
  function onKey(e) {
    if (e.key === 'Enter' || (e.key === ' ' && el.tagName === 'BUTTON')) addRipple(0, 0);
  }
  function onFocus() {
    let fv = true;
    try { fv = el.matches(':focus-visible'); } catch (err) { fv = true; }
    st.focusTarget = fv ? 1 : 0; kick();
  }
  function onBlur() { st.focusTarget = 0; kick(); }
  function addRipple(x, y) {
    ripples.push({ x: x, y: y, t0: performance.now() });
    while (ripples.length > 4) ripples.shift();
    kick();
  }

  function stepPointer(dt) {
    const k = 42, c = 2 * Math.sqrt(k);                // critically damped: the light trails the pointer by a beat
    if (ptr.have) {
      const ax = (ptr.tx - ptr.x) * k - ptr.vx * c, ay = (ptr.ty - ptr.y) * k - ptr.vy * c;
      ptr.vx += ax * dt; ptr.vy += ay * dt;
      ptr.x += ptr.vx * dt; ptr.y += ptr.vy * dt;
    }
    const target = ptr.have ? (ptr.down ? 1.2 : ptr.near) : 0;
    ptr.pres += (target - ptr.pres) * Math.min(1, dt * (target > ptr.pres ? 4.5 : 1.6));
    if (ptr.pres < 1e-3 && !ptr.have) ptr.pres = 0;
    let dx = 0, dy = 0;
    if (ptr.have) {
      const now = performance.now(), el2 = Math.max(1e-3, (now - ptr.lastT) / 1000);
      dx = (ptr.tx - ptr.lx) / el2 * 0.22; dy = (ptr.ty - ptr.ly) / el2 * 0.22;
      const cap = 0.42 * st.bh, mag = Math.hypot(dx, dy);
      if (mag > cap) { dx *= cap / mag; dy *= cap / mag; }
      ptr.lx = ptr.tx; ptr.ly = ptr.ty; ptr.lastT = now;
    }
    const rate = Math.min(1, dt * 2.6);
    ptr.dragX += (dx - ptr.dragX) * rate; ptr.dragY += (dy - ptr.dragY) * rate;
  }

  // ---- one frame: advance, then draw through the shared context and copy into this button's canvas
  function step(now, dt) {
    if (!measure()) return false;
    const rm = reduce && reduce.matches;
    st.busy += (st.busyTarget - st.busy) * Math.min(1, dt * 2.2);
    st.focus += (st.focusTarget - st.focus) * Math.min(1, dt * 6);
    st.motionCur += (st.motion - st.motionCur) * Math.min(1, dt * 3);
    const sp = st.playing ? st.speed * (rm ? 0.5 : 1) * (1 + 1.1 * st.busy) : 0;   // busy: the flow runs about twice as fast
    st.t = (st.t + dt * sp) % LOOP;
    stepPointer(dt);
    for (let i = ripples.length - 1; i >= 0; i--) if ((now - ripples[i].t0) / 1000 > 4.5) ripples.splice(i, 1);
    draw(now, rm);
    if (!st.live) {
      st.live = true;
      canvas.style.opacity = '1';
      el.classList.add('is-live');
    }
    return true;
  }

  function draw(now, rm) {
    const gl = R.gl, U = R.U;
    if (R.canvas.width < st.w || R.canvas.height < st.h) {
      R.canvas.width = Math.max(R.canvas.width, st.w); R.canvas.height = Math.max(R.canvas.height, st.h);
    }
    gl.viewport(0, 0, st.w, st.h);
    const H = st.bh, A = st.bw / 2, m = st.motionCur * (rm ? 0.75 : 1);
    const t = st.t, th = 2 * Math.PI * t / LOOP;
    gl.uniform2f(U.uRes, st.w, st.h);
    gl.uniform1f(U.uPx, st.px);
    gl.uniform2f(U.uHalf, A, H / 2);
    gl.uniform1f(U.uUnit, H);
    gl.uniform1f(U.uReach, st.M);
    gl.uniform1f(U.uRw, clamp(H * 0.042, 1.35, 2.8));
    gl.uniform1f(U.uMotion, m);
    // the logo's own slow looping offsets
    const circ = function (rad, k, ph) { return [rad * Math.cos(k * th + ph), rad * Math.sin(k * th + ph)]; };
    const o1 = circ(0.62, 1, 0.0), o2 = circ(0.50, 2, 1.7), o3 = circ(0.55, 1, 2.6), o4 = circ(0.60, 1, 0.8);
    gl.uniform4f(U.uO12, o1[0], o1[1], o2[0], o2[1]);
    gl.uniform4f(U.uO34, o3[0], o3[1], o4[0], o4[1]);
    gl.uniform2f(U.uWarpAmp, H * (0.36 + 0.07 * Math.sin(2 * th + 0.3)), H * (0.13 + 0.03 * Math.sin(3 * th + 1.1)));
    gl.uniform3f(U.uHue, 8 * Math.sin(th + 0.3) + 3 * Math.sin(2 * th + 2.1), 7 * Math.sin(th + 3.9), 11);
    gl.uniform1f(U.uGlowHue, 9 * Math.sin(th + 4.0) + 3 * Math.sin(3 * th + 1.0));
    gl.uniform4f(U.uGlowW, 1 + m * 0.30 * Math.sin(3 * th + 0.5), 1 + m * 0.32 * Math.sin(2 * th + 2.0),
                           1 + m * 0.30 * Math.sin(2 * th + 4.1), 1 + m * 0.35 * Math.sin(th + 1.3));
    const ts = 0.13, tz = ts * t;
    gl.uniform4f(U.uTurb, H * 0.036 * (rm ? 0.5 : 1), 1 / (2.4 * H), 7.31 + tz, 7.31 + tz - ts * LOOP);
    gl.uniform1f(U.uTurbMix, Math.PI * 0.5 * (t / LOOP));
    const la = th + 0.9;
    gl.uniform2f(U.uLightDir, Math.cos(la), Math.sin(la));
    // the sheen crosses twice per loop, fading in and out at the ends of its path, at a slowly tilting angle
    const ph = (2 * t / LOOP) % 1, env = Math.sin(Math.PI * ph);
    const sa = -0.56 + 0.18 * Math.sin(th);
    const span = (A + H) * 1.25;
    gl.uniform2f(U.uSweepDir, Math.cos(sa), Math.sin(sa));
    gl.uniform3f(U.uSweep, -span + 2 * span * ph, H * 0.55, env * env);
    // focus drifts: the four soft zones swell and fade at their own pace and wander along the pill
    const k = H / 56;
    gl.uniform4f(U.uBlobA,
      k * 2.3 * (1 + m * 0.75 * Math.sin(th + 0.4)),
      k * 1.0 * (1 + m * 0.70 * Math.sin(2 * th + 1.9)),
      k * 1.2 * (1 + m * 0.75 * Math.sin(th + 3.6)),
      k * 0.9 * (1 + m * 0.70 * Math.sin(3 * th + 0.9)));
    gl.uniform4f(U.uBlobX, -0.12 + 0.30 * Math.sin(th + 1.0), -0.40 + 0.25 * Math.sin(2 * th + 0.2),
                           0.55 + 0.12 * Math.sin(2 * th + 0.4), -0.60 + 0.10 * Math.sin(th + 2.2));
    gl.uniform3f(U.uPtr, ptr.x, ptr.y, ptr.pres);
    gl.uniform2f(U.uDrag, ptr.dragX * ptr.pres, ptr.dragY * ptr.pres);
    ripBuf.fill(0);
    const tau = 1.05, ampK = rm ? 0.7 : 1;
    ripples.forEach(function (rp, i) {
      const age = (now - rp.t0) / 1000;
      const amp = Math.exp(-age / tau) * Math.min(1, age / 0.12) * ampK;
      ripBuf.set([rp.x, rp.y, age, amp], 4 * i);
    });
    gl.uniform4fv(U.uRip, ripBuf);
    gl.uniform1f(U.uRipV, 2.3 * (A + H / 2));
    gl.uniform1f(U.uFocus, st.focus);
    gl.uniform1f(U.uBusy, st.busy);
    gl.uniform3f(U.uGround, cols.ground[0], cols.ground[1], cols.ground[2]);
    gl.uniform3f(U.uFill, cols.fill[0], cols.fill[1], cols.fill[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    ctx.clearRect(0, 0, st.w, st.h);
    ctx.drawImage(R.canvas, 0, R.canvas.height - st.h, st.w, st.h, 0, 0, st.w, st.h);
  }

  // ---- public controls
  function setBusy(on) {
    on = !!on;
    if (!on && st.busyTarget > 0) addRipple(0, 0);               // done: a ripple, then back to the calm pace
    st.busyTarget = on ? 1 : 0;
    if (on) el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy');
    kick();
  }
  function ripple(x, y) { addRipple(+x || 0, +y || 0); }
  function setMotion(v) { st.motion = clamp(+v || 0, 0, 1); kick(); }
  function setSpeed(v) { st.speed = Math.max(0, +v || 0); kick(); }
  function setTime(s) { st.t = (((+s || 0) % LOOP) + LOOP) % LOOP; kick(); }
  function getTime() { return st.t; }
  function play() { st.playing = true; kick(); }
  function pause() { st.playing = false; }
  function resize() { inst.sizeKey = ''; kick(); }          // also re-reads the ground and fill colors
  let io = null, ro = null;
  function destroy() {
    if (inst.destroyed) return;
    inst.destroyed = true;
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    el.removeEventListener('keydown', onKey);
    el.removeEventListener('focus', onFocus);
    el.removeEventListener('blur', onBlur);
    if (io) io.disconnect();
    if (ro) ro.disconnect();
    const i = instances.indexOf(inst); if (i >= 0) instances.splice(i, 1);
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    el.classList.remove('is-live');
    delete el.__colobriButton;
  }

  // ---- wiring
  el.addEventListener('pointerdown', onDown, { passive: true });
  el.addEventListener('pointerup', onUp, { passive: true });
  el.addEventListener('pointercancel', onUp, { passive: true });
  el.addEventListener('keydown', onKey);
  el.addEventListener('focus', onFocus);
  el.addEventListener('blur', onBlur);
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(function () { inst.sizeKey = ''; kick(); }); ro.observe(el); }
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver(function (entries) {
      inst.visible = entries[entries.length - 1].isIntersecting;
      if (inst.visible) kick();
    }, { rootMargin: '120px' });
    io.observe(el);
  }
  if (reduce && reduce.addEventListener) reduce.addEventListener('change', kick);
  wirePointer();
  instances.push(inst);
  kick();
  return api;
}

function enhance(target, options) {
  let list;
  if (!target) list = document.querySelectorAll('.colobri-button');
  else if (typeof target === 'string') list = document.querySelectorAll(target);
  else if (target.length !== undefined) list = target;
  else list = [target];
  return Array.prototype.map.call(list, function (el) { return create(el, options); });
}

// buttons with the class colobri-button come alive on their own (data-colobri-manual opts out)
if (typeof document !== 'undefined') {
  const auto = function () {
    Array.prototype.forEach.call(document.querySelectorAll('.colobri-button:not([data-colobri-manual])'), function (el) { create(el); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else setTimeout(auto, 0);
}

function get(el) {
  if (typeof el === 'string') el = document.querySelector(el);
  return (el && el.__colobriButton) || null;
}

return Object.freeze({ create: create, enhance: enhance, get: get, isSupported: isSupported, version: VERSION, loopSeconds: LOOP, defaults: DEFAULTS });
}));
