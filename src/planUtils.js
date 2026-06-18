// Shared geometry / annotation helpers for plan-based rendering.

export function nid() { return Math.random().toString(36).slice(2, 9); }

// Normalize an annotations payload into the canonical form
//   { facades: [...], windows: [...], doors: [...], scale: {p1,p2,m}|null }
// Accepts the legacy single-facade form  { facade: {x,y,w,h}, ... }  and
// migrates it transparently.  `scale` is an optional user-defined ruler:
// the line from p1 to p2 (in plan-pixel coords) corresponds to `m` meters,
// giving us pxPerM = hypot(p2-p1) / m.  When absent we fall back to the
// bbox-vs-typed-breite assumption.
export function normalizeAnnotations(a) {
  if (!a) return { facades: [], windows: [], doors: [], scale: null };
  const wins = Array.isArray(a.windows) ? a.windows : [];
  const drs  = Array.isArray(a.doors)   ? a.doors   : [];
  const scale = (a.scale && a.scale.p1 && a.scale.p2 && Number(a.scale.m) > 0) ? a.scale : null;
  if (Array.isArray(a.facades)) {
    return {
      facades: a.facades.map(f => f.id ? f : { ...f, id: nid() }),
      windows: wins,
      doors:   drs,
      scale,
    };
  }
  if (a.facade) {
    return {
      facades: [{ ...a.facade, id: a.facade.id || nid() }],
      windows: wins,
      doors:   drs,
      scale,
    };
  }
  return { facades: [], windows: wins, doors: drs, scale };
}

// Compute pxPerM (uniform — single value for X and Y).  Prefers explicit
// scale; falls back to bbox-vs-typed-dimensions; returns null if neither
// is determinable.
export function pxPerMeter(ann, bbox, fwM, fhM) {
  if (ann?.scale?.p1 && ann?.scale?.p2 && ann.scale.m > 0) {
    const dx = ann.scale.p2.x - ann.scale.p1.x;
    const dy = ann.scale.p2.y - ann.scale.p1.y;
    const px = Math.hypot(dx, dy);
    return px > 0 ? px / ann.scale.m : null;
  }
  if (!bbox || bbox.w <= 0 || bbox.h <= 0) return null;
  const sx = fwM > 0 ? bbox.w / fwM : null;
  const sy = fhM > 0 ? bbox.h / fhM : null;
  // Average if both available, else pick whichever exists
  if (sx && sy) return (sx + sy) / 2;
  return sx || sy;
}

export function pointInRect(p, r, slack = 0) {
  return !!r && p.x >= r.x - slack && p.x <= r.x + r.w + slack &&
                p.y >= r.y - slack && p.y <= r.y + r.h + slack;
}
export function pointInAny(p, rects, slack = 0) {
  for (const r of rects) if (pointInRect(p, r, slack)) return true;
  return false;
}

// Smallest axis-aligned bbox enclosing all rects.  Returns null for empty.
export function unionBBox(rects) {
  if (!rects || rects.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Selection key helpers (stable string ids for items)
export function selKey(item) {
  return item.kind === "facade" ? `facade:${item.id || "0"}` : `${item.kind}:${item.id}`;
}

// Axis-aligned intersection area between two rectangles (0 if disjoint).
export function rectIntersectionArea(a, b) {
  if (!a || !b) return 0;
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

// Sample a line segment and report the pixel-length whose midpoint lies
// inside any greening rect AND outside every exclusion rect.  Used by the
// plan-aware material calc to estimate how much of each cable runs over
// actual greening (not over windows or beyond the wall).
export function lineInsideLengthPx(x1, y1, x2, y2, greenings, exclusions, samples = 100) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return 0;
  let insideCount = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = { x: x1 + dx * t, y: y1 + dy * t };
    if (pointInAny(p, greenings) && !pointInAny(p, exclusions)) insideCount++;
  }
  return (insideCount / (samples + 1)) * len;
}

// Net greening area in pixel² = Σ greening − Σ (greening ∩ exclusion).
// Does NOT account for overlap between greening rects (assumes user marks
// non-overlapping wall areas, which is the natural workflow).
export function greeningAreaPx(greenings, exclusions) {
  let total = 0;
  for (const g of greenings) {
    total += g.w * g.h;
    for (const e of exclusions) total -= rectIntersectionArea(g, e);
  }
  return Math.max(0, total);
}

// Build anchor/cable/Seilkreuz geometry per greening rectangle.  Returns
// concatenated lists ready for direct rendering.  This is the ONE source
// of truth used by both the renderers (RealisticFacade, RasterOverlay)
// and — semantically equivalent — by calcFacadeStats in App.jsx, so the
// preview always matches the material calculation.
//
// `cellW` / `cellH` are in plan-pixel space.  When the caller has a real
// scale (m → px), pass cellW = lh * pxM and cellH = lv * pxM and the grid
// will be uniform across rects.  In procedural mode the renderer can pass
// rect-relative cell sizes; the function only cares that all rects share
// the same cellW/cellH.
export function buildPlanGrid({
  greeningRects,
  exclusions = [],
  cellW, cellH,
  rasterType = "gitter",
  hasSeilkreuze = false,
  offsetBottomPx = 0,   // Startversatz der untersten Lage (px); >0 verankert das Raster bodenseitig
}) {
  const anchors = [];
  const cables = [];      // {x1,y1,x2,y2,dir,rectIndex}
  const subCables = [];   // only relevant for gitter+Seilkreuze (mid-cell extra cables)
  const skPts = [];

  const drawV = rasterType === "gitter" || rasterType === "vertikal";
  const drawH = rasterType === "gitter" || rasterType === "horizontal";
  const drawD = rasterType === "diagonal";

  const offPx = Math.max(0, offsetBottomPx || 0);
  greeningRects.forEach((g, rectIndex) => {
    const effH  = Math.max(0, g.h - offPx);
    const colsR = Math.max(0, Math.floor(g.w / cellW));
    const rowsR = Math.max(0, Math.floor(effH / cellH));
    const totalW = colsR * cellW;
    const totalH = rowsR * cellH;
    const ax0 = g.x + (g.w - totalW) / 2;
    // Mit Versatz: unterste Reihe offPx über dem Boden, Raster läuft nach oben.
    // Ohne Versatz: wie bisher mittig in der Fläche.
    const ay0 = offPx > 0 ? g.y + g.h - offPx - totalH : g.y + (g.h - totalH) / 2;

    // Anchors — inside THIS rect, outside every exclusion
    for (let c = 0; c <= colsR; c++) for (let r = 0; r <= rowsR; r++) {
      const p = { x: ax0 + c * cellW, y: ay0 + r * cellH, rectIndex };
      if (!pointInRect(p, g, 1)) continue;
      if (pointInAny(p, exclusions, -2)) continue;
      anchors.push(p);
    }

    // Cables
    if (drawV) {
      for (let c = 0; c <= colsR; c++) {
        cables.push({ x1: ax0 + c * cellW, y1: ay0, x2: ax0 + c * cellW, y2: ay0 + totalH, dir: "V", rectIndex });
      }
      if (hasSeilkreuze && rasterType === "gitter") {
        for (let c = 0; c < colsR; c++) {
          subCables.push({ x1: ax0 + (c + 0.5) * cellW, y1: ay0, x2: ax0 + (c + 0.5) * cellW, y2: ay0 + totalH, dir: "V", rectIndex });
        }
      }
    }
    if (drawH) {
      for (let r = 0; r <= rowsR; r++) {
        cables.push({ x1: ax0, y1: ay0 + r * cellH, x2: ax0 + totalW, y2: ay0 + r * cellH, dir: "H", rectIndex });
      }
      if (hasSeilkreuze && rasterType === "gitter") {
        for (let r = 0; r < rowsR; r++) {
          subCables.push({ x1: ax0, y1: ay0 + (r + 0.5) * cellH, x2: ax0 + totalW, y2: ay0 + (r + 0.5) * cellH, dir: "H", rectIndex });
        }
      }
    }
    if (drawD) {
      for (let c = 0; c < colsR; c++) for (let r = 0; r < rowsR; r++) {
        cables.push({ x1: ax0 + c * cellW,       y1: ay0 + r * cellH,       x2: ax0 + (c + 1) * cellW, y2: ay0 + (r + 1) * cellH, dir: "D", rectIndex });
        cables.push({ x1: ax0 + (c + 1) * cellW, y1: ay0 + r * cellH,       x2: ax0 + c * cellW,       y2: ay0 + (r + 1) * cellH, dir: "D", rectIndex });
      }
    }

    // Seilkreuze
    if (hasSeilkreuze) {
      const candidates = [];
      if (rasterType === "gitter") {
        for (let c = 0; c < colsR; c++) for (let r = 0; r < rowsR; r++) candidates.push({ x: ax0 + (c + 0.5) * cellW, y: ay0 + (r + 0.5) * cellH });
        for (let c = 0; c < colsR; c++) for (let r = 0; r <= rowsR; r++) candidates.push({ x: ax0 + (c + 0.5) * cellW, y: ay0 + r * cellH });
        for (let c = 0; c <= colsR; c++) for (let r = 0; r < rowsR; r++) candidates.push({ x: ax0 + c * cellW, y: ay0 + (r + 0.5) * cellH });
      } else if (rasterType === "diagonal") {
        for (let c = 0; c < colsR; c++) for (let r = 0; r < rowsR; r++) candidates.push({ x: ax0 + (c + 0.5) * cellW, y: ay0 + (r + 0.5) * cellH });
      }
      for (const p of candidates) {
        if (!pointInRect(p, g, 1)) continue;
        if (pointInAny(p, exclusions, -2)) continue;
        skPts.push(p);
      }
    }
  });

  return { anchors, cables, subCables, skPts };
}
