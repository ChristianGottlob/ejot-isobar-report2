// Validierung der DE-Vorbemessung (Raster, Beton) gegen die Excel-Cache-Werte.
// Lauf:  node --test src/vorbemessung/de.test.js
//
// Referenzfall = Beispielprojekt aus dem Workbook
// "2025 03 12 Vorbemessung Iso Bar Eco Raster Beton …":
//   z=20 m, Gebäudelänge d=4 m, Gebäudebreite b=10 m, WZ 3, GK IV, LK 5,
//   Dämmung 180 mm, Putz 10 mm, ttol 10 mm, Beton C20/25.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeVorbemessungDE, windQz, cpeWand } from "./de.js";

const REF_INPUT = {
  gebaeudehoehe: 20,
  gebaeudelaenge: 4,
  gebaeudebreite: 10,
  windzone: 3,
  gelaendekategorie: "IV",
  lastklasse: 5,
  daemmdicke: 180,
  putzdicke: 10,
  ttol: 10,
  betonklasse: "c2025",
};

// Erwartete Excel-Cache-Werte (Sheet-Zellen in Klammern).
const EXP = {
  qz: 0.6821855898695863,          // q(z)!B38
  cpeA: -1.7,                       // CPE Wand!D8
  ws: 1.1597155027782968,          // Berechnung_de!B41
  nek: 0.6821855898695863,         // B42
  g: 0.5670000000000001,           // B39
  psi: 0.7,                         // B40
  FRd: 3.333333333333333,          // B24
  Ncr: 85.13160441073259,          // B53
  V10: 0.3667512335730527,         // G10
  V5: 0.3436268321167883,          // G11
  minBef: 2.2275617863853165,      // C13
  LH: 0.6700159177879382,          // C14
  Vd: 0.34362683211678835,         // B46
  Nd: 0.5466520773339293,          // B47
  NEd: 0.32156004549054656,        // B52
  kombi: 0.19370521522759984,      // B50
  nwZug: 0.10308804963503651,      // B48
  nwQuer: 0.1639956232001788,      // B49
  nwKnicken: 0.004910374496419212, // B73
  nwBeton: 0.00502437571078979,    // B74
  verfL1: 9.360110447080292,       // B80
  verfL2: 4.995000000000002,       // B81
};

const REL = 5e-3; // ±0,5 %
const near = (a, e, name) => {
  const tol = Math.max(Math.abs(e) * REL, 1e-9);
  assert.ok(Math.abs(a - e) <= tol, `${name}: ${a} ≠ ${e} (Δ ${Math.abs(a - e).toExponential(2)})`);
};

test("windQz reproduziert q(z) (WZ3, GK IV, z=20)", () => {
  near(windQz({ windzone: 3, gelaendekategorie: "IV", z: 20 }), EXP.qz, "q(z)");
});

test("cpeWand reproduziert cpe,A (h/d≥5 → -1,7)", () => {
  const r = cpeWand({ gebaeudelaenge: 4, gebaeudebreite: 10, gebaeudehoehe: 20 });
  near(r.hd, 5, "h/d");
  near(r.cpeA, EXP.cpeA, "cpe,A");
});

test("Referenzfall: komplette Kette stimmt mit Excel überein", () => {
  const r = computeVorbemessungDE(REF_INPUT);
  near(r.wind.qz, EXP.qz, "qz");
  near(r.wind.cpeA, EXP.cpeA, "cpeA");
  near(r.lasten.ws, EXP.ws, "ws");
  near(r.lasten.nek, EXP.nek, "nek");
  near(r.lasten.g, EXP.g, "g");
  near(r.lasten.psi, EXP.psi, "psi");
  near(r.tragfaehigkeit.FRd, EXP.FRd, "FRd");
  near(r.tragfaehigkeit.Ncr, EXP.Ncr, "Ncr");
  near(r.tragfaehigkeit.V10, EXP.V10, "V10");
  near(r.tragfaehigkeit.V5, EXP.V5, "V5");
  near(r.raster.minBefProM2, EXP.minBef, "minBef/m²");
  near(r.raster.LH, EXP.LH, "LH");
  near(r.raster.LV, EXP.LH, "LV");
  near(r.schnittgroessen.Vd, EXP.Vd, "Vd");
  near(r.schnittgroessen.Nd, EXP.Nd, "Nd");
  near(r.schnittgroessen.NEd, EXP.NEd, "NEd");
  near(r.nachweise.zugQuerKombi.wert, EXP.kombi, "kombi");
  near(r.nachweise.zug.wert, EXP.nwZug, "Vd/FRd");
  near(r.nachweise.quer.wert, EXP.nwQuer, "Nd/FRd");
  near(r.nachweise.druckKnicken.wert, EXP.nwKnicken, "NEd/(Ncr/γME)");
  near(r.nachweise.druckBeton.wert, EXP.nwBeton, "NEd/Fd");
  near(r.nachweise.verformungL1.wert, EXP.verfL1, "Verformung L1");
  near(r.nachweise.verformungL2.wert, EXP.verfL2, "Verformung L2");
});

test("Produktwahl: e=200, hef=40 → Lmin=240 → ECO 260", () => {
  const r = computeVorbemessungDE(REF_INPUT);
  assert.equal(r.produkt.laenge, 260);
  assert.equal(r.produkt.bezeichnung, "SET EJOT Iso-Bar ECO 260");
});

test("alle Nachweise im Referenzfall erfüllt", () => {
  const r = computeVorbemessungDE(REF_INPUT);
  for (const [k, nw] of Object.entries(r.nachweise)) {
    assert.ok(nw.ok, `Nachweis ${k} sollte erfüllt sein (${nw.wert} ≤ ${nw.grenze})`);
  }
});

test("FRk ist betonklassen-unabhängig (Z-21.8-2083 Tabelle 12)", () => {
  // Alle Betonklassen liefern dasselbe Ergebnis (FRk = 6,0 kN bei Normaltemperatur).
  const ref = computeVorbemessungDE(REF_INPUT);
  for (const klasse of ["c2025", "c2530", "c3037", "c3545", "c4050", "c4555", "c5060"]) {
    const r = computeVorbemessungDE({ ...REF_INPUT, betonklasse: klasse });
    near(r.tragfaehigkeit.FRd, 3.333333333333333, `FRd ${klasse}`);
    near(r.raster.LH, ref.raster.LH, `LH ${klasse}`);
  }
});

test("erhöhte Temperatur senkt FRk auf 5,5 kN", () => {
  const r = computeVorbemessungDE({ ...REF_INPUT, temperatur: "hoch" });
  near(r.tragfaehigkeit.frk, 5.5, "FRk(hoch)");
  near(r.tragfaehigkeit.FRd, 5.5 / 1.8, "FRd(hoch)");
});
