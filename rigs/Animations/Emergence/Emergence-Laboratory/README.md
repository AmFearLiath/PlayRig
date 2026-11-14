# Emergence Laboratory

**Observe. Experiment. Evolve.**

Ein eigenständiges PlayRig für künstliches Leben, evolvierende Populationen und kontrollierte Experimente. Das Rig läuft clientseitig im Browser und benötigt für die Simulation keine externe Datenbank oder Serververbindung.

## Funktionsumfang

### Welt & Ökosystem
- Vollflächiges Simulationsfeld mit Produzenten, Konsumenten, Räubern und Zersetzern
- Separater Modus für klassische zelluläre Automaten mit frei konfigurierbaren B/S-Regeln
- Individuelle Organismen mit Energie, Alter, Position, Genom und Abstammungsdaten
- Nahrungssuche, Energieaufnahme, Bewegung, Fortpflanzung und Lebensende
- Umweltparameter: Temperatur, Licht, Wasser, Nährstoffe und Toxizität
- Durchlässige, undurchdringbare und selektive Barrieren
- Direkte Eingriffe: Organismen einsetzen, auswählen, inspizieren und entfernen
- Einstellbare Populationsobergrenze; sie verhindert nur weitere Geburten und Einsätze, entfernt aber keine vorhandenen Organismen

### Evolution & Genetik
- Vererbbare Merkmale: Stoffwechsel, Bewegung, Verteidigung, Fortpflanzung, Temperaturtoleranz, Effizienz, Wahrnehmung und Anpassungsfähigkeit
- Zufällige Mutationen und Weitergabe genetischer Eigenschaften
- Umweltbedingte Selektionsvorteile
- Populationsverlauf, Geburten, Todesfälle und genetische Varianz
- Räumlicher Positionsindex für direkte Feldabfragen und effizientere lokale Suche
- Abstammungsinformationen für Organismen

### Experimentallabor
- Einzelne Organismen als Proben übernehmen oder zufällige Proben entnehmen
- Probenarchiv und Duplikation von Proben
- Genetische Eigenschaften direkt bearbeiten
- Isolierte Kulturen unter veränderbaren Temperatur-, Nährstoff- und Mutationsbedingungen simulieren
- Versuchsergebnisse als Einzelorganismus oder kleine Population in die Welt zurückführen
- Laborergebnisse dokumentieren

### Experimente & Daten
- Weltzustände und Laborproben lokal speichern
- Snapshots erstellen und wieder laden
- JSON-Export und JSON-Import
- Verschiebbare, minimierbare und größenveränderbare Fenster

## Projektstruktur

```text
Emergence-Laboratory/
├── index.html
├── docs.json
├── README.md
├── thumbnail.png
└── assets/
    ├── css/
    │   ├── main.css
    │   ├── layout.css
    │   ├── components.css
    │   └── windows.css
    └── js/
        ├── main.js
        ├── core/
        │   └── WorldEngine.js
        ├── modules/
        │   └── LabManager.js
        └── ui/
            ├── Renderer.js
            └── WindowManager.js
```

## Installation / PlayRig-Importer

1. Das Verzeichnis `Emergence-Laboratory` als Rig-Verzeichnis in PlayRig importieren.
2. `docs.json` enthält die Metadaten nach `rig-docs-v1.json`.
3. Der Einstiegspunkt ist `index.html`.
4. Die relativen Verweise auf `../../../../_shared/` binden die gemeinsam genutzten PlayRig-Styles und die optionale Bridge ein. Fehlt die Bridge, bleibt die Simulation eigenständig nutzbar.

## Bedienung

- Das Hauptmenü im Header öffnet die jeweiligen Arbeitsfenster.
- Unter **Leben → Katalog → Simulationsleistung** lässt sich die maximale Population einstellen. Die Obergrenze kann bis zur Zahl der Weltfelder reichen; eine Absenkung löscht keine bereits vorhandenen Organismen.
- Fenster lassen sich an der Titelleiste verschieben, minimieren und schließen. Die Fenstergröße kann über den Browser-Resize-Griff angepasst werden.
- Die Simulationssteuerung befindet sich im Footer.
- Im Bereich **Leben** können Organismen ausgewählt und eingesetzt werden.
- Im Bereich **Strukturen** wird ein Barrieren-Typ gewählt und anschließend direkt im Feld gezeichnet.
- Über **Labor** wird ein ausgewählter oder zufälliger Organismus als Probe übernommen.
- Nach einem Versuch können Ergebnisse bewusst in die Welt zurückgeführt werden.

## Wissenschaftliche Einordnung und Modellgrenzen

Emergence Laboratory ist ein vereinfachtes, wissenschaftlich inspiriertes Modell. Mutation wird zufällig erzeugt; Umweltbedingungen beeinflussen Energiehaushalt, Überleben und Reproduktion. Dadurch können sich vererbbare Eigenschaften über Generationen verändern.

Das Modell bildet keine vollständige Biochemie, keine vollständigen mehrzelligen Organismen und kein Bewusstsein ab. Die Verhaltenssteuerung ist eine begrenzte lokale Entscheidungsheuristik und keine allgemeine künstliche Intelligenz. Labor-Kulturen sind vereinfachte Vergleichsmodelle und keine identische Fortsetzung der vollständigen Weltphysik.

## Datenformat

Welt-Exporte verwenden weiterhin `playrig-emergence-world-v2`. Die optionale Eigenschaft `maxPopulation` speichert die eingestellte Obergrenze; ältere V2-Spielstände ohne diese Eigenschaft verwenden automatisch die gesamte Weltkapazität. Komplette Rig-Exporte verwenden `playrig-emergence-export` mit Version `2` und enthalten Welt, Labor und gespeicherte Experimente.
