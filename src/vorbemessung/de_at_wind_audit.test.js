// Lückenloser Abgleich der ÖNORM-Windkette gegen die acht Vorbemessungen von
// EJOT Austria (F. Kassler, 2026).  Geprüft wird JEDER Zwischenwert, den die
// PDFs ausweisen: vb,0 → qb → ce(z) → qp → cpe,A (beide Windrichtungen)
// → cpe,B → we (Rand/Regel/Druck).  60 Einzelwerte.
//
// Zweck: belegen, dass die österreichische Windlastberechnung selbst korrekt
// ist — die früheren Abweichungen kamen aus Eingaben (Pflanzengewicht,
// Sogbereich) und aus dem stillen Rückfall auf die deutsche Windrechnung.
import test from "node:test";
import assert from "node:assert/strict";
import { windAUT, findStadt, qbAUT, ceAUT, cpeA_AUT, cpeB_AUT } from "./de_at_wind.js";
import { windQz, cpeWand } from "./de.js";

// PDF-Werte sind gerundet → absolute Toleranz.
const eq = (app, pdf, tol, what) =>
  assert.ok(Math.abs(app - pdf) <= tol, `${what}: App ${app.toFixed(4)} ≠ PDF ${pdf} (±${tol})`);

const FAELLE = [
  { id: "Kaufland Linz (PDF 1+2)", ort: "Linz", sh: 261, gk: "III", h: 7, L: 202, B: 90,
    vb0: 27.4, qb: 0.469, ce: 1.75, qp: 0.821,
    cpeL: -1.25, cpeQ: -1.25, cpeReg: -0.88, weRand: 1.026, weReg: 0.719, weD: 0.821 },
  { id: "AUVA Meidling (PDF 3+4)", ort: "Wien, alle übrige B.", sh: 214, gk: "III", h: 8, L: 33, B: 14,
    vb0: 25.1, qb: 0.394, ce: 1.75, qp: 0.689,
    cpeL: -1.25, cpeQ: -1.26, cpeReg: -0.88, weRand: 0.865, weReg: 0.605, weD: 0.689 },
  { id: "Motel One Linz (PDF 5)", ort: "Linz", sh: 260, gk: "IV", h: 20, L: 25, B: 15,
    vb0: 27.4, qb: 0.469, ce: 1.56, qp: 0.733,
    cpeL: -1.30, cpeQ: -1.34, cpeReg: -0.92, weRand: 0.984, weReg: 0.675, weD: 0.733 },
  { id: "MAG 12 Wien (PDF 6)", ort: "Wien, alle übrige B.", sh: 160, gk: "III", h: 16.7, L: 52.4, B: 13.8,
    vb0: 25.1, qb: 0.394, ce: 2.03, qp: 0.800,
    cpeL: -1.25, cpeQ: -1.31, cpeReg: -0.89, weRand: 1.047, weReg: 0.709, weD: 0.800 },
  { id: "Mackgasse (PDF 7)", ort: "Perchtolsdorf", sh: 265, gk: "III", h: 12, L: 30, B: 15,
    vb0: 25.1, qb: 0.394, ce: 1.85, qp: 0.726,
    cpeL: -1.25, cpeQ: -1.28, cpeReg: -0.89, weRand: 0.926, weReg: 0.645, weD: 0.726 },
  // Hier weist das Sheet zwei cpe,B aus (−0,95 / −0,94); maßgebend ist der
  // ungünstigere — die daraus folgende Last we = −0,858 bestätigt das.
  { id: "Franzensbrückenstr. (PDF 8)", ort: "Wien, alle übrige B.", sh: 160, gk: "III", h: 25, L: 24, B: 14,
    vb0: 25.1, qb: 0.394, ce: 2.28, qp: 0.899,
    cpeL: -1.34, cpeQ: -1.39, cpeReg: -0.95, weRand: 1.247, weReg: 0.858, weD: 0.899 },
];

for (const c of FAELLE) {
  test(`ÖNORM-Windkette: ${c.id}`, () => {
    const st = findStadt(c.ort);
    assert.ok(st, `Ort „${c.ort}" fehlt in der Städtetabelle`);
    eq(st.vb0, c.vb0, 0.05, "vb,0");
    eq(qbAUT(st.vb0), c.qb, 0.001, "qb");
    eq(ceAUT(c.h, c.gk), c.ce, 0.006, "ce(z)");

    const w = windAUT({ vb0: st.vb0, seehoeheStadt: st.seehoehe, seehoehe: c.sh,
      gelaendekategorie: c.gk, gebaeudehoehe: c.h, gebaeudelaenge: c.L, gebaeudebreite: c.B });
    eq(w.qp, c.qp, 0.004, "qp");

    // Beide Windrichtungen einzeln — genau wie die Sheets sie ausweisen
    eq(cpeA_AUT(c.h, c.L, c.B), c.cpeL, 0.006, "cpe,A (Wind ⊥ L)");
    eq(cpeA_AUT(c.h, c.B, c.L), c.cpeQ, 0.006, "cpe,A (Wind ⊥ B)");
    eq(Math.min(cpeB_AUT(c.h, c.L, c.B), cpeB_AUT(c.h, c.B, c.L)), c.cpeReg, 0.007, "cpe,B");

    eq(w.wsRand, c.weRand, 0.004, "we Randbereich");
    eq(w.wsRegel, c.weReg, 0.005, "we Regelbereich");
    eq(w.nek, c.weD, 0.004, "we Winddruck");
  });
}

test("we = qp · cpe — die Sheets wenden cp,net (2/3 bzw. 1/3) NICHT an", () => {
  const st = findStadt("Linz");
  const w = windAUT({ vb0: st.vb0, seehoeheStadt: st.seehoehe, seehoehe: 261,
    gelaendekategorie: "III", gebaeudehoehe: 7, gebaeudelaenge: 202, gebaeudebreite: 90 });
  eq(w.wsRand, w.qp * 1.25, 1e-9, "we = qp·cpe ohne Zusatzfaktor");
  assert.ok(Math.abs(w.wsRand - w.qp * 1.25 / 3) > 0.5, "kein 1/3-Faktor auf den Sog");
});

test("Deutsche Windrechnung liefert für AT-Standorte andere Lasten", () => {
  // Belegt, warum der frühere stille Rückfall auf die deutsche Berechnung
  // (bei unbekanntem Ort) zu völlig anderen Ergebnissen führte: der Sog liegt
  // je nach Standort 3 % bis 38 % daneben — ohne jeden Hinweis im Report.
  const faelle = [
    { ort: "Wien, alle übrige B.", sh: 214, gk: "III", h: 8,  L: 33, B: 14 },
    { ort: "Linz",                 sh: 260, gk: "IV",  h: 20, L: 25, B: 15 },
  ];
  for (const f of faelle) {
    const st = findStadt(f.ort);
    const at = windAUT({ vb0: st.vb0, seehoeheStadt: st.seehoehe, seehoehe: f.sh,
      gelaendekategorie: f.gk, gebaeudehoehe: f.h, gebaeudelaenge: f.L, gebaeudebreite: f.B });
    const qz = windQz({ windzone: 2, gelaendekategorie: "II", z: f.h });   // Default der App
    const { cpeA } = cpeWand({ gebaeudelaenge: f.L, gebaeudebreite: f.B, gebaeudehoehe: f.h });
    const wsDE = Math.abs(qz * cpeA);
    assert.ok(wsDE / at.ws - 1 > 0.2,
      `${f.ort}: DE-Sog ${wsDE.toFixed(3)} vs ÖNORM ${at.ws.toFixed(3)} — Unterschied muss deutlich sein`);
  }
});
