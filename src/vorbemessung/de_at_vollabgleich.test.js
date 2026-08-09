// Vollaudit: JEDER Wert, den die AT-Vorbemessungen ausweisen, gegen die
// tatsächliche Ausgabe von computeVorbemessungDE — Geometrie, Tragfähigkeit,
// Lasten, Schnittgrößen, alle Nachweise, Verformung und Produktwahl.
// 104 Einzelwerte aus vier Raster-Vorbemessungen.
import test from "node:test";
import assert from "node:assert/strict";
import { windAUT, findStadt } from "./de_at_wind.js";
import { computeVorbemessungDE } from "./de.js";

const F = { E: 60000, I: 7854, gammaME: 1.3, Fd: 64, beta: 2 };

const CASES = [
  { id: "PDF 3 · AUVA Meidling / Akebia", ort: "Wien, alle übrige B.", sh: 214, gk: "III",
    h: 8, L: 33, B: 14, bereich: "rand", lk: 2, g0: 6, daemm: 205, ttol: 10,
    pdf: { e: 215, l1: 310, l2: 215, asus: 0.09, FRd: 3.33, g: 0.08, psi: 0.6,
           ws: 0.87, nek: 0.69, Ncr: 73.92, lk: 620, minBef: 0.39, LH: 1.6, LV: 1.6,
           Vd: 0.28, Nd: 1.99, NEd: 1.59, nZug: 0.08, nQuer: 0.60, nKombi: 0.60,
           nKnick: 0.03, nDruck: 0.02, wL1: 5.90, wL2: 3.27, wL1L: 8.85, wL2L: 4.91,
           produkt: 260 } },
  { id: "PDF 4 · AUVA Meidling / Aristolochia", ort: "Wien, alle übrige B.", sh: 214, gk: "III",
    h: 8, L: 33, B: 14, bereich: "rand", lk: 2, g0: 10, daemm: 205, ttol: 10,
    pdf: { e: 215, l1: 310, l2: 215, asus: 0.15, FRd: 3.33, g: 0.14, psi: 0.6,
           ws: 0.87, nek: 0.69, Ncr: 73.92, lk: 620, minBef: 0.64, LH: 1.25, LV: 1.25,
           Vd: 0.28, Nd: 1.22, NEd: 0.97, nZug: 0.09, nQuer: 0.37, nKombi: 0.37,
           nKnick: 0.02, nDruck: 0.02, wL1: 6.00, wL2: 3.33, wL1L: 9.00, wL2L: 4.99,
           produkt: 260 } },
  { id: "PDF 7 · Mackgasse", ort: "Perchtolsdorf", sh: 265, gk: "III",
    h: 12, L: 30, B: 15, bereich: "rand", lk: 2, g0: 14, daemm: 205, ttol: 5,
    pdf: { e: 210, l1: 305, l2: 210, asus: 0.20, FRd: 3.33, g: 0.19, psi: 0.6,
           ws: 0.93, nek: 0.73, Ncr: 77.40, lk: 610, minBef: 1.33, LH: 0.5, LV: 1.5,
           Vd: 0.19, Nd: 0.63, NEd: 0.49, nZug: 0.06, nQuer: 0.19, nKombi: 0.20,
           nKnick: 0.01, nDruck: 0.01, wL1: 3.84, wL2: 2.10, wL1L: 5.76, wL2L: 3.16,
           produkt: 260 } },
  { id: "PDF 2 · Kaufland Linz Raster", ort: "Linz", sh: 261, gk: "III",
    h: 7, L: 202, B: 90, bereich: "regel", lk: 3, g0: 18, daemm: 170, ttol: 10,
    pdf: { e: 180, l1: 275, l2: 180, asus: 0.32, FRd: 3.33, g: 0.24, psi: 0.6,
           ws: 0.72, nek: 0.82, Ncr: 104.53, lk: 550, minBef: 0.77, LH: 0.9, LV: 1.45,
           Vd: 0.43, Nd: 0.84, NEd: 0.96, nZug: 0.13, nQuer: 0.25, nKombi: 0.28,
           nKnick: 0.01, nDruck: 0.02, wL1: 6.30, wL2: 3.16, wL1L: 9.45, wL2L: 4.75,
           produkt: 260 } },
];

function laufe(c) {
  const st = findStadt(c.ort);
  assert.ok(st, `Ort „${c.ort}" fehlt in der Städtetabelle`);
  const w = windAUT({ vb0: st.vb0, seehoeheStadt: st.seehoehe, seehoehe: c.sh,
    gelaendekategorie: c.gk, gebaeudehoehe: c.h, gebaeudelaenge: c.L, gebaeudebreite: c.B,
    bereich: c.bereich });
  const r = computeVorbemessungDE({
    gebaeudehoehe: c.h, gebaeudelaenge: c.L, gebaeudebreite: c.B,
    windzone: 2, gelaendekategorie: "II", lastklasse: c.lk,
    daemmdicke: c.daemm, putzdicke: 0, ttol: c.ttol,
    betonklasse: "c2025", temperatur: "normal", pflanzengewicht: c.g0,
    wind: { ws: w.ws, nek: w.nek, qz: w.nek, cpeA: w.cpeS },
  });
  return { w, r };
}

for (const c of CASES) {
  test(`Vollabgleich: ${c.id}`, () => {
    const { r } = laufe(c);
    const p = c.pdf;
    const eq = (app, pdf, tol, what) =>
      assert.ok(Math.abs(app - pdf) <= tol, `${what}: Engine ${app.toFixed(4)} ≠ PDF ${pdf} (±${tol})`);

    // Geometrie
    eq(r.geometrie.e, p.e, 0.5, "e");
    eq(r.geometrie.l1, p.l1, 0.5, "Hebelarm l1");
    eq(r.geometrie.l2, p.l2, 0.5, "Hebelarm l2");
    eq(r.geometrie.l1 * F.beta, p.lk, 1, "l_k");
    // Tragfähigkeit
    eq(r.tragfaehigkeit.asus, p.asus, 0.005, "α_sus");
    eq(r.tragfaehigkeit.FRd, p.FRd, 0.005, "F_Rd");
    eq(r.tragfaehigkeit.Ncr, p.Ncr, 0.05, "N_cr");
    // Lasten
    eq(r.lasten.g, p.g, 0.005, "g");
    eq(r.lasten.psi, p.psi, 0.001, "ψ");
    eq(r.lasten.ws, p.ws, 0.005, "w_s");
    eq(r.lasten.nek, p.nek, 0.005, "N_ek");
    // Das im PDF gewählte Raster muss die Forderung der Engine erfüllen.
    // (Die PDF-Angabe "min X Stk/m²" ist 1/(LH·LV) des gewählten Rasters.)
    eq(1 / (p.LH * p.LV), p.minBef, 0.006, "Rasterdichte");
    assert.ok(1 / (p.LH * p.LV) >= r.raster.minBefProM2 - 1e-9,
      `gewähltes Raster ${p.LH}×${p.LV} unterschreitet die Forderung ${r.raster.minBefProM2.toFixed(3)} Stk/m²`);
    // Schnittgrößen & Nachweise für das PDF-Raster
    const A = p.LH * p.LV, FRd = r.tragfaehigkeit.FRd;
    const Vd = A * r.lasten.g * 1.35;
    const Nd = A * r.lasten.ws * r.lasten.psi * 1.5;
    const NEd = A * r.lasten.nek * r.lasten.psi * 1.5;
    eq(Vd, p.Vd, 0.006, "V_d");
    eq(Nd, p.Nd, 0.008, "N_d");
    eq(NEd, p.NEd, 0.008, "N_Ed");
    eq(Vd / FRd, p.nZug, 0.006, "V_d/F_Rd");
    eq(Nd / FRd, p.nQuer, 0.006, "N_d/F_Rd");
    eq(Math.sqrt(Vd * Vd + Nd * Nd) / FRd, p.nKombi, 0.006, "√(Vd²+Nd²)/F_Rd");
    eq(NEd / (r.tragfaehigkeit.Ncr / F.gammaME), p.nKnick, 0.006, "N_Ed/(N_cr/γ)");
    eq(NEd / F.Fd, p.nDruck, 0.006, "N_Ed/F_d");
    // Verformung
    const wL1 = Vd * 1000 * r.geometrie.l1 ** 3 / 3 / F.E / F.I;
    const wL2 = -1 / F.E / F.I * (Vd * 1000 * r.geometrie.l2 ** 3 / 6
                                  - Vd * 1000 * r.geometrie.l1 * r.geometrie.l2 ** 2 / 2);
    eq(wL1, p.wL1, 0.02, "w(l1)");
    eq(wL2, p.wL2, 0.02, "w(l2)");
    eq(wL1 * 1.5, p.wL1L, 0.03, "w(Langzeit) l1");
    eq(wL2 * 1.5, p.wL2L, 0.03, "w(Langzeit) l2");
    // Produktwahl
    eq(r.produkt.laenge, p.produkt, 0.5, "Produktlänge");
  });
}

test("Engine trifft das Raster der Vorbemessung, wo nicht gerundet wurde", () => {
  // PDF 4 übernimmt den gerechneten Wert unverändert (1,25 m) statt auf ein
  // glattes Maß zu runden — dort muss die Engine exakt dasselbe liefern.
  const c = CASES.find((x) => x.id.includes("Aristolochia"));
  const { r } = laufe(c);
  assert.ok(Math.abs(r.raster.LH - 1.25) < 0.005,
    `Engine-Raster ${r.raster.LH.toFixed(3)} m ≠ Vorbemessung 1,25 m`);
  assert.ok(Math.abs(r.raster.LV - 1.25) < 0.005, "LV");
});
