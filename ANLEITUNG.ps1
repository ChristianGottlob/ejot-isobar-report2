# ═══════════════════════════════════════════════════════════════
# EJOT Greening Frontend - Iso-Bar ECO Integration
# Schritt-für-Schritt PowerShell Befehle
# ═══════════════════════════════════════════════════════════════

# 1. In das Repo wechseln
cd ~\Documents\greening-frontend

# 2. Feature-Branch erstellen
git checkout -b feature/isobar-report-generator

# 3. Die 3 Dateien ersetzen/anlegen:
#    - src/pages/IsoBarReport.tsx        (NEU - die komplette App)
#    - src/components/app-sidebar.tsx     (ERSETZT - neuer Menüpunkt)
#    - src/App.tsx                        (ERSETZT - neue Route)
#
#    Kopiere die Dateien aus dem Download-Ordner:
#    (Passe den Pfad an, je nachdem wo du die Dateien gespeichert hast)

# 4. Dev Server starten zum Testen
npm run dev

# 5. Im Browser öffnen: http://localhost:5173
#    -> Sidebar sollte jetzt "Iso-Bar ECO" zwischen Dashboard und Docs zeigen

# 6. Wenn alles funktioniert - committen und pushen:
git add .
git commit -m "feat: add Iso-Bar ECO Report Generator"
git push origin feature/isobar-report-generator

# 7. Dann auf GitHub den Pull Request erstellen:
#    https://github.com/EJOT-Engineering/greening-frontend/compare
#    -> "feature/isobar-report-generator" als Source Branch auswählen
#    -> PR erstellen -> wird automatisch auf Dev deployed
