// ─────────────────────────────────────────────────────────────────────────
// Österreich – Windlastmodul nach ÖNORM B 1991-1-4 (Spitzengeschwindigkeits-
// druck qp + Außendruckbeiwerte cpe).  Reine Berechnung, 1:1-Nachbau der
// Sheets 0_Input_AUT / Daten_AUT / Ce_AUT / Cpe_AUT / Städte_AUT des
// EJOT-Austria-Workbooks.
//
// Liefert ws (Windsog) und Nek (Winddruck) für die bestehende Vorbemessungs-
// Engine — der Untergrund-/System-Teil (FRd, min. Befestiger, Nachweise) ist
// identisch zu Deutschland; nur die Windermittlung ist österreichisch.
//
// Kette:
//   qb  = ρ/2 · vb,0²            (ρ = 1,25 kg/m³, vb,0 je Stadt aus Städte_AUT)
//   ce(z) = a · (max(z,zmin)/10)^b   (a,b,zmin je Geländekategorie)
//   qp  = qb · ce(z)            (bei Seehöhendifferenz ≤ 250 m; sonst Höhentabelle)
//   cpe,A = bilineare Interpolation in (h/b, d/b), schlimmster Sog beider
//           Windrichtungen → we,s = qp · cpe,A ;  we,d = qp · cpe,D (cpe,D = 1)
// ─────────────────────────────────────────────────────────────────────────

import { STAEDTE_AUT } from "./staedte_aut.js";
export { STAEDTE_AUT };

export const RHO_LUFT = 1.25;   // kg/m³

// Geländekategorie-Koeffizienten (Daten_AUT / Ce_AUT, Zeilen II/III/IV).
//   ce(z) = a · (max(z, zmin)/10)^b
export const GK_AUT = {
  II:  { a: 2.1,  b: 0.24, zmin: 5,  label: "II – niedrige Vegetation, einzelne Hindernisse" },
  III: { a: 1.75, b: 0.29, zmin: 10, label: "III – Dörfer, vorstädtische Bebauung, Wald" },
  IV:  { a: 1.2,  b: 0.38, zmin: 15, label: "IV – Stadtgebiete (≥15 % Bebauung, h > 15 m)" },
};

// cpe,1 Außendruckbeiwerte (Ce_AUT).  Zeilen = h/b, Spalten = d/b.
const HB = [0, 0.5, 2, 5, 10, 20, 50];
const DB = [0, 0.2, 0.7, 1, 2, 5, 10, 1000];
const CPE_A = [
  [-1.25,  -1.25,  -1.25,  -1.25,  -1.25,  -1.25,  -1.25,  -1.25 ],   // h/b 0
  [-1.25,  -1.25,  -1.25,  -1.25,  -1.25,  -1.25,  -1.25,  -1.25 ],   // 0.5
  [-1.5,   -1.5,   -1.5,   -1.5,   -1.375, -1.375, -1.375, -1.375],   // 2
  [-1.6875,-1.6875,-1.8125,-1.625, -1.5625,-1.5,   -1.5,   -1.5  ],   // 5
  [-1.875, -1.875, -2.0625,-1.75,  -1.6875,-1.625, -1.625, -1.625],   // 10
  [-2.0625,-2.0625,-2.25,  -1.875, -1.8125,-1.6875,-1.6875,-1.6875],  // 20
  [-2.1875,-2.1875,-2.375, -2,     -1.875, -1.75,  -1.75,  -1.75 ],   // 50
];
const CPE_B = [
  [-0.875,-0.875,-0.875,-0.875, -0.875, -0.875, -0.875, -0.875],
  [-0.875,-0.875,-0.875,-0.875, -0.875, -0.875, -0.875, -0.875],
  [-1,    -1,    -1.125,-1,     -0.9375,-0.875, -0.875, -0.875],
  [-1.25, -1.25, -1.375,-1.125, -1.0625,-0.9375,-0.875, -0.875],
  [-1.5,  -1.5,  -1.625,-1.25,  -1.125, -1,     -0.875, -0.875],
  [-1.75, -1.75, -1.875,-1.4375,-1.1875,-1.0625,-0.9375,-0.9375],
  [-1.875,-1.875,-2.125,-1.6875,-1.25,  -1.125, -0.9375,-0.9375],
];

// Höhen-/Seehöhentabelle (Städte_AUT) für Seehöhendifferenz > 250 m.
// Zeilen = Höhe z [m], Spalten = Seehöhe-Stützstellen [müM].
const ALT_Z   = [0, 6, 10, 15, 25, 50, 75, 100, 150, 200, 300];
const ALT_SH  = [0, 800, 1800, 3000, 5000];
const ALT_QP  = [
  [0.40, 0.40, 0.98, 1.6, 1.6],
  [0.40, 0.40, 0.98, 1.6, 1.6],
  [0.47, 0.47, 0.98, 1.6, 1.6],
  [0.54, 0.54, 0.98, 1.6, 1.6],
  [0.63, 0.63, 0.98, 1.6, 1.6],
  [0.79, 0.79, 0.98, 1.6, 1.6],
  [0.90, 0.90, 0.98, 1.6, 1.6],
  [0.99, 0.99, 0.98, 1.6, 1.6],
  [1.12, 1.12, 0.98, 1.6, 1.6],
  [1.23, 1.23, 0.98, 1.6, 1.6],
  [1.40, 1.40, 0.98, 1.6, 1.6],
];

// ── 1D-Interpolation auf einem Stützstellengitter (mit Klemmung). ──
function interp1(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 0; i < xs.length - 1; i++) {
    if (x <= xs[i + 1]) {
      const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
      return ys[i] + t * (ys[i + 1] - ys[i]);
    }
  }
  return ys[ys.length - 1];
}
// Bilineare Interpolation in einer Tabelle table[row=hb][col=db].
function interp2(table, hbAxis, dbAxis, hb, db) {
  const rowAtDb = table.map((row) => interp1(dbAxis, row, db));   // je h/b-Zeile über d/b interpolieren
  return interp1(hbAxis, rowAtDb, hb);                            // dann über h/b
}

// ── vb,0 / Seehöhe für eine Stadt finden. ──
export function findStadt(name) {
  if (!name) return null;
  const exact = STAEDTE_AUT.find((s) => s.name === name);
  if (exact) return exact;
  const low = String(name).toLowerCase();
  return STAEDTE_AUT.find((s) => s.name.toLowerCase().includes(low)) || null;
}

// qb = ρ/2 · vb,0²  [kN/m²]
export function qbAUT(vb0) {
  return (RHO_LUFT / 2) * vb0 * vb0 / 1000;
}

// ce(z) = a · (max(z,zmin)/10)^b
export function ceAUT(z, gkKey) {
  const gk = GK_AUT[gkKey];
  if (!gk) throw new Error(`Unbekannte Geländekategorie (AT): ${gkKey}`);
  const zr = Math.max(z, gk.zmin);
  return gk.a * Math.pow(zr / 10, gk.b);
}

// cpe,A (schlimmster Sog) für eine Windrichtung (b = angeströmte Breite, d = Tiefe).
export function cpeA_AUT(h, b, d) {
  return interp2(CPE_A, HB, DB, h / b, d / b);
}

// Komplettes AT-Windergebnis: liefert ws (Sog, positiv) und Nek (Druck).
export function windAUT({ vb0, seehoehe, seehoeheStadt, gelaendekategorie, gebaeudehoehe, gebaeudelaenge, gebaeudebreite }) {
  const z = gebaeudehoehe, L = gebaeudelaenge, B = gebaeudebreite;
  const qb = qbAUT(vb0);
  const ce = ceAUT(z, gelaendekategorie);
  // qp: Normalfall qb·ce; bei Seehöhendifferenz > 250 m Höhentabelle.
  const diff = (seehoehe ?? 0) - (seehoeheStadt ?? 0);
  const qp = diff > 250
    ? interp2(ALT_QP, ALT_Z, ALT_SH, z, seehoehe)   // Achse: Zeile=z, Spalte=Seehöhe
    : qb * ce;
  // cpe,A für beide Windrichtungen, schlimmster (negativster) Sog.
  const cpeA1 = cpeA_AUT(z, L, B);   // Wind ⊥ zur Länge L
  const cpeA2 = cpeA_AUT(z, B, L);   // Wind ⊥ zur Breite B
  const cpeA = Math.min(cpeA1, cpeA2);
  const cpeD = 1.0;
  const we_s = qp * cpeA;            // negativ
  const we_d = qp * cpeD;            // positiv
  return {
    qb, ce, qp,
    cpeA, cpeA1, cpeA2, cpeD,
    ws: Math.abs(we_s),              // Windsog (positiv) → Engine
    nek: we_d,                       // Winddruck → Engine
    we_s, we_d,
  };
}
