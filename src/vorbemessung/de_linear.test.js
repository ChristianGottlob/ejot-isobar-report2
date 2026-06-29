// Validierung der DE-Vorbemessung (System Linear) gegen die Excel-Cache-Werte.
// Lauf:  node --test src/vorbemessung/de_linear.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLinearBeton, computeLinearMauerwerk } from "./de_linear.js";

const REL = 5e-3;
const near = (a, e, name) => {
  const tol = Math.max(Math.abs(e) * REL, 1e-9);
  assert.ok(Math.abs(a - e) <= tol, `${name}: ${a} ≠ ${e} (Δ ${Math.abs(a - e).toExponential(2)})`);
};

// ── Linear Beton (Workbook "2025 07 01 … linear Beton …") ──
// z=19,3 · d=66,24 · b=17 · WZ1 · GK Binnenland (D9=5) · LK5 · Dämm200 · Putz30
// · ttol10 · Seillänge 19 m.
const LB_IN = {
  gebaeudehoehe: 19.3, gebaeudelaenge: 66.24, gebaeudebreite: 17,
  windzone: 1, gelaendekategorie: "binnenland", lastklasse: 5,
  daemmdicke: 200, putzdicke: 30, ttol: 10, seillaenge: 19, betonklasse: "c2025",
};
const LB = {
  qz: 0.693833243112967, cpeA: -1.4, ws: 0.9713665403581537, nek: 0.693833243112967,
  g: 0.37800000000000006, psi: 0.7, FRd: 3.333333333333333,
  minBef: 2.3882063882063886, maxAbstand: 0.6470890818391165,
  anzahl: 31, LV: 0.6333333333333333,
  Vd: 0.3231900000000001, Nd: 0.43758495922908436, NEd: 0.3125606851636318,
  nwVd: 0.09695700000000003, nwNd: 0.13127548776872533, nwKombi: 0.16319899980672908,
  knicken: 0.006817283125651773, druck: 0.0048837607056817466,
  verfL1: 12.891996908422465, verfL2: 7.555090909090912,
};

test("Linear Beton: Kette stimmt mit Excel überein", () => {
  const r = computeLinearBeton(LB_IN);
  near(r.wind.qz, LB.qz, "qz"); near(r.wind.cpeA, LB.cpeA, "cpeA");
  near(r.lasten.ws, LB.ws, "ws"); near(r.lasten.nek, LB.nek, "nek");
  near(r.lasten.g, LB.g, "g"); near(r.lasten.psi, LB.psi, "psi");
  near(r.tragfaehigkeit.FRd, LB.FRd, "FRd");
  near(r.linear.minBefProM, LB.minBef, "minBef");
  near(r.linear.maxAbstand, LB.maxAbstand, "maxAbstand");
  assert.equal(r.linear.anzahl, LB.anzahl, "Anzahl");
  near(r.linear.LV, LB.LV, "LV");
  near(r.schnittgroessen.Vd, LB.Vd, "Vd");
  near(r.schnittgroessen.Nd, LB.Nd, "Nd");
  near(r.schnittgroessen.NEd, LB.NEd, "NEd");
  near(r.nachweise.zug.wert, LB.nwVd, "Vd/FRd");
  near(r.nachweise.quer.wert, LB.nwNd, "Nd/FRd");
  near(r.nachweise.zugQuerKombi.wert, LB.nwKombi, "Kombi");
  near(r.nachweise.druckKnicken.wert, LB.knicken, "Knicken");
  near(r.nachweise.druckBeton.wert, LB.druck, "Druck/Fd");
  near(r.nachweise.verformungL1.wert, LB.verfL1, "Verformung L1");
  near(r.nachweise.verformungL2.wert, LB.verfL2, "Verformung L2");
});

test("Linear Beton: Verformung im Beispiel n.i.O. (12,9>10 / 7,6>5)", () => {
  const r = computeLinearBeton(LB_IN);
  assert.equal(r.nachweise.verformungL1.ok, false);
  assert.equal(r.nachweise.verformungL2.ok, false);
});

test("Linear Beton Produktwahl: e=240, hef=40 → Lmin=280 → ECO 320", () => {
  const r = computeLinearBeton(LB_IN);
  assert.equal(r.produkt.laenge, 320);
});

// ── Linear Mauerwerk (Workbook "2026 01 12 … linear Mauerwerk …") ──
// z=20 · d=20 · b=20 · WZ3 · GK Binnenland (D9=5) · LK5 · Stein Kalksand-Lochstein
// · Dämm100 · Putz10 · ttol10 · Seillänge 12 m.
const LM_IN = {
  gebaeudehoehe: 20, gebaeudelaenge: 20, gebaeudebreite: 20,
  windzone: 3, gelaendekategorie: "binnenland", lastklasse: 5,
  daemmdicke: 100, putzdicke: 10, ttol: 10, seillaenge: 12, steinart: "ksl",
};
const LM = {
  qz: 1.0325899116793562, cpeA: -1.4, ws: 1.4456258763510985, nek: 1.0325899116793562,
  g: 0.37800000000000006, psi: 0.7,
  NRd: 0.57, NRdd: 0.22799999999999998, VRd: 0.39,
  minBef: 4.6372053326910425, maxAbstand: 0.21564712542493442,
  anzahl: 56, LV: 0.21818181818181817,
  NEdz: 0.22768607552529802, NEdd: 0.1626329110894986, VEd: 0.11133818181818184,
  nZug: 0.3994492553075404, nDruck: 0.713302241620608, nQuer: 0.2854825174825175,
  kombiZugQuer: 0.6849317727900579, kombiDruckQuer: 0.9987847591031255,
  verfL1: 1.1740520782693245, verfL2: 0.4465435099659699,
};

test("Linear Mauerwerk: Kette stimmt mit Excel überein", () => {
  const r = computeLinearMauerwerk(LM_IN);
  near(r.wind.qz, LM.qz, "qz"); near(r.wind.cpeA, LM.cpeA, "cpeA");
  near(r.lasten.ws, LM.ws, "ws"); near(r.lasten.g, LM.g, "g");
  near(r.tragfaehigkeit.NRd, LM.NRd, "NRd");
  near(r.tragfaehigkeit.NRdd, LM.NRdd, "NRdd");
  near(r.tragfaehigkeit.VRd, LM.VRd, "VRd");
  near(r.linear.minBefProM, LM.minBef, "minBef");
  near(r.linear.maxAbstand, LM.maxAbstand, "maxAbstand");
  assert.equal(r.linear.anzahl, LM.anzahl, "Anzahl");
  near(r.linear.LV, LM.LV, "LV");
  near(r.schnittgroessen.NEdz, LM.NEdz, "NEdz");
  near(r.schnittgroessen.NEdd, LM.NEdd, "NEdd");
  near(r.schnittgroessen.VEd, LM.VEd, "VEd");
  near(r.nachweise.zug.wert, LM.nZug, "Zug");
  near(r.nachweise.druck.wert, LM.nDruck, "Druck");
  near(r.nachweise.quer.wert, LM.nQuer, "Quer");
  near(r.nachweise.kombiZugQuer.wert, LM.kombiZugQuer, "Zug+Quer");
  near(r.nachweise.kombiDruckQuer.wert, LM.kombiDruckQuer, "Druck+Quer");
  near(r.nachweise.verformungL1.wert, LM.verfL1, "Verformung L1");
  near(r.nachweise.verformungL2.wert, LM.verfL2, "Verformung L2");
});

test("Linear Mauerwerk Produktwahl: e=120, hef=80 → Lmin=200 → ECO 200", () => {
  const r = computeLinearMauerwerk(LM_IN);
  assert.equal(r.produkt.laenge, 200);
});
