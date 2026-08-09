// Regression gegen echte EJOT-Austria-Vorbemessungen (Florian Kassler, 2026).
// Diese Fälle deckten drei Fehler auf, die zu völlig anderen Ergebnissen führten:
//   1. Pflanzengewicht kam immer aus der FLL-Tabelle statt aus der Kundenangabe
//   2. Windsog immer aus dem Randbereich; die Sheets weisen auch den Regelbereich aus
//   3. Unbekannter Ort → stiller Rückfall auf die deutsche Windzonen-Rechnung
import test from "node:test";
import assert from "node:assert/strict";
import { windAUT, findStadt, cpeB_AUT } from "./de_at_wind.js";
import { computeVorbemessungDE } from "./de.js";
import { computeLinearBeton } from "./de_linear.js";

// PDF-Werte sind auf 2–3 Stellen gerundet → absolute Toleranz statt relativer.
const near = (a, b, tol, what) =>
  assert.ok(Math.abs(a - b) <= tol, `${what}: ${a.toFixed(4)} erwartet ${b} (±${tol})`);

function atWind(stadtName, { sh, gk, h, L, B, bereich }) {
  const st = findStadt(stadtName);
  assert.ok(st, `Ort nicht gefunden: ${stadtName}`);
  return windAUT({ vb0: st.vb0, seehoeheStadt: st.seehoehe, seehoehe: sh,
    gelaendekategorie: gk, gebaeudehoehe: h, gebaeudelaenge: L, gebaeudebreite: B, bereich });
}

function raster({ wind, lk, g0, daemm, ttol }) {
  return computeVorbemessungDE({
    gebaeudehoehe: 10, gebaeudelaenge: 10, gebaeudebreite: 10,
    windzone: 2, gelaendekategorie: "II", lastklasse: lk,
    daemmdicke: daemm, putzdicke: 0, ttol,
    betonklasse: "c2025", temperatur: "normal",
    pflanzengewicht: g0,
    wind: { ws: wind.ws, nek: wind.nek, qz: wind.nek, cpeA: wind.cpeS },
  });
}

test("Windlast Linz: qp trifft die Vorbemessung exakt", () => {
  const w = atWind("Linz", { sh: 261, gk: "III", h: 7, L: 202, B: 90, bereich: "rand" });
  near(w.qb, 0.469, 0.001, "qb");
  near(w.ce, 1.75, 0.005, "ce(z)");
  near(w.qp, 0.821, 0.001, "qp");
});

test("Rand- und Regelbereich werden beide korrekt geliefert", () => {
  const geo = { sh: 261, gk: "III", h: 7, L: 202, B: 90 };
  const rand = atWind("Linz", { ...geo, bereich: "rand" });
  const regel = atWind("Linz", { ...geo, bereich: "regel" });
  near(rand.cpeA, -1.25, 0.005, "cpe,A");        // PDF: -1,25
  near(regel.cpeS, -0.88, 0.006, "cpe,B");       // PDF: -0,88
  near(rand.ws, 1.026, 0.002, "ws Randbereich"); // PDF: -1,026
  near(regel.ws, 0.719, 0.002, "ws Regelbereich");// PDF: -0,719
  assert.ok(rand.ws > regel.ws, "Randbereich muss ungünstiger sein");
});

test("cpe,B-Tabelle wird tatsächlich benutzt (war toter Code)", () => {
  assert.equal(typeof cpeB_AUT, "function");
  assert.ok(cpeB_AUT(20, 15, 25) < 0);
});

test("Meidling / Akebia quinata – Kundenangabe 6 kg/m² statt FLL-Tabelle", () => {
  const w = atWind("Wien, alle übrige B.", { sh: 214, gk: "III", h: 8, L: 33, B: 14, bereich: "rand" });
  near(w.qp, 0.689, 0.001, "qp");
  near(w.ws, 0.865, 0.002, "ws");
  const r = raster({ wind: w, lk: 2, g0: 6, daemm: 205, ttol: 10 });
  near(r.lasten.g0, 0.06, 0.0001, "g0 (Kundenangabe)");
  const A = 1.6 * 1.6;                                    // im PDF gewähltes Raster
  near(A * r.lasten.g * 1.35, 0.28, 0.005, "Vd");
  near(A * w.ws * r.lasten.psi * 1.5, 1.99, 0.01, "Nd");
  near(A * w.nek * r.lasten.psi * 1.5, 1.59, 0.01, "NEd");
});

test("Meidling / Aristolochia – 10 kg/m², Raster 1,25 m", () => {
  const w = atWind("Wien, alle übrige B.", { sh: 214, gk: "III", h: 8, L: 33, B: 14, bereich: "rand" });
  const r = raster({ wind: w, lk: 2, g0: 10, daemm: 205, ttol: 10 });
  const A = 1.25 * 1.25;
  near(A * r.lasten.g * 1.35, 0.285, 0.006, "Vd");
  near(A * w.ws * r.lasten.psi * 1.5, 1.22, 0.01, "Nd");
  near(A * w.nek * r.lasten.psi * 1.5, 0.97, 0.01, "NEd");
});

test("Mackgasse – Gewicht deckt sich hier mit der FLL-Tabelle", () => {
  const w = atWind("Perchtolsdorf", { sh: 265, gk: "III", h: 12, L: 30, B: 15, bereich: "rand" });
  near(w.qp, 0.726, 0.004, "qp");
  near(w.ws, 0.926, 0.002, "ws");
  const r = raster({ wind: w, lk: 2, g0: 14, daemm: 205, ttol: 5 });
  const A = 0.5 * 1.5;
  near(A * r.lasten.g * 1.35, 0.19, 0.005, "Vd");
  near(A * w.ws * r.lasten.psi * 1.5, 0.63, 0.01, "Nd");
});

test("Kaufland Raster – Regelbereich + 18 kg/m²", () => {
  const w = atWind("Linz", { sh: 261, gk: "III", h: 7, L: 202, B: 90, bereich: "regel" });
  const r = raster({ wind: w, lk: 3, g0: 18, daemm: 170, ttol: 10 });
  const A = 0.9 * 1.45;
  near(A * r.lasten.g * 1.35, 0.43, 0.005, "Vd");
  near(A * w.ws * r.lasten.psi * 1.5, 0.84, 0.01, "Nd");
  near(A * w.nek * r.lasten.psi * 1.5, 0.96, 0.01, "NEd");
});

test("Ohne Kundenangabe bleibt der FLL-Tabellenwert maßgebend", () => {
  const w = atWind("Linz", { sh: 261, gk: "III", h: 7, L: 202, B: 90, bereich: "rand" });
  const mitAngabe = raster({ wind: w, lk: 2, g0: 6, daemm: 170, ttol: 10 });
  const ohne     = raster({ wind: w, lk: 2, g0: "", daemm: 170, ttol: 10 });
  near(mitAngabe.lasten.g0, 0.06, 1e-9, "mit Angabe");
  near(ohne.lasten.g0, 0.14, 1e-9, "ohne Angabe = FLL LK2 schmal (14 kg/m²)");
});

test("Linear: Lastbreite je Seil ist einstellbar (war fest 0,7 m)", () => {
  const base = {
    gebaeudehoehe: 20, gebaeudelaenge: 25, gebaeudebreite: 15,
    windzone: 2, gelaendekategorie: "II", lastklasse: 2,
    daemmdicke: 170, putzdicke: 0, ttol: 10,
    betonklasse: "c2025", temperatur: "normal",
    seillaenge: 16.75, pflanzengewicht: 9,
    wind: { ws: 0.675, nek: 0.733, qz: 0.733, cpeA: -0.92 },
  };
  const b07 = computeLinearBeton({ ...base });
  const b03 = computeLinearBeton({ ...base, bewuchsbreite: 0.3 });
  near(b07.lasten.g0, 0.09, 1e-9, "g0 aus Kundenangabe 9 kg/m");
  // Die windabhängigen Nachweise skalieren direkt mit der Lastbreite …
  near(b03.linear.minBefDetail.zug / b07.linear.minBefDetail.zug, 0.3 / 0.7, 1e-6, "Zug skaliert");
  near(b03.schnittgroessen.Nd / b07.schnittgroessen.Nd, 0.3 / 0.7, 1e-6, "Nd skaliert");
  // … die Befestigerzahl hier aber nicht, weil die Verformung maßgebend ist
  // (sie hängt nur am Eigengewicht).  Genau das zeigen auch die AT-Sheets:
  // dort liegen alle Wind-Ausnutzungen bei ≈ 0,1.
  assert.equal(b03.linear.minBefDetail.verformL2, b07.linear.minBefDetail.verformL2);
});

test("Linear Beton: √-Umrechnung des DE-Sheets verdichtet das Raster stark", () => {
  // Dokumentiert eine bekannte Abweichung: die deutsche Excel rechnet
  // maxAbstand = √(1/minBef) statt 1/minBef (dimensional inkonsistent).
  // Dadurch fordert das Tool bei verformungsdominierten Fällen deutlich mehr
  // Befestiger als die österreichischen Vorbemessungen.  Bewusst 1:1 gespiegelt
  // — hier nur festgehalten, damit eine Änderung auffällt.
  const r = computeLinearBeton({
    gebaeudehoehe: 20, gebaeudelaenge: 25, gebaeudebreite: 15,
    windzone: 2, gelaendekategorie: "II", lastklasse: 2,
    daemmdicke: 170, putzdicke: 0, ttol: 10,
    betonklasse: "c2025", temperatur: "normal",
    seillaenge: 16.75, pflanzengewicht: 9,
    wind: { ws: 0.675, nek: 0.733, qz: 0.733, cpeA: -0.92 },
  });
  const minBef = r.linear.minBefProM;
  near(r.linear.maxAbstand, Math.sqrt(1 / minBef), 1e-9, "maxAbstand = √(1/minBef)");
  // Ohne die Wurzel läge der zulässige Abstand bei ≈ 2,75 m — praktisch genau
  // dem in der Vorbemessung gewählten Achsmaß von 2,79 m.
  near(1 / minBef, 2.75, 0.06, "1/minBef entspricht dem AT-Achsmaß");
});
