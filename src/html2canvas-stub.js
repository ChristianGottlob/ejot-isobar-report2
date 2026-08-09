// Platzhalter für html2canvas.
//
// jsPDF listet html2canvas als optionalDependency und lädt es per
// import("html2canvas") — ausschließlich für jsPDF.html(). Diese Methode
// benutzen wir nicht: das Rendering läuft über snapdom, jsPDF bekommt nur
// fertige Bitmaps via addImage().
//
// npm installiert optionale Abhängigkeiten trotzdem mit, wodurch Vite die
// 200 KB in jeden Build zog. Das Alias in vite.config.js ersetzt sie durch
// diesen Stub. Sollte doch einmal jsPDF.html() aufgerufen werden, gibt es
// eine klare Meldung statt eines stillen Fehlschlags.
export default function html2canvasStub() {
  throw new Error(
    "html2canvas ist in diesem Build nicht enthalten. Der PDF-Export nutzt snapdom; " +
    "für jsPDF.html() müsste html2canvas wieder als echte Abhängigkeit aufgenommen werden."
  );
}
