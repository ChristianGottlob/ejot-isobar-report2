// Technical raster overlay.
//   - Plan mode  (plan + at least one annotated greening rect): the plan is
//     the backdrop and we render a thin CAD-style overlay (crosshair anchors,
//     hair-line cables) clipped to the union of greening rects minus
//     window/door rects.  Each greening area is outlined in red dashed.
//   - Clean mode (no plan): a refined schematic with real facade aspect
//     ratio, a pale wall tint, dezent anchor marks, and one dimension per
//     axis.

import React, { useMemo } from "react";
import { normalizeAnnotations, pointInAny, unionBBox, pxPerMeter } from "./planUtils";

const R  = "#C8102E", BK = "#1A1A1A", GY = "#666";
const BD = "#D8D6D4", WH = "#FFF";
const PLASTER = "#F1ECDE";
const BLUE = "#1565C0";
const COL_FACADE_OUTLINE = "#2E7D32";  // green for greening-area outline

function pf(v) { return parseFloat(String(v ?? "").replace(",", ".")); }

export default function RasterOverlay({
  LH = 0.9, LV = 0.9, fW = 10, fH = 6,
  rasterType = "gitter", seilkreuztyp = "ohne",
  size = 420,
  plan = null, annotations = null,
  forceProcedural = false,
}) {
  const w = Math.max(0.5, pf(fW) || 10);
  const h = Math.max(0.5, pf(fH) || 6);
  const lh = Math.max(0.05, pf(LH) || 0.9);
  const lv = Math.max(0.05, pf(LV) || 0.9);
  const ann = useMemo(() => normalizeAnnotations(annotations), [annotations]);
  const havePlan = !forceProcedural && !!(plan && plan.dataUrl && ann.facades.length > 0);

  // ── Layout ──
  let vbW, vbH, facadeBox, greeningRects, exclusions, backdrop;
  if (havePlan) {
    vbW = plan.w;
    vbH = plan.h;
    facadeBox = unionBBox(ann.facades);
    greeningRects = ann.facades;
    exclusions = [...ann.windows, ...ann.doors];
    backdrop = (
      <image href={plan.dataUrl} x={0} y={0} width={plan.w} height={plan.h} preserveAspectRatio="none" />
    );
  } else {
    const aspect = w / h;
    const maxIn = 540;
    let innerW, innerH;
    if (aspect >= 1) { innerW = maxIn; innerH = maxIn / aspect; }
    else             { innerH = maxIn; innerW = maxIn * aspect; }
    const M = { top: 24, right: 28, bottom: 50, left: 56 };
    vbW = innerW + M.left + M.right;
    vbH = innerH + M.top + M.bottom;
    facadeBox = { x: M.left, y: M.top, w: innerW, h: innerH };
    greeningRects = [facadeBox];
    exclusions = [];
    backdrop = (
      <g>
        <rect x={facadeBox.x} y={facadeBox.y} width={facadeBox.w} height={facadeBox.h}
          fill={PLASTER} stroke="#B7AB8E" strokeWidth="0.8" />
      </g>
    );
  }

  // ── Grid (uses calibrated scale in plan mode when present) ──
  const cols = Math.max(1, Math.min(80, Math.floor(w / lh)));
  const rows = Math.max(1, Math.min(80, Math.floor(h / lv)));
  let cellW, cellH;
  if (havePlan) {
    const pxM = pxPerMeter(ann, facadeBox, w, h);
    if (pxM && pxM > 0) { cellW = lh * pxM; cellH = lv * pxM; }
    else                { cellW = (lh * facadeBox.w) / w; cellH = (lv * facadeBox.h) / h; }
  } else {
    cellW = (lh * facadeBox.w) / w;
    cellH = (lv * facadeBox.h) / h;
  }
  const totalGridW = cols * cellW;
  const totalGridH = rows * cellH;
  const ox = facadeBox.x + (facadeBox.w - totalGridW) / 2;
  const oy = facadeBox.y + (facadeBox.h - totalGridH) / 2;

  const hasV = rasterType === "gitter" || rasterType === "vertikal";
  const hasH = rasterType === "gitter" || rasterType === "horizontal";
  const hasD = rasterType === "diagonal";
  const hasSK = seilkreuztyp && seilkreuztyp !== "ohne";

  // ── Cable lines ──
  const lines = useMemo(() => {
    const out = [];
    const add = (x1, y1, x2, y2, sub = false) => out.push({ x1, y1, x2, y2, sub });
    if (hasV) {
      for (let c = 0; c <= cols; c++) add(ox + c * cellW, oy, ox + c * cellW, oy + totalGridH);
      if (hasSK && rasterType === "gitter")
        for (let c = 0; c < cols; c++) add(ox + (c + 0.5) * cellW, oy, ox + (c + 0.5) * cellW, oy + totalGridH, true);
    }
    if (hasH) {
      for (let r = 0; r <= rows; r++) add(ox, oy + r * cellH, ox + totalGridW, oy + r * cellH);
      if (hasSK && rasterType === "gitter")
        for (let r = 0; r < rows; r++) add(ox, oy + (r + 0.5) * cellH, ox + totalGridW, oy + (r + 0.5) * cellH, true);
    }
    if (hasD) {
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        add(ox + c * cellW, oy + r * cellH, ox + (c + 1) * cellW, oy + (r + 1) * cellH);
        add(ox + (c + 1) * cellW, oy + r * cellH, ox + c * cellW, oy + (r + 1) * cellH);
      }
    }
    return out;
  }, [hasV, hasH, hasD, hasSK, cols, rows, ox, oy, cellW, cellH, totalGridW, totalGridH, rasterType]);

  // ── Anchor points filtered to greening areas minus exclusions ──
  const anchors = useMemo(() => {
    const out = [];
    for (let c = 0; c <= cols; c++) for (let r = 0; r <= rows; r++) {
      const p = { x: ox + c * cellW, y: oy + r * cellH };
      if (!pointInAny(p, greeningRects, 1)) continue;
      if (pointInAny(p, exclusions, -2)) continue;
      out.push(p);
    }
    return out;
  }, [cols, rows, ox, oy, cellW, cellH, greeningRects, exclusions]);

  const skPts = useMemo(() => {
    if (!hasSK) return [];
    const out = [];
    if (rasterType === "gitter") {
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++)
        out.push({ x: ox + (c + 0.5) * cellW, y: oy + (r + 0.5) * cellH });
      for (let c = 0; c < cols; c++) for (let r = 0; r <= rows; r++)
        out.push({ x: ox + (c + 0.5) * cellW, y: oy + r * cellH });
      for (let c = 0; c <= cols; c++) for (let r = 0; r < rows; r++)
        out.push({ x: ox + c * cellW, y: oy + (r + 0.5) * cellH });
    } else if (rasterType === "diagonal") {
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++)
        out.push({ x: ox + (c + 0.5) * cellW, y: oy + (r + 0.5) * cellH });
    }
    return out
      .filter(p => pointInAny(p, greeningRects, 1))
      .filter(p => !pointInAny(p, exclusions, -2));
  }, [hasSK, rasterType, cols, rows, ox, oy, cellW, cellH, greeningRects, exclusions]);

  const maskId = useMemo(() => `ro-mask-${Math.random().toString(36).slice(2, 9)}`, []);

  // ── Sizes & styles ──
  const scaleRef = Math.min(facadeBox.w, facadeBox.h);
  const anchorR = havePlan
    ? Math.max(2.5, scaleRef * 0.008)
    : Math.max(3, Math.min(5.5, Math.min(cellW, cellH) * 0.13));
  const cableW = havePlan ? Math.max(0.6, anchorR * 0.18) : 1;
  const subCableW = cableW * 0.6;
  const skSz = havePlan ? Math.max(2, anchorR * 0.75) : Math.max(2.5, anchorR * 0.85);
  const dimFs = Math.max(9, scaleRef * 0.022);
  const cableColor = havePlan ? "#1F2A33" : "#4A4A4A";
  const subCableColor = havePlan ? "#4A5560" : "#B8B8B8";

  const dimY = facadeBox.y + facadeBox.h + dimFs * 0.8;
  const dimX = facadeBox.x - dimFs * 0.8;

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" style={{ maxWidth: size, display: "block" }} role="img" aria-label="Rasterdarstellung">
      <defs>
        <mask id={maskId}>
          {greeningRects.map((r, i) => (
            <rect key={`gm${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill="white" />
          ))}
          {exclusions.map((r, i) => (
            <rect key={`em${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill="black" />
          ))}
        </mask>
        <pattern id="ro-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#222" strokeWidth="0.8" opacity="0.25" />
        </pattern>
      </defs>

      {backdrop}

      {/* Plan-mode: green dashed outline marking each greening area (matches PlanAnnotator) */}
      {havePlan && greeningRects.map((r, i) => (
        <rect key={`fo${i}`} x={r.x} y={r.y} width={r.w} height={r.h}
          fill="none" stroke={COL_FACADE_OUTLINE} strokeWidth={Math.max(1.2, vbW / 700)}
          strokeDasharray={`${vbW / 200},${vbW / 300}`} opacity="0.7" />
      ))}

      {/* Cables (masked) */}
      <g mask={`url(#${maskId})`}>
        {lines.map((ln, i) => (
          <line key={i} x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
            stroke={ln.sub ? subCableColor : cableColor}
            strokeWidth={ln.sub ? subCableW : cableW}
            opacity={ln.sub ? 0.65 : 0.85} />
        ))}
      </g>

      {/* Seilkreuze */}
      <g>
        {skPts.map((p, i) => (
          <rect key={i} x={p.x - skSz} y={p.y - skSz} width={skSz * 2} height={skSz * 2}
            fill="none" stroke={BLUE} strokeWidth={Math.max(0.7, skSz * 0.18)} rx="0.5" opacity="0.85" />
        ))}
      </g>

      {/* Anchors */}
      {havePlan ? (
        <g>
          {anchors.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={anchorR} fill="#FFF" stroke={R} strokeWidth={Math.max(0.6, anchorR * 0.25)} />
              <line x1={p.x - anchorR * 1.6} y1={p.y} x2={p.x + anchorR * 1.6} y2={p.y} stroke={R} strokeWidth={Math.max(0.5, anchorR * 0.18)} />
              <line x1={p.x} y1={p.y - anchorR * 1.6} x2={p.x} y2={p.y + anchorR * 1.6} stroke={R} strokeWidth={Math.max(0.5, anchorR * 0.18)} />
            </g>
          ))}
        </g>
      ) : (
        <g>
          {anchors.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={anchorR} fill={R} />
              <circle cx={p.x} cy={p.y} r={anchorR * 0.4} fill={WH} opacity="0.55" />
            </g>
          ))}
        </g>
      )}

      {/* Plan-mode: ghost exclusion overlays */}
      {havePlan && exclusions.map((r, i) => (
        <g key={`ex${i}`}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#ro-hatch)" opacity="0.55" />
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="#222" strokeDasharray="3,3" strokeWidth="0.7" opacity="0.5" />
        </g>
      ))}

      {/* Dimensions */}
      <g fontFamily="Segoe UI, system-ui, sans-serif" fontSize={dimFs} fill={BK}>
        <line x1={ox} y1={dimY} x2={ox + cellW} y2={dimY} stroke={BK} strokeWidth="0.6" />
        <line x1={ox} y1={dimY - 3} x2={ox} y2={dimY + 3} stroke={BK} strokeWidth="0.6" />
        <line x1={ox + cellW} y1={dimY - 3} x2={ox + cellW} y2={dimY + 3} stroke={BK} strokeWidth="0.6" />
        <text x={ox + cellW / 2} y={dimY + dimFs} textAnchor="middle">LH = {lh.toFixed(2).replace(".", ",")} m</text>
        <text x={ox + totalGridW / 2} y={dimY + dimFs * 2 + 2} textAnchor="middle" fontWeight="700">
          {w.toFixed(1).replace(".", ",")} m
        </text>
        <line x1={dimX} y1={oy} x2={dimX} y2={oy + cellH} stroke={BK} strokeWidth="0.6" />
        <line x1={dimX - 3} y1={oy} x2={dimX + 3} y2={oy} stroke={BK} strokeWidth="0.6" />
        <line x1={dimX - 3} y1={oy + cellH} x2={dimX + 3} y2={oy + cellH} stroke={BK} strokeWidth="0.6" />
        <text x={dimX - 4} y={oy + cellH / 2} textAnchor="middle"
          transform={`rotate(-90 ${dimX - 4} ${oy + cellH / 2})`}>
          LV = {lv.toFixed(2).replace(".", ",")} m
        </text>
        <text x={dimX - dimFs * 1.4} y={oy + totalGridH / 2} textAnchor="middle" fontWeight="700"
          transform={`rotate(-90 ${dimX - dimFs * 1.4} ${oy + totalGridH / 2})`}>
          {h.toFixed(1).replace(".", ",")} m
        </text>
      </g>

      <g fontFamily="Segoe UI, system-ui, sans-serif" fontSize={Math.max(8, dimFs * 0.8)} fill={GY}>
        <text x={vbW - 6} y={vbH - 4} textAnchor="end">
          <tspan fill={R} fontWeight="700">●</tspan> {anchors.length} Anker
          {skPts.length > 0 && <> · <tspan fill={BLUE} fontWeight="700">□</tspan> {skPts.length} Seilkreuze</>}
          {exclusions.length > 0 && <> · {exclusions.length} Aussparungen</>}
          {havePlan && greeningRects.length > 1 && <> · {greeningRects.length} Flächen</>}
        </text>
      </g>
    </svg>
  );
}
