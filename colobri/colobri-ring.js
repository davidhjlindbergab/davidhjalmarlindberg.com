/*!
 * Colobri ring v1.0.0
 * The ring round a picked look, in the same light as the Colobri button (colobri-button.js v1.0.1): its iridescent ribbon laid round
 * the picture as it is round the pill (a pale wing tip at the left, blue and violet along the top, the head's blue at the right, a white
 * throat at the lower right, the warm belly along the bottom), focus that drifts in and out, a slow undulation, a light that trails the
 * pointer and drags the colors, a ripple of light when the look is picked, and the bird's electric-blue glow, strongest at the two ends
 * and absent under the belly, kept small so it never lights the pictures beside it.
 * Nothing is ever drawn over the picture: a grade is judged on it. A dark hairline keeps the ribbon clear of its edge.
 * One shared WebGL2 context draws every ring on the page; without WebGL2 the page's own CSS ring stays.
 * Copyright (c) 2026 David HJ Lindberg AB. All rights reserved. For use in COLOBRI products.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.ColobriRing = factory();
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const VERSION = '1.0.0';
const LOOP = 40;                        // the logo's and the button's loop: every ambient motion repeats seamlessly after 40 s

const DEFAULTS = Object.freeze({
  host: null,                           // the element the light's canvas goes in (positioned); null: the picture itself
  on: false,                            // shown: the picked look
  gap: 1.5,                             // the dark hairline between the picture and the ribbon (CSS px)
  width: 1.6,                           // the ribbon (CSS px)
  reach: 20,                            // how far the glow may reach beyond the picture (CSS px)
  glow: 1,                              // the glow's strength
  radius: null,                         // the picture's corner radius; null reads it from the page
  motion: 0.6,                          // as the button
  speed: 1,
  interactive: true,                    // pointer light, color drag and ripples
  quality: 1,
  maxPixelRatio: 2,
  startTime: null,                      // seconds into the loop; null staggers the rings
  ground: null,                         // the color behind the ring; null reads it from the page
  respectReducedMotion: true,
  zIndex: -1,                           // behind the picture (and, in a stacking strip, behind the pictures beside it)
  fadeIn: 450,                          // ms
  fadeOut: 320,
  liveClass: 'cr-live'                  // on the host while this ring is in charge, so the page can let its CSS ring go
});

/* ---------------------------------------------------------------------- *
 *  Shader: the button's light (colobri-button.js), round a rounded        *
 *  rectangle, outside the picture only                                   *
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
uniform vec2 uPic;          // the picture's half width and half height (CSS px)
uniform float uPicR;        // its corner radius
uniform vec2 uHalf;         // the ribbon's centre line: half width and half height
uniform float uRad;         // its corner radius
uniform float uUnit;        // the picture's height: the color flow, the noise, the pointer and the ripples scale with it
uniform float uLite;        // the light's own unit: the glow's falloff and the undulation scale with it
uniform float uReach;       // how far the canvas reaches beyond the picture (CSS px)
uniform float uGap;
uniform float uRw;          // ribbon width (CSS px)
uniform float uGlow;
uniform float uMotion;
uniform vec4 uO12, uO34;    // slow looping offsets: color flow (two scales), hue weather, glow breathing
uniform vec2 uWarpAmp;
uniform vec3 uHue;
uniform float uGlowHue;
uniform vec4 uGlowW;
uniform vec4 uTurb;         // amount (CSS px), 1/size, z, z - loop
uniform float uTurbMix;
uniform vec3 uSweep;
uniform vec2 uSweepDir, uLightDir;
uniform vec4 uBlobA;
uniform vec4 uBlobX;
uniform vec3 uPtr;          // pointer (CSS px from the picture's centre), presence
uniform vec2 uDrag;
uniform vec4 uRip[4];       // ripples: x, y, age (s), amplitude
uniform float uRipV;
uniform float uFocus;
uniform vec3 uGround;
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
float turb(vec3 a, vec3 b){ return cos(uTurbMix) * snoise3(a) + sin(uTurbMix) * snoise3(b); }

// the logo's color model, as in the button: hue in degrees (185-398), saturation toward white, always at full value
vec3 hsv1(float hdeg, float s){
  vec3 p = abs(fract(hdeg / 360.0 + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
  return mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), s);
}
float sdRound(vec2 p, vec2 h, float r){
  vec2 q = abs(p) - h + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
// the nearest point on the ribbon's centre line: the glow is light emitted along it, as round the pill
vec2 nearestOnRound(vec2 p, vec2 h, float r){
  vec2 s = vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);
  vec2 a = abs(p), c = h - r, q = a - c, o;
  if (q.x > 0.0 && q.y > 0.0) { float l = length(q); o = c + (l > 1e-4 ? q / l : vec2(0.70710678)) * r; }
  else if (q.x > q.y) o = vec2(h.x, a.y);
  else o = vec2(a.x, h.y);
  return o * s;
}
float edgeF(float x){ return 1.0 / (1.0 + exp(clamp(-1.702 * x, -60.0, 60.0))); }

// the bird laid round the picture, exactly as round the pill: x, y in ring coordinates (-1..1), hue, saturation
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
  vec2 p = vec2(fc.x - 0.5*uRes.x, 0.5*uRes.y - fc.y) / uPx;     // CSS px from the picture's centre, y down
  float U = uUnit, Lu = uLite;
  float dp0 = sdRound(p, uPic, uPicR);                             // from the picture's edge
  if (dp0 < 0.0 || dp0 > uReach + 1.0) { outColor = vec4(0.0); return; }   // never over the picture
  float d0 = sdRound(p, uHalf, uRad);

  float n1 = fract(52.9829189 * fract(dot(fc, vec2(0.06711056, 0.00583715))));
  float n2 = fract(sin(dot(fc, vec2(12.9898, 78.233))) * 43758.5453);
  float dith = (n1 + n2 - 1.0) / 255.0;

  // ---- pointer and ripples, sized by the picture
  vec2 dpv = p - uPtr.xy; float dp2 = dot(dpv, dpv);
  float sF = 0.55 * U, sW = 0.85 * U, sD = 0.70 * U, Ur = 0.6 * U;
  float kFocus = uPtr.z * exp(-dp2 / (2.0*sF*sF));
  float kWide  = uPtr.z * exp(-dp2 / (2.0*sW*sW));
  float kDrag  = uPtr.z * exp(-dp2 / (2.0*sD*sD));
  float ring = 0.0; vec2 push = vec2(0.0);
  for (int i = 0; i < 4; i++){
    vec4 r = uRip[i];
    if (r.w <= 0.0) continue;
    vec2 dr = p - r.xy; float dist = length(dr);
    float rad = uRipV * r.z + 0.05 * Ur;
    float wOut = Ur * (0.20 + 0.18 * r.z), wIn = wOut + 0.35 * rad;
    float gsh = (dist - rad) / (dist < rad ? wIn : wOut);
    float gg = exp(-gsh*gsh) * r.w * (dist < rad ? 0.85 + 0.15 * exp(-gsh*gsh) : 1.0);
    float gp = (dist - rad) / (Ur * (0.55 + 0.25 * r.z));
    ring += gg; push += dr / max(dist, 1.0) * min(dist / (0.45*Ur), 1.0) * exp(-gp*gp) * r.w;
  }
  ring = min(ring, 1.2);
  push /= max(1.0, length(push));

  // ---- the light undulates: calm at the ribbon, freer in the glow
  vec3 tq = vec3(p * uTurb.y, 0.0);
  vec2 disp = vec2(turb(tq + vec3(0.0, 0.0, uTurb.z), tq + vec3(0.0, 0.0, uTurb.w)),
                   turb(tq + vec3(37.2, 11.9, uTurb.z + 5.3), tq + vec3(37.2, 11.9, uTurb.w + 5.3)));
  vec2 pp = p + disp * uTurb.x * mix(0.22, 1.0, smoothstep(0.0, 0.7*Lu, abs(d0))) * uMotion;
  float d = sdRound(pp, uHalf, uRad);
  vec2 c0 = pp / uHalf;
  vec2 ce = nearestOnRound(pp, uHalf, uRad) / uHalf;

  vec2 dir = normalize(c0 * vec2(1.0, 0.75) + vec2(1e-4));
  float lit = dot(dir, uLightDir);
  float sz = (dot(pp, uSweepDir) - uSweep.x) / uSweep.y;
  float sw = exp(-sz*sz) * uSweep.z * uMotion;

  // ---- the ribbon: finer toward the beak, a little fuller along the belly, swelling where a ripple passes
  float rw = uRw * (1.0 - 0.28 * smoothstep(0.5, 1.0, c0.x)) * (1.0 + 0.14 * smoothstep(0.2, 1.0, c0.y)) * (1.0 + 0.45 * min(ring, 1.0));
  float ra = -0.5 * rw, rb = 0.5 * rw;
  float outside = smoothstep(-0.5*rw, 0.6*rw, d);

  vec3 Cr = vec3(0.0);
  float o = 0.0, cov = 0.0;
  if (d < 0.5 * Lu) {
    vec2 s1 = pp / (2.4*U), s2 = pp / (1.05*U);
    vec2 w = uWarpAmp.x * vec2(snoise(s1 + uO12.xy), snoise(s1 + vec2(4.3, 1.9) - uO12.xy))
           + uWarpAmp.y * vec2(snoise(s2 + vec2(7.1, 3.3) + uO12.zw), snoise(s2 + vec2(1.5, 8.2) - uO12.zw));
    w *= uMotion;
    w += uDrag * kDrag + vec2(-dpv.y, dpv.x) * (0.20 * kDrag) + push * (0.16 * U);
    w.y *= 0.45;
    vec2 c = (pp + w) / uHalf;

    float sw0 = 0.0, H = 0.0, S = 0.0;
    for (int i = 0; i < NA; i++){
      vec2 e = (c - AN[i].xy) / vec2(0.27, 0.56);
      float k = exp(-0.5 * dot(e, e)) + 1e-6;
      sw0 += k; H += k * AN[i].z; S += k * AN[i].w;
    }
    H /= sw0; S /= sw0;
    float warm = smoothstep(318.0, 368.0, H);
    float hn = snoise(pp / (2.9*U) + vec2(11.0, 3.0) + uO34.xy);
    H += (uHue.x + uHue.y * (2.0*warm - 1.0) + uHue.z * hn) * mix(1.0, 0.45, warm) * uMotion;
    H += (20.0 * ring + 5.0 * kFocus) * mix(1.0, 0.6, warm);
    H = clamp(H, 185.0, 398.0);

    // ---- depth of field: the back and the tips drift in and out of focus, the belly stays sharp
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
    cov *= smoothstep(0.0, uGap, dp0);                           // the hairline beside the picture stays dark

    S = clamp(S, 0.0, 1.0);
    float Sr = S * max(1.0 - 0.20*sw - 0.20*max(lit, 0.0)*uMotion - (0.34*min(kFocus, 1.0) + 0.62*min(ring, 1.0)) - 0.22*uFocus, 0.12);
    Cr = hsv1(H, Sr);
    o = cov * clamp(0.90 + 0.10*lit*uMotion + 0.30*sw + 0.25*kFocus + 0.3*ring, 0.0, 1.0);
  }

  // ---- the glow: the button's, on the light's own smaller scale, gone well before the pictures beside it
  float eL = smoothstep(-0.50, -1.0, ce.x);
  float eR = smoothstep(0.64, 1.0, ce.x);
  float eT = smoothstep(0.30, -1.0, ce.y);
  float eB = smoothstep(0.10, 1.0, ce.y);
  float E = max(max(eL, 0.86*eR), 0.52*eT);
  E *= 1.0 - 0.92 * eB * (1.0 - max(eL, eR));
  float gn = snoise(pp / (2.2*U) + vec2(21.0, 7.0) + uO34.zw);
  float dOut = max(d - rb, 0.0);
  vec4 fall = exp(-dOut / (Lu * vec4(0.055, 0.15, 0.34, 0.70)));
  float boost = 1.5*kWide + 1.9*ring + 0.8*uFocus;
  vec4 wts = vec4(1.35, 0.70, 0.30, 0.10) * (1.0 + boost * vec4(1.0, 0.85, 0.45, 0.2));
  float L = dot(fall * uGlowW, wts) * E * uGlow;
  L *= 1.0 + (0.30*gn + 0.45*lit)*uMotion + 0.22*sw;
  float gl = 1.0 - exp(-L);
  gl = gl * gl / (gl + 0.025);
  float edge = 1.0 - smoothstep(0.35 * uReach, uReach, dp0);    // gone before the canvas border, following the picture's shape
  edge *= edge;
  float ga = gl * outside * (1.0 - cov) * edge;
  float Hg = 240.0 - 26.6 * pow(clamp((gl - 0.25) / 0.75, 0.0, 1.0), 1.5) + (uGlowHue + 7.0*gn) * uMotion;
  vec3 Cg = hsv1(Hg, 1.0);

  // ---- light is added to the ground, never laid over it (as in the button)
  vec3 G = uGround;
  vec3 F = min(Cr * o + (G + Cg * ga) * (1.0 - o), vec3(1.0));
  F += dith;
  vec3 up = (F - G) / max(vec3(1.0) - G, vec3(1e-3));
  vec3 dn = (G - F) / max(G, vec3(1e-3));
  float a = clamp(max(o, max(max(max(up.r, up.g), up.b), max(max(dn.r, dn.g), dn.b))), 0.0, 1.0);
  vec3 P = clamp(F - G * (1.0 - a), vec3(0.0), vec3(a));
  outColor = vec4(P, a);
}`;

/* ---------------------------------------------------------------------- *
 *  The shared renderer                                                    *
 * ---------------------------------------------------------------------- */
let R = null, rendererFailed = false;
const instances = [];
let raf = 0, lastNow = 0;
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('ColobriRing shader: ' + gl.getShaderInfoLog(s));
  return s;
}
function setupProgram(r) {
  const gl = r.gl;
  const vs = compile(gl, gl.VERTEX_SHADER, VS), fs = compile(gl, gl.FRAGMENT_SHADER, FS);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('ColobriRing program: ' + gl.getProgramInfoLog(prog));
  gl.deleteShader(vs); gl.deleteShader(fs);
  gl.useProgram(prog);
  r.vao = gl.createVertexArray(); gl.bindVertexArray(r.vao);
  gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
  r.U = {};
  for (let i = 0, n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS); i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    r.U[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(prog, info.name);
  }
  r.prog = prog; r.ready = true;
}
function getRenderer() {
  if (R) return R;
  if (rendererFailed || typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 2;
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl) { rendererFailed = true; return null; }
    R = { canvas: canvas, gl: gl, prog: null, vao: null, U: {}, ready: false, scale: 1, times: [] };
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); if (R) R.ready = false; }, false);
    canvas.addEventListener('webglcontextrestored', function () {
      try { setupProgram(R); instances.forEach(function (i) { i.sizeKey = ''; }); kick(); }
      catch (err) { rendererFailed = true; console.warn('[ColobriRing]', err.message || err); }
    }, false);
    setupProgram(R);
    return R;
  } catch (err) {
    rendererFailed = true; R = null;
    if (typeof console !== 'undefined') console.warn('[ColobriRing]', err && err.message ? err.message : err);
    return null;
  }
}
function isSupported() {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch (e) { return false; }
}
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
function findGround(el) {
  for (let n = el; n; n = n.parentElement) {
    const c = cssColor(getComputedStyle(n).backgroundColor);
    if (c && c[3] > 0.5) return [c[0], c[1], c[2]];
  }
  return [1, 1, 1];
}

function kick() { if (!raf && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(loop); }
function loop() {
  raf = 0;
  const now = performance.now();
  if (!R || !R.ready) { lastNow = 0; return; }
  const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
  lastNow = now;
  let drew = 0, waiting = 0;
  for (let i = instances.length - 1; i >= 0; i--) {
    const b = instances[i];
    if (!b.el.isConnected) { b.destroy(); continue; }        // (a strip drawn again: its old pictures' rings go with them)
    if (!b.active(now)) continue;
    if (!b.visible) { waiting++; continue; }
    if (b.step(now, dt)) drew++;
  }
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

let pointerWired = false;
function wirePointer() {
  if (pointerWired) return;
  pointerWired = true;
  document.addEventListener('pointermove', function (e) { for (let i = 0; i < instances.length; i++) instances[i].onMove(e); }, { passive: true });
  document.addEventListener('pointerout', function (e) { if (!e.relatedTarget) for (let i = 0; i < instances.length; i++) instances[i].onLeave(); }, { passive: true });
  window.addEventListener('blur', function () { for (let i = 0; i < instances.length; i++) instances[i].onLeave(); });
}

let stagger = 0;

/* ---------------------------------------------------------------------- *
 *  A ring                                                                 *
 * ---------------------------------------------------------------------- */
function create(target, options) {
  if (typeof target === 'string') target = document.querySelector(target);
  if (!target) throw new Error('ColobriRing.create: element not found');
  if (target.__colobriRing) return target.__colobriRing;
  const o = Object.assign({}, DEFAULTS);
  Object.keys(options || {}).forEach(function (k) { if (options[k] !== undefined) o[k] = options[k]; });
  const pic = target, host = o.host || pic;
  const focusEl = pic.closest('button, a, [tabindex]') || host;

  const st = {
    on: !!o.on, offAt: -1e9, t: 0, playing: true, speed: Math.max(0, +o.speed || 0),
    motion: clamp(+o.motion, 0, 1), motionCur: clamp(+o.motion, 0, 1), focus: 0, focusTarget: 0,
    pw: 0, ph: 0, M: 0, cw: 0, ch: 0, px: 1, w: 1, h: 1, x: 0, y: 0, rad: 0, shown: false, lastRipple: -1e9
  };
  st.t = o.startTime == null ? (stagger++ * 13.7) % LOOP : ((+o.startTime % LOOP) + LOOP) % LOOP;

  const api = { element: pic, supported: false, setOn: setOn, isOn: function () { return st.on; }, ripple: ripple, resize: resize, setTime: setTime, getTime: function () { return st.t; }, destroy: destroy };
  pic.__colobriRing = api;

  const r = getRenderer();
  if (!r) return api;                                            // the page's own CSS ring stays
  api.supported = true;
  if (o.liveClass) host.classList.add(o.liveClass);              // (from now on the page's CSS ring gives way to this one)

  const canvas = document.createElement('canvas');
  canvas.className = 'cr-light';
  canvas.setAttribute('aria-hidden', 'true');
  const cs = canvas.style;
  cs.position = 'absolute'; cs.display = 'block'; cs.pointerEvents = 'none'; cs.zIndex = String(o.zIndex); cs.opacity = '0';
  cs.left = cs.top = '0'; cs.width = cs.height = '0';             // (no size until it is first shown: a canvas's own 300 x 150 would widen the page)
  canvas.width = canvas.height = 1;
  host.appendChild(canvas);                                       // (last: a page that looks up its own canvas by tag finds that one first)
  const ctx = canvas.getContext('2d');

  const reduce = (o.respectReducedMotion && window.matchMedia) ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const ptr = { have: false, down: false, near: 0, tx: 0, ty: 0, x: 0, y: 0, vx: 0, vy: 0, pres: 0, lx: 0, ly: 0, lastT: 0, dragX: 0, dragY: 0 };
  let ground = [0, 0, 0];
  const ripples = [], ripBuf = new Float32Array(16);

  const inst = {
    el: pic, visible: true, sizeKey: '', destroyed: false,
    step: step, onMove: onMove, onLeave: onLeave, destroy: destroy,
    active: function (now) { return st.on || now - st.offAt < o.fadeOut + 80; }
  };

  function measure() {
    const pw = pic.offsetWidth, ph = pic.offsetHeight;
    let x = 0, y = 0;
    if (host !== pic) {
      if (pic.offsetParent === host) { x = pic.offsetLeft; y = pic.offsetTop; }
      else { const a = host.getBoundingClientRect(), b = pic.getBoundingClientRect(); x = b.left - a.left - host.clientLeft; y = b.top - a.top - host.clientTop; }
    }
    const dpr = Math.min((window.devicePixelRatio || 1), o.maxPixelRatio) * clamp(+o.quality || 1, 0.4, 1) * R.scale;
    const key = pw + 'x' + ph + '@' + x + ',' + y + '@' + dpr.toFixed(3);
    if (key === inst.sizeKey) return pw > 0 && ph > 0;
    inst.sizeKey = key;
    ground = (o.ground && cssColor(o.ground)) || null;
    ground = ground && ground[3] > 0.5 ? ground.slice(0, 3) : findGround(host === pic ? pic.parentElement || pic : host.parentElement || host);
    let rad = o.radius;
    if (rad == null) rad = parseFloat(getComputedStyle(pic).borderTopLeftRadius) || 0;
    st.rad = clamp(rad, 0, Math.min(pw, ph) / 2);
    st.pw = pw; st.ph = ph; st.x = x; st.y = y;
    st.M = Math.round(Math.max(4, +o.reach || 0));
    st.cw = pw + 2 * st.M; st.ch = ph + 2 * st.M;
    cs.left = (x - st.M) + 'px'; cs.top = (y - st.M) + 'px';
    cs.width = st.cw + 'px'; cs.height = st.ch + 'px';
    st.w = Math.max(1, Math.round(st.cw * dpr)); st.h = Math.max(1, Math.round(st.ch * dpr));
    if (canvas.width !== st.w || canvas.height !== st.h) { canvas.width = st.w; canvas.height = st.h; }
    st.px = st.w / Math.max(st.cw, 1);
    return pw > 0 && ph > 0;
  }
  function centreLine() { return o.gap + o.width / 2; }
  function sdRing(x, y) {                                         // from the ribbon's centre line (CSS px)
    const c = centreLine(), hx = st.pw / 2 + c, hy = st.ph / 2 + c, rr = st.rad + c;
    const qx = Math.abs(x) - hx + rr, qy = Math.abs(y) - hy + rr;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
  }
  function local(cx, cy) {
    const rc = pic.getBoundingClientRect();
    const sx = rc.width / Math.max(pic.offsetWidth, 1), sy = rc.height / Math.max(pic.offsetHeight, 1);
    return [(cx - (rc.left + rc.width / 2)) / (sx || 1), (cy - (rc.top + rc.height / 2)) / (sy || 1)];
  }
  function aim(x, y) {
    if (!ptr.have) { ptr.x = x; ptr.y = y; ptr.vx = ptr.vy = 0; ptr.lx = x; ptr.ly = y; ptr.lastT = performance.now(); }
    ptr.have = true; ptr.tx = x; ptr.ty = y;
  }
  function onMove(e) {
    if (inst.destroyed || !o.interactive || !st.on || !st.pw) return;
    if (e.pointerType === 'touch' && !ptr.down) return;
    const q = local(e.clientX, e.clientY), dd = sdRing(q[0], q[1]), reach = st.M + 0.35 * st.ph;
    if (dd > reach) { if (ptr.have && !ptr.down) { ptr.have = false; kick(); } return; }
    ptr.near = dd <= 0 ? 1 : 0.85 * Math.pow(1 - dd / reach, 1.5);
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
  function onFocus() { let fv = true; try { fv = focusEl.matches(':focus-visible'); } catch (err) { fv = true; } st.focusTarget = fv ? 1 : 0; kick(); }
  function onBlur() { st.focusTarget = 0; kick(); }
  function addRipple(x, y) {
    const now = performance.now();
    ripples.push({ x: x, y: y, t0: now }); st.lastRipple = now;
    while (ripples.length > 4) ripples.shift();
    kick();
  }

  function stepPointer(dt) {
    const k = 42, c = 2 * Math.sqrt(k);
    if (ptr.have) {
      const ax = (ptr.tx - ptr.x) * k - ptr.vx * c, ay = (ptr.ty - ptr.y) * k - ptr.vy * c;
      ptr.vx += ax * dt; ptr.vy += ay * dt; ptr.x += ptr.vx * dt; ptr.y += ptr.vy * dt;
    }
    const target = ptr.have ? (ptr.down ? 1.2 : ptr.near) : 0;
    ptr.pres += (target - ptr.pres) * Math.min(1, dt * (target > ptr.pres ? 4.5 : 1.6));
    if (ptr.pres < 1e-3 && !ptr.have) ptr.pres = 0;
    let dx = 0, dy = 0;
    if (ptr.have) {
      const now = performance.now(), e2 = Math.max(1e-3, (now - ptr.lastT) / 1000);
      dx = (ptr.tx - ptr.lx) / e2 * 0.22; dy = (ptr.ty - ptr.ly) / e2 * 0.22;
      const cap = 0.42 * st.ph, mag = Math.hypot(dx, dy);
      if (mag > cap) { dx *= cap / mag; dy *= cap / mag; }
      ptr.lx = ptr.tx; ptr.ly = ptr.ty; ptr.lastT = now;
    }
    const rate = Math.min(1, dt * 2.6);
    ptr.dragX += (dx - ptr.dragX) * rate; ptr.dragY += (dy - ptr.dragY) * rate;
  }

  function step(now, dt) {
    if (!measure()) return false;
    const rm = reduce && reduce.matches;
    st.focus += (st.focusTarget - st.focus) * Math.min(1, dt * 6);
    st.motionCur += (st.motion - st.motionCur) * Math.min(1, dt * 3);
    const sp = st.playing ? st.speed * (rm ? 0.5 : 1) : 0;
    st.t = (st.t + dt * sp) % LOOP;
    stepPointer(dt);
    for (let i = ripples.length - 1; i >= 0; i--) if ((now - ripples[i].t0) / 1000 > 4.5) ripples.splice(i, 1);
    draw(now, rm);
    if (st.on && !st.shown) {                                    // the first frame is drawn: let the light come up
      st.shown = true;
      cs.transition = 'opacity ' + o.fadeIn + 'ms ease';
      cs.opacity = '1';
    }
    return true;
  }

  function draw(now, rm) {
    const gl = R.gl, U = R.U;
    if (R.canvas.width < st.w || R.canvas.height < st.h) { R.canvas.width = Math.max(R.canvas.width, st.w); R.canvas.height = Math.max(R.canvas.height, st.h); }
    gl.viewport(0, 0, st.w, st.h);
    const c = centreLine(), A = st.pw / 2 + c, B = st.ph / 2 + c, H = clamp(st.ph, 36, 140);
    const Lu = Math.max(8, st.M * 0.9), k = (o.width / 2.35);
    const m = st.motionCur * (rm ? 0.75 : 1), t = st.t, th = 2 * Math.PI * t / LOOP;
    gl.uniform2f(U.uRes, st.w, st.h);
    gl.uniform1f(U.uPx, st.px);
    gl.uniform2f(U.uPic, st.pw / 2, st.ph / 2);
    gl.uniform1f(U.uPicR, st.rad);
    gl.uniform2f(U.uHalf, A, B);
    gl.uniform1f(U.uRad, st.rad + c);
    gl.uniform1f(U.uUnit, H);
    gl.uniform1f(U.uLite, Lu);
    gl.uniform1f(U.uReach, st.M);
    gl.uniform1f(U.uGap, o.gap);
    gl.uniform1f(U.uRw, o.width);
    gl.uniform1f(U.uGlow, +o.glow || 0);
    gl.uniform1f(U.uMotion, m);
    const circ = function (rad, kk, ph) { return [rad * Math.cos(kk * th + ph), rad * Math.sin(kk * th + ph)]; };
    const o1 = circ(0.62, 1, 0.0), o2 = circ(0.50, 2, 1.7), o3 = circ(0.55, 1, 2.6), o4 = circ(0.60, 1, 0.8);
    gl.uniform4f(U.uO12, o1[0], o1[1], o2[0], o2[1]);
    gl.uniform4f(U.uO34, o3[0], o3[1], o4[0], o4[1]);
    gl.uniform2f(U.uWarpAmp, H * (0.30 + 0.06 * Math.sin(2 * th + 0.3)), H * (0.11 + 0.025 * Math.sin(3 * th + 1.1)));
    gl.uniform3f(U.uHue, 8 * Math.sin(th + 0.3) + 3 * Math.sin(2 * th + 2.1), 7 * Math.sin(th + 3.9), 11);
    gl.uniform1f(U.uGlowHue, 9 * Math.sin(th + 4.0) + 3 * Math.sin(3 * th + 1.0));
    gl.uniform4f(U.uGlowW, 1 + m * 0.30 * Math.sin(3 * th + 0.5), 1 + m * 0.32 * Math.sin(2 * th + 2.0),
                           1 + m * 0.30 * Math.sin(2 * th + 4.1), 1 + m * 0.35 * Math.sin(th + 1.3));
    const ts = 0.13, tz = ts * t;
    gl.uniform4f(U.uTurb, Lu * 0.07 * (rm ? 0.5 : 1), 1 / (2.4 * H), 7.31 + tz, 7.31 + tz - ts * LOOP);
    gl.uniform1f(U.uTurbMix, Math.PI * 0.5 * (t / LOOP));
    const la = th + 0.9;
    gl.uniform2f(U.uLightDir, Math.cos(la), Math.sin(la));
    const ph = (2 * t / LOOP) % 1, env = Math.sin(Math.PI * ph);
    const sa = -0.56 + 0.18 * Math.sin(th), span = (A + B) * 1.25;
    gl.uniform2f(U.uSweepDir, Math.cos(sa), Math.sin(sa));
    gl.uniform3f(U.uSweep, -span + 2 * span * ph, H * 0.55, env * env);
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
    gl.uniform1f(U.uRipV, 2.3 * (A + B));
    gl.uniform1f(U.uFocus, st.focus);
    gl.uniform3f(U.uGround, ground[0], ground[1], ground[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    ctx.clearRect(0, 0, st.w, st.h);
    ctx.drawImage(R.canvas, 0, R.canvas.height - st.h, st.w, st.h, 0, 0, st.w, st.h);
  }

  // ---- public controls
  function setOn(on) {
    on = !!on;
    if (on === st.on) return;
    st.on = on;
    if (on) {
      if (performance.now() - st.lastRipple > 400) addRipple(0, 0);   // picked from the keyboard or by the page: a ripple all the same
      st.shown = false;                                              // (comes up once its first frame is drawn)
    } else {
      st.offAt = performance.now();
      cs.transition = 'opacity ' + o.fadeOut + 'ms ease';
      cs.opacity = '0';
      ptr.have = false; ptr.down = false;
    }
    kick();
  }
  function ripple(x, y) { addRipple(+x || 0, +y || 0); }
  function setTime(s) { st.t = (((+s || 0) % LOOP) + LOOP) % LOOP; kick(); }
  function resize() { inst.sizeKey = ''; kick(); }
  let io = null, ro = null;
  function destroy() {
    if (inst.destroyed) return;
    inst.destroyed = true;
    host.removeEventListener('pointerdown', onDown);
    host.removeEventListener('pointerup', onUp);
    host.removeEventListener('pointercancel', onUp);
    focusEl.removeEventListener('focus', onFocus);
    focusEl.removeEventListener('blur', onBlur);
    if (io) io.disconnect();
    if (ro) ro.disconnect();
    const i = instances.indexOf(inst); if (i >= 0) instances.splice(i, 1);
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (o.liveClass) host.classList.remove(o.liveClass);
    delete pic.__colobriRing;
  }

  host.addEventListener('pointerdown', onDown, { passive: true });
  host.addEventListener('pointerup', onUp, { passive: true });
  host.addEventListener('pointercancel', onUp, { passive: true });
  focusEl.addEventListener('focus', onFocus);
  focusEl.addEventListener('blur', onBlur);
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(function () { inst.sizeKey = ''; kick(); }); ro.observe(pic); }
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver(function (entries) { inst.visible = entries[entries.length - 1].isIntersecting; if (inst.visible) kick(); }, { rootMargin: '80px' });
    io.observe(pic);
  }
  if (reduce && reduce.addEventListener) reduce.addEventListener('change', kick);
  wirePointer();
  instances.push(inst);
  if (st.on) addRipple(0, 0);
  kick();
  return api;
}

function get(el) {
  if (typeof el === 'string') el = document.querySelector(el);
  return (el && el.__colobriRing) || null;
}

return Object.freeze({ create: create, get: get, isSupported: isSupported, version: VERSION, loopSeconds: LOOP, defaults: DEFAULTS });
}));
