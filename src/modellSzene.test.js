// Snapshot-Renderer: Szene und SVG-Ausgabe müssen ohne DOM funktionieren.
import test from "node:test";
import assert from "node:assert/strict";
import { bauSzene, szeneSVGInner } from "./modellSzene.js";

const doc = { vm_daemm: "160", dicke_klebschicht: "10", LH: "0.9", LV: "0.9", vm_untergrund: "mauerwerk" };

test("bauSzene liefert Schichten, Anker und Seile", () => {
  const prim = bauSzene(doc, { fuehrung: "gitter" });
  assert.ok(prim.filter((p) => p.q).length > 100, "Flächen vorhanden");
  assert.ok(prim.filter((p) => p.s).length >= 4, "Seile vorhanden");
});

test("Seilführung ändert die Seil-Segmente", () => {
  const seile = (f) => bauSzene(doc, { fuehrung: f }).filter((p) => p.s).length;
  assert.ok(seile("gitter") > seile("vertikal"), "Gitter hat mehr Seile als nur vertikal");
  assert.ok(seile("diagonal") > 0, "Raute erzeugt Diagonalen");
});

test("szeneSVGInner rendert Polygone mit gültiger viewBox", () => {
  const { inner, vb } = szeneSVGInner(doc, { rx: -16, ry: -32, explode: 0.5 });
  assert.ok(inner.includes("<polygon"), "Polygone enthalten");
  assert.ok(inner.includes("<line"), "Seile enthalten");
  const teile = vb.split(" ").map(Number);
  assert.equal(teile.length, 4);
  assert.ok(teile[2] > 100 && teile[3] > 100, "viewBox hat plausible Größe");
});
