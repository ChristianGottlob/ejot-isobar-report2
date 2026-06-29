// ─────────────────────────────────────────────────────────────────────────
// Vorbemessung Deutschland — EJOT Iso-Bar ECO, System "Linear" (eine vertikale
// Seillinie je Pflanze; Befestiger im Abstand LV entlang des Seils).
// Reine Rechen-Engine.  1:1-Nachbau der EJOT-Excel "linear Beton" bzw.
// "linear Mauerwerk".
//
// Unterschiede zum Raster:
//   - Bewuchslast aus der LINEAREN Lastklassen-Zeile (kg/m statt kg/m²).
//   - Windlast wirkt auf einen 0,7 m breiten Streifen → Faktor 0,7.
//   - Ergebnis ist die Anzahl Iso-Bar je Seil + vertikaler Abstand LV
//     (statt eines quadratischen Rasters LH·LV).
//
// ACHTUNG – die beiden Linear-Workbooks unterscheiden sich in der Umrechnung
// "min. Befestiger → max. Abstand":
//   - Linear BETON:     maxAbstand = √(1/minBef),  Anzahl = ⌈L/maxAbstand + 1⌉
//                       (dimensional inkonsistent; im EJOT-Beispiel scheitert
//                        dadurch sogar die Verformung — bewusst 1:1 gespiegelt).
//   - Linear MAUERWERK: maxAbstand = 1/minBef,      Anzahl = ⌈L·minBef⌉.
// Interaktion: Beton √(Vd²+Nd²)/FRd, Mauerwerk linear (NEd/NRd + VEd/VRd).
//
// Quelle der Wahrheit:
//   public/Vorbemessung_Deutschland/2025 07 01 … linear Beton … .xlsx
//   public/Vorbemessung_Deutschland/2026 01 12  … linear Mauerwerk … .xlsx
// ─────────────────────────────────────────────────────────────────────────

import { windQz, cpeWand, LASTKLASSEN, BAUTEIL_KONST, BETON_FRK, WINDZONEN_QREF,
         ECO_LAENGEN_RASTER } from "./de.js";
import { STEINE, AJ, ECO_LAENGEN_MW, steinTragfaehigkeit } from "./de_mauerwerk.js";

const num = (v) => (typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")));
const roundUp = (x) => Math.ceil(x - 1e-9);   // Excel ROUNDUP(x,0)

// Gemeinsame Vorbereitung (Geometrie, Wind, Linear-Lasten, Steifigkeiten).
function commonLinear(input) {
  const z = num(input.gebaeudehoehe), d = num(input.gebaeudelaenge), b = num(input.gebaeudebreite);
  const wz = Number(input.windzone), gk = String(input.gelaendekategorie);
  const lk = Number(input.lastklasse), li = lk - 1;
  const daemm = num(input.daemmdicke), putz = num(input.putzdicke), ttol = num(input.ttol);
  const L = num(input.seillaenge);                       // Seillänge [m]
  const K = BAUTEIL_KONST;

  const tWDVS = daemm + putz;
  const e = tWDVS + ttol;
  const l1 = e + K.a + 0.5 * K.d2 + K.La;
  const l2 = l1 - K.La - 15;

  let qz, cpeA, hd;
  if (input.wind) {
    ({ qz = input.wind.nek, cpeA, hd } = input.wind);
  } else {
    qz = windQz({ windzone: wz, gelaendekategorie: gk, z });
    ({ cpeA, hd } = cpeWand({ gebaeudelaenge: d, gebaeudebreite: b, gebaeudehoehe: z }));
  }

  const g0 = LASTKLASSEN.linear[li] / 100;               // kN/m (LINEARE Zeile)
  const g = g0 * 0.75 * 1.8;
  const psi = LASTKLASSEN.durchstroemung[li];
  const ws = input.wind ? input.wind.ws : qz * cpeA * -1;
  const nek = input.wind ? input.wind.nek : qz;

  const Ncr = (Math.PI ** 2 * (K.E / K.gammaME) * K.I / (e + K.a) ** 2) / 1000;
  const V10 = (3 * K.E * K.I * 6.66) / l1 ** 3 / 1000;
  const V5  = (6 * K.E * K.I * 3.33) / (l2 ** 2 * (3 * l1 - l2)) / 1000;

  return { K, L, e, l1, l2, qref: WINDZONEN_QREF[wz], qz, cpeA, hd, g0, g, psi, ws, nek, Ncr, V10, V5 };
}

// ── Linear BETON ──
export function computeLinearBeton(input) {
  const c = commonLinear(input);
  const tempKey = input.temperatur === "hoch" ? "hoch" : "normal";
  const frk = BETON_FRK[tempKey];
  const gammaM = 1.8, psi0sus = 0.6;

  const asus = c.g / Math.sqrt(c.g * c.g + c.ws * c.ws);
  const psisus = asus < psi0sus ? 1 : psi0sus + 1 - asus;
  const FRd = (frk * psisus) / gammaM;

  // Min. Befestiger (pro m) → max. Abstand (Beton: √-Umrechnung)
  const mb = {
    zug:          (c.ws * c.psi * 0.7 * 1.5) / FRd,
    druckKnicken: (c.nek * c.psi * 0.7 * 1.5) / (c.Ncr / c.K.gammaME),
    druckBeton:   (c.nek * c.psi * 0.7 * 1.5) / c.K.Fd,
    quer:         (c.g * 1.35) / FRd,
  };
  mb.zugQuer   = mb.zug + mb.quer;
  mb.druckQuer = mb.quer + Math.max(mb.druckKnicken, mb.druckBeton);
  mb.verformL1 = (c.g * 1.35) / c.V10;
  mb.verformL2 = (c.g * 1.35) / c.V5;
  const minBef = Math.max(...Object.values(mb));
  const maxAbstand = Math.sqrt(1 / minBef);
  const anzahl = roundUp(c.L / maxAbstand + 1);
  const LV = c.L / (anzahl - 1);

  const Vd  = (c.g * 1.35 * c.L) / (anzahl - 1);
  const Nd  = (c.ws * 0.7 * 1.5 * c.psi * c.L) / anzahl;
  const NEd = (c.nek * 0.7 * 1.5 * c.psi * c.L) / anzahl;
  const wL1 = (Vd * 1000) * c.l1 ** 3 / 3 / c.K.E / c.K.I;
  const wL2 = -1 / c.K.E / c.K.I * (Vd * 1000 * c.l2 ** 3 / 6 - Vd * 1000 * c.l1 * c.l2 ** 2 / 2);

  const nachweise = {
    zugQuerKombi: { wert: Math.sqrt(Vd * Vd + Nd * Nd) / FRd, grenze: 1 },
    zug:          { wert: Vd / FRd, grenze: 1 },
    quer:         { wert: Nd / FRd, grenze: 1 },
    druckKnicken: { wert: NEd / (c.Ncr / c.K.gammaME), grenze: 1 },
    druckBeton:   { wert: NEd / c.K.Fd, grenze: 1 },
    verformungL1: { wert: wL1 * 1.5, grenze: 10, einheit: "mm" },
    verformungL2: { wert: wL2 * 1.5, grenze: 5,  einheit: "mm" },
  };
  for (const nw of Object.values(nachweise)) nw.ok = nw.wert <= nw.grenze;

  const Lmin = c.e + 40;                                  // hef = 40 (Beton)
  const Lgew = ECO_LAENGEN_RASTER.find((Lx) => Lx >= Lmin) ?? null;

  return {
    system: "linear", untergrund: "beton",
    geometrie: { e: c.e, l1: c.l1, l2: c.l2, Lmin },
    wind: { qref: c.qref, qz: c.qz, cpeA: c.cpeA, hd: c.hd },
    lasten: { g0: c.g0, g: c.g, psi: c.psi, ws: c.ws, nek: c.nek },
    tragfaehigkeit: { frk, FRd, Ncr: c.Ncr, V10: c.V10, V5: c.V5 },
    linear: { seillaenge: c.L, minBefProM: minBef, maxAbstand, anzahl, LV },
    schnittgroessen: { Vd, Nd, NEd, wL1, wL2 },
    nachweise,
    produkt: { laenge: Lgew, bezeichnung: Lgew ? `SET EJOT Iso-Bar ECO ${Lgew}` : "keine passende Länge" },
  };
}

// ── Linear MAUERWERK ──
export function computeLinearMauerwerk(input) {
  const c = commonLinear(input);
  const stein = STEINE[input.steinart || "ks_vollstein"];
  if (!stein) throw new Error(`Unbekannte Steinart: ${input.steinart}`);
  const { NRd, NRdd, VRd } = steinTragfaehigkeit(stein);

  // Linien-Bezugskräfte (kN/m)
  const NEd_line = c.ws * c.psi * 0.7 * 1.5;             // J21
  const VEd_line = c.g * 1.35;                           // J22
  const NEdd_line = c.nek * c.psi * 0.7 * 1.5;          // J24

  const mb = {
    zug:    NEd_line / NRd,                              // C4
    druck:  NEdd_line / NRdd,                            // C5
    quer:   VEd_line / VRd,                              // C6
  };
  mb.zugQuer   = mb.quer + mb.zug;                       // C7
  mb.druckQuer = mb.druck + mb.quer;                     // C8
  mb.verformL1 = VEd_line / c.V10;                       // C9
  mb.verformL2 = VEd_line / c.V5;                        // C10
  const minBef = Math.max(...Object.values(mb));         // C12
  const maxAbstand = 1 / minBef;                         // C13  (1/minBef, NICHT √)
  const anzahl = roundUp(c.L * minBef);                  // B45 = ⌈L·minBef⌉
  const LV = c.L / (anzahl - 1);                         // B48

  const wsI  = (c.ws * c.L * 0.7) / anzahl;              // B46
  const nekI = (c.nek * c.L * 0.7) / anzahl;             // B47
  const NEdz = wsI * c.psi * 1.5;                        // B51
  const NEdd = nekI * c.psi * 1.5;                       // B54
  const VEd  = c.g * LV * 1.35;                          // B81
  const wL1  = VEd * 1000 * c.l1 ** 3 / 3 / c.K.E / c.K.I;                                  // B91
  const wL2  = -1 / c.K.E / c.K.I * (VEd * 1000 / 6 * c.l2 ** 3 - VEd * 1000 * c.l1 * c.l2 ** 2 / 2); // B92

  const nZug = NEdz / NRd, nDruck = NEdd / NRdd, nQuer = VEd / VRd;
  const nachweise = {
    zug:           { wert: nZug,           grenze: 1 },
    druck:         { wert: nDruck,         grenze: 1 },
    quer:          { wert: nQuer,          grenze: 1 },
    kombiZugQuer:  { wert: nZug + nQuer,   grenze: 1 },
    kombiDruckQuer:{ wert: nDruck + nQuer, grenze: 1 },
    knicken:       { wert: NEdd / (c.Ncr / c.K.gammaME), grenze: 1 },
    stahlDruck:    { wert: NEdd / c.K.Fd,  grenze: 1 },
    verformungL1:  { wert: wL1 * 1.5, grenze: 10, einheit: "mm" },
    verformungL2:  { wert: wL2 * 1.5, grenze: 5,  einheit: "mm" },
  };
  for (const nw of Object.values(nachweise)) nw.ok = nw.wert <= nw.grenze;

  const Lmin = c.e + stein.hef;
  const Lgew = ECO_LAENGEN_MW.find((Lx) => Lx >= Lmin) ?? null;

  return {
    system: "linear", untergrund: "mauerwerk",
    geometrie: { e: c.e, l1: c.l1, l2: c.l2, Lmin },
    wind: { qref: c.qref, qz: c.qz, cpeA: c.cpeA, hd: c.hd },
    lasten: { g0: c.g0, g: c.g, psi: c.psi, ws: c.ws, nek: c.nek },
    tragfaehigkeit: { nrk: stein.nrk, vrk: stein.vrk, alphaDruck: stein.alphaDruck,
                      gammaMm: stein.gammaMm, NRd, NRdd, VRd, Ncr: c.Ncr, V10: c.V10, V5: c.V5 },
    linear: { seillaenge: c.L, minBefProM: minBef, maxAbstand, anzahl, LV },
    schnittgroessen: { NEdz, NEdd, VEd, wL1, wL2 },
    nachweise,
    produkt: { laenge: Lgew, bezeichnung: Lgew ? `SET EJOT Iso-Bar ECO ${Lgew}` : "keine passende Länge", stein: stein.label },
  };
}
