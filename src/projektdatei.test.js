import test from "node:test";
import assert from "node:assert/strict";
import { baueProjektPayload, leseProjektdatei, projektDateiname,
         PROJEKT_TYP, PROJEKT_VERSION } from "./projektdatei.js";

const beispiel = () => ({
  bauvorhaben: "BVH Mackgasse 7-11", ort_plz: "1230 Wien", dokNr: "VB-ISO-001",
  gebaeudehoehe: "12", vm_geb_laenge: "30", vm_geb_breite: "15",
  vm_daemm: "205", dicke_klebschicht: "5", windlastzone: "3", vm_gk: "III",
  lastklasse: "2", vm_pflanzengewicht: "9", vm_at_bereich: "regel",
  vm_raster_lh: "0,5", vm_raster_lv: "1,5",
  pflanze_botanisch: "Clematis viticella",
  fassaden: [{ name: "Fassade 1", breite: "30", hoehe: "12", seilkreuztyp: "sk90a4",
               strukturNH: "7", strukturNV: "7" }],
});

test("Rundlauf: alles kommt unverändert zurück", () => {
  const d = beispiel();
  const text = JSON.stringify(baueProjektPayload({ d, pdfN: "quelle.pdf" }), null, 2);
  const { doc, pdfN } = leseProjektdatei(text);
  assert.deepEqual(doc, d);
  assert.equal(pdfN, "quelle.pdf");
});

test("neue Vorbemessungsfelder wandern mit", () => {
  const text = JSON.stringify(baueProjektPayload({ d: beispiel() }));
  const { doc } = leseProjektdatei(text);
  for (const k of ["vm_pflanzengewicht", "vm_at_bereich", "vm_raster_lh", "vm_raster_lv"]) {
    assert.ok(k in doc, `${k} fehlt in der Datei`);
  }
  assert.equal(doc.fassaden[0].strukturNH, "7", "Strukturteilung je Fassade bleibt erhalten");
});

test("Kopfdaten der Datei", () => {
  const o = baueProjektPayload({ d: beispiel(), jetzt: new Date("2026-08-10T09:00:00Z") });
  assert.equal(o._typ, PROJEKT_TYP);
  assert.equal(o._version, PROJEKT_VERSION);
  assert.equal(o.gespeichert, "2026-08-10T09:00:00.000Z");
  assert.match(o.app, /Iso-Bar ECO/);
});

test("Dateiname enthält Projekt und Datum", () => {
  const n = projektDateiname(beispiel(), new Date("2026-08-10T09:00:00Z"));
  assert.equal(n, "EJOT_IsoBar_BVH Mackgasse 7-11_2026-08-10.ejot.json");
  assert.match(projektDateiname({}, new Date("2026-08-10T09:00:00Z")), /^EJOT_IsoBar_Projekt_2026-08-10/);
});

test("fremde Dateien werden abgelehnt — mit verständlicher Meldung", () => {
  assert.throws(() => leseProjektdatei("kein json"), /keine gültige JSON-Datei/);
  assert.throws(() => leseProjektdatei(JSON.stringify({ irgendwas: 1 })), /keine Projektdaten/);
  assert.throws(() => leseProjektdatei(JSON.stringify([1, 2, 3])), /Keine gültige Projektdatei/);
  assert.throws(() => leseProjektdatei(JSON.stringify({ _typ: "etwas-anderes", d: {} })), /keine Iso-Bar-ECO-Projektdatei/);
});

test("Datei aus einer neueren Programmversion wird nicht stumm falsch gelesen", () => {
  const o = baueProjektPayload({ d: beispiel() });
  const zukunft = JSON.stringify({ ...o, _version: PROJEKT_VERSION + 1 });
  assert.throws(() => leseProjektdatei(zukunft), /neueren Programmversion/);
});

test("ältere Dateien (v1) laden weiterhin", () => {
  const alt = JSON.stringify({ _typ: PROJEKT_TYP, _version: 1, pdfN: "", d: beispiel() });
  const { doc } = leseProjektdatei(alt);
  assert.equal(doc.bauvorhaben, "BVH Mackgasse 7-11");
});

test("Dokument ohne Fassaden bekommt eine leere Fassade", () => {
  const ohne = { ...beispiel(), fassaden: [] };
  const { doc } = leseProjektdatei(JSON.stringify(baueProjektPayload({ d: ohne })));
  assert.equal(doc.fassaden.length, 1);
  assert.equal(doc.fassaden[0].breite, "");
});

test("Pläne als Data-URL überstehen den Rundlauf", () => {
  const d = { ...beispiel() };
  d.fassaden = [{ name: "F1", breite: "10", hoehe: "6",
    plan: { dataUrl: "data:image/png;base64,iVBORw0KGgo=", w: 800, h: 600 },
    annotations: { facades: [{ x: 1, y: 2, w: 3, h: 4 }], windows: [], doors: [] } }];
  const { doc } = leseProjektdatei(JSON.stringify(baueProjektPayload({ d })));
  assert.equal(doc.fassaden[0].plan.dataUrl, d.fassaden[0].plan.dataUrl);
  assert.deepEqual(doc.fassaden[0].annotations.facades, [{ x: 1, y: 2, w: 3, h: 4 }]);
});
