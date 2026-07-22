import test from "node:test";
import assert from "node:assert/strict";
import { FLL_STRUKTUR, strukturInfo, teilung, strukturRaster } from "./fllStruktur.js";

test("Tabelle 15: 52 Pflanzen digitalisiert", () => {
  assert.equal(Object.keys(FLL_STRUKTUR).length, 52);
});

test("Sonderfall Campsis: gleiche Kletterform, unterschiedliche Vorgabe", () => {
  assert.equal(strukturInfo("Campsis radicans").struktur, "sicherung");
  const ct = strukturInfo("Campsis x tagliabuana");
  assert.equal(ct.struktur, "raster");
  assert.deepEqual(ct.sB, [30, 60]);
  assert.deepEqual(ct.sH, [30, 60]);
});

test("Teilung rundet auf: 1,00 m bei max 60 cm → 2 Teilungen (50 cm)", () => {
  assert.equal(teilung(1.0, 60), 2);
  assert.equal(teilung(1.0, 20), 5);
  assert.equal(teilung(1.0, 100), 1);   // Sollmaß = Ankerabstand → keine Teilung
  assert.equal(teilung(0.9, 100), 1);   // Sollmaß gröber als Raster
});

test("Beispiel Campsis x tagliabuana: LH/LV 1,00 m → 50 × 50 cm", () => {
  const r = strukturRaster({ lh: 1.0, lv: 1.0, info: strukturInfo("Campsis x tagliabuana") });
  assert.equal(r.nH, 2);
  assert.equal(r.nV, 2);
  assert.equal(r.bIst, 0.5);
  assert.equal(r.hIst, 0.5);
  assert.equal(r.ok, true);
  assert.equal(r.zwischenV, 1);
  assert.equal(r.zwischenH, 1);
});

test("Feines Gitter: 1,00 m bei 20 cm (Clematis viticella) → 5 × 5", () => {
  const r = strukturRaster({ lh: 1.0, lv: 1.0, info: strukturInfo("Clematis viticella") });
  assert.equal(r.nH, 5);
  assert.equal(r.nV, 5);
  assert.ok(Math.abs(r.bIst - 0.2) < 1e-9);
  assert.equal(r.ok, true);
});

test("Nur-Breite-Pflanze (Wisteria sinensis 50–70): keine horizontalen Zwischenseile", () => {
  const r = strukturRaster({ lh: 1.0, lv: 1.0, info: strukturInfo("Wisteria sinensis") });
  assert.equal(r.struktur, "vertikal");
  assert.equal(r.nH, 2);      // 100/70 → 2 → 50 cm
  assert.equal(r.nV, 1);      // keine Höhenvorgabe
  assert.equal(r.zwischenH, 0);
  assert.equal(r.ok, true);
});

test("Selbstklimmer (Hedera helix): keine Kletterhilfe, keine Zwischenseile", () => {
  const r = strukturRaster({ lh: 1.0, lv: 1.0, info: strukturInfo("Hedera helix") });
  assert.equal(r.struktur, "sicherung");
  assert.equal(r.aktiv, false);
  assert.equal(r.nH, 1);
  assert.equal(r.nV, 1);
  assert.equal(r.zwischenV, 0);
  assert.equal(r.zwischenH, 0);
});

test("Ohne Pflanze: Feature inaktiv, Raster unverändert", () => {
  const r = strukturRaster({ lh: 1.0, lv: 1.0, info: null });
  assert.equal(r.aktiv, false);
  assert.equal(r.nH, 1);
  assert.equal(r.nV, 1);
});

test("Manuelle Teilung: feiner ist zulässig, gröber wird als n.i.O. gemeldet", () => {
  const info = strukturInfo("Clematis viticella");          // max 20 cm
  const fein = strukturRaster({ lh: 1.0, lv: 1.0, info, nH: 10, nV: 10 });
  assert.equal(fein.bIst, 0.1);
  assert.equal(fein.ok, true);
  const grob = strukturRaster({ lh: 1.0, lv: 1.0, info, nH: 2, nV: 2 });
  assert.equal(grob.bIst, 0.5);
  assert.equal(grob.ok, false);                              // 50 cm > 20 cm
  assert.equal(grob.nHreq, 5);                               // Vorschlag bleibt sichtbar
});

test("Nicht-quadratisches Tragraster wird richtungsweise geteilt", () => {
  const r = strukturRaster({ lh: 1.2, lv: 0.8, info: strukturInfo("Vitis vinifera") }); // max 40
  assert.equal(r.nH, 3);   // 120/40 = 3 → 40 cm
  assert.equal(r.nV, 2);   // 80/40  = 2 → 40 cm
  assert.ok(Math.abs(r.bIst - 0.4) < 1e-9);
  assert.ok(Math.abs(r.hIst - 0.4) < 1e-9);
  assert.equal(r.ok, true);
});
