// PDF text extraction + field parsing for EJOT Iso-Bar ECO vorbemessung PDFs.
// Uses pdfjs-dist to get real text from binary PDFs.
//
// The extraction step is structure-aware: items are grouped into LINES based
// on their Y-coordinate with a small tolerance, then sorted left→right inside
// each line.  This survives PDFs whose tabular layout puts label and value
// on the same baseline but in different columns.
//
// The parser tries multiple alternative regex patterns per field — labels in
// German engineering reports vary wildly (Bauvorhaben / Projekt / Objekt /
// Bauwerk / Vorhaben / BV …).  First match wins; missing fields are reported
// back to the UI as a German-labeled list so the user knows what's left to
// fill in by hand.

import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// ── Public: render the first page of a PDF (or pass through an image
// file) to a data URL.  Used by the plan annotator. ──────────────────
export async function loadPlanImage(file, { scale = 2, pageNum = 1 } = {}) {
  if (!file) throw new Error("no file");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) {
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error("Bilddatei konnte nicht gelesen werden"));
      r.readAsDataURL(file);
    });
    const dim = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
      im.onerror = () => rej(new Error("Bild konnte nicht decodiert werden"));
      im.src = dataUrl;
    });
    return { dataUrl, w: dim.w, h: dim.h, kind: "image" };
  }
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf, useSystemFonts: true }).promise;
  const page = await pdf.getPage(Math.min(pageNum, pdf.numPages));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height, kind: "pdf" };
}

// ── Public: extract text from a PDF, preserving line structure. ─────
//
// pdfjs returns text items as a flat stream of {str, transform: [a,b,c,d,e,f]}
// where (e,f) is the position.  We group items whose Y values are within
// ~3 px into a single visual line — this stitches subscripts back together
// and prevents column-aligned data from being split into too many lines.
export async function extractPdfText(file) {
  if (!file) return "";
  if (file.type === "text/plain" || /\.txt$/i.test(file.name)) {
    return await file.text();
  }
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf, useSystemFonts: true }).promise;
  const TOL_Y = 3;          // px tolerance for "same line"
  const COL_GAP = 24;       // px gap that we treat as a column boundary
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items
      .filter(it => "str" in it && it.str)
      .map(it => ({ x: it.transform[4], y: it.transform[5], s: it.str.trim() }))
      .filter(it => it.s.length > 0);
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));    // top → bottom, left → right
    // Group into lines using a Y tolerance
    const lines = [];
    for (const it of items) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - it.y) <= TOL_Y) last.parts.push(it);
      else lines.push({ y: it.y, parts: [it] });
    }
    for (const ln of lines) {
      ln.parts.sort((a, b) => a.x - b.x);
      // Insert a tab where the gap between two items is larger than COL_GAP
      // — preserves the column structure of tables in the raw text.
      let text = "";
      let prevX = null;
      for (const p of ln.parts) {
        if (prevX !== null && p.x - prevX > COL_GAP) text += "\t";
        else if (text) text += " ";
        text += p.s;
        prevX = p.x + p.s.length * 5;   // very rough end-x
      }
      out += text + "\n";
    }
    out += "\n";
  }
  return out;
}

// ── Feldmuster / Plausibilität liegen in pdfFields.js (ohne pdfjs, testbar) ──
export { FIELD_LABELS, PLAUSIBEL, istPlausibel, parseFields, buildDocument } from "./pdfFields.js";
