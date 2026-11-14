# Emergence Laboratory

Ein interaktives PlayRig-Forschungslabor für zelluläre Automaten und emergente Systeme.

## Modelle
- Conway's Game of Life (B3/S23)
- HighLife (B36/S23)
- Seeds (B2/S)
- Day & Night (B3678/S34678)
- Brian's Brain (dreistufiger Automat)
- Anneal (B4678/S35678)
- Eigene binäre B/S-Regeln

## Versuchssteuerung
- 1–120 Generationen pro Sekunde oder Einzelschritt
- 100×62 bis 480×300 Zellen
- Reproduzierbarer Seed und einstellbare Anfangsdichte
- Zellwerkzeuge: lebend, löschen, feste Hindernisse, inspizieren
- Toroidale oder begrenzte Feldränder
- Zufällige Mutationen
- Dichte-, Alters- und Aktivitätsdarstellung
- Populations-, Geburts-/Sterbe- und Shannon-Entropie-Kennzahlen
- Experiment-Snapshots und JSON-Export

## Wissenschaftliche Einordnung
Ein zellulärer Automat ist ein diskretes dynamisches System mit lokalem Zustandsübergang und synchroner Aktualisierung. Die sichtbaren globalen Muster entstehen aus der wiederholten Anwendung lokaler Regeln. Das Modell stellt kein biologisches Leben dar.

## Reproduzierbarkeit
Ein Export enthält Modellparameter, Seed, Generation, Zellzustände, Kennzahlen, Messhistorie und gespeicherte Experimente. Ein Snapshot kann direkt wieder geladen werden.
