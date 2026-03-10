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

## Deploy auf Vercel

1. Repository auf GitHub pushen
2. In Vercel mit GitHub verbinden
3. Framework: Vite erkennt Vercel automatisch
4. Fertig – die App läuft unter der zugewiesenen URL

## Tech Stack

- React 18 + Vite
- html2canvas + jsPDF für PDF-Export
- Keine externen UI-Libraries – alles Inline-Styles
