// Validierung der DE-Vorbemessung (Raster, Mauerwerk) gegen die Excel-Cache-Werte.
// Lauf:  node --test src/vorbemessung/de_mauerwerk.test.js
//
// Referenzfall = Beispielprojekt aus dem Workbook
// "2026 01 12 Vorbemessung Iso Bar Eco Raster Mauerwerk …":
//   z=16,1 m, Gebäudelänge d=19,1 m, Gebäudebreite b=10,75 m,
//   Windzone 1 (q(z)!D3), Geländekategorie IV (q(z)!D9), LK 3,
//   Stein Hohlblock-Leichtbeton, Dämmung 160 mm, Putz 10 mm, ttol 20 mm.
// (Hinweis: im Excel stehen in Eingabe!B8/B9 die Labels "WZ2"/"II", die echten
//  Rechen-Selektoren sind aber q(z)!D3=1 und D9=4.)

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeVorbemessungMW, steinTragfaehigkeit, STEINE } from "./de_mauerwerk.js";

const REF = {
  gebaeudehoehe: 16.1,
  gebaeudelaenge: 19.1,
  gebaeudebreite: 10.75,
  windzone: 1,
  gelaendekategorie: "IV",
  lastklasse: 3,
  daemmdicke: 160,
  putzdicke: 10,
  ttol: 20,
  steinart: "hbl",
};

const EXP = {
  qz: 0.4258660444605699,     // q(z)!B38
  cpeA: -1.4,                 // CPE Wand!D8
  ws: 0.5962124622447978,     // B40
  nek: 0.4258660444605699,    // B41
  g: 0.25650000000000006,     // B38
  psi: 0.6,                   // B39
  NRd: 0.24000000000000005,   // B19
  NRdd: 0.24000000000000005,  // B51
  VRd: 0.36,                  // B78
  Ncr: 94.08693426327514,     // B53
  V10: 0.4067270447587112,    // G9
  V5: 0.39220107887447153,    // G10
  minBef: 3.1976717334179923, // C12
  LH: 0.5592204711330855,     // C13
  NEdz: 0.16780684846807445,  // B46
  NEdd: 0.11986203462005315,  // B49
  VEd: 0.10828972729788826,   // B76
  nZug: 0.69919520195031,     // B47
  nDruck: 0.4994251442502214, // B52
  nQuer: 0.3008047980496896,  // B79
  kombiZugQuer: 0.9999999999999997, // B81
  kombiDruckQuer: 0.8002299422999111, // B82
  knicken: 0.0016561347888119089,    // B73
  stahlDruck: 0.0018728442909383305, // B74
  verfL1: 2.6598043814560812, // B88
  verfL2: 1.379157827421672,  // B89
};

const REL = 5e-3;
const near = (a, e, name) => {
  const tol = Math.max(Math.abs(e) * REL, 1e-9);
  assert.ok(Math.abs(a - e) <= tol, `${name}: ${a} ≠ ${e} (Δ ${Math.abs(a - e).toExponential(2)})`);
};

test("steinTragfaehigkeit: Hohlblock-Leichtbeton → NRd/VRd", () => {
  const r = steinTragfaehigkeit(STEINE.hbl);
  near(r.NRd, EXP.NRd, "NRd");
  near(r.NRdd, EXP.NRdd, "NRdd");
  near(r.VRd, EXP.VRd, "VRd");
});

test("Referenzfall Mauerwerk: komplette Kette stimmt mit Excel überein", () => {
  const r = computeVorbemessungMW(REF);
  near(r.wind.qz, EXP.qz, "qz");
  near(r.wind.cpeA, EXP.cpeA, "cpeA");
  near(r.lasten.ws, EXP.ws, "ws");
  near(r.lasten.nek, EXP.nek, "nek");
  near(r.lasten.g, EXP.g, "g");
  near(r.lasten.psi, EXP.psi, "psi");
  near(r.tragfaehigkeit.NRd, EXP.NRd, "NRd");
  near(r.tragfaehigkeit.NRdd, EXP.NRdd, "NRdd");
  near(r.tragfaehigkeit.VRd, EXP.VRd, "VRd");
  near(r.tragfaehigkeit.Ncr, EXP.Ncr, "Ncr");
  near(r.tragfaehigkeit.V10, EXP.V10, "V10");
  near(r.tragfaehigkeit.V5, EXP.V5, "V5");
  near(r.raster.minBefProM2, EXP.minBef, "minBef");
  near(r.raster.LH, EXP.LH, "LH");
  near(r.raster.LV, EXP.LH, "LV");
  near(r.schnittgroessen.NEdz, EXP.NEdz, "NEdz");
  near(r.schnittgroessen.NEdd, EXP.NEdd, "NEdd");
  near(r.schnittgroessen.VEd, EXP.VEd, "VEd");
  near(r.nachweise.zug.wert, EXP.nZug, "Zug");
  near(r.nachweise.druck.wert, EXP.nDruck, "Druck");
  near(r.nachweise.quer.wert, EXP.nQuer, "Quer");
  near(r.nachweise.kombiZugQuer.wert, EXP.kombiZugQuer, "Zug+Quer");
  near(r.nachweise.kombiDruckQuer.wert, EXP.kombiDruckQuer, "Druck+Quer");
  near(r.nachweise.knicken.wert, EXP.knicken, "Knicken");
  near(r.nachweise.stahlDruck.wert, EXP.stahlDruck, "StahlDruck");
  near(r.nachweise.verformungL1.wert, EXP.verfL1, "Verformung L1");
  near(r.nachweise.verformungL2.wert, EXP.verfL2, "Verformung L2");
});

test("Produktwahl Mauerwerk: e=190, hef=80 → Lmin=270 → ECO 320", () => {
  const r = computeVorbemessungMW(REF);
  assert.equal(r.produkt.laenge, 320);
  assert.equal(r.produkt.bezeichnung, "SET EJOT Iso-Bar ECO 320");
});

test("alle (maßgebenden) Nachweise im Referenzfall erfüllt", () => {
  const r = computeVorbemessungMW(REF);
  for (const [k, nw] of Object.entries(r.nachweise)) {
    assert.ok(nw.ok, `Nachweis ${k} sollte erfüllt sein (${nw.wert} ≤ ${nw.grenze})`);
  }
});

test("Porenbeton nutzt γM,m = 2,0", () => {
  const r = computeVorbemessungMW({ ...REF, steinart: "pp" });
  near(r.tragfaehigkeit.gammaMm, 2.0, "γM,m Porenbeton");
});
