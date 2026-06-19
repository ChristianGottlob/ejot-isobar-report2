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

// ── German labels for every parsed field (used by the UI) ──────────
export const FIELD_LABELS = {
  bauvorhaben:        "Bauvorhaben",
  ort_plz:            "Ort / PLZ",
  datum:              "Datum",
  bearbeiter:         "Bearbeiter",
  dokNr:              "Dokument-Nr.",
  version:            "Version",
  produkt:            "Produkt (EJOT Iso-Bar ECO)",
  verankerungsgrund:  "Verankerungsgrund",
  wdvs_dicke:         "WDVS-Dicke",
  dicke_klebschicht:  "Klebschicht-Dicke",
  verankerungstiefe:  "Verankerungstiefe",
  gebaeudehoehe:      "Gebäudehöhe",
  druckfestigkeit:    "Druckfestigkeit",
  rohdichte:          "Rohdichte",
  windlastzone:       "Windlastzone",
  gelaendekategorie:  "Geländekategorie",
  LH:                 "Horizontaler Abstand LH",
  LV:                 "Vertikaler Abstand LV",
  stk_m2:             "ISO-Bar ECO pro m²",
  pflanze_botanisch:  "Pflanze (botanisch)",
  pflanze_deutsch:    "Pflanze (deutsch)",
  lastklasse:         "Lastklasse",
  psi:                "ψ (Durchströmung)",
  ws:                 "Windsog ws",
  nek:                "Winddruck N_Ek",
  ned_z:              "Zug N_d",
  ned_d:              "Druck N_Ed",
  ved:                "Querkraft V_d",
  vrd:                "Bemessungswert Tragfähigkeit F_Rd",
  nw_zug:             "Nachweis Zug (N_d/F_Rd)",
  nw_druck:           "Nachweis Druck (N_Ed/F_Rd)",
  nw_quer:            "Nachweis Quer (V_d/F_Rd)",
  nw_kombi:           "Nachweis Quer/Zug",
  fassadenlaenge:     "Fassadenlänge",
  fassadenhoehe:      "Fassadenhöhe",
  geometrie_art:      "Geometrie / Begrünungsart",
};

// ── Pattern building blocks ─────────────────────────────────────────
// Flexible label-separator: any combo of ':', '=', '-', tabs, spaces.
const SEP = String.raw`[\s\t]*[:\-=]?[\s\t]*`;
// Optional surrounding parens or brackets around the value
// Decimal number: 12 / 12,5 / 12.5 / 0.12 / 1.234,56 (we keep as-is, pf() normalises)
const NUM = String.raw`(\d+(?:[.,]\d+)?(?:[.,]\d+)?)`;
// Up to N non-digit characters until the captured number (the label-to-number gap)
const GAP = (n) => `[^\\d\\n]{0,${n}}`;

// ── Field catalog — alternatives are tried in order ────────────────
const PATTERNS = {
  bauvorhaben: [
    /(?:Bauvorhaben|Projekt|Objekt|Vorhaben|Bauwerk|BV|Bauwerksbezeichnung)[\s\t]*[:\-=][\s\t]*([^\n\t]{2,100}?)(?:\t|\s{3,}|$)/im,
    /(?:Bauvorhaben|Projekt|Objekt|Bauwerk)[\s\t]+([A-ZÄÖÜ][^\n\t]{2,100}?)(?:\t|\s{3,}|$)/m,
  ],
  ort_plz: [
    /(?:Ort\s*\/\s*PLZ|PLZ\s*\/\s*Ort|Ort|Standort|Adresse|Anschrift)[\s\t]*[:\-=][\s\t]*([^\n\t]{2,100}?)(?:\t|\s{3,}|$)/im,
    /\b(\d{5}\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-\s/]{2,60})/m,             // any "12345 Stadtname"
  ],
  datum: [
    /(?:Datum|Stand|Bearbeitungsdatum)[\s\t]*[:\-=][\s\t]*(\d{1,2}\.\d{1,2}\.\d{2,4})/im,
    /(?:vom|am)[\s\t]+(\d{1,2}\.\d{1,2}\.\d{2,4})/im,
    /\b(\d{1,2}\.\d{1,2}\.20\d{2})\b/m,
  ],
  bearbeiter: [
    /(?:Bearbeiter|Sachbearbeiter|erstellt von|Verfasser|Geprüft von|Aufgestellt von|Ersteller)[\s\t]*[:\-=][\s\t]*([^\n\t]{2,80}?)(?:\t|\s{3,}|$)/im,
  ],
  dokNr: [
    /(?:Dok|Dokument|Projekt|Auftrags)[-\.\s]?(?:Nr|Nummer|nr)[\.\s:]*\s*([A-Z0-9\-\/_]{2,30})/im,
    /\b(VB[-\s]?ISO[-\s]?\d{6,}[-\s]?\d+)\b/im,
    /\bAuftragsnr\.?\s*([A-Z0-9\-\/_]{2,30})/im,
  ],
  version: [
    /(?:Version|Stand|Revision|Rev)[\.\s:]*\s*(V?\d+\.\d+)/im,
  ],

  // System / Untergrund
  produkt: [
    /SET\s*EJOT\s*Iso[-\s]?Bar\s*ECO\s*(\d{3})/im,
    /Iso[-\s]?Bar\s*ECO\s*(\d{3})/im,
    /\b(eco\s*\d{3})/im,
    /Produkt[\s\t]*[:\-=][\s\t]*([A-Za-z0-9\-\s]{2,40}?)(?:\t|\s{3,}|$)/im,
  ],
  verankerungsgrund: [
    /(?:Verankerungsgrund|Untergrund|Wandaufbau|Grundwand|Tragschicht|Verankerungsmaterial)[\s\t]*[:\-=][\s\t]*([^\n\t]{2,80}?)(?:\t|\s{3,}|$)/im,
  ],
  wdvs_dicke: [
    new RegExp(`(?:WDVS|D[äa]mmstoff|D[äa]mmung|Wärmedämmung)[\\s\\-]?(?:dicke|stärke|st\\.)${GAP(20)}${NUM}`, "im"),
    new RegExp(`t[_\\s]?WDVS${GAP(15)}${NUM}`, "im"),
  ],
  dicke_klebschicht: [
    new RegExp(`(?:t[_\\s]?tol|Klebschicht|Mörtelbett|Klebmörtel|Klebebett)${GAP(25)}${NUM}`, "im"),
  ],
  verankerungstiefe: [
    new RegExp(`(?:Verankerungstiefe|Einbindetiefe|h[_\\s]?ef(?:,min|min)?)${GAP(20)}${NUM}`, "im"),
  ],
  gebaeudehoehe: [
    new RegExp(`(?:Geb[aä]udeh[oö]he|Bauwerksh[oö]he|H[oö]he\\s+(?:Geb|Bauwerk))${GAP(20)}${NUM}`, "im"),
    new RegExp(`\\bh[_\\s]?Geb${GAP(12)}${NUM}`, "im"),
  ],
  druckfestigkeit: [
    new RegExp(`(?:Druckfestigkeit|f[_\\s]?ck|Festigkeit)${GAP(20)}${NUM}`, "im"),
    new RegExp(`σ${GAP(15)}${NUM}\\s*(?:N\\/mm|MPa)`, "im"),
  ],
  rohdichte: [
    new RegExp(`(?:Rohdichte|Trockenrohdichte|Dichte)${GAP(20)}${NUM}`, "im"),
    new RegExp(`(?:ρ|rho)${GAP(12)}${NUM}\\s*(?:kg\\/dm|t\\/m)`, "im"),
  ],
  windlastzone: [
    /Windlastzone[\s\t]*[:\-=]?\s*(?:WZ\s*)?(\d|[IV]+)/im,
    /\bWZ\s*(\d)\b/m,
    /Windzone\s*(\d)/im,
  ],
  gelaendekategorie: [
    /Gel[aä]ndekategorie[\s\t]*[:\-=]?\s*(?:GK\s*)?([IV]+|\d)/im,
    /\bGK\s*([IV]+|\d)\b/m,
    /Terrain[\s\-]?Kategorie\s*([IV]+|\d)/im,
  ],

  // Raster (LH / LV / Anker pro m²)
  LH: [
    new RegExp(`horizontaler?\\s+Abstand\\s*\\(?LH\\)?${GAP(20)}${NUM}`, "im"),
    new RegExp(`\\bLH${GAP(10)}${NUM}\\s*m`, "im"),
    new RegExp(`Maschenweite\\s+(?:horizontal|H)${GAP(15)}${NUM}`, "im"),
  ],
  LV: [
    new RegExp(`vertikaler?\\s+Abstand\\s*\\(?LV\\)?${GAP(20)}${NUM}`, "im"),
    new RegExp(`\\bLV${GAP(10)}${NUM}\\s*m`, "im"),
    new RegExp(`Maschenweite\\s+(?:vertikal|V)${GAP(15)}${NUM}`, "im"),
  ],
  stk_m2: [
    new RegExp(`(?:ISO|Iso)[\\s\\-]?Bar\\s+ECO\\s+pro\\s+m[²2]${GAP(10)}${NUM}`, "im"),
    new RegExp(`Anker\\s+pro\\s+m[²2]${GAP(10)}${NUM}`, "im"),
    new RegExp(`Befestigungsdichte${GAP(15)}${NUM}`, "im"),
  ],

  // Pflanze
  pflanze_botanisch: [
    /Pflanze\s*\(?botanisch\)?[\s\t]*[:\-=]\s*([A-Z][a-z]+\s+[a-z\-]+(?:\s+[a-z\-]+)?)/m,
    /(?:Art|Botanisch|Botanischer\s+Name)[\s\t]*[:\-=]\s*([A-Z][a-z]+\s+[a-z\-]+(?:\s+[a-z\-]+)?)/m,
  ],
  pflanze_deutsch: [
    /Pflanze\s*\(?deutsch\)?[\s\t]*[:\-=]\s*([^\n\t]{2,60}?)(?:\t|\s{3,}|$)/im,
    /Deutscher\s+Name[\s\t]*[:\-=]\s*([^\n\t]{2,60}?)(?:\t|\s{3,}|$)/im,
  ],
  lastklasse: [
    /Lastklasse[\s\t]*[:\-=]?\s*(?:LK\s*)?(\d)/im,
    /\bLK\s*(\d)\b/m,
  ],
  psi: [
    /[ψΨ]\s*(?:\(.*?\))?[^\d\n]{0,15}(\d[\.,]\d+)/m,
    /(?:Psi|Durchstr[oö]mung(?:sbeiwert)?|Permeabilität)[^\d\n]{0,20}(\d[\.,]\d+)/im,
  ],

  // Wind / Schnittgrößen
  ws: [
    new RegExp(`w[_\\s]*s\\s*\\(?(?:Windsog)?\\)?${GAP(20)}${NUM}\\s*kN`, "im"),
    new RegExp(`\\bw\\s*s${GAP(15)}${NUM}\\s*kN`, "im"),
    new RegExp(`Windsog${GAP(15)}${NUM}`, "im"),
  ],
  nek: [
    new RegExp(`N[_\\s]*Ek\\s*\\(?(?:Winddruck)?\\)?${GAP(20)}${NUM}`, "im"),
    new RegExp(`Winddruck${GAP(20)}${NUM}`, "im"),
  ],
  // Vorbemessung notation (Vd / Nd / NEd / FRd) first, Eurocode-Anbauteil
  // notation (N_Ed,z / N_Ed,d / V_Ed / V_Rd) kept as fallback for old PDFs.
  ned_z: [   // Nd – Zugkraft aus Windsog
    new RegExp(`\\bN\\s*d\\b[^\\n]*?${NUM}\\s*kN`, "im"),
    new RegExp(`N[_\\s]*Ed[,\\s]*z\\s*\\(?(?:Zug)?\\)?${GAP(20)}${NUM}`, "im"),
    new RegExp(`N[_\\s]*Ed[,\\s]*Zug${GAP(20)}${NUM}`, "im"),
    new RegExp(`Zugkraft${GAP(20)}${NUM}\\s*kN`, "im"),
  ],
  ned_d: [   // NEd – Druckkraft aus Winddruck
    new RegExp(`\\bN\\s*Ed\\b[^\\n]*?${NUM}\\s*kN`, "im"),
    new RegExp(`N[_\\s]*Ed[,\\s]*d\\s*\\(?(?:Druck)?\\)?${GAP(20)}${NUM}`, "im"),
    new RegExp(`N[_\\s]*Ed[,\\s]*Druck${GAP(20)}${NUM}`, "im"),
    new RegExp(`Druckkraft${GAP(20)}${NUM}\\s*kN`, "im"),
  ],
  ved: [     // Vd – Querkraft aus Eigenlast
    new RegExp(`\\bV\\s*d\\b[^\\n]*?${NUM}\\s*kN`, "im"),
    new RegExp(`V[_\\s]*Ed\\s*\\(?(?:Quer.*?)?\\)?${GAP(20)}${NUM}`, "im"),
    new RegExp(`Querkraft${GAP(20)}${NUM}\\s*kN`, "im"),
  ],
  vrd: [     // FRd – Bemessungswert der Tragfähigkeit
    new RegExp(`\\bF\\s*Rd\\b[^\\n]*?${NUM}\\s*kN`, "im"),
    new RegExp(`V[_\\s]*Rd\\s*\\(?(?:Quertrag.*?)?\\)?${GAP(20)}${NUM}`, "im"),
    new RegExp(`Quertragf[äa]higkeit${GAP(20)}${NUM}`, "im"),
  ],

  // Nachweise (Ausnutzung — typically a ratio between 0 and ~1.5)
  nw_zug: [
    /N\s*d\s*\/\s*F\s*Rd[^\d\n]{0,20}(\d[\.,]\d{1,4})/im,
    /(?:Zug|N[_\s]*Ed[,\s]*z\s*\/\s*N[_\s]*Rd)[^\d\n]{0,40}(\d[\.,]\d{1,3})/im,
    /Ausnutzung\s+Zug[^\d\n]{0,30}(\d[\.,]\d{1,3})/im,
  ],
  nw_druck: [
    /N\s*Ed\s*\/\s*F\s*Rd[^\d\n]{0,20}(\d[\.,]\d{1,4})/im,
    /(?:Druck|N[_\s]*Ed[,\s]*d\s*\/\s*N[_\s]*Rd[,\s]*d)[^\d\n]{0,40}(\d[\.,]\d{1,3})/im,
    /Ausnutzung\s+Druck[^\d\n]{0,30}(\d[\.,]\d{1,3})/im,
  ],
  nw_quer: [
    /V\s*d\s*\/\s*F\s*Rd[^\d\n]{0,20}(\d[\.,]\d{1,4})/im,
    /(?:Quer|V[_\s]*Ed\s*\/\s*V[_\s]*Rd)[^\d\n]{0,40}(\d[\.,]\d{1,3})/im,
    /Ausnutzung\s+Quer[^\d\n]{0,30}(\d[\.,]\d{1,3})/im,
  ],
  nw_kombi: [
    /Kombination[^\d\n]{0,40}(\d[\.,]\d{1,3})/im,
    /(?:Kombinierte?\s+Ausnutzung|Interaktionsnachweis)[^\d\n]{0,30}(\d[\.,]\d{1,3})/im,
  ],

  // Fassade
  fassadenlaenge: [
    new RegExp(`(?:Fassadenl[aä]nge|Fassadenbreite|Wandl[aä]nge|Wandbreite)${GAP(15)}${NUM}`, "im"),
  ],
  fassadenhoehe: [
    new RegExp(`(?:Fassadenh[oö]he|Wandh[oö]he|H[oö]he\\s+Fassade)${GAP(15)}${NUM}`, "im"),
  ],
  geometrie_art: [
    /Geometrie\s*\/?\s*Begr[uü]nungsart[\s\t]*[:\-=]\s*([^\n\t]{2,60}?)(?:\t|\s{3,}|$)/im,
    /Begr[uü]nungsart[\s\t]*[:\-=]\s*([^\n\t]{2,60}?)(?:\t|\s{3,}|$)/im,
  ],
};

// ── Product / underground heuristics ────────────────────────────────
const PRODUCT_MAP = { "200": "eco200", "260": "eco260", "320": "eco320", "380": "eco380" };

const UNTERGRUND_HINTS = [
  [/Beton\s*C20\/25/i, "beton_c2025"],
  [/Beton\s*C25\/30/i, "beton_c2530"],
  [/Beton\s*C30\/37/i, "beton_c3037"],
  [/Beton\s*C50\/60/i, "beton_c5060"],
  [/Kalksand[\-\s]?Vollstein|KS\s*Vollstein|Vollstein\s*KS/i, "ks_vollstein"],
  [/Vollziegel|\bMz\b/i, "vollziegel"],
  [/Leichtbeton(?!.*Hohl)/i, "lbv"],
  [/Hohlblock.*Leichtbeton|\bHbl\b/i, "hbl"],
  [/Kalksandlochstein|\bKSL\b/i, "ksl"],
  [/Hochlochziegel\s*I\b|\bHlz\s*I\b/i, "hlz1"],
  [/Hochlochziegel\s*II\b|\bHlz\s*II\b/i, "hlz2"],
  [/Porenbeton|\bPP\b/i, "pp"],
  [/Naturstein/i, "naturstein"],
];

const todayDe  = () => new Date().toLocaleDateString("de-DE");
const todayDoc = () => `VB-ISO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-001`;

// Light normalisation: collapse runs of spaces/tabs into a single space
// per group (preserving tabs as column-boundary hints) and keep newlines.
function clean(text) {
  return text
    .replace(/[ ]+/g, " ")          // collapse runs of plain spaces
    .replace(/[ \t]*\n[ \t]*/g, "\n")
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

  // Normalize product id (extracted "260" → "eco260")
  if (values.produkt) {
    if (PRODUCT_MAP[values.produkt]) values.produkt = PRODUCT_MAP[values.produkt];
    else {
      const m = String(values.produkt).match(/(\d{3})/);
      if (m && PRODUCT_MAP[m[1]]) values.produkt = PRODUCT_MAP[m[1]];
    }
  }
  // Try to detect product from a free-form mention if nothing else matched
  if (!values.produkt) {
    const m = text.match(/Iso[-\s]?Bar\s*ECO\s*(200|260|320|380)/i);
    if (m && PRODUCT_MAP[m[1]]) {
      values.produkt = PRODUCT_MAP[m[1]];
      if (!hits.includes("produkt")) {
        hits.push("produkt");
        const idx = misses.indexOf("produkt");
        if (idx >= 0) misses.splice(idx, 1);
      }
    }
  }
  // Verankerungsgrund: map free-form label → stable id
  if (!values.verankerungsgrund || !/^[a-z_0-9]+$/.test(values.verankerungsgrund)) {
    for (const [re, id] of UNTERGRUND_HINTS) {
      if (re.test(text)) {
        values.verankerungsgrund = id;
        if (!hits.includes("verankerungsgrund")) {
          hits.push("verankerungsgrund");
          const idx = misses.indexOf("verankerungsgrund");
          if (idx >= 0) misses.splice(idx, 1);
        }
        break;
      }
    }
  }
  // Normalise WZ Roman → digit
  if (values.windlastzone) {
    const m = { I: "1", II: "2", III: "3", IV: "4" };
    values.windlastzone = m[values.windlastzone] || values.windlastzone;
  }
  // Normalise GK Arabic → Roman
  if (values.gelaendekategorie) {
    const m = { "1": "I", "2": "II", "3": "III", "4": "IV" };
    values.gelaendekategorie = m[values.gelaendekategorie] || values.gelaendekategorie;
  }
  // Default datum if absent (parser-fallback, not a "hit")
  if (!values.datum) values.datum = todayDe();

  return { values, hits, misses };
}

// Build the complete defaults object and overlay parsed values.
// `rawText` is also returned so the UI can show what we actually got.
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
  merged.fassaden = [{
    name: "Fassade 1",
    breite: merged.fassadenlaenge,
    hoehe: merged.fassadenhoehe,
  }];

  return {
    document: merged,
    hits, misses,
    rawTextLength: (rawText || "").length,
    rawText: rawText || "",          // expose for the UI's "Roher Text" panel
  };
}
