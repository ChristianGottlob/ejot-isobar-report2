// Realistic facade preview.
//   - Plan mode  (plan uploaded + at least one annotated greening rect):
//       the plan is the backdrop, one or more greening rectangles are
//       supported.  Anchors, cables, foliage are clipped to the UNION of
//       greening rects minus all window/door rects via an SVG mask.
//   - Procedural mode (no plan, or plan without facade rect):
//       generated plaster wall + auto-placed windows.  Same mask trick keeps
//       cables/foliage off the windows.
//
// Foliage system:
//   - Real leaf SHAPES (SVG paths), not ellipses.  Several variants per plant
//     family (Wurzelkletterer/Efeu vs. Spaltkletterer vs. Sprossranker etc.).
//   - Three-layer cluster (dark → mid → light) for depth.
//   - Subtle drop-shadow filter on the whole foliage group.
//   - Cables drawn AFTER foliage at high contrast → the raster type
//     (Gitter / Vertikal / Horizontal / Diagonal) is always readable.
//   - Raster-type badge inside the picture (icon + label).

import React, { useMemo } from "react";
import { normalizeAnnotations, pointInAny, unionBBox, pxPerMeter } from "./planUtils";

const R = "#C8102E", BK = "#1A1A1A";
const COL_FACADE_OUTLINE = "#2E7D32";  // green for greening-area outline (matches PlanAnnotator)

const FOLIAGE_PALETTES = {
  // dark = shadow base, mid = main, light = highlight, flower = optional accent
  S:  { dark: "#1E3D1F", mid: "#3A6E32", light: "#7CB561", flower: null,      stem: "#5A3D22" }, // Schlinger
  RB: { dark: "#1B3A1D", mid: "#3F6F35", light: "#83BD66", flower: "#D8A8C4", stem: "#5C402A" }, // Blattstielranker (Clematis)
  RS: { dark: "#143218", mid: "#345E2E", light: "#71A95A", flower: null,      stem: "#4E3722" }, // Sprossranker (Vitis)
  K:  { dark: "#1F3B1B", mid: "#3F6E2F", light: "#80B463", flower: "#D87A7A", stem: "#5A3520" }, // Spreizklimmer (Rose)
  WK: { dark: "#142E1A", mid: "#2E5C28", light: "#6CA257", flower: null,      stem: "#48311F" }, // Wurzelkletterer (Efeu)
  RH: { dark: "#1A3E1F", mid: "#3D7034", light: "#83BB62", flower: null,      stem: "#52371E" }, // Haftscheibe (Parthenocissus)
  default: { dark: "#1E3D1F", mid: "#3A6E32", light: "#7CB561", flower: null, stem: "#5A3D22" },
};

// Leaf path definitions in a 2×2 unit box centered around (0,0).  The leaf
// "stem" attaches near the bottom (positive y), tip points up (negative y).
const LEAF_SHAPES = {
  // Generic teardrop (Schlinger, Geißblatt)
  teardrop: "M0,-1 C-0.30,-0.85 -0.55,-0.40 -0.50,0.10 C-0.40,0.55 -0.10,0.85 0,0.90 C0.10,0.85 0.40,0.55 0.50,0.10 C0.55,-0.40 0.30,-0.85 0,-1 Z",
  // Ivy-style 3-lobed leaf (Hedera helix)
  ivy:      "M0,-1.05 C-0.30,-1.00 -0.55,-0.75 -0.60,-0.40 L-0.85,-0.10 L-0.55,0.10 C-0.45,0.30 -0.50,0.55 -0.35,0.75 L-0.18,0.75 L0,0.95 L0.18,0.75 L0.35,0.75 C0.50,0.55 0.45,0.30 0.55,0.10 L0.85,-0.10 L0.60,-0.40 C0.55,-0.75 0.30,-1.00 0,-1.05 Z",
  // Maple-ish 5-lobed (Parthenocissus tricuspidata)
  maple:    "M0,-1.05 L-0.25,-0.80 L-0.55,-0.85 L-0.45,-0.50 L-0.85,-0.30 L-0.55,-0.10 L-0.70,0.30 L-0.30,0.20 L-0.20,0.55 L0,0.40 L0.20,0.55 L0.30,0.20 L0.70,0.30 L0.55,-0.10 L0.85,-0.30 L0.45,-0.50 L0.55,-0.85 L0.25,-0.80 Z",
  // Round (Vitis / grape-like)
  round:    "M0,-0.90 C-0.55,-0.95 -0.95,-0.55 -0.95,0 C-0.95,0.55 -0.55,0.90 0,0.95 C0.55,0.90 0.95,0.55 0.95,0 C0.95,-0.55 0.55,-0.95 0,-0.90 Z",
  // Narrow oval (Clematis)
  oval:     "M0,-1.10 C-0.25,-0.80 -0.40,-0.30 -0.35,0.30 C-0.25,0.75 -0.10,0.95 0,0.95 C0.10,0.95 0.25,0.75 0.35,0.30 C0.40,-0.30 0.25,-0.80 0,-1.10 Z",
  // Compound-pinnate hint (Wisteria, Akebia) — single leaflet variant
  pinnate:  "M0,-1 C-0.20,-0.85 -0.35,-0.50 -0.30,-0.05 C-0.25,0.40 -0.05,0.85 0,0.95 C0.05,0.85 0.25,0.40 0.30,-0.05 C0.35,-0.50 0.20,-0.85 0,-1 Z",
};
const FORM_LEAF = {
  WK: ["ivy", "ivy", "round"],
  RH: ["maple", "maple", "ivy"],
  RS: ["round", "round", "ivy"],
  S:  ["teardrop", "teardrop", "oval", "pinnate"],
  RB: ["oval", "oval", "teardrop"],
  K:  ["teardrop", "teardrop", "oval"],
  default: ["teardrop", "oval", "round"],
};

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function pf(v) { return parseFloat(String(v ?? "").replace(",", ".")); }

// Clean procedural backdrop — no fictitious windows.  Just a plastered wall
// with subtle texture against a sky/ground gradient.  Real windows come from
// the user's plan annotations in plan mode.
function ProceduralBackdrop({ facadeBox, vbW, vbH }) {
  return (<>
    <rect x="0" y="0" width={vbW} height={vbH} fill="url(#fc-sky)" />
    <rect x="0" y={facadeBox.y + facadeBox.h} width={vbW} height={vbH - (facadeBox.y + facadeBox.h)} fill="url(#fc-ground)" />
    <rect x={facadeBox.x} y={facadeBox.y} width={facadeBox.w} height={facadeBox.h} fill="url(#fc-plaster)" />
    <rect x={facadeBox.x} y={facadeBox.y} width={facadeBox.w} height={facadeBox.h} fill="url(#fc-plasterTex)" />
    <rect x={facadeBox.x} y={facadeBox.y} width={facadeBox.w} height={facadeBox.h} fill="none" stroke="#9C8C6E" strokeWidth="1.2" />
    <rect x={facadeBox.x} y={facadeBox.y} width={Math.min(40, facadeBox.w * 0.06)} height={facadeBox.h} fill="#000" opacity="0.05" />
  </>);
}

// Small raster-type icon (svg path) — drawn inside the badge group
function RasterIcon({ type, size = 14, color = "#222" }) {
  const s = size, m = 1.5, e = s - m;
  const sw = 1.2;
  if (type === "vertikal") {
    return (<g stroke={color} strokeWidth={sw}>
      <line x1={s * 0.25} y1={m} x2={s * 0.25} y2={e} />
      <line x1={s * 0.50} y1={m} x2={s * 0.50} y2={e} />
      <line x1={s * 0.75} y1={m} x2={s * 0.75} y2={e} />
    </g>);
  }
  if (type === "horizontal") {
    return (<g stroke={color} strokeWidth={sw}>
      <line x1={m} y1={s * 0.25} x2={e} y2={s * 0.25} />
      <line x1={m} y1={s * 0.50} x2={e} y2={s * 0.50} />
      <line x1={m} y1={s * 0.75} x2={e} y2={s * 0.75} />
    </g>);
  }
  if (type === "diagonal") {
    return (<g stroke={color} strokeWidth={sw}>
      <line x1={m} y1={m} x2={e} y2={e} />
      <line x1={e} y1={m} x2={m} y2={e} />
      <line x1={s * 0.5} y1={m} x2={m} y2={s * 0.5} />
      <line x1={s * 0.5} y1={m} x2={e} y2={s * 0.5} />
    </g>);
  }
  // gitter (default)
  return (<g stroke={color} strokeWidth={sw}>
    <line x1={s * 0.30} y1={m} x2={s * 0.30} y2={e} />
    <line x1={s * 0.70} y1={m} x2={s * 0.70} y2={e} />
    <line x1={m} y1={s * 0.30} x2={e} y2={s * 0.30} />
    <line x1={m} y1={s * 0.70} x2={e} y2={s * 0.70} />
  </g>);
}

const RASTER_LABEL = {
  gitter: "Gitter (H+V)",
  vertikal: "Vertikal",
  horizontal: "Horizontal",
  diagonal: "Diagonalnetz",
};

export default function RealisticFacade({
  fW = 10, fH = 6, LH = 0.9, LV = 0.9,
  rasterType = "gitter", seilkreuztyp = "ohne",
  coverage = 65, maturity = "mature",
  windows = "auto", formCode = "S",
  showLabels = true, showAnchors = true,
  size = 760,
  plan = null, annotations = null,
  forceProcedural = false,
}) {
  const w = pf(fW) || 10;
  const h = pf(fH) || 6;
  const lh = pf(LH) || 0.9;
  const lv = pf(LV) || 0.9;
  const ann = useMemo(() => normalizeAnnotations(annotations), [annotations]);
  const havePlan = !forceProcedural && !!(plan && plan.dataUrl && ann.facades.length > 0);

  // ── Layout ──
  let vbW, vbH, facadeBox, greeningRects, exclusionRects, backdrop;
  if (havePlan) {
    vbW = plan.w;
    vbH = plan.h;
    facadeBox = unionBBox(ann.facades);
    greeningRects = ann.facades;
    exclusionRects = [...ann.windows, ...ann.doors];
    backdrop = (
      <image href={plan.dataUrl} x={0} y={0} width={plan.w} height={plan.h} preserveAspectRatio="none" />
    );
  } else {
    vbW = 800;
    const M = { top: 32, right: 32, bottom: 70, left: 32 };
    const innerW = vbW - M.left - M.right;
    const innerH = Math.max(140, innerW / Math.max(0.4, w / h));
    vbH = innerH + M.top + M.bottom;
    facadeBox = { x: M.left, y: M.top, w: innerW, h: innerH };
    greeningRects = [facadeBox];
    exclusionRects = [];   // no fictitious auto-windows — only user-annotated exclusions are real
    backdrop = <ProceduralBackdrop facadeBox={facadeBox} vbW={vbW} vbH={vbH} />;
  }

  // ── Anchor grid sized to facadeBox.  In plan mode, prefer the user's
  //    calibrated scale (annotations.scale) over the bbox-vs-typed ratio
  //    — that's the only way the cell spacing reflects real metres when
  //    the user marked only part of the facade. ──
  const cols = Math.max(1, Math.min(80, Math.floor(w / lh)));
  const rows = Math.max(1, Math.min(80, Math.floor(h / lv)));
  let cellW, cellH;
  if (havePlan) {
    const pxM = pxPerMeter(ann, facadeBox, w, h);
    if (pxM && pxM > 0) {
      cellW = lh * pxM;
      cellH = lv * pxM;
    } else {
      cellW = (lh * facadeBox.w) / w;
      cellH = (lv * facadeBox.h) / h;
    }
  } else {
    cellW = (lh * facadeBox.w) / w;
    cellH = (lv * facadeBox.h) / h;
  }
  const totalGridW = cols * cellW;
  const totalGridH = rows * cellH;
  const ax0 = facadeBox.x + (facadeBox.w - totalGridW) / 2;
  const ay0 = facadeBox.y + (facadeBox.h - totalGridH) / 2;

  const anchors = useMemo(() => {
    const out = [];
    for (let c = 0; c <= cols; c++) for (let r = 0; r <= rows; r++) {
      const p = { x: ax0 + c * cellW, y: ay0 + r * cellH };
      // greening: be inclusive at edges so the outer ring of anchors is rendered
      if (!pointInAny(p, greeningRects, 1)) continue;
      // exclusions: small negative slack so anchors barely touching a window edge still count
      if (pointInAny(p, exclusionRects, -2)) continue;
      out.push(p);
    }
    return out;
  }, [cols, rows, ax0, ay0, cellW, cellH, greeningRects, exclusionRects]);

  // ── Cables ──
  const cables = useMemo(() => {
    const out = [];
    const dV = rasterType === "gitter" || rasterType === "vertikal";
    const dH = rasterType === "gitter" || rasterType === "horizontal";
    const dD = rasterType === "diagonal";
    if (dV) for (let c = 0; c <= cols; c++) out.push({ x1: ax0 + c * cellW, y1: ay0, x2: ax0 + c * cellW, y2: ay0 + totalGridH, dir: "V" });
    if (dH) for (let r = 0; r <= rows; r++) out.push({ x1: ax0, y1: ay0 + r * cellH, x2: ax0 + totalGridW, y2: ay0 + r * cellH, dir: "H" });
    if (dD) {
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        out.push({ x1: ax0 + c * cellW, y1: ay0 + r * cellH, x2: ax0 + (c + 1) * cellW, y2: ay0 + (r + 1) * cellH, dir: "D" });
        out.push({ x1: ax0 + (c + 1) * cellW, y1: ay0 + r * cellH, x2: ax0 + c * cellW, y2: ay0 + (r + 1) * cellH, dir: "D" });
      }
    }
    return out;
  }, [rasterType, cols, rows, ax0, ay0, cellW, cellH, totalGridW, totalGridH]);

  // ── Foliage (real leaf shapes, three-layer cluster, raster-aware density) ──
  const palette = FOLIAGE_PALETTES[formCode] || FOLIAGE_PALETTES.default;
  const shapeKeys = FORM_LEAF[formCode] || FORM_LEAF.default;
  // Leaf base size — fewer-but-bigger looks less cartoony than many tiny dots
  const leafBase = Math.max(4, Math.min(facadeBox.w, facadeBox.h) *
    (maturity === "dense" ? 0.018 : maturity === "young" ? 0.012 : 0.015));

  const leaves = useMemo(() => {
    if (coverage <= 0) return [];
    const seed = hashStr(`${facadeBox.x}-${facadeBox.y}-${facadeBox.w}-${facadeBox.h}-${cols}-${rows}-${rasterType}-${coverage}-${maturity}-${formCode}-${greeningRects.length}-${exclusionRects.length}`);
    const rng = mulberry32(seed);
    const out = [];

    const pushLeaf = (x, y, mul, tone, layer) => {
      if (!pointInAny({ x, y }, greeningRects, -1)) return;
      if (pointInAny({ x, y }, exclusionRects, -1)) return;
      out.push({
        x, y,
        s: leafBase * mul * (0.85 + rng() * 0.45),
        rot: rng() * 360,
        shape: shapeKeys[Math.floor(rng() * shapeKeys.length)],
        color: palette[tone],
        layer,
      });
    };

    // Per-rect, place clusters along cables (clipped to that rect).
    // Coverage probability rises with proximity to the rect's bottom (rooted there).
    const pAt = (x, y) => {
      const rect = greeningRects.find(r =>
        x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
      );
      if (!rect) return 0;
      const climbFrac = (y - rect.y) / Math.max(1, rect.h); // 0 at top, 1 at bottom
      const weight = 0.55 + 0.45 * climbFrac;               // dense near ground
      return Math.min(1, (coverage / 100) * weight);
    };

    // Walk cables and drop clusters of leaves at each step
    const step = Math.max(8, Math.min(cellW, cellH) * 0.30);
    for (const ln of cables) {
      const dx = ln.x2 - ln.x1, dy = ln.y2 - ln.y1;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;
      const n = Math.max(2, Math.floor(len / step));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const cx = ln.x1 + dx * t;
        const cy = ln.y1 + dy * t;
        if (rng() > pAt(cx, cy)) continue;

        // Cluster: 4 dark (shadow), 6 mid, 3 light (highlight)
        const clusterRadius = leafBase * 1.4;
        const place = (count, tone, layer, mulMin, mulMax) => {
          for (let k = 0; k < count; k++) {
            const ang = rng() * Math.PI * 2;
            const rr = rng() * clusterRadius;
            pushLeaf(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr,
              mulMin + rng() * (mulMax - mulMin), tone, layer);
          }
        };
        place(4, "dark", 0, 1.05, 1.4);
        place(6, "mid",  1, 0.85, 1.15);
        place(3, "light", 2, 0.65, 0.95);
      }
    }

    // Ground-rooted tendrils (a few stem lines climbing up) — only at the bottom
    for (const rect of greeningRects) {
      const tendrils = Math.max(2, Math.round((rect.w / cellW) * 0.7));
      const groundY = rect.y + rect.h;
      for (let i = 0; i < tendrils; i++) {
        const x0 = rect.x + 8 + ((rect.w - 16) * (i + rng() * 0.5)) / tendrils;
        const climb = (0.25 + rng() * 0.5) * rect.h * Math.min(1, coverage / 100);
        const segs = 10;
        let cx = x0, cy = groundY;
        for (let s = 0; s < segs; s++) {
          cy -= climb / segs;
          cx += (rng() - 0.5) * 4;
          // smaller leaves on tendrils
          pushLeaf(cx, cy, 0.6 + rng() * 0.4, rng() < 0.35 ? "dark" : "mid", 1);
        }
      }
    }

    return out;
  }, [coverage, maturity, formCode, palette, shapeKeys, leafBase, facadeBox.x, facadeBox.y, facadeBox.w, facadeBox.h, cables, cellW, cellH, cols, rows, greeningRects, exclusionRects, rasterType]);

  const maskId = useMemo(() => `fc-mask-${Math.random().toString(36).slice(2, 9)}`, []);
  const shadowFilterId = useMemo(() => `fc-shadow-${Math.random().toString(36).slice(2, 9)}`, []);

  const anchorR = Math.max(2.8, Math.min(facadeBox.w, facadeBox.h) * 0.009);
  // Cables drawn AFTER foliage so the raster type stays readable at any coverage
  const cableMain = Math.max(0.9, anchorR * 0.28);
  const cableSub  = Math.max(0.5, anchorR * 0.18);
  const labelFs = Math.max(10, Math.min(facadeBox.w, facadeBox.h) * 0.025);

  // Sort leaves so darker (shadow) layer renders first, then mid, then light
  const sortedLeaves = useMemo(() => {
    return [...leaves].sort((a, b) => a.layer - b.layer);
  }, [leaves]);

  // Badge dimensions
  const badgeW = Math.max(140, vbW * 0.16);
  const badgeH = Math.max(28, vbH * 0.045);
  const badgeFs = Math.max(10, badgeH * 0.42);

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" style={{ maxWidth: size, display: "block" }} role="img" aria-label="Fassadenvorschau">
      <defs>
        <mask id={maskId}>
          {greeningRects.map((r, i) => (
            <rect key={`gm${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill="white" />
          ))}
          {exclusionRects.map((r, i) => (
            <rect key={`em${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill="black" />
          ))}
        </mask>
        {/* Drop shadow for the whole foliage cloud — gives a sense of depth */}
        <filter id={shadowFilterId} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation={Math.max(0.6, anchorR * 0.25)} />
          <feOffset dx={Math.max(0.5, anchorR * 0.18)} dy={Math.max(0.8, anchorR * 0.30)} result="off" />
          <feComponentTransfer><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="fc-plaster" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F1ECDE" /><stop offset="1" stopColor="#DCD3BD" />
        </linearGradient>
        <pattern id="fc-plasterTex" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="2" r="0.5" fill="#BBAE92" opacity="0.35" />
          <circle cx="4" cy="5" r="0.4" fill="#A99877" opacity="0.30" />
        </pattern>
        <linearGradient id="fc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CFE4F2" /><stop offset="1" stopColor="#EAF2F8" />
        </linearGradient>
        <linearGradient id="fc-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5C4A33" /><stop offset="1" stopColor="#3D2F1F" />
        </linearGradient>
        <linearGradient id="fc-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5B7C90" />
          <stop offset="0.6" stopColor="#3E5A6C" />
          <stop offset="1" stopColor="#2A4150" />
        </linearGradient>
        <radialGradient id="fc-anchorShade" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fc-anchorFace" cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#E94B65" />
          <stop offset="0.65" stopColor="#C8102E" />
          <stop offset="1" stopColor="#7C0A1D" />
        </radialGradient>
      </defs>

      {backdrop}

      {/* Foliage (masked + drop-shadowed) */}
      <g mask={`url(#${maskId})`} filter={`url(#${shadowFilterId})`}>
        {sortedLeaves.map((lf, i) => (
          <path key={i}
            d={LEAF_SHAPES[lf.shape] || LEAF_SHAPES.teardrop}
            transform={`translate(${lf.x},${lf.y}) rotate(${lf.rot}) scale(${lf.s})`}
            fill={lf.color}
            opacity={lf.layer === 0 ? 0.85 : lf.layer === 1 ? 0.94 : 1.0}
          />
        ))}
      </g>

      {/* Cables drawn AFTER foliage with strong contrast — raster type stays
          readable even at dense coverage.  We mask them so they don't cross
          windows/doors. */}
      <g mask={`url(#${maskId})`}>
        {cables.map((ln, i) => (
          <g key={`c${i}`}>
            {/* faint dark halo for legibility */}
            <line x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
              stroke="#000" strokeWidth={cableMain * 1.6} opacity="0.18" strokeLinecap="round" />
            <line x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
              stroke="#1F1F1F" strokeWidth={cableMain} opacity="0.75" strokeLinecap="round" />
          </g>
        ))}
      </g>

      {/* Anchors on top of everything */}
      {showAnchors && anchors.map((p, i) => (
        <g key={`a${i}`}>
          <ellipse cx={p.x + anchorR * 0.18} cy={p.y + anchorR * 0.25}
            rx={anchorR * 1.15} ry={anchorR * 0.7} fill="url(#fc-anchorShade)" />
          <circle cx={p.x} cy={p.y} r={anchorR} fill="url(#fc-anchorFace)" />
          <circle cx={p.x - anchorR * 0.3} cy={p.y - anchorR * 0.3}
            r={anchorR * 0.32} fill="#FFF" opacity="0.55" />
        </g>
      ))}

      {/* Plan-mode: green dashed outline of each greening area (matches PlanAnnotator) */}
      {havePlan && greeningRects.map((r, i) => (
        <rect key={`fo${i}`} x={r.x} y={r.y} width={r.w} height={r.h}
          fill="none" stroke={COL_FACADE_OUTLINE} strokeWidth={Math.max(1.2, vbW / 700)}
          strokeDasharray={`${vbW / 200},${vbW / 300}`} opacity="0.55" />
      ))}

      {/* Raster-type badge (so the chosen raster is identifiable at a glance) */}
      <g transform={`translate(${vbW - badgeW - 10}, 10)`}>
        <rect x="0" y="0" width={badgeW} height={badgeH} rx="4" fill="#FFFFFFE6" stroke="#00000020" />
        <g transform={`translate(${badgeH * 0.28}, ${(badgeH - badgeH * 0.6) / 2})`}>
          <RasterIcon type={rasterType} size={badgeH * 0.6} color="#222" />
        </g>
        <text x={badgeH + 4} y={badgeH * 0.43} fontSize={badgeFs * 0.7} fontFamily="Segoe UI, system-ui, sans-serif"
          fill="#666" fontWeight="600">Raster</text>
        <text x={badgeH + 4} y={badgeH * 0.82} fontSize={badgeFs * 0.95} fontFamily="Segoe UI, system-ui, sans-serif"
          fill="#1A1A1A" fontWeight="700">{RASTER_LABEL[rasterType] || rasterType}</text>
      </g>

      {/* Dimension labels */}
      {showLabels && (
        <g fontFamily="Segoe UI, system-ui, sans-serif" fill={BK}>
          <text x={facadeBox.x + facadeBox.w / 2}
                y={facadeBox.y + facadeBox.h + labelFs + 4}
                textAnchor="middle" fontSize={labelFs} fontWeight="700">
            {w.toFixed(1).replace(".", ",")} m
          </text>
          <text x={facadeBox.x - labelFs - 2} y={facadeBox.y + facadeBox.h / 2}
                textAnchor="middle" fontSize={labelFs} fontWeight="700"
                transform={`rotate(-90 ${facadeBox.x - labelFs - 2} ${facadeBox.y + facadeBox.h / 2})`}>
            {h.toFixed(1).replace(".", ",")} m
          </text>
        </g>
      )}
    </svg>
  );
}
