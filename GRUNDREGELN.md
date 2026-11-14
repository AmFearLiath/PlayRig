# 📜 PLAYRIG PLATFORM - SYSTEM-GRUNDREGELN & MANIFEST
> **Offizielles Regelwerk & Standards für alle Rigs, Module und Plattform-Komponenten**
> **Stand:** v1.1.0 • **Author:** Liath • **Copyright:** © GameChiller • **System:** PlayRig

---

### § 1. Namensgebung, Rigs & Strukturkonventionen
1. **Systemname & Begrifflichkeiten:**  
   Die Plattform heißt offiziell **PlayRig** (bestehend aus dem öffentlichen **PlayRig Deck** und dem geschützten **PlayRig Studio / Admin Panel**). Alle erstellten Projekte, Werkzeuge und Generatoren heißen offiziell **Rigs**.
2. **Ordnerhierarchie:**  
   Alle Rigs werden strikt nach dem Schema organisiert:  
   `projects/Kategorien/Unterkategorien/Projektname/Dateinamen`  
   *Beispiel:* `projects/Gaming/Minecraft/Voxel-Sphere-Architect/index.html`
3. **Eindeutige ID & Slug:**  
   Jedes Rig besitzt eine systemweit unverwechselbare ID (z.B. `voxel-sphere-architect`, `particle-gravity-vortex`).
4. **Zentrale Datenbank (MySQL auf Port 3307):**  
   Die gesamte Benutzer-, Rechte-, Kategorie-, Audit- und Rig-Verwaltung läuft vollautomatisch über den lokalen MySQL-Server auf **Port 3307** (`localhost:3307`, User `root`, DB `playrig_db`).

---

### § 2. Kategorien & Animationen-Hauptkategorie
Das PlayRig-System umfasst fünf standardisierte Hauptkategorien:
1. **Gaming & Sandbox:** Generatoren, Editoren und Tools für Sandbox & Games (Minecraft, Procedural, RPG-Tools, Map-Generators).
2. **Animations & Visual FX (Eigene Hauptkategorie):**  
   - `Border-Beams` (Animierte leuchtende Rahmen, Scanner-Lights)
   - `Spotlights-3D` (Mausfolgende Lichtkegel, 3D-Kippeffekte)
   - `Particles-FX` (Partikelfelder, Konfetti, Stardust, Funken)
   - `Buttons-Ripples` (Haptische Buttons, Welleneffekte, Klick-Impulse)
   - `Canvas-Shaders` (WebGL Shader, Plasma, Fluid Dynamics, Raymarching)
   - `Transitions-Loaders` (High-Tech Preloader, Übergänge, Glitch-Effekte)
3. **Helper & Utility:** Produktivitäts-Helfer, Konverter und Rechner.
4. **Creative & Art:** Generative Kunst, Farbsysteme und Vektoren.
5. **Dev Lab & Showcase:** Experimentelle Tech-Demos, Shader und Prototypen.

---

### § 3. Versionierung, Copyright & Autorenschaft
1. **Versions-Standard:**  
   Alle Rigs und Module starten standardmäßig bei **`v0.0.1`** und werden semantisch versioniert (`vMAJOR.MINOR.PATCH`).
2. **Copyright & Urheber:**  
   - **Author:** `Liath`  
   - **Copyright:** `© GameChiller`  
3. **Sichtbarkeit des Copyrights:**  
   Der Hinweis `v[Version] • © GameChiller • Author: Liath` muss **sowohl in der Standalone-Ansicht als auch bei jeder Einbettung (z.B. per Iframe)** am Bildschirmrand oder im Header/Footer dezent, aber dauerhaft sichtbar bleiben.

---

### § 4. Vollständige Einbettbarkeit & Interoperabilität (Embeddable First)
1. **Iframe- & Widget-Support:**  
   Jedes Rig funktioniert autonom und lässt sich über `?embed=true` nahtlos in externe Webseiten, Notion, OBS-Browserquellen, Streamlabs oder Dashboards integrieren.
2. **Kein Frame-Bloat:**  
   Im Embed-Modus wird die äußere Seitenleiste/Navigation minimiert oder ausgeblendet (`body.is-embedded`), sodass nur der tatsächliche Tool-Inhalt im Fokus steht.
3. **Bridge-Kommunikation:**  
   Alle Module binden `_shared/js/embed-bridge.js` ein, um per `window.postMessage` sicher mit übergeordneten Plattformen zu kommunizieren.

---

### § 5. In-Window Rig Studio, 1-Klick CDN & Themesets
1. **Vollbild In-Page Studio (Kein Popup):**  
   Das Code-Studio wird als vollwertige Vollbild-Ansicht im Seitenfenster gerendert – mit Zwei-Spalten-Layout (Inspektor links, Monospace-Editor rechts), Line-Counters, Tab-Einrückung und `Strg+S`-Schnellspeichern.
2. **1-Klick CDN-Bibliotheken Injektor:**  
   Per Klick können die wichtigsten Standard-Bibliotheken (Three.js r128, OrbitControls, GSAP 3, Canvas-Confetti, Howler.js, Lucide Icons, jQuery 3.7, Tailwind CSS, FontAwesome 6, Bootstrap 5.3) automatisch in den `<head>` von `index.html` injiziert oder wieder entfernt werden.
3. **Systemeigene Themesets:**  
   Rigs können mit einem Klick an die standardisierten PlayRig Farb-Themesets gekoppelt werden (Cyber Cyan, Emerald Matrix, Synthwave Sunset, Royal Gold, Crimson Voltage), um systemweit maximale visuelle Konsistenz zu garantieren.
4. **Rig-Importer:**  
   Importiert externe Projekte von CodePen, JSFiddle, Gist oder reinem Quellcode und überführt sie automatisch in standardisierte PlayRig-Rigs.
5. **Standalone ZIP-Export:**  
   Jedes Rig kann mit einem Klick als autarkes `.zip`-Archiv exportiert werden.

---

### § 6. Design-, Visualisierungs- & Performance-Niveau
1. **Kein generischer KI-Einheitsbrei:**  
   Eigenständiges PlayRig-Design mit Deep Slate / OLED Surface (`#07090e`, `#0a0f1d`), gestochen scharfen Schriftbildern (*Plus Jakarta Sans* & *JetBrains Mono*) und dynamischen Micro-Interactions.
2. **Höchste technische Exzellenz:**  
   Three.js InstancedMesh für 100.000+ Polygone/Voxel bei 60 FPS, Web Audio API für haptisches Soundfeedback, GPU-beschleunigte CSS-Filter.
