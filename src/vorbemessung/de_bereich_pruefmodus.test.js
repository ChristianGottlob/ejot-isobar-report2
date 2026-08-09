// Zwei Erweiterungen, die aus dem Abgleich mit den EJOT-Vorbemessungen folgten:
//   1. Sogbereich A/B auch für Deutschland (Blatt " CPE Wand" der Excel führt
//      alle Bereiche A–E; der Code nutzte nur A)
//   2. Prüfmodus: vorgegebenes LH/LV nachweisen statt quadratisch bemessen —
//      die Vorbemessungen wählen bewusst Raster wie 0,5 × 1,5 m
import test from "node:test";
import assert from "node:assert/strict";
import { cpeWand, computeVorbemessungDE } from "./de.js";
import { computeVorbemessungMW } from "./de_mauerwerk.js";
import { windAUT, findStadt } from "./de_at_wind.js";

const near = (a, b, tol, what) =>
  assert.ok(Math.abs(a - b) <= tol, `${what}: ${a.toFixed(4)} erwartet ${b} (±${tol})`);

test("cpe Deutschland: Bereich A und B nach Blatt ' CPE Wand'", () => {
  // schlank & hoch → h/d ≥ 5
  const hoch = cpeWand({ gebaeudelaenge: 4, gebaeudebreite: 10, gebaeudehoehe: 20 });
  near(hoch.hd, 5, 1e-9, "h/d");
  near(hoch.cpeA, -1.7, 1e-9, "cpe,A bei h/d ≥ 5");
  near(hoch.cpeB, -1.1, 1e-9, "cpe,B");
  near(hoch.randstreifen, 2, 1e-9, "Randstreifen e/5");
  // gedrungen → h/d < 5
  const flach = cpeWand({ gebaeudelaenge: 30, gebaeudebreite: 20, gebaeudehoehe: 8 });
  near(flach.cpeA, -1.4, 1e-9, "cpe,A bei h/d < 5");
  near(flach.cpeB, -1.1, 1e-9, "cpe,B ist über alle h/d konstant");
});

test("Sogbereich wählt den maßgebenden Wert, Default bleibt Randbereich", () => {
  const geo = { gebaeudelaenge: 4, gebaeudebreite: 10, gebaeudehoehe: 20 };
  near(cpeWand(geo).cpeS, -1.7, 1e-9, "Default = Randbereich A");
  near(cpeWand({ ...geo, bereich: "rand" }).cpeS, -1.7, 1e-9, "Randbereich");
  near(cpeWand({ ...geo, bereich: "regel" }).cpeS, -1.1, 1e-9, "Regelbereich");
});

test("Windbestimmter Fall: Regelbereich vergrößert das zulässige Raster", () => {
  const inp = { gebaeudehoehe: 25, gebaeudelaenge: 4, gebaeudebreite: 10,
    windzone: 4, gelaendekategorie: "II", lastklasse: 1,
    daemmdicke: 80, putzdicke: 0, ttol: 10, betonklasse: "c2025", temperatur: "normal" };
  const rand = computeVorbemessungDE(inp);
  const regel = computeVorbemessungDE({ ...inp, bereich: "regel" });
  assert.ok(regel.lasten.ws < rand.lasten.ws, "Regelbereich muss weniger Sog liefern");
  assert.ok(regel.raster.LH > rand.raster.LH,
    `Raster muss wachsen (Rand ${rand.raster.LH.toFixed(2)} → Regel ${regel.raster.LH.toFixed(2)} m)`);
  // Eigengewicht und Geometrie bleiben unberührt
  near(regel.lasten.g, rand.lasten.g, 1e-12, "g unverändert");
  near(regel.geometrie.l1, rand.geometrie.l1, 1e-12, "l1 unverändert");
});

test("Verformungsbestimmter Fall: Bereich ändert den Sog, nicht das Raster", () => {
  const inp = { gebaeudehoehe: 20, gebaeudelaenge: 4, gebaeudebreite: 10,
    windzone: 2, gelaendekategorie: "II", lastklasse: 3,
    daemmdicke: 170, putzdicke: 0, ttol: 10, betonklasse: "c2025", temperatur: "normal" };
  const rand = computeVorbemessungDE(inp);
  const regel = computeVorbemessungDE({ ...inp, bereich: "regel" });
  assert.ok(regel.lasten.ws < rand.lasten.ws, "Sog sinkt");
  near(regel.raster.LH, rand.raster.LH, 1e-9, "Raster bleibt (Verformung maßgebend)");
});

test("Prüfmodus rechnet die Vorbemessung Mackgasse (0,5 × 1,5 m) exakt nach", () => {
  const st = findStadt("Perchtolsdorf");
  const w = windAUT({ vb0: st.vb0, seehoeheStadt: st.seehoehe, seehoehe: 265,
    gelaendekategorie: "III", gebaeudehoehe: 12, gebaeudelaenge: 30, gebaeudebreite: 15 });
  const base = { gebaeudehoehe: 12, gebaeudelaenge: 30, gebaeudebreite: 15,
    windzone: 2, gelaendekategorie: "II", lastklasse: 2,
    daemmdicke: 205, putzdicke: 0, ttol: 5, betonklasse: "c2025", temperatur: "normal",
    pflanzengewicht: 14, wind: { ws: w.ws, nek: w.nek, qz: w.nek, cpeA: w.cpeS } };

  const bem = computeVorbemessungDE(base);
  assert.equal(bem.raster.gewaehlt, false);
  near(bem.raster.LH, bem.raster.LV, 1e-12, "ohne Vorgabe quadratisch");

  const prf = computeVorbemessungDE({ ...base, rasterLH: 0.5, rasterLV: 1.5 });
  assert.equal(prf.raster.gewaehlt, true);
  assert.equal(prf.raster.erfuellt, true);
  near(prf.raster.LH, 0.5, 1e-12, "LH übernommen");
  near(prf.raster.LV, 1.5, 1e-12, "LV übernommen");
  near(prf.raster.stk_m2, 1 / 0.75, 1e-9, "Dichte = 1/(LH·LV) → PDF 1,33 Stk/m²");
  // Schnittgrößen und Nachweise wie im PDF
  near(prf.schnittgroessen.Vd, 0.19, 0.005, "V_d");
  near(prf.schnittgroessen.Nd, 0.63, 0.008, "N_d");
  near(prf.schnittgroessen.NEd, 0.49, 0.008, "N_Ed");
  near(prf.nachweise.zugQuerKombi.wert, 0.20, 0.006, "Kombinationsnachweis");
  near(prf.nachweise.verformungL1.wert, 5.76, 0.02, "w(Langzeit) l1");
});

test("Prüfmodus meldet ein zu weites Raster als nicht erfüllt", () => {
  const inp = { gebaeudehoehe: 25, gebaeudelaenge: 4, gebaeudebreite: 10,
    windzone: 4, gelaendekategorie: "II", lastklasse: 5,
    daemmdicke: 80, putzdicke: 0, ttol: 10, betonklasse: "c2025", temperatur: "normal" };
  const zuWeit = computeVorbemessungDE({ ...inp, rasterLH: 3, rasterLV: 3 });
  assert.equal(zuWeit.raster.erfuellt, false, "9 m² je Anker darf nicht durchgehen");
  assert.ok(zuWeit.raster.LHerforderlich < 3, "erforderliches Maß wird weiterhin ausgewiesen");
  const eng = computeVorbemessungDE({ ...inp, rasterLH: 0.4, rasterLV: 0.4 });
  assert.equal(eng.raster.erfuellt, true, "dichtes Raster erfüllt die Forderung");
});

test("Prüfmodus gilt auch für Mauerwerk", () => {
  const inp = { gebaeudehoehe: 12, gebaeudelaenge: 30, gebaeudebreite: 15,
    windzone: 2, gelaendekategorie: "II", lastklasse: 2,
    daemmdicke: 160, putzdicke: 0, ttol: 10, steinart: "ks_vollstein" };
  const bem = computeVorbemessungMW(inp);
  const prf = computeVorbemessungMW({ ...inp, rasterLH: 0.6, rasterLV: 1.2 });
  assert.equal(bem.raster.gewaehlt, false);
  assert.equal(prf.raster.gewaehlt, true);
  near(prf.raster.LH, 0.6, 1e-12, "LH");
  near(prf.raster.LV, 1.2, 1e-12, "LV");
  near(prf.schnittgroessen.VEd, 0.6 * 1.2 * prf.lasten.g * 1.35, 1e-9, "V_Ed folgt dem Raster");
});
