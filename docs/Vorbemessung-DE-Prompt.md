# Aufgabe: Vorbemessung im Tool rechnen (statt nur PDF einlesen) — Phase 1: Deutschland, Iso-Bar ECO Raster, Beton

## Kontext & Ziel
Heute zieht das Tool die Vorbemessungswerte per Regex aus einer extern in Excel erzeugten PDF
(`src/pdfExtract.js`). Künftig soll die **Vorbemessung direkt im Tool gerechnet** werden — exakt nach
der EJOT-Excel-Logik. Zwei Eingabewege bleiben gleichberechtigt:

1. **PDF hochladen** (wie bisher) → Werte werden extrahiert.
2. **Im Tool rechnen** → Nutzer gibt die Projektparameter ein, das Tool rechnet die komplette
   Vorbemessung (Windlast → Lasten → FRd → min. Befestiger/m² → Raster LH/LV → alle Nachweise).

Wenn im Tool gerechnet wird, sind die Zellenzuweisungen eindeutig bekannt → keine Regex-Heuristik,
keine Abhängigkeit von der PDF-Erstellung mehr.

Länder: **DE zuerst**, danach **AT**, dann **CH**. Sie unterscheiden sich im Wesentlichen in der
**Windlastberechnung** (Norm/National Annex). Die Maske soll von Anfang an eine Länderauswahl
(DE/AT/CH) vorsehen; gerechnet wird in Phase 1 nur DE.

Innerhalb DE gibt es 4 Excel-Varianten, die **dieselbe Rechen-Engine** teilen und sich nur in
Parametern unterscheiden:
- Untergrund: **Beton** vs. **Mauerwerk** (andere Zulassungswerte FRk, hef, γM, d2, Fd …)
- System: **Raster** (Gitter, LH·LV-Feld) vs. **Linear** (Seil/Reihe)

**Phase 1 = DE · Raster · Beton C20/25.** Architektur aber so anlegen, dass Untergrund/System/Land
als Parametersätze austauschbar sind.

---

## Referenz-Workbook (Quelle der Wahrheit)
`public/Vorbemessung_Deutschland/2025 03 12 Vorbemessung Iso Bar Eco Raster Beton … .xlsx`

Relevante Sheets: `Eingabe`, `q(z)`, ` CPE Wand`, `Lastklassen`, `MIndestanzahl Bef._m²`,
`Berechnung_de`, `Längenwahl`. Die Plant-/FLL-Tabelle (`Eingabe!E14:R66`) liegt bereits im Tool
(`FLL_PLANTS` in `src/App.jsx`), inkl. Lastklasse je Pflanze (Spalte R).

---

## Rechen-Engine DE (exakt nachzubauen)

### Eingaben (vom Nutzer)
| Größe | Excel | Einheit | Default/Quelle |
|---|---|---|---|
| Bauvorhaben, Ort, PLZ | Eingabe!B2/B3/B4 | – | Text |
| Gebäudehöhe z | Eingabe!B5 | m | z. B. 20 |
| Gebäudelänge d | Eingabe!B6 | m | Wandbreite für cpe |
| Gebäudebreite b | Eingabe!B7 | m | Gebäudetiefe für cpe |
| Windzone WZ | q(z)!D3 | 1–4 | DIN EN 1991-1-4/NA |
| Geländekategorie | q(z)!D9 | I–IV + Mischprofile | s. u. |
| Lastklasse Gewächs LK | Eingabe!B10 | 1–5 | aus Pflanzenwahl (FLL R-Spalte) |
| Dämmdicke | Eingabe!B11 | mm | tWDVS-Anteil |
| Putzdicke | Eingabe!B12 | mm | tWDVS-Anteil |
| Dicke Kleber+Altputz ttol | Eingabe!B13 | mm | z. B. 10 |

Geländekategorie-Selektor (q(z)!D9): **1=GK I, 2=GK II, 3=GK III, 4=GK IV, 5=Binnenland,
7=Küste+Ostsee, 8=Nordsee.** (Das Tool kennt heute nur GK I–IV — Mischprofile ergänzen.)

### 1) Böengeschwindigkeitsdruck q(z) — Sheet `q(z)`
`qref` nach Windzone: WZ1=0,32 · WZ2=0,39 · WZ3=0,47 · WZ4=0,56 [kN/m²].
Dann je Geländekategorie höhenabhängig (z = Gebäudehöhe), nur der zutreffende Ast ist ≠ 0:

- **GK I:** z≤2 → 1,9·qref · 2<z≤300 → 2,6·qref·(z/10)^0,19
- **GK II:** z≤4 → 1,7·qref · 4<z≤50 → 2,1·qref·(z/10)^0,24 · 50<z≤300 → 2,6·qref·(z/10)^0,19
- **GK III:** z≤8 → 1,5·qref · 8<z≤50 → 1,6·qref·(z/10)^0,31 · 50<z≤300 → 2,1·qref·(z/10)^0,24
- **GK IV:** z≤16 → 1,3·qref · 16<z≤50 → 1,1·qref·(z/10)^0,4 · 50<z≤300 → 1,6·qref·(z/10)^0,31
- **Binnenland (5):** z≤7 → 1,5·qref · 7<z≤50 → 1,7·qref·(z/10)^0,37 · 50<z≤300 → 2,1·qref·(z/10)^0,24
- **Küste+Ostsee (7):** z≤4 → 1,8·qref · 4<z≤50 → 2,3·qref·(z/10)^0,27 · 50<z≤300 → 2,6·qref·(z/10)^0,19
- **Nordsee (8):** z≤2 → 1,1·qref · 2<z≤300 → 1,5·qref·(z/10)^0,19  *(Achtung: im Sheet wirkt qref hier teils nicht — Originalformel prüfen und 1:1 übernehmen)*

→ **q(z) = B38** [kN/m²].

### 2) Wand-Druckbeiwert cpe — Sheet ` CPE Wand`
d = Gebäudelänge, b = Gebäudetiefe, h = Höhe. e = min(b, 2h). Verhältnis h/d = max(h/d, h/b).
cpe,1 Bereich A (maßgebliche Sog-Ecke) aus Tabelle: h/d≥5 → −1,7; h/d=1 → −1,4; h/d≤0,25 → −1,4
(zwischen interpolieren wie im Sheet; in Phase 1 reicht die Sheet-Logik 1:1).
→ **cpe,A = D8** (z. B. −1,7). Für Winddruck (Bereich D) gilt cpe = +1.

### 3) Flächenlasten — Sheet `Berechnung_de` + `Lastklassen`
- Gewicht je LK: `Lastklassen` Zeile „flächig" → g0 [kg/m²]/100 = [kN/m²]
  (LK1=6, LK2=11, LK3=15, LK4=17, LK5=24 kg/m² → /100). **B38**.
- **g = g0 · 0,75 · 1,8** (Vereisung +80 %, −25 %) [kN/m²]. **B39**.
- Durchströmungsfaktor **ψ** je LK (`Lastklassen` Abminderung): LK1=0,55 · LK2=0,60 · LK3=0,60 ·
  LK4=0,65 · LK5=0,70. **B40**.
- **Windsog ws = q(z) · cpe,A · (−1)** [kN/m²]. **B41**.
- **Winddruck Nek = q(z)** [kN/m²]. **B42**.

### 4) Tragfähigkeit FRd (Beton-Zulassung Z-21.8-2083)
- FRk = 6 kN; γM = 1,8; ψ0sus = 0,6; hef,min = 40 mm.
- asus = g / √(g² + ws²)  → **B20**
- ψsus = (asus < ψ0sus) ? 1 : (ψ0sus + 1 − asus)  → **B22**
- **FRd = FRk · ψsus / γM**  → **B24** (Beispiel = 3,333 kN)

### 5) Min. Befestiger/m² → Raster LH/LV — Sheet `MIndestanzahl Bef._m²`
Geometrie: e = tWDVS + ttol = (Dämm+Putz) + Kleber; a = 5 mm (Abstand WDVS–Anbauteil);
d2 = 20 mm; La = 80 mm; E = 60000 N/mm²; I = 7854 mm⁴; γM,E = 1,3; Fd = 64 kN; Knickbeiwert b = 2.
- lges l1 = (e + a + 0,5·d2 + La) · b / b  → l1 = e+a+0,5·d2+La (= 295 mm im Beispiel)
- l2 = l1 − La − 15  (= 200 mm)
- Ncr = π² · (E/γM,E) · I / (e+a)² / 1000  [kN]
- V(10 mm) = 3·E·I·6,66 / l1³ / 1000   (6,66 = 10 mm / 1,5)
- V(5 mm)  = 6·E·I·3,33 / l2² / (3·l1 − l2) / 1000   (3,33 = 5 mm / 1,5)

Min. Befestiger/m² = **MAX** über:
| Nachweis | Formel |
|---|---|
| Zug | ws·ψ·1,5 / FRd |
| Druck Knicken | Nek·ψ·1,5 / (Ncr/γM,E) |
| Druck max. Beton | Nek·ψ·1,5 / Fd |
| Quer | g·1,35 / FRd |
| Zug/Quer | Zug + Quer |
| Druck/Quer | Quer + max(Druck Knicken, Druck max. Beton) |
| Verformung L1 | g·1,35 / V(10 mm) |
| Verformung L2 | g·1,35 / V(5 mm) |

→ **min. Bef/m² = C13**, **max. Abstand LH = √(1 / min.Bef/m²) = C14**, **LV = LH** (quadratisches Raster).

### 6) Endgültige Nachweise (mit gewähltem LH/LV) — Sheet `Berechnung_de`
- Vd = LH·LV·g·1,35 [kN]                         (B46)
- Nd = LH·LV·ws·ψ·1,5 [kN]                        (B47)
- NEd = Nek·LH·LV·ψ·1,5 [kN]                      (B52)
- Nachweise (Ausnutzung, jeweils ≤ 1):
  - Vd/FRd (B48) · Nd/FRd (B49) · **√(Vd²+Nd²)/FRd** (B50, kombiniert)
  - NEd/(Ncr/γM,E) (B73) · NEd/Fd (B74)
- Verformung (≤-Grenzen): w(l1)·1,5 ≤ 10 mm (B80) · w(l2)·1,5 ≤ 5 mm (B81)
  - w(l1) = Vd·1000·l1³ / 3 / E / I
  - w(l2) = −1/E/I · (Vd·1000·l2³/6 − Vd·1000·l1·l2²/2)

### 7) Produkt/Längenwahl — Sheet `Längenwahl`
Lmin = e + hef = (tWDVS + ttol) + hef,min. Wähle kleinste Standardlänge ≥ Lmin.
Standard-Raster-Set: ECO 200/260/320/380/440/500. Sonderlängen 140–500 in 10-mm-Schritten.
→ Bestellbezeichnung „SET EJOT Iso-Bar ECO {L}".

---

## Referenz-Validierungsfall (Engine muss das reproduzieren)
Eingabe: z=20 m, d=4 m, b=10 m, WZ 3, GK IV, LK 5, Dämm 180 mm, Putz 10 mm, ttol 10 mm, Beton C20/25.
Erwartete Ergebnisse:
- q(z) = 0,682 kN/m² · cpe,A = −1,7 · ws = 1,160 kN/m² · Nek = 0,682 kN/m²
- g = 0,567 kN/m² · ψ = 0,70 · FRd = 3,333 kN
- LH = LV = 0,670 m  (min. Bef/m² = 2,228)
- Vd/FRd = 0,103 · Nd/FRd = 0,164 · √-kombi = 0,194
- Druck-Nachweise ≪ 1 · Verformung 9,36 mm (≤10) und 4,995 mm (≤5)
**Toleranz: ±0,5 % gegen die Excel-Cache-Werte.** Diesen Fall als automatisierten Test hinterlegen.

---

## Umsetzung im Tool

### Architektur
- Neues, reines Rechenmodul **`src/vorbemessung/de.js`** (keine UI, keine Seiteneffekte), Funktion
  `computeVorbemessungDE(inputs) → { qz, cpe, ws, nek, g, psi, FRd, LH, LV, stk_m2, nachweise{…},
  verformung{…}, produkt }`. Reine Funktionen je Schritt (windQz, cpeWand, frd, minBefestiger …),
  jeweils unit-testbar.
- Parametersätze als Daten: `SUBSTRATE_PARAMS` (Beton C20/25 zuerst: FRk, hef, γM, d2, Fd, E, I, …),
  `SYSTEM = raster|linear`, `LASTKLASSEN`, `WINDZONEN`, `GK_PROFILE`. So sind Mauerwerk/Linear/AT/CH
  später nur neue Datensätze + ggf. eigene `windQz`.
- Länderschicht: `computeVorbemessung(country, inputs)` dispatcht auf `de` (Phase 1), Platzhalter `at`,`ch`.

### UI / Maske
- Oben in der Vorbemessungs-Sektion ein **Moduswechsel**: „PDF hochladen" ⟷ „Im Tool rechnen".
- Im Rechen-Modus: Eingabefelder (Land DE/AT/CH; Gebäudemaße z/d/b; Windzone; Geländekategorie inkl.
  Mischprofile; Lastklasse — automatisch aus Pflanzenwahl, manuell überschreibbar; Dämm-/Putz-/Klebdicke;
  Untergrund; System Raster/Linear).
- Live-Ergebnisanzeige: q(z), ws, Nek, FRd, LH/LV, Stück/m², alle Nachweise als Ausnutzungsbalken
  (gleiche Farbskala wie `NwBar`), Produkt/Bestellbezeichnung, Verformungen.
- Ergebnis schreibt in **dasselbe `document`-Datenmodell** wie der PDF-Pfad (Felder aus `FIELD_LABELS`),
  damit Report/RasterOverlay/DetailCrop unverändert weiterlaufen.
- Quellenvermerk je Wert (Norm/Zulassung) wie in der Excel-Spalte D optional als Tooltip.

### Nicht-Ziele Phase 1
AT/CH-Windlast; Mauerwerk; Linear-System; Dlubal-Geo-API-Autobefüllung. (Felder/Schalter anlegen,
Rechnung folgt in Folgephasen.)

---

## Getroffene Entscheidungen (2026-06-29)
1. **Untergrund:** alle Betonklassen (C20/25 … C50/60), **FRk je Klasse** — nicht konstant.
2. **Geländekategorie:** alle Profile (GK I–IV + Binnenland + Küste+Ostsee + Nordsee), voll umsetzbar.
3. **Lastklasse:** automatisch aus Pflanzenwahl (FLL Spalte R), manuell überschreibbar.
4. **Geo-API:** später; Phase 1 manuelle Eingabe von Windzone/GK.

## FRk je Betonklasse — GEKLÄRT (Z-21.8-2083 Tabelle 12, eingebettetes Bild im Workbook)
Die im Workbook eingebettete **Tabelle 12** („Charakteristische Tragfähigkeit für alle
Belastungsrichtungen und Versagensarten") zeigt: FRk ist **NICHT** von der Betonklasse abhängig,
sondern **produkt-/stahlbestimmt und nur temperaturabhängig**:
- FRk = **6,0 kN** bei ≤ 24/40 °C · FRk = **5,5 kN** bei ≤ 50/80 °C · γM = 1,8.
Gültig für alle Klassen ≥ C20/25; auch die Anker-Montagewerte (hef,min = 40 mm, Smin = 100, d0 = 24)
sind nach Tabelle 5 klassenunabhängig. → Umgesetzt: alle Betonklassen wählbar (rein dokumentarisch),
FRk über einen **Temperatur-Schalter** (normal/hoch). Test deckt Klassen-Unabhängigkeit + 5,5-kN-Fall ab.

## Bild-/Sheet-Analyse aller 4 Workbooks (vollständig gesichtet)
Alle eingebetteten Bilder extrahiert/betrachtet (Beton-Set wb0=wb1, Mauerwerk-Set wb2=wb3) und alle
Sheets inventarisiert. Bestätigt 1:1 die Engine: q(z)-GK-Tabelle (Bild image17), cpe-Tabelle NA.1 +
Wandbereiche (image18/19), FRd/Knick-Formeln (image5/9), Knickfälle β=2 (image6), Montagewerte Tab. 5
(image7). **Mauerwerk-Workbooks** haben ein eigenes Sheet **`Steine`** (= Substrat-Parameter je Stein:
N_Rk Zug d/d & w/w, α_Druck, V_Rk, δ0, Verankerungstiefe, Achs-/Randabstände, Gruppenfaktor) +
Tabellen 14/15/16 (Bilder) und eine **andere Interaktionsformel** x = NRd·VRd/(NEd·VRd+VEd·NRd) statt
der Beton-Wurzelformel, γMm = 2,5 (Porenbeton 2,0). → Datengrundlage für die Mauerwerk-Phase steht.
