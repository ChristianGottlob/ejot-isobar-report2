// ─────────────────────────────────────────────────────────────────────────
// Vorbemessung Deutschland — EJOT Iso-Bar ECO, System "Raster", Untergrund
// Mauerwerk.  Reine Rechen-Engine (keine UI, keine Seiteneffekte).  1:1-Nachbau
// der EJOT-Excel "Vorbemessung Iso Bar Eco Raster Mauerwerk".
//
// Teilt Windlast (q(z)), Wand-cpe, Lastklassen und die Bauteilkonstanten des
// Iso-Bar mit der Beton-Engine (src/vorbemessung/de.js).  Unterschiede zu Beton:
//   - Verankerungswiderstand kommt je STEINART aus der Tabelle "Steine"
//     (Z-21.8-2083 Tabelle 14/15/16) statt aus einer festen Beton-Zulassung.
//   - NR,d = NR,k · aj / γM,m   (aj = 0,75; γM,m steinabhängig: 2,5 / Porenbeton 2,0)
//   - Druckwiderstand des Steins:  NR,d,d = α_Druck · NR,d
//   - Querwiderstand:              V_Rd  = V_Rk · aj / γM,m
//   - Interaktion LINEAR:  NEd,z/NRd + VEd/VRd ≤ 1  und  NEd,d/NRd,d + VEd/VRd ≤ 1
//     (Beton nutzt die Wurzel-Interaktion √(Vd²+Nd²)/FRd).
//
// Quelle der Wahrheit:
//   public/Vorbemessung_Deutschland/2026 01 12 … Raster Mauerwerk … .xlsm
//   Sheets: Eingabe, q(z), " CPE Wand", Lastklassen, Steine,
//           "MIndestanzahl Bef._m²", Berechnung_de, Längenwahl.
// ─────────────────────────────────────────────────────────────────────────

import { windQz, cpeWand, LASTKLASSEN, BAUTEIL_KONST, WINDZONEN_QREF } from "./de.js";

// ── Steintabelle (Sheet "Steine", Z-21.8-2083 Tabelle 14/15/16) ──
// Je Stein die in Berechnung_de per VLOOKUP genutzten Werte:
//   druckf  – Druckfestigkeit [N/mm²]   (nur Doku)
//   gammaMm – γM,m  (2,5; Porenbeton 2,0)
//   rohdichte [kg/dm³]                  (nur Doku)
//   nrk     – N_Rk Zug (d/d) [kN]
//   alphaDruck – α_Druck [-]
//   vrk     – V_Rk (d/d) [kN]
//   hef     – Verankerungstiefe [mm]
//   smin    – Achsabstand s_cr,II [mm]  (nur Doku)
export const STEINE = {
  vollziegel:   { label: "Vollziegel Mz",            druckf: 12, gammaMm: 2.5, rohdichte: 1.9,  nrk: 2.2, alphaDruck: 1.0, vrk: 0.5, hef: 80,  smin: 235 },
  ks_vollstein: { label: "Kalksand-Vollstein KS",    druckf: 12, gammaMm: 2.5, rohdichte: 1.8,  nrk: 3.1, alphaDruck: 1.0, vrk: 1.3, hef: 80,  smin: 250 },
  lbv:          { label: "Leichtbeton-Vollstein V",  druckf: 2,  gammaMm: 2.5, rohdichte: 0.65, nrk: 1.2, alphaDruck: 1.0, vrk: 1.2, hef: 80,  smin: 250 },
  hbl:          { label: "Hohlblock-Leichtbeton Hbl",druckf: 2,  gammaMm: 2.5, rohdichte: 0.5,  nrk: 0.8, alphaDruck: 1.0, vrk: 1.2, hef: 80,  smin: 250 },
  ksl:          { label: "Kalksand-Lochstein KSL",   druckf: 12, gammaMm: 2.5, rohdichte: 1.5,  nrk: 1.9, alphaDruck: 0.4, vrk: 1.3, hef: 80,  smin: 240 },
  hlz1:         { label: "Hochloch-Ziegel I (RD 0,9)",druckf:12, gammaMm: 2.5, rohdichte: 0.9,  nrk: 1.9, alphaDruck: 0.2, vrk: 0.5, hef: 80,  smin: 240 },
  hlz2:         { label: "Hochloch-Ziegel II (RD 1,07)",druckf:24,gammaMm: 2.5, rohdichte: 1.07, nrk: 3.2, alphaDruck: 0.7, vrk: 0.5, hef: 80,  smin: 370 },
  pp:           { label: "Porenbeton PP",            druckf: 4,  gammaMm: 2.0, rohdichte: 0.5,  nrk: 3.3, alphaDruck: 1.0, vrk: 0.7, hef: 100, smin: 300 },
};

export const AJ = 0.75;   // Beiwert aj (Berechnung_de B17), fest

// Standard-Bestelllängen "Raster"-Set Mauerwerk [mm] (Längenwahl-Block, nur bis 380).
export const ECO_LAENGEN_MW = [200, 260, 320, 380];

const num = (v) => (typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")));

// NR,d / NR,d,d / V_Rd aus Steinwiderständen.
export function steinTragfaehigkeit(stein) {
  const NRd  = (stein.nrk * AJ) / stein.gammaMm;        // B19
  const NRdd = stein.alphaDruck * NRd;                  // B51
  const VRd  = (stein.vrk * AJ) / stein.gammaMm;        // B78
  return { NRd, NRdd, VRd };
}

// Vollständige DE-Vorbemessung (Raster, Mauerwerk).
export function computeVorbemessungMW(input) {
  const z   = num(input.gebaeudehoehe);
  const d   = num(input.gebaeudelaenge);
  const b   = num(input.gebaeudebreite);
  const wz  = Number(input.windzone);
  const gk  = String(input.gelaendekategorie);
  const lk  = Number(input.lastklasse);
  const daemm = num(input.daemmdicke);
  const putz  = num(input.putzdicke);
  const ttol  = num(input.ttol);
  const steinKey = input.steinart || "ks_vollstein";
  const stein = STEINE[steinKey];
  if (!stein) throw new Error(`Unbekannte Steinart: ${steinKey}`);
  const K = BAUTEIL_KONST;
  const li = lk - 1;

  // ── Geometrie [mm] ──
  const tWDVS = daemm + putz;                            // B6
  const e = tWDVS + ttol;                                // B15
  const l1 = e + K.a + 0.5 * K.d2 + K.La;               // B84
  const l2 = l1 - K.La - 15;                            // B85

  // ── Wind (identisch zu Beton; Override für Österreich via input.wind) ──
  let qz, cpeA, hd;
  if (input.wind) {
    ({ qz = input.wind.nek, cpeA, hd } = input.wind);
  } else {
    qz = windQz({ windzone: wz, gelaendekategorie: gk, z });
    ({ cpeA, hd } = cpeWand({ gebaeudelaenge: d, gebaeudebreite: b, gebaeudehoehe: z }));
  }

  // ── Flächenlasten ──
  const g0 = LASTKLASSEN.schmal[li] / 100;              // B37
  const g = g0 * 0.75 * 1.8;                            // B38
  const psi = LASTKLASSEN.durchstroemung[li];           // B39
  const ws = input.wind ? input.wind.ws : qz * cpeA * -1;  // B40
  const nek = input.wind ? input.wind.nek : qz;            // B41

  // ── Stein-Tragfähigkeiten ──
  const { NRd, NRdd, VRd } = steinTragfaehigkeit(stein);

  // ── Steifigkeits-/Knickgrößen (Iso-Bar, wie Beton) ──
  const Ncr = (Math.PI ** 2 * (K.E / K.gammaME) * K.I / (e + K.a) ** 2) / 1000;  // B53
  const V10 = (3 * K.E * K.I * 6.66) / l1 ** 3 / 1000;                           // G9
  const V5  = (6 * K.E * K.I * 3.33) / l2 ** 2 / (3 * l1 - l2) / 1000;           // G10

  // ── Min. Befestiger/m² (Sheet "MIndestanzahl Bef._m²") ──
  const mb = {
    zug:       (ws * psi * 1.5) / NRd,                   // C4
    druck:     (nek * 1.5 * psi) / NRdd,                 // C5
    quer:      (g * 1.35) / VRd,                         // C6
  };
  mb.zugQuer   = mb.zug + mb.quer;                       // C7
  mb.druckQuer = mb.druck + mb.quer;                     // C8
  mb.verformL1 = (g * 1.35) / V10;                       // C9
  mb.verformL2 = (g * 1.35) / V5;                        // C10
  const minBef = Math.max(...Object.values(mb));         // C12
  const LH = Math.sqrt(1 / minBef);                      // C13
  const LV = LH;

  // ── Endgültige Nachweise mit LH/LV ──
  const NEdz = LH * LV * ws * psi * 1.5;                  // B46  Zug
  const NEdd = LH * LV * nek * psi * 1.5;                 // B49  Druck
  const VEd  = LH * LV * g * 1.35;                        // B76  Quer (aus Eigenlast)
  const wL1  = (VEd * 1000) * l1 ** 3 / 3 / K.E / K.I;    // B86
  const wL2  = -1 / K.E / K.I * (VEd * 1000 / 6 * l2 ** 3 - VEd * 1000 * l1 * l2 ** 2 / 2); // B87

  const nZug   = NEdz / NRd;                              // B47
  const nDruck = NEdd / NRdd;                             // B52
  const nQuer  = VEd / VRd;                               // B79

  const nachweise = {
    zug:          { wert: nZug,          grenze: 1 },                       // B47
    druck:        { wert: nDruck,        grenze: 1 },                       // B52
    quer:         { wert: nQuer,         grenze: 1 },                       // B79
    kombiZugQuer: { wert: nZug + nQuer,  grenze: 1 },                       // B81 (maßgeblich)
    kombiDruckQuer:{ wert: nDruck + nQuer, grenze: 1 },                     // B82
    knicken:      { wert: NEdd / (Ncr / K.gammaME), grenze: 1 },            // B73
    stahlDruck:   { wert: NEdd / K.Fd,   grenze: 1 },                       // B74
    verformungL1: { wert: wL1 * 1.5, grenze: 10, einheit: "mm" },          // B88
    verformungL2: { wert: wL2 * 1.5, grenze: 5,  einheit: "mm" },          // B89
  };
  for (const nw of Object.values(nachweise)) nw.ok = nw.wert <= nw.grenze;

  // ── Produkt-/Längenwahl ──
  const Lmin = e + stein.hef;                            // Längenwahl!B7
  const Lgew = ECO_LAENGEN_MW.find((L) => L >= Lmin) ?? null;
  const produkt = Lgew ? `SET EJOT Iso-Bar ECO ${Lgew}` : "keine passende Länge";

  return {
    geometrie: { tWDVS, e, l1, l2, Lmin },
    wind: { qref: WINDZONEN_QREF[wz], qz, cpeA, hd },
    lasten: { g0, g, psi, ws, nek },
    tragfaehigkeit: { nrk: stein.nrk, vrk: stein.vrk, alphaDruck: stein.alphaDruck,
                      gammaMm: stein.gammaMm, NRd, NRdd, VRd, Ncr, V10, V5 },
    raster: { minBefProM2: minBef, minBefDetail: mb, LH, LV, stk_m2: minBef },
    schnittgroessen: { NEdz, NEdd, VEd, wL1, wL2 },
    nachweise,
    produkt: { laenge: Lgew, bezeichnung: produkt, stein: stein.label },
  };
}

export default computeVorbemessungMW;
