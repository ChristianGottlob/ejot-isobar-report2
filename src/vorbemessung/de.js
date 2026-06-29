// ─────────────────────────────────────────────────────────────────────────
// Vorbemessung Deutschland — EJOT Iso-Bar ECO, System "Raster", Untergrund Beton.
//
// Reine Rechen-Engine (keine UI, keine Seiteneffekte).  1:1-Nachbau der
// EJOT-Excel "Vorbemessung Iso Bar Eco Raster Beton".  Jede Zwischengröße ist
// mit ihrer Excel-Zelle annotiert, damit die Werte nachvollziehbar bleiben.
//
// Kette:  q(z) → cpe(Wand) → Lasten (ws, Nek, g, ψ) → FRd → min. Befestiger/m²
//         → Raster LH/LV → Nachweise (Zug/Quer/Druck/Verformung) → Produktwahl.
//
// Quelle der Wahrheit:
//   public/Vorbemessung_Deutschland/2025 03 12 … Raster Beton … .xlsx
//   Sheets: Eingabe, q(z), " CPE Wand", Lastklassen, "MIndestanzahl Bef._m²",
//           Berechnung_de, Längenwahl.
//
// Normbezug: DIN EN 1991-1-4/NA (Wind), Zulassung Z-21.8-2083 (Anker/Beton),
//            FLL-Richtlinie (Bewuchslasten).
// ─────────────────────────────────────────────────────────────────────────

// ── Lastklassen-Tabelle (Sheet "Lastklassen", Spalten C..G = LK 1..5) ──
// Das Excel nimmt für die Gewichtskraft die Zeile "schmaler Bewuchs (bis 1 m
// breit)" (HLOOKUP-Index 3) — nicht die flächige Zeile.  ψ = Durchströmung.
export const LASTKLASSEN = {
  //         LK:   1     2     3     4     5
  flaechig:    [   6,   11,   15,   17,   24],   // kg/m² (Info, nicht in Rechnung)
  schmal:      [   6,   14,   19,   26,   42],   // kg/m² — DIESE Zeile geht in g ein
  linear:      [   6,   13,   18,   20,   28],   // kg/m² (Info)
  durchstroemung: [0.55, 0.60, 0.60, 0.65, 0.70], // ψ
};

// ── Windzonen: Referenz-Geschwindigkeitsdruck qref [kN/m²] (DIN EN 1991-1-4/NA) ──
export const WINDZONEN_QREF = { 1: 0.32, 2: 0.39, 3: 0.47, 4: 0.56 };

// ── Geländekategorie-Profile: q_p(z) = Faktor·qref·(z/10)^exp, höhenabhängig.
// Faktoren exakt aus Sheet "q(z)".  Nordsee multipliziert qref bewusst NICHT
// (so im Original-Sheet hinterlegt — Sonderprofil; bei Bedarf normseitig prüfen).
// Jeder Eintrag: { zMax, f, exp, useQref } — erster zutreffender (z ≤ zMax) gilt.
export const GK_PROFILE = {
  I:            [ { zMax: 2,   f: 1.9, exp: 0,    useQref: true },
                  { zMax: 300, f: 2.6, exp: 0.19, useQref: true } ],
  II:           [ { zMax: 4,   f: 1.7, exp: 0,    useQref: true },
                  { zMax: 50,  f: 2.1, exp: 0.24, useQref: true },
                  { zMax: 300, f: 2.6, exp: 0.19, useQref: true } ],
  III:          [ { zMax: 8,   f: 1.5, exp: 0,    useQref: true },
                  { zMax: 50,  f: 1.6, exp: 0.31, useQref: true },
                  { zMax: 300, f: 2.1, exp: 0.24, useQref: true } ],
  IV:           [ { zMax: 16,  f: 1.3, exp: 0,    useQref: true },
                  { zMax: 50,  f: 1.1, exp: 0.4,  useQref: true },
                  // Sheet-Zelle B36 referenziert versehentlich falsche Zellen;
                  // hier die offensichtlich gemeinte Fortsetzung (wie GK III 50–300-Muster).
                  { zMax: 300, f: 1.6, exp: 0.31, useQref: true } ],
  binnenland:   [ { zMax: 7,   f: 1.5, exp: 0,    useQref: true },
                  { zMax: 50,  f: 1.7, exp: 0.37, useQref: true },
                  { zMax: 300, f: 2.1, exp: 0.24, useQref: true } ],
  kueste_ostsee:[ { zMax: 4,   f: 1.8, exp: 0,    useQref: true },
                  { zMax: 50,  f: 2.3, exp: 0.27, useQref: true },
                  { zMax: 300, f: 2.6, exp: 0.19, useQref: true } ],
  nordsee:      [ { zMax: 2,   f: 1.1, exp: 0,    useQref: false },
                  { zMax: 300, f: 1.5, exp: 0.19, useQref: false } ],
};

// ── cpe,1 Bereich A (maßgebliche Sog-Ecke), Sheet " CPE Wand" (Tabelle 7.1) ──
// Werte für h/d ≥ 5 bzw. h/d ≤ 1.  Das Excel wählt hart: h/d ≥ 5 → -1,7, sonst -1,4.
const CPE_A_HD_GE5 = -1.7;
const CPE_A_HD_LT5 = -1.4;

// ── Untergrund Beton: Anker-/Bauteilparameter (Zulassung Z-21.8-2083) ──
// WICHTIG (belegt durch Z-21.8-2083 Tabelle 12, eingebettetes Bild im Workbook):
// Die charakteristische Tragfähigkeit FRk des Iso-Bar in Beton ist
// produkt-/stahlbestimmt und hängt NICHT von der Betonklasse ab, sondern nur von
// der Bauteiltemperatur: 6,0 kN bei ≤24/40 °C, 5,5 kN bei ≤50/80 °C; γM = 1,8.
// Sie gilt damit für alle Betonklassen ≥ C20/25 (Anker-Montagewerte hef etc. sind
// nach Tabelle 5 ebenfalls klassenunabhängig).  Die Betonklasse ist daher nur
// dokumentarisch (Report) — alle Klassen sind rechenbar.
export const BETON_KLASSEN = {
  c2025: { label: "Beton C20/25", hef: 40 },
  c2530: { label: "Beton C25/30", hef: 40 },
  c3037: { label: "Beton C30/37", hef: 40 },
  c3545: { label: "Beton C35/45", hef: 40 },
  c4050: { label: "Beton C40/50", hef: 40 },
  c4555: { label: "Beton C45/55", hef: 40 },
  c5060: { label: "Beton C50/60", hef: 40 },
};
// FRk [kN] nach Bauteiltemperatur (Z-21.8-2083 Tabelle 12).
export const BETON_FRK = { normal: 6.0, hoch: 5.5 };
export const BETON_TEMPERATUR = {
  normal: "≤ 24/40 °C (Standard)",
  hoch:   "≤ 50/80 °C (erhöhte Temperatur)",
};

// Bauteil-/Materialkonstanten des Iso-Bar selbst (Z-21.8-2083) — identisch für
// Beton UND Mauerwerk (nur der Verankerungsgrund/Widerstand unterscheidet sich).
export const BAUTEIL_KONST = {
  a:        5,      // Abstand WDVS–Anbauteil [mm]
  La:       80,     // Anbauteillänge [mm]
  d2:       20,     // Nenndurchmesser [mm]
  gammaME:  1.3,    // γM,E
  Fd:       64,     // max. Druckkraft [kN]
  E:        60000,  // E-Modul [N/mm²]
  I:        7854,   // Trägheitsmoment [mm⁴]
  knickB:   2,      // Knickbeiwert b
};
// Beton: Bauteilkonstanten + ankerspezifische Beiwerte.
export const BETON_KONST = {
  ...BAUTEIL_KONST,
  gammaM:   1.8,    // γM Anker (B23)
  psi0sus:  0.6,    // ψ0,sus (B21)
};

// ── Standard-Bestelllängen "Raster"-Set [mm] (Sheet "Längenwahl" F11-Block) ──
export const ECO_LAENGEN_RASTER = [200, 260, 320, 380, 440, 500];

// ── Helfer ──
const num = (v) => (typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")));

// q_p(z): Böengeschwindigkeitsdruck [kN/m²] aus Windzone, GK-Profil und Höhe z.
export function windQz({ windzone, gelaendekategorie, z }) {
  const qref = WINDZONEN_QREF[windzone];
  const profile = GK_PROFILE[gelaendekategorie];
  if (qref == null) throw new Error(`Unbekannte Windzone: ${windzone}`);
  if (!profile)     throw new Error(`Unbekannte Geländekategorie: ${gelaendekategorie}`);
  const seg = profile.find((s) => z <= s.zMax) || profile[profile.length - 1];
  const base = seg.useQref ? qref : 1;
  const shape = seg.exp ? Math.pow(z / 10, seg.exp) : 1;
  return seg.f * base * shape;
}

// cpe,1 Bereich A (Sog) und Bereich D (Druck) aus Wandgeometrie.
export function cpeWand({ gebaeudelaenge, gebaeudebreite, gebaeudehoehe }) {
  const d = gebaeudelaenge, b = gebaeudebreite, h = gebaeudehoehe;
  const e = Math.min(b, 2 * h);            // D5
  const hd = Math.max(h / d, h / b);       // D6 (= h/d, robust gegen d>b)
  const cpeA = hd >= 5 ? CPE_A_HD_GE5 : CPE_A_HD_LT5;   // D8
  return { e, hd, cpeA, cpeD: 1.0 };
}

// FRd [kN] aus FRk, Lastverhältnis (asus) und γM.
export function frd({ frk, g, ws, gammaM, psi0sus }) {
  const asus = g / Math.sqrt(g * g + ws * ws);          // B20
  const psisus = asus < psi0sus ? 1 : psi0sus + 1 - asus; // B22
  return { asus, psisus, FRd: (frk * psisus) / gammaM };  // B24
}

// Vollständige DE-Vorbemessung (Raster, Beton).
export function computeVorbemessungDE(input) {
  // ── Eingaben normalisieren ──
  const z   = num(input.gebaeudehoehe);
  const d   = num(input.gebaeudelaenge);
  const b   = num(input.gebaeudebreite);
  const wz  = Number(input.windzone);
  const gk  = String(input.gelaendekategorie);
  const lk  = Number(input.lastklasse);                 // 1..5
  const daemm = num(input.daemmdicke);                  // mm
  const putz  = num(input.putzdicke);                   // mm
  const ttol  = num(input.ttol);                        // mm (Kleber+Altputz)
  const klasseKey = input.betonklasse || "c2025";
  const klasse = BETON_KLASSEN[klasseKey];
  if (!klasse) throw new Error(`Unbekannte Betonklasse: ${klasseKey}`);
  const tempKey = input.temperatur === "hoch" ? "hoch" : "normal";
  const frk = BETON_FRK[tempKey];           // FRk klassenunabhängig, nur temperaturabhängig
  const K = BETON_KONST;
  const li = lk - 1;                                     // 0-basierter Index

  // ── Geometrie [mm] ──
  const tWDVS = daemm + putz;                            // B7
  const e = tWDVS + ttol;                                // B14  (= e)
  const l1 = e + K.a + 0.5 * K.d2 + K.La;               // B76  Hebelarm lges
  const l2 = l1 - K.La - 15;                            // B77  Hebelarm am Putz

  // ── Wind ── (Override für Österreich/ÖNORM via input.wind = {ws, nek, qz, cpeA})
  let qz, cpeA, hd;
  if (input.wind) {
    ({ qz = input.wind.nek, cpeA, hd } = input.wind);
  } else {
    qz = windQz({ windzone: wz, gelaendekategorie: gk, z });        // q(z)!B38
    ({ hd, cpeA } = cpeWand({ gebaeudelaenge: d, gebaeudebreite: b, gebaeudehoehe: z }));
  }

  // ── Flächenlasten [kN/m²] ──
  const g0 = LASTKLASSEN.schmal[li] / 100;              // B38
  const g = g0 * 0.75 * 1.8;                            // B39  (Vereisung +80% −25%)
  const psi = LASTKLASSEN.durchstroemung[li];           // B40
  const ws = input.wind ? input.wind.ws : qz * cpeA * -1;  // B41  Windsog (positiv)
  const nek = input.wind ? input.wind.nek : qz;            // B42  Winddruck

  // ── Tragfähigkeit ──
  const { asus, psisus, FRd } = frd({
    frk, g, ws, gammaM: K.gammaM, psi0sus: K.psi0sus,
  });

  // ── Steifigkeits-/Knickgrößen ──
  const Ncr = (Math.PI ** 2 * (K.E / K.gammaME) * K.I / (e + K.a) ** 2) / 1000;  // B53
  const V10 = (3 * K.E * K.I * 6.66) / l1 ** 3 / 1000;                           // G10 (10mm/1,5)
  const V5  = (6 * K.E * K.I * 3.33) / l2 ** 2 / (3 * l1 - l2) / 1000;           // G11 (5mm/1,5)

  // ── Min. Befestiger/m² (Sheet "MIndestanzahl Bef._m²") ──
  const mb = {
    zug:          (ws * psi * 1.5) / FRd,                 // C4
    druckKnicken: (nek * psi * 1.5) / (Ncr / K.gammaME),  // C5
    druckBeton:   (nek * psi * 1.5) / K.Fd,               // C6
    quer:         (g * 1.35) / FRd,                       // C7
  };
  mb.zugQuer   = mb.zug + mb.quer;                        // C8
  mb.druckQuer = mb.quer + Math.max(mb.druckKnicken, mb.druckBeton); // C9
  mb.verformL1 = (g * 1.35) / V10;                        // C10
  mb.verformL2 = (g * 1.35) / V5;                         // C11
  const minBef = Math.max(...Object.values(mb));          // C13
  const LH = Math.sqrt(1 / minBef);                       // C14
  const LV = LH;                                          // quadratisches Raster

  // ── Endgültige Nachweise mit gewähltem LH/LV ──
  const Vd  = LH * LV * g * 1.35;                          // B46
  const Nd  = LH * LV * ws * psi * 1.5;                    // B47
  const NEd = nek * LH * LV * psi * 1.5;                   // B52
  const wL1 = (Vd * 1000) * l1 ** 3 / 3 / K.E / K.I;       // B78
  const wL2 = -1 / K.E / K.I * (Vd * 1000 * l2 ** 3 / 6 - Vd * 1000 * l1 * l2 ** 2 / 2); // B79

  const nachweise = {
    zugQuerKombi: { wert: Math.sqrt(Vd * Vd + Nd * Nd) / FRd, grenze: 1 },  // B50 (maßgeblich)
    zug:          { wert: Vd / FRd,            grenze: 1 },                  // B48
    quer:         { wert: Nd / FRd,            grenze: 1 },                  // B49 (Nd/FRd)
    druckKnicken: { wert: NEd / (Ncr / K.gammaME), grenze: 1 },             // B73
    druckBeton:   { wert: NEd / K.Fd,          grenze: 1 },                  // B74
    verformungL1: { wert: wL1 * 1.5, grenze: 10, einheit: "mm" },           // B80
    verformungL2: { wert: wL2 * 1.5, grenze: 5,  einheit: "mm" },           // B81
  };
  for (const nw of Object.values(nachweise)) nw.ok = nw.wert <= nw.grenze;

  // ── Produkt-/Längenwahl ──
  const Lmin = e + klasse.hef;                            // Längenwahl!B7
  const Lgew = ECO_LAENGEN_RASTER.find((L) => L >= Lmin) ?? null;
  const produkt = Lgew ? `SET EJOT Iso-Bar ECO ${Lgew}` : "keine passende Länge";

  return {
    // Eingang/Geometrie
    geometrie: { tWDVS, e, l1, l2, Lmin },
    // Wind
    wind: { qref: WINDZONEN_QREF[wz], qz, cpeA, hd },
    // Lasten
    lasten: { g0, g, psi, ws, nek },
    // Tragfähigkeit
    tragfaehigkeit: { frk, temperatur: tempKey, asus, psisus, FRd, Ncr, V10, V5 },
    // Raster
    raster: { minBefProM2: minBef, minBefDetail: mb, LH, LV, stk_m2: minBef },
    // Schnittgrößen
    schnittgroessen: { Vd, Nd, NEd, wL1, wL2 },
    // Nachweise
    nachweise,
    // Produkt
    produkt: { laenge: Lgew, bezeichnung: produkt, betonklasse: klasse.label },
  };
}

export default computeVorbemessungDE;
