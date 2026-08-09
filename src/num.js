// Ein einziger Zahlen-Parser für die ganze App.
//
// Vorher stand in acht Dateien dieselbe Zeile:
//     parseFloat(String(v).replace(",", "."))
// Die ersetzt nur das ERSTE Komma und kennt keine Tausendertrennzeichen:
//     "1.234,56"  → 1.234   (Faktor 1000 daneben)
//     "1 234,56"  → 1       (Faktor 1234 daneben)
//     "1,234.56"  → 1.234
// Für aus PDFs übernommene Werte ist das gefährlich, weil das Ergebnis
// plausibel aussieht.
//
// Regeln:
//   • Leer-/Schutzleerzeichen und Hochkommata gelten als Tausendertrenner
//     (deutsche und Schweizer Schreibweise).
//   • Sind Punkt UND Komma vorhanden, ist das HINTERE das Dezimaltrennzeichen —
//     das deckt "1.234,56" (deutsch) und "1,234.56" (englisch) ab.
//   • Nur Kommata: eines = Dezimaltrenner ("12,5"), mehrere = Tausendertrenner.
//   • Nur Punkt: unverändert lassen.  "0.9" ist im Tool eine Dezimalzahl; ob
//     "1.234" 1234 oder 1,234 meint, ist ohne Kontext nicht entscheidbar, und
//     die Direkteingabe im Tool ist punktbasiert.

export function parseNum(v) {
  if (typeof v === "number") return v;
  if (v == null) return NaN;
  let s = String(v).trim().replace(/[\s  ']/g, "");
  if (!s) return NaN;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    const dec = Math.max(lastComma, lastDot);
    s = s.slice(0, dec).replace(/[.,]/g, "") + "." + s.slice(dec + 1);
  } else if (lastComma >= 0) {
    s = s.split(",").length > 2 ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  return parseFloat(s);
}

/**
 * Wie parseNum, aber auf einen zulässigen Bereich begrenzt.
 * Schützt Schleifen, deren Länge aus einer Eingabe folgt: ein Tippfehler wie
 * 0,09 m statt 0,9 m Rasterabstand erzeugte sonst hunderttausende Iterationen
 * und ließ den Browser einfrieren.
 */
export function parseClamped(v, min, max, fallback) {
  const n = parseNum(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
