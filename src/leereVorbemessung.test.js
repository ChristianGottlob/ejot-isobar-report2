// Eine neu geöffnete Vorbemessung muss leer sein.
//
// Vorher setzte buildDocument("") Rückfallwerte (Gebäude 10 m, Fassade 10 × 6 m,
// Windzone 2, Lastklasse 3, t_tol 10 mm) — daraus rechnete das Tool sofort ein
// vollständiges Ergebnis inklusive Bestellbezeichnung, ohne dass jemand eine
// Zahl eingegeben hatte.
import test from "node:test";
import assert from "node:assert/strict";
import { leeresDokument, buildDocument } from "./pdfFields.js";
import { computeVorbemessungDE } from "./vorbemessung/de.js";
import { computeVorbemessungMW } from "./vorbemessung/de_mauerwerk.js";

test("leeresDokument enthält keine Projektmaße", () => {
  const d = leeresDokument();
  for (const k of ["gebaeudehoehe", "wdvs_dicke", "dicke_klebschicht", "windlastzone",
                   "gelaendekategorie", "lastklasse", "druckfestigkeit", "rohdichte",
                   "fassadenlaenge", "fassadenhoehe", "LH", "LV"]) {
    assert.equal(d[k], "", `${k} darf nicht vorbelegt sein`);
  }
  assert.deepEqual(d.fassaden, [{ name: "Fassade 1", breite: "", hoehe: "" }]);
});

test("leeresDokument behält nur Nicht-Messgrößen vor", () => {
  const d = leeresDokument();
  assert.ok(d.datum && d.dokNr, "Datum und Dokumentnummer bleiben");
  assert.equal(d.version, "V1.0");
  assert.equal(d.seilfuehrung, "gitter");
  assert.equal(d.seilkreuztyp, "ohne");
});

test("der PDF-Import behält seine Rückfallwerte", () => {
  // buildDocument ist der Import-Pfad und bleibt unverändert — dort sind
  // Rückfallwerte sinnvoll, weil das PDF nicht alles enthält.
  const { document: doc } = buildDocument("");
  assert.equal(doc.lastklasse, "3");
  assert.equal(doc.windlastzone, "2");
});

test("Putzdicke ist optional: keine Angabe = keine Putzschicht", () => {
  const base = { gebaeudehoehe: "12", gebaeudelaenge: "30", gebaeudebreite: "15",
    windzone: "2", gelaendekategorie: "II", lastklasse: "2",
    daemmdicke: "205", ttol: "5", betonklasse: "c2025", temperatur: "normal" };
  const leer = computeVorbemessungDE({ ...base, putzdicke: "" });
  const null0 = computeVorbemessungDE({ ...base, putzdicke: "0" });
  const zehn = computeVorbemessungDE({ ...base, putzdicke: "10" });
  assert.equal(leer.geometrie.e, 210, "e = 205 + 0 + 5");
  assert.equal(leer.geometrie.e, null0.geometrie.e, "leer verhält sich wie 0");
  assert.equal(zehn.geometrie.e, 220, "mit Putz wird gerechnet");
  assert.ok(Number.isFinite(leer.raster.LH), "kein NaN-Ergebnis");
});

test("fehlende Kerneingaben brechen laut ab statt NaN zu liefern", () => {
  const base = { gebaeudehoehe: "12", gebaeudelaenge: "30", gebaeudebreite: "15",
    windzone: "2", gelaendekategorie: "II", lastklasse: "2",
    betonklasse: "c2025", temperatur: "normal" };
  // Früher lieferte das ein Ergebnis mit NaN-Raster und "keine passende Länge" —
  // im UI sah das aus wie "es wird nichts berechnet".
  assert.throws(() => computeVorbemessungDE({ ...base, daemmdicke: "", ttol: "5" }), /Unvollständige Eingaben/);
  assert.throws(() => computeVorbemessungDE({ ...base, daemmdicke: "205", ttol: "" }), /Unvollständige Eingaben/);
  assert.throws(() => computeVorbemessungMW({ ...base, daemmdicke: "", ttol: "5", steinart: "ks_vollstein" }),
    /Unvollständige Eingaben/);
});

test("mit vollständigen Eingaben rechnet die Engine wieder normal", () => {
  const r = computeVorbemessungDE({ gebaeudehoehe: "12", gebaeudelaenge: "30", gebaeudebreite: "15",
    windzone: "2", gelaendekategorie: "II", lastklasse: "2",
    daemmdicke: "205", putzdicke: "", ttol: "5", betonklasse: "c2025", temperatur: "normal" });
  assert.ok(Math.abs(r.raster.LH - 1.089) < 0.005, `Raster ${r.raster.LH.toFixed(3)} m`);
  assert.ok(r.produkt.laenge > 0, "Produktlänge wird gewählt");
});

test("Dämmdicke wirkt sich aufs Raster aus (Verformung maßgebend)", () => {
  const base = { gebaeudehoehe: "12", gebaeudelaenge: "30", gebaeudebreite: "15",
    windzone: "2", gelaendekategorie: "II", lastklasse: "2",
    putzdicke: "", ttol: "5", betonklasse: "c2025", temperatur: "normal" };
  const duenn = computeVorbemessungDE({ ...base, daemmdicke: "205" });
  const dick = computeVorbemessungDE({ ...base, daemmdicke: "300" });
  assert.ok(dick.raster.LH < duenn.raster.LH,
    `dickere Dämmung ⇒ engeres Raster (${duenn.raster.LH.toFixed(2)} → ${dick.raster.LH.toFixed(2)} m)`);
});
