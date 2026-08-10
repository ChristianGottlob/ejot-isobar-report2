// Lesen und Schreiben der Projektdatei (.ejot.json).
//
// Bewusst als eigenes Modul: die Prüfungen beim Laden entscheiden, ob ein
// Projekt korrekt weiterbearbeitet werden kann.  Steckten sie in der
// Komponente, ließen sie sich nicht automatisiert prüfen.
//
// Format
//   { _typ, _version, app, gespeichert, pdfN, d }
// `d` ist das vollständige Dokument — alle Eingaben, Fassaden, Pläne und
// Vorbemessungsfelder.  Dadurch wandern neue Felder automatisch mit; es gibt
// keine Liste, die man beim Erweitern vergessen könnte.
//
// Versionen
//   1  ursprüngliches Format
//   2  zusätzlich Pflanzengewicht, Sogbereich, Prüfraster, Strukturmaß-Teilung

export const PROJEKT_TYP = "ejot-isobar-projekt";
export const PROJEKT_VERSION = 2;

/** Baut den Inhalt der Projektdatei. */
export function baueProjektPayload({ d, pdfN = "", jetzt = new Date() }) {
  return {
    _typ: PROJEKT_TYP,
    _version: PROJEKT_VERSION,
    app: "EJOT Iso-Bar ECO · Report Generator",
    gespeichert: jetzt.toISOString(),
    pdfN,
    d,
  };
}

/** Dateiname mit Projektbezeichnung und Datum. */
export function projektDateiname(d, jetzt = new Date()) {
  const roh = d?.bauvorhaben || d?.dokNr || "Projekt";
  const safe = String(roh).replace(/[^\w\-äöüÄÖÜß ]+/g, "").trim() || "Projekt";
  return `EJOT_IsoBar_${safe}_${jetzt.toISOString().slice(0, 10)}.ejot.json`;
}

// Felder, an denen eine echte Projektdatei erkennbar ist.
const BEKANNTE_FELDER = [
  "bauvorhaben", "dokNr", "fassaden", "gebaeudehoehe", "vm_daemm",
  "lastklasse", "pflanze_botanisch",
];

/**
 * Liest eine Projektdatei und gibt { doc, pdfN, gespeichert } zurück.
 * Wirft mit einer für Anwender verständlichen Meldung, wenn die Datei nicht
 * passt — das geöffnete Projekt darf dabei unangetastet bleiben.
 */
export function leseProjektdatei(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error("Die Datei ist keine gültige JSON-Datei.");
  }
  if (obj && obj._typ && obj._typ !== PROJEKT_TYP) {
    throw new Error("Das ist keine Iso-Bar-ECO-Projektdatei.");
  }
  if (Number(obj?._version) > PROJEKT_VERSION) {
    throw new Error(
      `Die Datei wurde mit einer neueren Programmversion gespeichert (Format v${obj._version}). ` +
      "Bitte das Tool aktualisieren."
    );
  }
  const doc = obj && obj._typ === PROJEKT_TYP ? obj.d : (obj && obj.d ? obj.d : obj);
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("Keine gültige Projektdatei.");
  }
  if (!BEKANNTE_FELDER.some((k) => k in doc)) {
    throw new Error("Die Datei enthält keine Projektdaten des Tools.");
  }
  // Mindestens eine Fassade, damit die Oberfläche nicht auf einen leeren
  // Array trifft (ältere Dateien können ohne gespeichert worden sein).
  const fassaden = Array.isArray(doc.fassaden) && doc.fassaden.length
    ? doc.fassaden
    : [{ name: "Fassade 1", breite: "", hoehe: "" }];
  return { doc: { ...doc, fassaden }, pdfN: obj?.pdfN || "", gespeichert: obj?.gespeichert || null };
}
