# 💻 PlayRig – Entwickler-Leitfaden

**Zielgruppe:** Frontend-Entwickler, Rig-Autoren & Modder  
**Stand:** v1.0.0  
**Autor:** Liath • **Copyright:** © GameChiller  

---

## 1. Vorbereitung und Schnellstart

### 1.1 Lokale Umgebung starten
1. **Repository klonen:**
   ```bash
   git clone https://github.com/AmFearLiath/PlayRig.git
   cd PlayRig
   ```
2. **Abhängigkeiten installieren:**
   ```bash
   npm install
   ```
3. **Datenbank sicherstellen:**
   MySQL-Dienst muss auf Port `3307` erreichbar sein (Datenbank: `playrig_db`).
4. **Server starten:**
   ```bash
   node server/server.js
   ```
5. **Oberflächen aufrufen:**
   - **PlayRig Deck (Katalog):** [http://localhost:8882](http://localhost:8882)
   - **PlayRig Studio (Editor):** [http://localhost:8882/studio](http://localhost:8882/studio)

---

## 2. Anatomie eines PlayRig-Moduls

Jedes Rig liegt in einem strukturierten Unterverzeichnis von `rigs/`:
`rigs/<Kategorie>/<Unterkategorie>/<Projekt-Slug>/`

```
rigs/Gaming/Minecraft/Voxel-Sphere-Architect/
├── index.html        # HTML-Gerüst, Header, Topbar & Viewport
├── style.css         # Rig-spezifische Layouts & Styles
├── app.js            # Anwendungslogik & PlayRig-Bridge Anbindung
├── docs.json         # Standalone-Dokumentation & Schnittstellen
└── thumbnail.png     # Statischer Snapshot für das Deck Spotlight
```

---

## 3. Schritt-für-Schritt: Neues Rig erstellen

### Schritt 1: Rig im Studio anlegen
1. Öffne das [PlayRig Studio](http://localhost:8882/studio).
2. Klicke unter **Meine Rigs & Code** auf den Button **`+ Neu`**.
3. Fülle das Formular aus:
   - **Titel:** z. B. `Orbital Gravity Lab`
   - **Slug:** `orbital-gravity-lab`
   - **Kategorie:** z. B. `Gaming & Sandbox`
   - **Autor:** Dein Entwicklername (z. B. `DeinName`)
   - **Copyright:** Dein Copyright (z. B. `© DeinName`)
4. Klicke auf **🚀 Rig & Dateistruktur erstellen**.

### Schritt 2: Designsystem einbinden
Binde in der `index.html` die zentralen Tokens und Styles ein:
```html
<link rel="stylesheet" href="../../../_shared/css/tokens.css">
<link rel="stylesheet" href="../../../_shared/css/themes.css">
<link rel="stylesheet" href="../../../_shared/css/base.css">
<link rel="stylesheet" href="../../../_shared/css/components.css">
<link rel="stylesheet" href="../../../_shared/css/animations.css">
<link rel="stylesheet" href="./style.css">
```

### Schritt 3: PlayRig Bridge initialisieren
Binde am Ende des `<body>` die Bridge ein:
```html
<script src="../../../_shared/js/playrig-bridge.js"></script>
<script src="./app.js"></script>
```

In deiner `app.js`:
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Kontext von GameChiller abholen
  window.PlayRig.onContext((ctx) => {
    console.log('Aktiver User:', ctx.user.displayName);
  });

  // 2. Gespeicherte Benutzereinstellungen laden
  const savedState = await window.PlayRig.storage.get('player_state', { score: 0 });

  // 3. Einstellungen nach Interaktion speichern
  await window.PlayRig.storage.set('player_state', { score: savedState.score + 10 });
});
```

### Schritt 4: Standalone-Dokumentation (`docs.json`) anlegen
Erstelle eine Datei `docs.json` im Rig-Verzeichnis:
```json
{
  "$schema": "https://playrig.gamechiller.de/schemas/rig-docs-v1.json",
  "id": "orbital-gravity-lab",
  "name": "Orbital Gravity Lab",
  "version": "v1.0.0",
  "author": "DeinName",
  "copyright": "© DeinName",
  "overview": "Physikalischer Gravitations-Simulator.",
  "features": [
    "N-Body Gravitationsberechnung",
    "WebGL-Partikel-Shader",
    "Offline-fähige Session-Persistenz"
  ],
  "permissions": [
    "rigs:read",
    "storage:user"
  ],
  "faq": [
    {
      "q": "Wie pausiere ich die Simulation?",
      "a": "Drücke die Leertaste oder klicke auf den Pause-Button."
    }
  ]
}
```

### Schritt 5: Vorschau-Snapshot (`thumbnail.png`) erstellen
- Starte dein Rig im Sandbox Runner des Decks.
- Klicke in der Sandbox-Topbar auf **`📸 Snapshot`**.
- Der Snapshot wird automatisch als `thumbnail.png` in dein Verzeichnis gespeichert und im Spotlight angezeigt.

---

## 4. Sicherheits- & Coding-Richtlinien

1. **Kein `target="_blank"`:** Alle Links müssen im selben Fenster verbleiben oder `window.PlayRig.navigate(url)` nutzen.
2. **Keine Wildcards in `postMessage`:** Immer `window.PlayRig.sendEvent()` oder `postToHost()` nutzen.
3. **Reduced Motion beachten:** Alle animierten Effekte müssen bei aktivierter Barrierefreiheit reduziert ablaufen.
4. **Offline First:** Verwende für Datenspeicherung immer `window.PlayRig.storage`, da es automatisch auf `localStorage` zurückfällt, wenn keine Serververbindung besteht.
5. **Autorenschaft & Copyright:** Core-Rigs von GameChiller tragen verbindlich `Liath` / `© GameChiller`. Eigene Rigs von Community-Entwicklern behalten ihren eigenen Namen und ihr eigenes Copyright.

---

## 5. ZIP-Projekt-Pakete & Automatischer Import

Entwickler und Modder können vollständige Projekte als **`.zip`-Archiv** hochladen oder über die API `/api/v1/rigs/import-zip` einbinden.

### 5.1 Erforderliche ZIP-Struktur
Das Archiv muss im Wurzelverzeichnis (oder in einem einzelnen Basisordner) mindestens folgende Dateien enthalten:
```
mein-rig.zip/
├── index.html        # Haupteinstiegspunkt (Erforderlich)
├── style.css         # Styling & Effekte (Optional, empfohlen)
├── app.js            # Anwendungslogik (Optional, empfohlen)
├── docs.json         # Autonome Dokumentation (Optional, wird sonst auto-generiert)
└── assets/           # Texturen, Icons, Shader etc. (Optional)
```

### 5.2 Automatisierte Sicherheitsprüfung (Anti-Malware & Sandbox-Scan)
Jedes Archiv wird vor dem Entpacken durch den `RigSecurityScanner` auf folgende Kriterien geprüft:
- **Zip-Slip Schutz:** Keine relativen Pfade (`../`) oder absolute Pfade, die aus dem Zielordner ausbrechen.
- **Verbot ausführbarer Binaries:** `.exe`, `.dll`, `.bat`, `.cmd`, `.sh`, `.php`, `.vbs`, `.py` führen zur sofortigen Ablehnung.
- **Verbot von dynamischem Code:** Aufrufe von `eval()`, `new Function()`, `setTimeout('code')` sind streng untersagt.
- **Anti-Backdoor & Systemaufrufe:** Keine Verwendung von `child_process`, `require('fs')`, `process.exit`, reverse shells.
- **Exfiltrations-Schutz:** Kein unberechtigter Zugriff auf `document.cookie` oder Token-Speicher des Hosts.
- **Mining-Erkennung:** Signaturen von Cryptominern (`coinhive` etc.) werden blockiert.

### 5.3 Out-of-the-Box Lauffähigkeit
Wird ein fremdes Web-Projekt importiert, injiziert das PlayRig-System automatisch fehlende Verknüpfungen in `index.html`:
1. **Design Tokens & Theme-Stylesheets:** `<link rel="stylesheet" href="../../../../_shared/css/tokens.css">`
2. **PlayRig Bridge:** `<script src="../../../../_shared/js/playrig-bridge.js"></script>`
3. **Dokumentations-Manifest:** Falls kein `docs.json` beiliegt, wird ein valides Grund-Manifest generiert.
Das Rig ist nach dem Import **sofort lauffähig** und erscheint im PlayRig Deck und Studio.

---

## 6. 🤖 Verbindlicher Leitfaden & System-Prompt für KI-Agenten (AI Agent Rig Creation Standard)

> [!IMPORTANT]
> **Für KI-Agenten (Gemini, Claude, GPT etc.):**  
> Wenn du beauftragt wirst, ein neues PlayRig-Modul oder Tool für das PlayRig- / GameChiller-Ökosystem zu entwickeln, musst du die folgenden Qualitätskriterien **ohne Ausnahme** erfüllen. Rigs dürfen niemals wie generische Webseiten oder unfertige Demos aussehen. Sie müssen auf **höchstem technischem, spielerischem und visuellem Niveau** operieren.

### 6.1 Visuelle Identität & UI-Standards
1. **Farbwelt & Dark Theme:**
   - Grundfläche: Deep Canvas Dark (`#07090e`, `#0a0f1d`).
   - Primärakzente: Cyber Cyan (`#00f0ff`), Electric Purple (`#a855f7`), Neon Emerald (`#10b981`), Radiant Rose (`#f43f5e`).
   - Transparenzen & Glassmorphism: `backdrop-filter: blur(16px); background: rgba(10, 15, 29, 0.75); border: 1px solid rgba(0, 240, 255, 0.2);`.
2. **Typografie:**
   - Monospace für Werte, Timer, Koordinaten und Code: `'JetBrains Mono', 'Fira Code', monospace`.
   - Fließtext & Buttons: `'Inter', -apple-system, sans-serif`.
3. **Lebendige Interaktivität (Micro-Interactions):**
   - Jedes UI-Element muss Hover- und Aktiv-Zustände besitzen (Glow-Effekte, sanfte Farbshifts `transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)`).
   - HUD-Elemente müssen gestochen scharf, kontrastreich und auch bei 1080p / 4K skalierbar sein.

### 6.2 Technische Spitzenqualität & Performance
1. **Stabile 60 FPS:**
   - Animationsschleifen **müssen** `requestAnimationFrame` mit kontinuierlicher Delta-Time (`deltaTime = (now - lastTime) / 1000`) verwenden.
   - Bei 3D-Szenen (Three.js): Verwende `InstancedMesh` für wiederkehrende Geometrien (z.B. Voxel, Partikel, Asteroiden), niemals Tausende separate Meshes!
   - Garbage Collection schonen: Objekte im Renderloop wiederverwenden, keine Vektoren oder Arrays pro Frame instanziieren.
2. **Prozeduraler Sound (Web Audio API):**
   - Rigs dürfen keine externen `.mp3` oder `.wav` Dateien erfordern, die durch CORS blockiert werden oder 404 werfen könnten.
   - Erzeuge Audio-Feedback (Klicks, Laser, Triebwerke, Chimes) **rein prozedural** mit der nativen `AudioContext`-API (Oszillatoren, Gain-Envelopes, Noise-Buffer, Biquad-Filter).
3. **Eingabe & Steuerung:**
   - Vollständige Unterstützung von Tastatur (WASD / Pfeiltasten), Maus (Click, Drag, Wheel) und Touch-Gesten auf mobilen Endgeräten.
   - Tastenbelegungen müssen im UI klar sichtbar dokumentiert sein (z.B. Keyboard-Badge `[SPACE]`, `[R]`, `[ESC]`).

### 6.3 Sandbox- & PlayRig-Bridge Konformität
1. **Kein `eval()` / `new Function()`:** Code muss statisch und transparent sein.
2. **Keine Wildcards in `postMessage`:** Nutze stets die Methoden von `window.PlayRig`:
   ```javascript
   // Status & Einstellungen speichern
   await window.PlayRig.storage.set('settings', { volume: 0.8, theme: 'neon' });

   // Navigation im selben Fenster
   window.PlayRig.navigate('/studio');

   // Benutzer benachrichtigen
   window.PlayRig.notify('Projekt erfolgreich gerendert!', 'success');
   ```
3. **Kein `target="_blank"`:** Alle Links bleiben im selben Tab oder nutzen `window.PlayRig.navigate()`.
4. **Offline First:** Verwende `window.PlayRig.storage`. Falls das Rig standalone ohne Host geöffnet wird, fällt die Bridge nahtlos auf `localStorage` zurück.

### 6.4 Manifest-Schema (`docs.json`)
Jedes professionelle Rig muss eine `docs.json` Datei im Root-Ordner besitzen:
```json
{
  "$schema": "https://playrig.gamechiller.de/schemas/rig-docs-v1.json",
  "id": "mein-rig-slug",
  "name": "Mein Aussergewoehnliches Rig",
  "version": "v1.0.0",
  "author": "Dein Name",
  "copyright": "© Dein Name",
  "overview": "Prägnante, packende Beschreibung der Kernfunktion in 2-3 Sätzen.",
  "features": [
    "Feature 1 mit technischen Details",
    "Feature 2 (z.B. 60 FPS WebGL Rendering)",
    "Feature 3 (z.B. Prozeduraler Web Audio Synthesizer)"
  ],
  "controls": [
    { "key": "Maus Links", "action": "Objekt platzieren / interagieren" },
    { "key": "WASD", "action": "Kamera bewegen" },
    { "key": "R", "action": "Simulation zurücksetzen" }
  ],
  "permissions": ["rigs:read", "storage:user"]
}
```

---

### 6.5 📋 Kopierbarer System-Prompt für KI-Agenten

Kopiere den folgenden Prompt und übergib ihn an deine KI (z.B. Antigravity, Claude, ChatGPT), wenn du ein neues Rig generieren lässt:

```markdown
Du bist ein leitender Lead Creative Developer und Systems Engineer für die PlayRig Plattform (GameChiller Ökosystem).
Deine Aufgabe ist es, ein vollständiges, atemberaubendes und sofort lauffähiges Web-Rig zu entwickeln.

Befolge strikt folgende Standards:
1. DESIGN & AESTHETICS:
   - Deep Canvas Dark Theme (#07090e, #0a0f1d) mit leuchtenden Neon-Akzenten (#00f0ff Cyan, #a855f7 Purple).
   - Hochmoderne Glassmorphism-Panels (backdrop-filter blur, subtile 1px Border mit Farbverlauf).
   - Typografie: 'JetBrains Mono' für Zahlen, Code und HUD; 'Inter' für Text.
   - Lebendige Interaktionen, reaktive Buttons, Tooltips und Statusanzeigen.

2. TECHNISCHE ANFORDERUNGEN:
   - Flüssige 60 FPS Animation via requestAnimationFrame mit Delta-Time.
   - Kein Einsatz von eval(), new Function() oder unsicherem Code (wird vom Security-Scanner geblockt).
   - Prozedurales Sound-Design via Web Audio API (keine externen mp3/wav Abhängigkeiten).
   - Alle Links im selben Tab (kein target="_blank").
   - Responsive Anpassung an die Viewport-Größe (Resize-Handler).

3. STRUKTUR:
   Erstelle ein vollständiges Projekt mit:
   - index.html: Sauberes Markup mit Topbar, Canvas/Viewport, Steuerungs-Dock und HUD.
   - style.css: Alle CSS-Variablen, Glassmorphism-Klassen, Animationen und Layouts.
   - app.js: Vollständige Anwendungslogik, Event-Listener, Sound-Synthese und PlayRig Bridge Integration (window.PlayRig.storage).
   - docs.json: Valides Manifest nach dem PlayRig Rig-Docs-v1 Schema.

4. AUTORENSCHAFT & COPYRIGHT:
   - Verwende den vom Nutzer angegebenen Autorennamen und das entsprechende Copyright.
   - Setze die Version initial auf v1.0.0.
```

