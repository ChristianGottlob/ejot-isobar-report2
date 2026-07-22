// ─────────────────────────────────────────────────────────────────────
// FLL-Richtlinie Fassadenbegrünung (2018), Tabelle 15
// "Hinweise zur angepassten Strukturierung von Kletterhilfen"
//
// Digitalisierte Abstandsmaße (Strukturempfehlungen) je Pflanze.
// Werte in cm als [von, bis]. Maßgebend für die Planung ist die OBERE
// Grenze (= max. zulässiger Seilabstand).
//
// Drei Fälle — zeilenweise aus der Tabelle, NICHT aus der Kletterform
// ableitbar (z. B. Campsis radicans = Sicherung, Campsis x tagliabuana = 30–60):
//   raster    : Breite UND Höhe angegeben  → Gitter in beide Richtungen
//   vertikal  : nur Breite angegeben       → nur vertikale Seile (Schlinger)
//   sicherung : "ggf. Sicherung"           → Selbstklimmer, keine Kletterhilfe
// ─────────────────────────────────────────────────────────────────────

const R = (b, h) => ({ sB: b, sH: h, struktur: "raster" });     // Breite + Höhe
const V = (b)    => ({ sB: b, sH: null, struktur: "vertikal" }); // nur Breite
const S = ()     => ({ sB: null, sH: null, struktur: "sicherung" });

export const FLL_STRUKTUR = {
  "Actinidia arguta":                  V([30, 50]),
  "Actinidia deliciosa":               V([30, 50]),
  "Actinidia kolomikta":               V([20, 30]),
  "Akebia quinata":                    V([30, 40]),
  "Akebia trifoliata":                 V([30, 40]),
  "Aristolochia macrophylla":          V([30, 50]),
  "Aristolochia tomentosa":            V([30, 50]),
  "Campsis radicans":                  S(),
  "Campsis x tagliabuana":             R([30, 60], [30, 60]),
  "Celastrus orbiculatus":             V([20, 40]),
  "Celastrus scandens":                V([20, 40]),
  "Clematis-Hybriden (groß)":          R([10, 20], [10, 20]),
  "Clematis alpina":                   R([10, 20], [10, 20]),
  "Clematis macropetala":              R([10, 30], [10, 30]),
  "Clematis montana":                  R([15, 20], [15, 20]),
  "Clematis orientalis":               R([10, 30], [10, 30]),
  "Clematis tangutica":                R([15, 20], [15, 20]),
  "Clematis terniflora":               R([15, 20], [15, 20]),
  "Clematis vitalba":                  R([15, 20], [15, 20]),
  "Clematis viticella":                R([10, 20], [10, 20]),
  "Euonymus fortunei":                 S(),
  "Fallopia baldschuanica":            V([20, 40]),
  "Hedera colchica":                   S(),
  "Hedera helix":                      S(),
  "Hedera hibernica":                  S(),
  "Humulus lupulus":                   V([20, 40]),
  "Hydrangea anomala ssp. petiolaris": S(),
  "Jasminum nudiflorum":               R([25, 50], [25, 50]),
  "Lonicera x brownii":                V([20, 30]),
  "Lonicera caprifolium":              V([20, 30]),
  "Lonicera x heckrottii":             V([20, 30]),
  "Lonicera henryi":                   V([20, 30]),
  "Lonicera japonica":                 V([20, 30]),
  "Lonicera periclymenum":             V([20, 30]),
  "Lonicera x tellmanniana":           V([20, 30]),
  "Menispermum":                       V([20, 30]),
  "Parthenocissus inserta":            R([20, 40], [20, 40]),
  "Parthenocissus quinquefolia":       S(),
  "Parthenocissus tricuspidata":       S(),
  "Periploca graeca":                  V([25, 40]),
  "Rosa [Climber]":                    R([30, 50], [30, 50]),
  "Rubus":                             R([30, 50], [30, 50]),
  "Schisandra chinensis":              V([20, 40]),
  "Schizophragma hydrangeoides":       S(),
  "Schizophragma integrifolium":       S(),
  "Vitis amurensis":                   R([20, 40], [20, 40]),
  "Vitis coignetiae":                  R([20, 40], [20, 40]),
  "Vitis riparia":                     R([20, 40], [20, 40]),
  "Vitis vinifera":                    R([20, 40], [20, 40]),
  "Wisteria brachybotris":             V([50, 70]),
  "Wisteria floribunda":               V([50, 70]),
  "Wisteria sinensis":                 V([50, 70]),
};

/** Strukturempfehlung zu einer botanischen Bezeichnung (oder null). */
export function strukturInfo(bot) {
  if (!bot) return null;
  return FLL_STRUKTUR[bot] || null;
}

/**
 * Erforderliche Teilung eines Ankerfeldes, damit das Strukturmaß eingehalten wird.
 * Beispiel: Ankerabstand 1,00 m, max. Abstandsmaß 60 cm → ceil(100/60) = 2 → 50 cm.
 */
export function teilung(L_m, maxCm) {
  if (!(L_m > 0) || !(maxCm > 0)) return 1;
  return Math.max(1, Math.ceil((L_m * 100) / maxCm - 1e-9));
}

/**
 * Feinraster der Kletterhilfe aus Tragraster + Strukturempfehlung.
 *
 * @param lh,lv  Ankerabstände (Tragraster) in m — bleiben unverändert.
 * @param info   Strukturempfehlung aus FLL_STRUKTUR (oder null).
 * @param nH,nV  Optionale manuell gewählte Teilung (Planerentscheid, ≥ 1).
 * @returns      Teilung, Ist-Abstände (m) und Nachweis.
 */
export function strukturRaster({ lh, lv, info, nH, nV } = {}) {
  const LH = Number(lh) > 0 ? Number(lh) : 0;
  const LV = Number(lv) > 0 ? Number(lv) : 0;
  const struktur = info?.struktur || "keine";
  const aktiv = struktur === "raster" || struktur === "vertikal";
  const bMax = aktiv ? (info?.sB?.[1] ?? null) : null;
  const hMax = struktur === "raster" ? (info?.sH?.[1] ?? null) : null;

  // Von der Richtlinie geforderte Mindestteilung
  const nHreq = bMax ? teilung(LH, bMax) : 1;
  const nVreq = hMax ? teilung(LV, hMax) : 1;

  // Tatsächlich verwendete Teilung (manuelle Wahl darf nur feiner sein/gleich)
  const nHu = Math.max(1, Math.round(Number(nH) || nHreq));
  const nVu = Math.max(1, Math.round(Number(nV) || nVreq));

  const bIst = LH > 0 ? LH / nHu : 0;
  const hIst = LV > 0 ? LV / nVu : 0;
  const okB = bMax == null || bIst * 100 <= bMax + 1e-9;
  const okH = hMax == null || hIst * 100 <= hMax + 1e-9;

  return {
    struktur, aktiv, bMax, hMax,
    nHreq, nVreq, nH: nHu, nV: nVu,
    bIst, hIst,
    ok: okB && okH, okB, okH,
    zwischenV: nHu - 1,   // zusätzliche vertikale Seile je Ankerfeld
    zwischenH: nVu - 1,   // zusätzliche horizontale Seile je Ankerfeld
  };
}
