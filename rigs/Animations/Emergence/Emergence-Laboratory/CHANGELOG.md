# Changelog

## 2.1.0
- Räumlicher Positionsindex mit direktem O(1)-Zugriff auf belegte Weltfelder.
- Bewegungen, Beutesuche und freie Platzsuche ohne wiederholte vollständige Populationsdurchläufe.
- Freie Fortpflanzungsplätze werden ohne temporäre Kandidatenlisten ermittelt.
- Populationszahlen werden inkrementell gepflegt; genetische Varianz wird in einem Durchlauf berechnet.
- Konfigurierbare Populationsobergrenze in den Simulationseinstellungen. Eine Änderung entfernt keine bestehenden Organismen.
- Terrain-Rendering wird zwischengespeichert; Organismen werden nach Typ gebündelt und ohne individuelle Schatten gezeichnet.
- Rendering auf maximal etwa 30 Aktualisierungen pro Sekunde begrenzt; UI-Analysen werden nur während des laufenden Betriebs periodisch aktualisiert.
- Das Weltformat `playrig-emergence-world-v2` bleibt erhalten; ältere V2-Spielstände erhalten beim Laden automatisch die maximale Weltkapazität als Populationslimit.

## 2.0.0
- Umbau zur modularen Ökosystem- und Evolutionssimulation.
- Klassischer zellulärer Automatenmodus mit B/S-Regeln und Presets.
- Floating Windows, Footer-Steuerung und Probenlabor mit Rückführung.
- JSON-Import/Export sowie lokale Speicherung.
