<div align="center">

# ⚡ PlayRig Engine
### High-Performance Web-Tooling, Modular Gaming Rigs & Interactive Sandbox

[![Platform: GameChiller](https://img.shields.io/badge/Platform-GameChiller%20Ecosystem-8b5cf6?style=for-the-badge&logo=gamepad)](https://gamechiller.de)
[![Version: v1.0.0](https://img.shields.io/badge/Version-v1.0.0%20(Release)-00f0ff?style=for-the-badge)](docs/CHANGELOG.md)
[![Database: MySQL 3307](https://img.shields.io/badge/Database-MySQL%20(Port%203307)-38bdf8?style=for-the-badge&logo=mysql)](server/db.js)
[![License](https://img.shields.io/badge/License-Proprietary%20%2F%20All%20Rights%20Reserved-ef4444?style=for-the-badge)](LICENSE.md)
[![Docs](https://img.shields.io/badge/Docs-Zentrale%20Dokumentation-10b981?style=for-the-badge&logo=read-the-docs)](docs/README.md)

<p align="center">
  <b>PlayRig</b> ist die hochmoderne, autarke Laufzeit-, Entwicklungs- und Ausführungsumgebung für modulare Web-Tools, Gaming-Editoren, Canvas-Shader und prozedurale Generatoren im <b>GameChiller-Ökosystem</b>.
</p>

[🕹️ Rigs Entdecken](#️-live-flagship-rigs) •
[📚 Dokumentations-Zentrale](#-zentrale-dokumentations-suite) •
[⚡ Live-Code Beispiele](#-live-code-beispiele) •
[🏗️ Architektur](#️-architektur--system-design) •
[🚀 Schnellstart](#-installation--schnellstart-in-60-sekunden)

---

</div>

## 🌟 Warum PlayRig? Das Erlebnis für Spieler, Creator & Admins

Traditionelle Web-Tools leiden unter Tab-Sprawl, fehlender Persistenz und Abhängigkeiten von instabilen Drittanbieter-Diensten. **PlayRig löst dies radikal:**

- **🎯 Zero Tab Sprawl (In-Window First):** Kein lästiges Fenster-Chaos. Sämtliche Navigationen, Editoren und Vorschauen bleiben exakt im selben Browserfenster.
- **🧩 100 % Autark (Standalone First):** Jedes Rig läuft vollständig lokal und unabhängig. Fällt das Host-Netzwerk aus, greift nahtlos der integrierte Offline- und Session-Fallback.
- **📦 1-Klick ZIP-Projekt-Importer & Sicherheits-Scanner:** Lade vollständige Rig-Projekte als ZIP-Archiv hoch. Das System scannt auf Schadcode, eval(), Backdoors und Zip-Slip und schaltet das Rig nach Freigabe sofort lauffähig frei.
- **⚡ Blitzschnelle Screenshots:** Das PlayRig Deck nutzt statische, gecachte Snapshots (`thumbnail.png`) für das Spotlight. Keine schweren WebGL-Kontexte beim bloßen Durchstöbern des Katalogs!
- **🔊 Prozedurale Web Audio SFX:** Echte Audio-Synthese in Echtzeit – keine externen MP3s, keine Ladezeiten, null 404-Fehler.
- **🤖 Standard & Prompt für KI-Agenten:** Verbindliche Design- und Performance-Leitlinien für KI-Systeme, um Rigs in AAA-Qualität zu generieren.
- **🛡️ Getestete Enterprise-Sicherheit:** Nonce-gesicherte Bridge, strikte Origin-Allowlist, serverseitiges Storage-Gating und RBAC-Rollenmodell.

---

## 📚 Zentrale Dokumentations-Suite

PlayRig verfügt über eine umfassende, interaktive Dokumentations-Zentrale. Du kannst sie **direkt im Browser** über das neue **[Dokumentations-Portal](http://localhost:3000/docs)** aufrufen oder in den Markdown-Handbüchern nachschlagen:

<div align="center">

| Handbuch | Fokus & Zielgruppe | Link |
|---|---|:---:|
| **📖 Systemdokumentation** | Gesamtarchitektur, Sandbox-Isolation, Module & Speichermodell | [Lesen](docs/SYSTEM_DOCUMENTATION.md) |
| **🛠️ API-Referenz (v1)** | REST-Endpunkte, Authentifizierung, Scopes, JSON-Envelopes & Playground | [Lesen](docs/API_REFERENCE.md) |
| **🌐 Integration Bridge** | Bidirektionale `window.PlayRig` Bridge, Nonces & Event-Protokoll | [Lesen](docs/INTEGRATION_BRIDGE.md) |
| **💻 Entwickler-Leitfaden** | Schritt-für-Schritt zum eigenen Rig, Tokens & Standalone `docs.json` | [Lesen](docs/DEVELOPER_GUIDE.md) |
| **⚙️ Installation & Betrieb** | MySQL Setup (Port 3307), Server-Bootstrap, Backups & Health-Checks | [Lesen](docs/INSTALLATION_AND_OPERATIONS.md) |
| **⚖️ System-Grundregeln** | Verbindliches Manifest, Master-Portal Trennung & Richtlinien | [Lesen](GRUNDREGELN.md) |
| **📜 Changelog** | Alle Release-Notes, Security Fixes & Migrationsschritte | [Lesen](docs/CHANGELOG.md) |

</div>

> 💡 **Tipp:** Starte den Server und rufe **`http://localhost:3000/docs`** auf, um die interaktive Dokumentation mit integrierter **Live-API-Testkonsole** und Markdown-Viewer zu erleben!

---

## 🕹️ Live Flagship Rigs

PlayRig wird mit 10 einsatzbereiten, hochkarätigen Rigs ausgeliefert:

```
rigs/
├── Gaming/
│   ├── Minecraft/Voxel-Sphere-Architect/     ➜ 3D Voxel-Generator für Minecraft-Kugeln & Kuppeln
│   ├── Enshrouded/Save-Editor/               ➜ Steam Save-Editor mit Zstandard & 4.300+ Icons
│   ├── RPG-Tools/rpg-dice-loot-vault/        ➜ Multi-Dice Roller & Diablo-Kistensimulator
│   ├── Shooter-Tools/crosshair-scope-lab/     ➜ CS2/Valorant Fadenkreuz-Editor mit Recoil-Physik
│   ├── Procedural/celestial-gravity-sandbox/ ➜ N-Körper Himmelsmechanik & Gravitations-Sandbox
│   └── Helper/speedrun-splits-tracker/       ➜ LiveSplit-Alternative mit Sub-Millisekunden-Delta
├── Animations/
│   ├── Canvas-Shaders/cyber-matrix-rain-lab/ ➜ Cyberpunk Digital-Rain mit Web Audio Regen-SFX
│   └── Particles-FX/Particle-Gravity-Vortex/ ➜ 1.500 Partikel Orbit-Physik bei stabilen 60 FPS
├── Creative/
│   └── Audio-Visual/audio-reactive-ribbon/   ➜ 3D Synthwave Audio-Visualizer mit FFT-Analyse
└── Helper/
    └── Generators/glassmorphism-beam-studio/ ➜ Rotierende CSS-Border-Beams & Glass-Generator
```

---

## ⚡ Live-Code Beispiele

### 1. Rig-zu-Plattform Kommunikation (PlayRig Bridge)
Jedes Rig kann über `window.PlayRig` mit GameChiller interagieren:

```javascript
// 1. Benutzer- und Plattform-Kontext abonnieren
window.PlayRig.onContext((ctx) => {
  console.log(`Willkommen zurück, ${ctx.user.displayName}!`);
  console.log(`Aktiver Gameserver: ${ctx.server?.name || 'Offline'}`);
});

// 2. Persistente Cloud-Einstellungen speichern (synct automatisch mit API v1)
await window.PlayRig.storage.set('player_loadout', {
  primaryWeapon: 'flame_sword',
  sensitivity: 1.45
});

// 3. Einstellungen abrufen (mit automatischem LocalStorage-Fallback im Standalone-Modus)
const loadout = await window.PlayRig.storage.get('player_loadout', { sensitivity: 1.0 });

// 4. In-Window Navigation (niemals neue Tabs!)
window.PlayRig.navigate('/studio');

// 5. Toast an Benutzer senden
window.PlayRig.notify('Speicherstand erfolgreich aktualisiert!', 'success');
```

---

### 2. Live REST-API v1 Abfrage
Autorisierte Komponenten und Skripte fragen die versionierte REST-Schnittstelle ab:

```bash
# 1. Plattform-Kontext abrufen
curl http://localhost:3000/api/v1/auth/context

# 2. Katalog aller aktiven Rigs abrufen
curl http://localhost:3000/api/v1/rigs?category=gaming

# 3. Autonome Rig-Dokumentation (docs.json) abfragen
curl http://localhost:3000/api/v1/rigs/voxel-sphere-architect/docs
```

**Antwort-Format (Standardisiertes Envelope):**
```json
{
  "success": true,
  "data": {
    "user": { "displayName": "Gastspieler", "isGuest": true },
    "community": { "name": "GameChiller Network" },
    "theme": "cyber-cyan"
  },
  "meta": {
    "version": "v1.0.0",
    "timestamp": "2026-11-14T03:00:00.000Z"
  }
}
```

---

### 3. 1-Klick Iframe-Einbettung (OBS, Notion, CMS)
Jedes Rig unterstützt den autarken Embed-Modus ohne störende Plattform-Menüs:

```html
<!-- Live Voxel Sphere Generator in externe Seite einbinden -->
<iframe 
  src="http://localhost:3000/rigs/Gaming/Minecraft/Voxel-Sphere-Architect/index.html?embed=true" 
  width="100%" 
  height="720" 
  style="border: 1px solid rgba(0, 210, 255, 0.3); border-radius: 16px;" 
  allow="autoplay; fullscreen">
</iframe>
```

---

### 4. ZIP-Projekt Pre-Flight Scan & Import via REST-API
Vollständige Projekte können automatisiert per Skript oder CI/CD über die REST-Schnittstelle geprüft und registriert werden:

```bash
# 1. ZIP-Archiv vorab auf Schadcode, eval() und Zip-Slip scannen (ohne Speichern)
curl -X POST http://localhost:3000/api/v1/rigs/validate-zip \
  -H "Content-Type: application/json" \
  -d '{"zipBase64": "data:application/zip;base64,UEsDBBQAAAA..."}'

# 2. Nach Freigabe: Rig entpacken, Bridge injizieren und in PlayRig registrieren
curl -X POST http://localhost:3000/api/v1/rigs/import-zip \
  -H "Authorization: Bearer <DEIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "zipBase64": "data:application/zip;base64,UEsDBBQAAAA...",
    "title": "Neon Asteroids Lab",
    "category": "gaming",
    "author": "DeinName",
    "copyright": "© DeinName"
  }'
```

---

## 🤖 Für Entwickler & KI-Agenten: Rigs auf höchstem Niveau

PlayRig definiert verbindliche Qualitätsmaßstäbe für Rigs, die von Entwicklern oder **KI-Agenten** (wie Google Antigravity, Claude, GPT) generiert werden:

- **Visuelle Identität:** Deep Slate Dark Theme (`#07090e`), leuchtende Cyber-Cyan- und Electric-Purple-Akzente, Glassmorphism-Panels und gestochen scharfe Typografie (`JetBrains Mono` für Zahlen/HUD, `Inter` für Text).
- **Flüssige Performance:** Stabile 60 FPS via `requestAnimationFrame` mit kontinuierlicher Delta-Time. Three.js InstancedMesh für Tausende Partikel oder Voxel ohne Garbage-Collection-Stottern.
- **Prozedurales Audio (Web Audio API):** Reines Sound-Design durch Oszillatoren, Biquad-Filter und Gain-Envelopes – null Abhängigkeit von externen MP3-Dateien.
- **Sicherheit & Isolation:** Kein `eval()`, kein `target="_blank"`, strikte In-Window Navigation und synchrone Persistenz via `window.PlayRig.storage`.

👉 **Vollständiger Leitfaden & kopierbarer AI-Agenten-Prompt:**  
Lies das Kapitel **[🤖 Leitfaden & System-Prompt für KI-Agenten](docs/DEVELOPER_GUIDE.md#6--verbindlicher-leitfaden--system-prompt-f%C3%BCr-ki-agenten-ai-agent-rig-creation-standard)** im Entwickler-Handbuch.

---

## 🏗️ Architektur & System-Design

```
+---------------------------------------------------------------------------------+
|                               GAMECHILLER MASTER-PORTAL                         |
|             (Zentrale Identitäten, Community-Rollen, Gameserver)                |
+----------------------------------------+----------------------------------------+
                                         |
                  [Sichere PlayRig Bridge & REST-API v1]
                  (Kein Wildcard-Messaging, Origin-Allowlist)
                                         |
+----------------------------------------v----------------------------------------+
|                                  PLAYRIG ENGINE                                 |
|  +--------------------+   +-----------------------+   +----------------------+  |
|  |    PlayRig Deck    |   |    PlayRig Studio     |   |     Docs-Portal      |  |
|  |  (Snapshot Stage,  |   | (Zwei-Spalten Editor, |   | (Interaktive Doku &  |  |
|  |  Sandbox Runner)   |   |   CDN & Themesets)    |   |  Live-API Konsole)   |  |
|  +--------------------+   +-----------------------+   +----------------------+  |
|                                           |                                     |
|  +----------------------------------------v----------------------------------+  |
|  |                           PLAYRIG RUNTIME SANDBOX                         |  |
|  |          Iframe-Isolation • In-Window Navigation • Offline-Fallback       |  |
|  +---------------------------------------------------------------------------+  |
|                                           |                                     |
|  +----------------------------------------v----------------------------------+  |
|  |                           PERSISTENZ & COMPANION LAYER                    |  |
|  |      MySQL 3307 (rig_storage, Mandantentrennung) • Companion Services     |  |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------+
```

---

## 🚀 Installation & Schnellstart in 60 Sekunden

### 1. Repository klonen & Pakete installieren
```bash
git clone https://github.com/AmFearLiath/PlayRig.git
cd PlayRig
npm install
```

### 2. Datenbank bereitstellen
PlayRig verbindet sich standardmäßig mit einem lokalen MySQL-Server auf **Port 3307**:
- **Host:** `localhost`
- **Port:** `3307`
- **User:** `root`
- **Datenbank:** `playrig_db`

*(Die erforderlichen Tabellen und Standardkonten werden beim ersten Start vollautomatisch initialisiert.)*

### 3. Server starten
```bash
node server/server.js
```

### 4. Sofort loslegen
- 🕹️ **PlayRig Deck (Katalog):** [http://localhost:3000](http://localhost:3000)
- ⚡ **PlayRig Studio (Editor):** [http://localhost:3000/studio](http://localhost:3000/studio)
- 📚 **Dokumentations-Zentrale:** [http://localhost:3000/docs](http://localhost:3000/docs)
- 🛡️ **Admin Control Panel:** [http://localhost:3000/admin](http://localhost:3000/admin) *(Login: `admin` / `admin123`)*

---

## ⚖️ Lizenz & Urheberrecht

- **Core-Plattform & Engine:** © GameChiller • Author: `Liath`
- **Eigenständige Rigs & Community-Code:** Die jeweiligen Autoren und Rechteinhaber sind explizit in den Metadaten der Rigs hinterlegt.
- **Lizenz:** Proprietary / All Rights Reserved.
