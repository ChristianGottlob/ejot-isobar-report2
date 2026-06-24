// Enlarged detail crop of the raster — a single, zoomed-in sub-section that
// makes the MAXIMUM spacings of the system absolutely unambiguous:
//   - LH  = max. horizontal spacing of anchors / vertical cables
//   - LV  = max. vertical spacing of anchors / horizontal cables
//   - diagonal length (diagonal raster)
//   - Seilkreuz sub-spacing LH/2 · LV/2 (when Seilkreuze are used)
//
// Unlike RasterOverlay (which renders the whole facade, where spacings become
// tiny and unreadable), this shows just a 2×2-cell patch at a large fixed
// scale with bold, arrowed dimension lines.  When facades/areas differ, the
// caller selects the governing (largest-spacing) area and draws THAT here.

import React, { useMemo } from "react";

const R  = "#C8102E", BK = "#1A1A1A", GY = "#666", GL = "#999";
const BD = "#D8D6D4", WH = "#FFF", BLUE = "#1565C0";
const CABLE = "#1F2A33", SUBCABLE = "#7A8794";

function pf(v) { return parseFloat(String(v ?? "").replace(",", ".")); }
function fm(v, d = 2) { return Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : "–"; }

export default function DetailCrop({
  LH = 0.9, LV = 0.9,
  rasterType = "gitter",
  seilkreuztyp = "ohne",
  size = 420,
  areaLabel = null,    // e.g. "Fläche 2" — shown as a caption inside the frame
  governing = false,   // mark as the maßgebliche (worst-case) area
}) {
  const lh = Math.max(0.05, pf(LH) || 0.9);
  const lv = Math.max(0.05, pf(LV) || 0.9);
  const hasSK = seilkreuztyp && seilkreuztyp !== "ohne";

  const drawV = rasterType === "gitter" || rasterType === "vertikal";
  const drawH = rasterType === "gitter" || rasterType === "horizontal";
  const drawD = rasterType === "diagonal";
  const skGrid = hasSK && rasterType === "gitter";   // sub-cables only in gitter

  // ── Fixed-scale 2×2-cell patch (3×3 anchors) ──
  const NC = 2, NR = 2;
  const cell = 132;                       // plan-pixels per cell — large & legible
  const gridW = NC * cell, gridH = NR * cell;
  const ML = 96, MR = 34, MT = hasSK ? 56 : 34, MB = 92;
  const vbW = ML + gridW + MR;
  const vbH = MT + gridH + MB;
  const gx = ML, gy = MT;

  const xs = useMemo(() => Array.from({ length: NC + 1 }, (_, c) => gx + c * cell), [gx]);
  const ys = useMemo(() => Array.from({ length: NR + 1 }, (_, r) => gy + r * cell), [gy]);

  const anchorR = 7;
  const cw = 2.4, subW = 1.4;
  const dimCol = R, dimW = 1.6, fs = 17, fsSub = 11.5;
  const arrow = `arrow-${rasterType}-${hasSK ? "sk" : "no"}`;

  // Dimension geometry — one full cell each, set off from the grid.
  const dimBY = gy + gridH + 40;          // LH dimension line (below grid)
  const dimLX = gx - 44;                  // LV dimension line (left of grid)

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%"
      style={{ maxWidth: size, display: "block", margin: "0 auto" }}
      role="img" aria-label="Detailausschnitt Maximalabstände">
      <defs>
        <marker id={arrow} markerWidth="9" markerHeight="9" refX="5" refY="4.5"
          orient="auto" markerUnits="userSpaceOnUse">
          <path d="M1,1 L8,4.5 L1,8" fill="none" stroke={dimCol} strokeWidth="1.4" />
        </marker>
      </defs>

      {/* Frame + caption */}
      <rect x={gx - 16} y={gy - (hasSK ? 40 : 16)} width={gridW + 32}
        height={gridH + (hasSK ? 56 : 32)} fill="#FBFAF8" stroke={BD} strokeWidth="1" rx="6" />
      {areaLabel && (
        <text x={gx - 16 + 8} y={gy - (hasSK ? 40 : 16) - 7} fontSize={fsSub} fontWeight="700"
          fill={governing ? R : GY} fontFamily="Segoe UI, system-ui, sans-serif">
          {governing ? "▣ Maßgebliche Fläche – größte Abstände" : "▣ " + areaLabel}
        </text>
      )}

      {/* Cables */}
      {drawV && xs.map((x, i) => (
        <line key={`v${i}`} x1={x} y1={gy} x2={x} y2={gy + gridH} stroke={CABLE} strokeWidth={cw} />
      ))}
      {drawH && ys.map((y, i) => (
        <line key={`h${i}`} x1={gx} y1={y} x2={gx + gridW} y2={y} stroke={CABLE} strokeWidth={cw} />
      ))}
      {drawD && Array.from({ length: NC }).map((_, c) =>
        Array.from({ length: NR }).map((_, r) => (
          <g key={`d${c}-${r}`} stroke={CABLE} strokeWidth={cw}>
            <line x1={gx + c * cell} y1={gy + r * cell} x2={gx + (c + 1) * cell} y2={gy + (r + 1) * cell} />
            <line x1={gx + (c + 1) * cell} y1={gy + r * cell} x2={gx + c * cell} y2={gy + (r + 1) * cell} />
          </g>
        ))
      )}

      {/* Seilkreuz sub-cables (gitter only) — at mid-cell */}
      {skGrid && (
        <g stroke={SUBCABLE} strokeWidth={subW} strokeDasharray="5,4" opacity="0.9">
          {Array.from({ length: NC }).map((_, c) => (
            <line key={`sv${c}`} x1={gx + (c + 0.5) * cell} y1={gy} x2={gx + (c + 0.5) * cell} y2={gy + gridH} />
          ))}
          {Array.from({ length: NR }).map((_, r) => (
            <line key={`sh${r}`} x1={gx} y1={gy + (r + 0.5) * cell} x2={gx + gridW} y2={gy + (r + 0.5) * cell} />
          ))}
        </g>
      )}

      {/* Seilkreuz markers */}
      {hasSK && (() => {
        const pts = [];
        if (rasterType === "gitter") {
          for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) pts.push([gx + (c + 0.5) * cell, gy + (r + 0.5) * cell]);
          for (let c = 0; c < NC; c++) for (let r = 0; r <= NR; r++) pts.push([gx + (c + 0.5) * cell, gy + r * cell]);
          for (let c = 0; c <= NC; c++) for (let r = 0; r < NR; r++) pts.push([gx + c * cell, gy + (r + 0.5) * cell]);
        } else if (rasterType === "diagonal") {
          for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) pts.push([gx + (c + 0.5) * cell, gy + (r + 0.5) * cell]);
        }
        const s = 5;
        return pts.map(([x, y], i) => (
          <rect key={`sk${i}`} x={x - s} y={y - s} width={s * 2} height={s * 2}
            fill="none" stroke={BLUE} strokeWidth="1.4" rx="0.5" opacity="0.9" />
        ));
      })()}

      {/* Anchors (CAD crosshair) */}
      {xs.map((x, ci) => ys.map((y, ri) => (
        <g key={`a${ci}-${ri}`}>
          <line x1={x - anchorR * 1.7} y1={y} x2={x + anchorR * 1.7} y2={y} stroke={R} strokeWidth="1.4" />
          <line x1={x} y1={y - anchorR * 1.7} x2={x} y2={y + anchorR * 1.7} stroke={R} strokeWidth="1.4" />
          <circle cx={x} cy={y} r={anchorR} fill={WH} stroke={R} strokeWidth="2" />
        </g>
      )))}

      {/* ── LH dimension (bottom, one cell) ── */}
      <g fontFamily="Segoe UI, system-ui, sans-serif">
        <line x1={gx} y1={gy + gridH} x2={gx} y2={dimBY + 6} stroke={dimCol} strokeWidth="0.8" opacity="0.5" />
        <line x1={gx + cell} y1={gy + gridH} x2={gx + cell} y2={dimBY + 6} stroke={dimCol} strokeWidth="0.8" opacity="0.5" />
        <line x1={gx + 1} y1={dimBY} x2={gx + cell - 1} y2={dimBY} stroke={dimCol} strokeWidth={dimW}
          markerStart={`url(#${arrow})`} markerEnd={`url(#${arrow})`} />
        <text x={gx + cell / 2} y={dimBY + fs + 4} textAnchor="middle" fontSize={fs} fontWeight="800" fill={dimCol}>
          L<tspan baselineShift="sub" fontSize={fs * 0.7}>H</tspan> = {fm(lh)} m
        </text>
        <text x={gx + cell / 2} y={dimBY + fs + fsSub + 6} textAnchor="middle" fontSize={fsSub} fontWeight="600" fill={GY}>
          max. Abstand horizontal
        </text>
      </g>

      {/* ── LV dimension (left, one cell) ── */}
      <g fontFamily="Segoe UI, system-ui, sans-serif">
        <line x1={gx} y1={gy} x2={dimLX - 6} y2={gy} stroke={dimCol} strokeWidth="0.8" opacity="0.5" />
        <line x1={gx} y1={gy + cell} x2={dimLX - 6} y2={gy + cell} stroke={dimCol} strokeWidth="0.8" opacity="0.5" />
        <line x1={dimLX} y1={gy + 1} x2={dimLX} y2={gy + cell - 1} stroke={dimCol} strokeWidth={dimW}
          markerStart={`url(#${arrow})`} markerEnd={`url(#${arrow})`} />
        <text x={dimLX - 8} y={gy + cell / 2} textAnchor="middle" fontSize={fs} fontWeight="800" fill={dimCol}
          transform={`rotate(-90 ${dimLX - 8} ${gy + cell / 2})`}>
          L<tspan baselineShift="sub" fontSize={fs * 0.7}>V</tspan> = {fm(lv)} m
        </text>
        <text x={dimLX - fs - 6} y={gy + cell / 2} textAnchor="middle" fontSize={fsSub} fontWeight="600" fill={GY}
          transform={`rotate(-90 ${dimLX - fs - 6} ${gy + cell / 2})`}>
          max. Abstand vertikal
        </text>
      </g>

      {/* ── Diagonal length (diagonal raster only) ── */}
      {drawD && (() => {
        const diag = Math.sqrt(lh * lh + lv * lv);
        const mx = gx + cell / 2, my = gy + cell / 2;
        return (
          <text x={mx} y={my - 8} textAnchor="middle" fontSize={fsSub} fontWeight="800" fill={CABLE}
            fontFamily="Segoe UI, system-ui, sans-serif"
            stroke={WH} strokeWidth="3.5" paintOrder="stroke" strokeLinejoin="round"
            transform={`rotate(45 ${mx} ${my})`}>
            Ø {fm(diag)} m
          </text>
        );
      })()}

      {/* ── Seilkreuz sub-spacing note (top) ── */}
      {hasSK && (
        <text x={gx + gridW / 2} y={gy - 14} textAnchor="middle" fontSize={fsSub} fontWeight="700" fill={BLUE}
          fontFamily="Segoe UI, system-ui, sans-serif">
          + Seilkreuze · Zwischenseil L<tspan baselineShift="sub" fontSize={fsSub * 0.7}>H</tspan>/2 = {fm(lh / 2)} m · L<tspan baselineShift="sub" fontSize={fsSub * 0.7}>V</tspan>/2 = {fm(lv / 2)} m
        </text>
      )}

      {/* Legend footer */}
      <text x={vbW - 4} y={vbH - 5} textAnchor="end" fontSize={fsSub * 0.92} fill={GL}
        fontFamily="Segoe UI, system-ui, sans-serif">
        <tspan fill={R} fontWeight="700">✚</tspan> Halterung (Iso-Bar ECO){hasSK ? <> · <tspan fill={BLUE} fontWeight="700">□</tspan> Seilkreuz</> : null}
      </text>
    </svg>
  );
}
