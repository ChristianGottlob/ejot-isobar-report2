import test from "node:test";
import assert from "node:assert/strict";
import { parseNum, parseClamped } from "./num.js";

test("deutsche Schreibweise mit Tausendertrenner", () => {
  assert.equal(parseNum("1.234,56"), 1234.56);   // war 1.234 → Faktor 1000
  assert.equal(parseNum("1 234,56"), 1234.56);   // war 1     → Faktor 1234
  assert.equal(parseNum("1'234,56"), 1234.56);   // Schweizer Schreibweise
  assert.equal(parseNum("12.345.678,9"), 12345678.9);
});

test("englische Schreibweise", () => {
  assert.equal(parseNum("1,234.56"), 1234.56);   // war 1.234
  assert.equal(parseNum("1,234,567"), 1234567);
});

test("einfache Werte bleiben unverändert", () => {
  assert.equal(parseNum("12,5"), 12.5);
  assert.equal(parseNum("0,9"), 0.9);
  assert.equal(parseNum("0.9"), 0.9);
  assert.equal(parseNum("180"), 180);
  assert.equal(parseNum("2.560"), 2.56);          // Direkteingabe ist punktbasiert
  assert.equal(parseNum(1.25), 1.25);
  assert.equal(parseNum("-3,5"), -3.5);
});

test("leere und ungültige Eingaben", () => {
  assert.ok(Number.isNaN(parseNum("")));
  assert.ok(Number.isNaN(parseNum(null)));
  assert.ok(Number.isNaN(parseNum(undefined)));
  assert.ok(Number.isNaN(parseNum("abc")));
});

test("parseClamped begrenzt und fängt Unsinn ab", () => {
  assert.equal(parseClamped("0,9", 0.05, 5, 0.9), 0.9);
  assert.equal(parseClamped("0,009", 0.05, 5, 0.9), 0.05, "zu klein → Untergrenze");
  assert.equal(parseClamped("500", 0.05, 5, 0.9), 5, "zu groß → Obergrenze");
  assert.equal(parseClamped("", 0.05, 5, 0.9), 0.9, "leer → Rückfallwert");
  assert.equal(parseClamped("abc", 0.05, 5, 0.9), 0.9);
});

test("Tippfehler beim Rasterabstand kann die Schleifenlänge nicht sprengen", () => {
  // 0,09 m statt 0,9 m auf 30 m Fassade: ungeklemmt 333 Spalten, geklemmt 600
  // Zellen bei 0,05 m Untergrenze — beides endlich, aber der Fall "0" oder ein
  // negativer Wert hätte vorher eine Endlosschleife bzw. Infinity erzeugt.
  assert.equal(parseClamped("0", 0.05, 5, 0.9), 0.05);
  assert.equal(parseClamped("-1", 0.05, 5, 0.9), 0.05);
  const cols = Math.floor(30 / parseClamped("0", 0.05, 5, 0.9));
  assert.ok(Number.isFinite(cols) && cols <= 600, `Spaltenzahl bleibt endlich: ${cols}`);
});
