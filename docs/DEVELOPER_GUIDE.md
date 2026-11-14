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
   - **PlayRig Deck (Katalog):** [http://localhost:3000](http://localhost:3000)
   - **PlayRig Studio (Editor):** [http://localhost:3000/studio](http://localhost:3000/studio)

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
1. Öffne das [PlayRig Studio](http://localhost:3000/studio).
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

