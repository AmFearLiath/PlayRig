<div align="center">

# ⚡ PlayRig Engine

**High-Performance Modular Web Platform, Rig Studio & Interactive Sandbox**

[![Version](https://img.shields.io/badge/Version-v0.0.1-00f0ff?style=for-the-badge)](https://github.com/AmFearLiath/PlayRig)
[![Author](https://img.shields.io/badge/Author-Liath-fbbf24?style=for-the-badge)](https://github.com/AmFearLiath)
[![Copyright](https://img.shields.io/badge/Copyright-GameChiller-a855f7?style=for-the-badge)](https://github.com/AmFearLiath)
[![License](https://img.shields.io/badge/License-Proprietary%20%2F%20All%20Rights%20Reserved-ef4444?style=for-the-badge)](LICENSE.md)
[![Database](https://img.shields.io/badge/Database-MySQL%20(Port%203307)-38bdf8?style=for-the-badge)](server/db.js)

<p align="center">
  <i>Eine moderne, autarke Plattform zur Erstellung, Katalogisierung, Ausführung und Einbettung von interaktiven Web-Tools, Gaming-Editoren, Canvas-Shadern und prozeduralen Generatoren.</i>
</p>

[✨ Features](#-features) •
[🕹️ Rig Katalog](#-rig-katalog) •
[🏗️ Architektur](#-architektur) •
[🚀 Installation](#-installation--schnellstart) •
[📜 Lizenz](#-lizenz)

---

</div>

## 🌟 Highlights

- **Autarke Rigs:** Jedes Modul ist unabhängig ausführbar und vollständig in externe Seiten, OBS-Overlays oder CMS einbettbar (`embedSupported: true`).
- **PlayRig Deck (Katalog):** Interaktive Entdecken-Ansicht mit Filterung nach Kategorien, Suchfunktion, Favoriten, Klon-Funktion und Live-Vorschau.
- **PlayRig Studio:** Schneller Code- und Rig-Editor mit 1-Klick CDN-Integration (Three.js, Lucide, Tailwind, MathJS etc.), Hot-Reload und Export.
- **Admin Control Panel:** Umfassende Nutzer-, Rechte- und Audit-Log-Verwaltung auf separater Sicherheits-Ebene (`/admin`).
- **Prozedurale Audio-Synthese:** Keine externen MP3-Dateien oder 404-Risiken – Sound-Effekte und Ambientes werden in Echtzeit über die Web Audio API synthetisiert.
- **Automatisches Versioning & Copyright:** Jedes Rig trägt standardmäßig die Signatur `Author: Liath`, `© GameChiller`, ab `v0.0.1` mit responsivem Hub-Rücksprung.

---

## 🕹️ Rig Katalog

Das Repository beinhaltet 10 einsatzbereite Flagship-Rigs:

| Rig | Kategorie | Tech-Stack | Beschreibung |
|---|---|---|---|
| **[Voxel Sphere & Dome Architect](Gaming/Minecraft/Voxel-Sphere-Architect/)** | Gaming / Minecraft | Three.js WebGL, InstancedMesh | 3D/2D Voxel-Generator für Minecraft-Kugeln, Kuppeln und Ellipsoide mit Schichten-Viewer, Ghosting und Bauplan-Export. |
| **[Enshrouded Save Editor](Gaming/Enshrouded/Save-Editor/)** | Gaming / Enshrouded | Zstandard WASM, XXHash3, SV2C | Lokale Steam-Spielstand-Erkennung, Level & XP Booster, 16 Ausrüstungs- und 40 Rucksack-Slots mit über 4.300 Ingame-Icons. |
| **[Retro RPG Dice & Loot Vault](Gaming/RPG-Tools/rpg-dice-loot-vault/)** | Gaming / RPG-Tools | Canvas 2D, Web Audio SFX | D4-D100 Würfelsystem mit 3D-Rotationsphysik, Nat-20 Fanfare und Diablo-inspiriertem Schatzkisten-Simulator. |
| **[FPS Tactical Crosshair Lab](Gaming/Shooter-Tools/crosshair-scope-lab/)** | Gaming / Shooter-Tools | Canvas Reticle, Recoil Physics | Professioneller Fadenkreuz-Editor für CS2/Valorant mit Live-Rückstoßsimulation, Mil-Dot Sniper-Scope und PNG-Export. |
| **[Speedrun Splits Tracker](Gaming/Helper/speedrun-splits-tracker/)** | Gaming / Helper | `performance.now()`, Web Audio | LiveSplit-Alternative mit Sub-Millisekunden-Delta, Gold-Splits, Tastatur-Hotkeys und OBS-Chroma-Key/Transparenz-Modus. |
| **[Celestial Gravity Sandbox](Gaming/Procedural/celestial-gravity-sandbox/)** | Gaming / Procedural | N-Body Gravitation, Verlet Engine | Interaktiver Himmelsmechanik-Simulator mit Maus-Schleuder, Materie-Verschmelzungen und kosmischem Synth-Drone. |
| **[Cyber Matrix Rain & Glyph Lab](Animations/Canvas-Shaders/cyber-matrix-rain-lab/)** | Animations / Canvas-Shaders | Canvas Shaders, Audio Noise | Digitaler Cyberpunk-Regen mit Katakana, Runen, Hexadezimal-Glyphen, Schockwellen-Interaktion und Regen-Ambiente. |
| **[Particle Gravity Vortex Lab](Animations/Particles-FX/Particle-Gravity-Vortex/)** | Animations / Particles-FX | Canvas 2D, Orbital Physics | 1.500 Partikel bei 60 FPS mit Gravitationslinsen, Schockwellen-Impulsen und Farbpaletten. |
| **[Glassmorphism & Beam Studio](Helper/Generators/glassmorphism-beam-studio/)** | Helper / Generators | CSS Custom Props, 3D Gyro | Visueller Generator für moderne Glassmorphismus-Karten und rotierende Border-Beams mit 1-Klick CSS/Tailwind-Export. |
| **[Audio Reactive Ribbon](Creative/Audio-Visual/audio-reactive-ribbon/)** | Creative / Audio-Visual | Web Audio FFT, Canvas Ribbons | 3D-Wellenbänder mit integriertem prozeduralem Synthwave-Arpeggiator, Mikrofon-Input und Spektralanalyse. |

---

## 🏗️ Architektur

```
PlayRig/
├── index.html                   # PlayRig Deck (Hauptkatalog & Discover UI)
├── hub.js / hub.css             # Deck Logik, Filter, Modal- und Card-Renderer
├── registry.js                  # Zentrales Verzeichnis aller Module & Metadaten
├── GRUNDREGELN.md               # Architektur- und Entwicklungs-Leitfaden
│
├── server/                      # Node.js Express Backend
│   ├── server.js                # REST API, Routing, Static Hosting & Auth
│   ├── db.js                    # MySQL Pool (Port 3307), Schema & Seeding
│   └── enshrouded-service.js    # SV2C Container, Zstd Decompressor & Hasher
│
├── studio/                      # PlayRig Studio (Rig-Entwicklungsumgebung)
├── admin/                       # PlayRig Admin Panel (Benutzer & System-Verwaltung)
│
├── Gaming/                      # Gaming Tools & Generatoren
│   ├── Minecraft/
│   ├── Enshrouded/
│   ├── RPG-Tools/
│   ├── Shooter-Tools/
│   ├── Helper/
│   └── Procedural/
│
├── Animations/                  # Canvas Shader & Visual FX
├── Creative/                    # Audio-Visual & Generative Kunst
└── Helper/                      # UI-Generatoren & Dienstprogramme
```

---

## 🚀 Installation & Schnellstart

### 1. Voraussetzungen
- **Node.js:** v18.0.0 oder neuer (empfohlen v20+)
- **MySQL:** Port 3307 (z. B. via XAMPP MySQL konfiguriert auf Port 3307)
- **Browser:** Moderner Chromium-basierter Browser oder Firefox

### 2. Abhängigkeiten installieren
```bash
npm install
```

### 3. Server starten
Unter Windows über die Batch-Datei:
```cmd
start.bat
```
Oder direkt über Node.js:
```bash
node server/server.js
```

### 4. Endpunkte
- **PlayRig Deck:** `http://localhost:3000/`
- **PlayRig Studio:** `http://localhost:3000/studio`
- **Admin Control Panel:** `http://localhost:3000/admin`
- **Health Check API:** `http://localhost:3000/api/health`

**Standard-Zugangsdaten (Initial):**
- **Admin:** `admin` / `admin123`
- **Creator:** `creator` / `creator123`

---

## 📜 Lizenz

**Copyright (c) 2026 GameChiller / AmFearLiath (Author: Liath). All Rights Reserved.**

Dieses Repository ist **Source-Available** zur Ansicht und Evaluierung. Jegliche unautorisierte Nutzung, Kopie, Modifikation, Verteilung, Veröffentlichung oder kommerzielle Verwendung ohne vorherige schriftliche Genehmigung ist ausdrücklich untersagt. Details siehe [LICENSE.md](LICENSE.md).
