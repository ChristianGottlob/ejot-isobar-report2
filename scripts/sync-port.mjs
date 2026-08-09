// Überträgt den Tool-Stand in das EJOT-Plattform-Repo (greening-frontend).
//
// Hintergrund: dort lebt das Tool als Microfrontend-Seite src/isobar/.  Die
// Dateien werden aus diesem Repo generiert.  Das war bisher Handarbeit und ist
// einmal beinahe schiefgegangen: das EJOT-Team hatte IsoBarReport.tsx direkt
// bearbeitet (Autosave-Härtung), ein blindes Überschreiben hätte die Arbeit
// stillschweigend zurückgerollt.
//
// Aufruf:
//   node scripts/sync-port.mjs --check    nur prüfen, Exit 1 bei Abweichung
//   node scripts/sync-port.mjs            schreiben
//
// --check gehört vor jeden Port: meldet es Abweichungen, wurde drüben von Hand
// geändert und die Änderung muss ZUERST hierher zurückportiert werden.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const QUELLE = resolve(HIER, "..");
const ZIEL = process.env.GREENING_FRONTEND || resolve(QUELLE, "..", "greening-frontend");

// Quelle → Ziel (relativ zu src/ bzw. src/isobar/)
const MODULE = [
  ["src/App.jsx",            "src/isobar/IsoBarReport.tsx"],
  ["src/num.js",             "src/isobar/num.ts"],
  ["src/fllStruktur.js",     "src/isobar/fllStruktur.ts"],
  ["src/pdfFields.js",       "src/isobar/pdfFields.ts"],
  ["src/pdfExtract.js",      "src/isobar/pdfExtract.ts"],
  ["src/planUtils.js",       "src/isobar/planUtils.ts"],
  ["src/idbStore.js",        "src/isobar/idbStore.ts"],
  ["src/PlanAnnotator.jsx",  "src/isobar/PlanAnnotator.tsx"],
  ["src/RasterOverlay.jsx",  "src/isobar/RasterOverlay.tsx"],
  ["src/RealisticFacade.jsx","src/isobar/RealisticFacade.tsx"],
  ["src/DetailCrop.jsx",     "src/isobar/DetailCrop.tsx"],
  ["src/html2canvas-stub.js","src/isobar/html2canvas-stub.ts"],
  ["src/vorbemessung/de.js",            "src/isobar/vorbemessung/de.ts"],
  ["src/vorbemessung/de_mauerwerk.js",  "src/isobar/vorbemessung/de_mauerwerk.ts"],
  ["src/vorbemessung/de_linear.js",     "src/isobar/vorbemessung/de_linear.ts"],
  ["src/vorbemessung/de_at_wind.js",    "src/isobar/vorbemessung/de_at_wind.ts"],
  ["src/vorbemessung/staedte_aut.js",   "src/isobar/vorbemessung/staedte_aut.ts"],
];

const KOPF = "// @ts-nocheck\n";

// Anpassungen für die Plattform-Fassung.
function transformieren(quelle, inhalt) {
  let s = inhalt;
  if (quelle === "src/App.jsx") {
    // Die Plattform bindet die Seite als benannten Export ein …
    s = s.replace("export default function App(", "export function IsoBarReport(");
    // … und läuft unter /applications/greening-frontend, daher base-relative Assets.
    s = s.replaceAll("`/zubehoer/", "`${import.meta.env.BASE_URL}zubehoer/");
  }
  return KOPF + s;
}

const pruefen = process.argv.includes("--check");
let abweichungen = 0, geschrieben = 0;

for (const [von, nach] of MODULE) {
  const qPfad = join(QUELLE, von), zPfad = join(ZIEL, nach);
  if (!existsSync(qPfad)) { console.error(`  ! Quelle fehlt: ${von}`); abweichungen++; continue; }
  const soll = transformieren(von, readFileSync(qPfad, "utf8"));
  const ist = existsSync(zPfad) ? readFileSync(zPfad, "utf8") : null;
  // Zeilenenden normalisieren — Windows checkt mit CRLF aus.
  const gleich = ist !== null && ist.replace(/\r\n/g, "\n") === soll.replace(/\r\n/g, "\n");
  if (gleich) continue;

  if (pruefen) {
    console.error(ist === null ? `  ✗ fehlt im Port:   ${nach}` : `  ✗ weicht ab:       ${nach}`);
    abweichungen++;
  } else {
    mkdirSync(dirname(zPfad), { recursive: true });
    writeFileSync(zPfad, soll);
    console.log(`  → ${nach}`);
    geschrieben++;
  }
}

if (pruefen) {
  if (abweichungen) {
    console.error(`\n${abweichungen} Datei(en) weichen ab.`);
    console.error("Wurde im Plattform-Repo von Hand geändert?  Dann die Änderung ZUERST");
    console.error("hierher zurückportieren — sonst geht sie beim Sync verloren.");
    process.exit(1);
  }
  console.log("Port ist auf Stand ✓");
} else {
  console.log(`\n${geschrieben} Datei(en) geschrieben, ${MODULE.length - geschrieben} unverändert.`);
  console.log("Nicht vergessen: im Plattform-Repo bauen und einen Changeset anlegen.");
}
