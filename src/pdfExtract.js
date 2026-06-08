// PDF text extraction + field parsing for EJOT Iso-Bar ECO vorbemessung PDFs.
// Uses pdfjs-dist to get real text from binary PDFs (the previous
// implementation called .text() on the binary blob and never matched anything).

import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// ── Public: render the first page of a PDF (or pass through an image
// file) to a data URL.  Used by the plan annotator so the architectural
// drawing can be used as a backdrop. ────────────────────────────────
export async function loadPlanImage(file, { scale = 2, pageNum = 1 } = {}) {
  if (!file) throw new Error("no file");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) {
    // Image: read directly, then probe natural size by loading it
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
  // PDF: render page to canvas
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf, useSystemFonts: true }).promise;
  const page = await pdf.getPage(Math.min(pageNum, pdf.numPages));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  // Plain white background so transparent areas don't break our overlays
  ctx.fillStyle = "#FFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height, kind: "pdf" };
}

// ── Public: read a File object and return raw text ──────────────────
export async function extractPdfText(file) {
  if (!file) return "";
  // Plain-text upload is still supported (useful for paste/debug).
  if (file.type === "text/plain" || /\.txt$/i.test(file.name)) {
    return await file.text();
  }
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf, useSystemFonts: true }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Group by Y so we keep line structure even though pdfjs returns items as a flat stream.
    const lines = new Map();
    for (const it of content.items) {
      if (!("str" in it)) continue;
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      const arr = lines.get(y) || [];
      arr.push({ x, s: it.str });
      lines.set(y, arr);
    }
    const ys = [...lines.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const parts = lines.get(y).sort((a, b) => a.x - b.x).map(p => p.s);
      out += parts.join(" ") + "\n";
    }
    out += "\n";
  }
  return out;
}

// ── Field catalog: each field has multiple alternative regexes ──────
// Patterns are matched against the cleaned text (multiline, case-insensitive).
// First match wins; whitespace is collapsed so we can use flexible patterns.
const PATTERNS = {
  bauvorhaben: [
    /Bauvorhaben[:\s]+([^\n]{2,80}?)(?:\s{2,}|$)/im,
    /Projekt[:\s]+([^\n]{2,80}?)(?:\s{2,}|$)/im,
    /Objekt[:\s]+([^\n]{2,80}?)(?:\s{2,}|$)/im,
  ],
  ort_plz: [
    /Ort\s*\/\s*PLZ[:\s]+([^\n]{2,80}?)(?:\s{2,}|$)/im,
    /(?:Ort|Standort)[:\s]+([^\n]{2,80}?)(?:\s{2,}|$)/im,
    /(\d{5}\s+[A-Za-zÄÖÜäöüß\-\s]{2,40})/m,
  ],
  datum: [
    /Datum[:\s]+(\d{1,2}\.\d{1,2}\.\d{2,4})/im,
    /(?:vom|am)\s+(\d{1,2}\.\d{1,2}\.\d{2,4})/im,
    /\b(\d{1,2}\.\d{1,2}\.20\d{2})\b/m,
  ],
  bearbeiter: [
    /Bearbeiter[:\s]+([A-Za-zÄÖÜäöüß][^\n]{1,50}?)(?:\s{2,}|$)/im,
    /(?:erstellt von|Sachbearbeiter)[:\s]+([^\n]{2,50}?)(?:\s{2,}|$)/im,
  ],
  dokNr: [
    /(?:Dok|Dokument)[\.\-\s]?Nr[\.:]?\s+([A-Z0-9\-\/]+)/im,
    /\b(VB-ISO-[0-9]{6,}-[0-9]+)\b/m,
  ],
  version: [
    /Version[:\s]+(V?\d+\.\d+)/im,
    /\bRev\.?\s*(V?\d+\.\d+)\b/im,
  ],

  // System / Untergrund
  produkt: [
    /SET\s+EJOT\s+Iso[-\s]?Bar\s+ECO\s+(\d{3})/im,
    /Iso[-\s]?Bar\s+ECO\s+(\d{3})/im,
    /Produkt[:\s]+([A-Za-z0-9\-\s]{2,40}?)(?:\s{2,}|$)/im,
  ],
  verankerungsgrund: [
    /Verankerungsgrund[:\s]+([^\n]{2,60}?)(?:\s{2,}|$)/im,
    /Untergrund[:\s]+([^\n]{2,60}?)(?:\s{2,}|$)/im,
  ],
  wdvs_dicke: [
    /WDVS[\s\-]?Dicke[^\d]{0,15}(\d{1,3}(?:[\.,]\d+)?)/im,
    /t[_\s]?WDVS[^\d]{0,10}(\d{1,3}(?:[\.,]\d+)?)/im,
    /(?:D[äa]mmstoff|D[äa]mmung)[\s\-]?Dicke[^\d]{0,15}(\d{1,3}(?:[\.,]\d+)?)/im,
  ],
  dicke_klebschicht: [
    /(?:t[_\s]?tol|Klebschicht|Mörtelbett)[^\d]{0,20}(\d{1,3}(?:[\.,]\d+)?)/im,
  ],
  verankerungstiefe: [
    /(?:Verankerungstiefe|h[_\s]?ef(?:,min)?)[^\d]{0,15}(\d{1,3}(?:[\.,]\d+)?)/im,
  ],
  gebaeudehoehe: [
    /Geb[aä]udeh[oö]he[^\d]{0,15}(\d{1,3}(?:[\.,]\d+)?)/im,
    /\bh[_\s]?Geb[^\d]{0,10}(\d{1,3}(?:[\.,]\d+)?)/im,
  ],
  druckfestigkeit: [
    /Druckfestigkeit[^\d]{0,15}(\d{1,3}(?:[\.,]\d+)?)/im,
    /(?:f[_\s]?ck|σ)[^\d]{0,15}(\d{1,3}(?:[\.,]\d+)?)\s*(?:N\/mm|MPa)/im,
  ],
  rohdichte: [
    /Rohdichte[^\d]{0,15}(\d{1,3}(?:[\.,]\d+)?)/im,
    /(?:ρ|rho)[^\d]{0,10}(\d{1,3}(?:[\.,]\d+)?)\s*(?:kg\/dm|t\/m)/im,
  ],
  windlastzone: [
    /Windlastzone[:\s]+(?:WZ\s*)?(\d|[IV]+)/im,
    /\bWZ\s*(\d)\b/m,
  ],
  gelaendekategorie: [
    /Gel[aä]ndekategorie[:\s]+(?:GK\s*)?([IV]+|\d)/im,
    /\bGK\s*([IV]+|\d)\b/m,
  ],

  // Raster
  LH: [
    /horizontaler?\s+Abstand\s*\(?LH\)?[^\d]{0,15}(\d(?:[\.,]\d+)?)/im,
    /\bLH[^\d]{0,8}(\d(?:[\.,]\d+)?)\s*m/im,
  ],
  LV: [
    /vertikaler?\s+Abstand\s*\(?LV\)?[^\d]{0,15}(\d(?:[\.,]\d+)?)/im,
    /\bLV[^\d]{0,8}(\d(?:[\.,]\d+)?)\s*m/im,
  ],
  stk_m2: [
    /(?:ISO|Iso)[\s\-]?Bar\s+ECO\s+pro\s+m[²2][^\d]{0,8}(\d+(?:[\.,]\d+)?)/im,
    /Anker\s+pro\s+m[²2][^\d]{0,8}(\d+(?:[\.,]\d+)?)/im,
  ],

  // Pflanze
  pflanze_botanisch: [
    /Pflanze\s*\(?botanisch\)?[:\s]+([A-Z][a-z]+\s+[a-z\-]+(?:\s+[a-z\-]+)?)/m,
    /(?:Art|Botanisch)[:\s]+([A-Z][a-z]+\s+[a-z\-]+)/m,
  ],
  pflanze_deutsch: [
    /Pflanze\s*\(?deutsch\)?[:\s]+([^\n]{2,60}?)(?:\s{2,}|$)/im,
  ],
  lastklasse: [
    /Lastklasse[:\s]+(?:LK\s*)?(\d)/im,
    /\bLK\s*(\d)\b/m,
  ],
  psi: [
    /[ψΨ]\s*(?:\(.*?\))?[^\d]{0,15}(\d[\.,]\d+)/m,
    /(?:Psi|Durchstr[oö]mung)[^\d]{0,15}(\d[\.,]\d+)/im,
  ],

  // Wind / Schnittgrößen
  ws: [
    /w[_\s]?s\s*\(?Windsog\)?[^\d]{0,15}(\d+(?:[\.,]\d+)?)/im,
    /\bws[^\d]{0,8}(\d+(?:[\.,]\d+)?)\s*kN/im,
  ],
  nek: [
    /N[_\s]?Ek\s*\(?Winddruck\)?[^\d]{0,15}(\d+(?:[\.,]\d+)?)/im,
  ],
  ned_z: [
    /N[_\s]?Ed[,\s]?z\s*\(?Zug\)?[^\d]{0,15}(\d+(?:[\.,]\d+)?)/im,
    /N[_\s]?Ed[,\s]?Zug[^\d]{0,15}(\d+(?:[\.,]\d+)?)/im,
  ],
  ned_d: [
    /N[_\s]?Ed[,\s]?d\s*\(?Druck\)?[^\d]{0,15}(\d+(?:[\.,]\d+)?)/im,
    /N[_\s]?Ed[,\s]?Druck[^\d]{0,15}(\d+(?:[\.,]\d+)?)/im,
  ],
  ved: [
    /V[_\s]?Ed\s*\(?Quer.*?\)?[^\d]{0,15}(\d+(?:[\.,]\d+)?)/im,
  ],
  vrd: [
    /V[_\s]?Rd\s*\(?Quertrag.*?\)?[^\d]{0,15}(\d+(?:[\.,]\d+)?)/im,
  ],

  // Nachweise (Ausnutzung)
  nw_zug: [
    /(?:Zug|N[_\s]?Ed[,\s]?z\s*\/\s*N[_\s]?Rd)[^\d]{0,30}(\d[\.,]\d{1,3})/im,
  ],
  nw_druck: [
    /(?:Druck|N[_\s]?Ed[,\s]?d\s*\/\s*N[_\s]?Rd[,\s]?d)[^\d]{0,30}(\d[\.,]\d{1,3})/im,
  ],
  nw_quer: [
    /(?:Quer|V[_\s]?Ed\s*\/\s*V[_\s]?Rd)[^\d]{0,30}(\d[\.,]\d{1,3})/im,
  ],
  nw_kombi: [
    /Kombination[^\d]{0,30}(\d[\.,]\d{1,3})/im,
  ],

  // Fassade
  fassadenlaenge: [
    /(?:Fassadenl[aä]nge|Fassadenbreite|Breite)[:\s]+(\d+(?:[\.,]\d+)?)/im,
  ],
  fassadenhoehe: [
    /Fassadenh[oö]he[:\s]+(\d+(?:[\.,]\d+)?)/im,
  ],
  geometrie_art: [
    /Geometrie\s*\/?\s*Begr[uü]nungsart[:\s]+([^\n]{2,60}?)(?:\s{2,}|$)/im,
  ],
};

// Product-id heuristic — turn extracted size ("260") into stable id
const PRODUCT_MAP = { "200": "eco200", "260": "eco260", "320": "eco320", "380": "eco380" };

const UNTERGRUND_HINTS = [
  [/Beton\s*C20\/25/i, "beton_c2025"],
  [/Beton\s*C25\/30/i, "beton_c2530"],
  [/Beton\s*C30\/37/i, "beton_c3037"],
  [/Beton\s*C50\/60/i, "beton_c5060"],
  [/Kalksand[\-\s]?Vollstein|KS\s*Vollstein|Vollstein\s*KS/i, "ks_vollstein"],
  [/Vollziegel|Mz\b/i, "vollziegel"],
  [/Leichtbeton(?!.*Hohl)/i, "lbv"],
  [/Hohlblock.*Leichtbeton|\bHbl\b/i, "hbl"],
  [/Kalksandlochstein|\bKSL\b/i, "ksl"],
  [/Hochlochziegel\s*I\b|\bHlz\s*I\b/i, "hlz1"],
  [/Hochlochziegel\s*II\b|\bHlz\s*II\b/i, "hlz2"],
  [/Porenbeton|\bPP\b/i, "pp"],
  [/Naturstein/i, "naturstein"],
];

const todayDe = () => new Date().toLocaleDateString("de-DE");
const todayDoc = () => `VB-ISO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-001`;

// Clean PDF text: collapse runs of whitespace into single space but keep newlines.
function clean(text) {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pickField(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return "";
}

// Run all patterns, return {values, hits, misses}
export function parseFields(rawText) {
  const text = clean(rawText || "");
  const values = {};
  const hits = [];
  const misses = [];
  for (const [key, patterns] of Object.entries(PATTERNS)) {
    const v = pickField(text, patterns);
    if (v) {
      values[key] = v;
      hits.push(key);
    } else {
      misses.push(key);
    }
  }

  // Normalize product id
  if (values.produkt && PRODUCT_MAP[values.produkt]) {
    values.produkt = PRODUCT_MAP[values.produkt];
  }
  // Map untergrund-label → id if we got a free-form label
  if (!values.verankerungsgrund || !/^[a-z_0-9]+$/.test(values.verankerungsgrund)) {
    for (const [re, id] of UNTERGRUND_HINTS) {
      if (re.test(text)) { values.verankerungsgrund = id; break; }
    }
  }
  // Normalise WZ/GK roman to digit
  if (values.windlastzone) {
    const m = { I: "1", II: "2", III: "3", IV: "4" };
    values.windlastzone = m[values.windlastzone] || values.windlastzone;
  }
  if (values.gelaendekategorie) {
    const m = { I: "I", II: "II", III: "III", IV: "IV", 1: "I", 2: "II", 3: "III", 4: "IV" };
    values.gelaendekategorie = m[values.gelaendekategorie] || values.gelaendekategorie;
  }
  // Default datum if absent
  if (!values.datum) values.datum = todayDe();

  return { values, hits, misses };
}

// Build a complete defaults object (everything the App needs) and overlay parsed values.
export function buildDocument(rawText) {
  const { values, hits, misses } = parseFields(rawText);
  const defaults = {
    bauvorhaben: "",
    ort_plz: "",
    datum: todayDe(),
    dokNr: todayDoc(),
    version: "V1.0",
    bearbeiter: "",
    produkt: "eco260",
    verankerungsgrund: "ks_vollstein",
    wdvs_dicke: "",
    gebaeudehoehe: "",
    gelaendekategorie: "II",
    druckfestigkeit: "12",
    rohdichte: "1.8",
    verankerungstiefe: "",
    dicke_klebschicht: "10",
    pflanze_botanisch: "",
    pflanze_deutsch: "",
    lastklasse: "3",
    seilfuehrung: "gitter",
    seilkreuztyp: "ohne",
    psi: "0.60",
    ws: "",
    nek: "",
    ned_z: "",
    ned_d: "",
    ved: "",
    vrd: "",
    LH: "0.9",
    LV: "0.9",
    stk_m2: "",
    nw_zug: "",
    nw_druck: "",
    nw_quer: "",
    nw_kombi: "",
    fassadenlaenge: "10",
    fassadenhoehe: "",
    windlastzone: "2",
    geometrie_art: "",
    fassaden: [{ name: "Fassade 1", breite: "10", hoehe: "6" }],
  };

  const merged = { ...defaults, ...values };
  if (!merged.fassadenhoehe) merged.fassadenhoehe = merged.gebaeudehoehe || "3";
  // Update first facade dims from parsed top-level
  merged.fassaden = [{
    name: "Fassade 1",
    breite: merged.fassadenlaenge,
    hoehe: merged.fassadenhoehe,
  }];

  return { document: merged, hits, misses, rawTextLength: rawText.length };
}
