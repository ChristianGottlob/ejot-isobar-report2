# EJOT Iso-Bar ECO Report Generator

Technischer Report-Generator für Fassadenbegrünungssysteme mit EJOT Iso-Bar ECO.

## Features

- PDF-Import: Statik-/Vorbemessungs-PDF einlesen und Werte automatisch extrahieren
- Editor: Alle Werte manuell bearbeiten (Projekt, System, Pflanze, Windlasten, Nachweise)
- Vorschau: Zweiseitiger Report mit Kernergebnissen und Nachweisbalken
- Anlagen: FLL Tabelle 15, Pflanzenübersicht (52 Arten), Systemschnitt
- Material: Überschlägige Stückliste mit Rastervisualisierung
- **PDF-Export**: Separate PDFs pro Abschnitt oder alle auf einmal

## Setup

```bash
npm install
npm run dev
```

## Tech Stack

- React 18 + Vite
- html2canvas + jsPDF für PDF-Export
- Keine externen UI-Libraries – alles Inline-Styles
