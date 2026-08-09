// Die Muster in pdfExtract greifen die erste Zahl nach einem Label.  Steht dort
// eine Zulassungs- oder Fußnotennummer, lieferten sie bisher einen plausibel
// aussehenden Unsinnswert und markierten ihn grün als Treffer.
import test from "node:test";
import assert from "node:assert/strict";
import { parseFields, istPlausibel, PLAUSIBEL } from "./pdfFields.js";

test("Zulassungsnummer vor der Zahl wird nicht als Dicke übernommen", () => {
  const r = parseFields("WDVS-Dicke gem. Zulassung Z-1: 140 mm");
  assert.equal(r.values.wdvs_dicke, undefined, "1 aus 'Z-1' darf nicht durchgehen");
  assert.ok(!r.hits.includes("wdvs_dicke"), "und nicht als Treffer gelten");
  const g = r.unplausibel.find((u) => u.key === "wdvs_dicke");
  assert.ok(g, "der Fund wird gemeldet");
  assert.equal(g.min, 20);
  assert.equal(g.einheit, "mm");
});

test("saubere Angabe wird weiterhin übernommen", () => {
  const r = parseFields("WDVS-Dicke: 205 mm");
  assert.equal(String(r.values.wdvs_dicke).trim(), "205");
  assert.ok(r.hits.includes("wdvs_dicke"));
  assert.equal(r.unplausibel.length, 0);
});

test("Bereichsgrenzen je Feld", () => {
  assert.equal(istPlausibel("wdvs_dicke", "205"), true);
  assert.equal(istPlausibel("wdvs_dicke", "1"), false, "zu dünn");
  assert.equal(istPlausibel("wdvs_dicke", "9999"), false, "zu dick");
  assert.equal(istPlausibel("gebaeudehoehe", "25"), true);
  assert.equal(istPlausibel("gebaeudehoehe", "0"), false);
  assert.equal(istPlausibel("verankerungstiefe", "40"), true);
  assert.equal(istPlausibel("windlastzone", "2"), true);
  assert.equal(istPlausibel("windlastzone", "9"), false);
  assert.equal(istPlausibel("druckfestigkeit", "20"), true);
});

test("Textfelder werden nicht auf Zahlen geprüft", () => {
  assert.equal(istPlausibel("bauvorhaben", "BVH Mackgasse 7-11"), true);
  assert.equal(istPlausibel("verankerungsgrund", "Beton C20/25"), true);
});

test("deutsche Tausendertrenner überstehen die Prüfung", () => {
  // 1.234,5 mm wäre zu dick — vorher hätte der alte Parser 1.234 gelesen und
  // den Wert als "zu dünn" verworfen; jetzt wird korrekt 1234,5 geprüft.
  assert.equal(istPlausibel("wdvs_dicke", "1.234,5"), false);
  assert.equal(istPlausibel("wdvs_dicke", "205,0"), true);
});

test("jedes geprüfte Feld hat sinnvolle Grenzen", () => {
  for (const [k, g] of Object.entries(PLAUSIBEL)) {
    assert.ok(g.min < g.max, `${k}: min < max`);
    assert.ok(Number.isFinite(g.min) && Number.isFinite(g.max), `${k}: endliche Grenzen`);
  }
});
