# 📜 PlayRig – Changelog

Alle relevanten Änderungen, Sicherheits-Updates und Erweiterungen der PlayRig-Plattform werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/) und folgt [Semantic Versioning](https://semver.org/).

---

## [v1.0.0] – 2026-11-14

### 🚀 Neu & Grundlegend
- **GameChiller Integration Architecture:** Vollständige Integration von PlayRig in das GameChiller Master-Portal unter Wahrung der vollständigen Eigenständigkeit (Standalone-Betrieb).
- **Zentrale Versionierte REST-API (`/api/v1`):** Einheitlicher Einstiegspunkt mit JSON-Envelopes für Authentifizierung, Rigs, Storage, Services und OpenAPI-Schema.
- **Sichere Integration Bridge (`_shared/js/playrig-bridge.js`):**
  - Typed Messaging-Protokoll (`PLAYRIG_INIT_CONTEXT`, `PLAYRIG_NAVIGATE`, `PLAYRIG_NOTIFY`, `PLAYRIG_EVENT`, `PLAYRIG_REQUEST_SCREENSHOT`).
  - Globale Hilfsmethoden `PlayRig.onContext()`, `PlayRig.sendEvent()`, `PlayRig.storage.get/set/delete()`, `PlayRig.notify()`.
  - Transparente Rückwärtskompatibilität für Legacy `NexusEmbed`.
- **Deck Spotlight Snapshot Pipeline:** Vollständige Umstellung auf statische Screenshots (`thumbnail.png` / `screenshot.png`) mit In-Sandbox Snapshot Capture und API-Refresh.
- **Standalone Rig Dokumentation:** Eigenständige `docs.json` Manifeste für alle 10 Flagship-Rigs mit In-Deck Handbuch-Modal.
- **Umfassende Dokumentations-Suite:** Bereitstellung von 6 zentralen Handbüchern unter `docs/` (`README`, `SYSTEM_DOCUMENTATION`, `API_REFERENCE`, `INTEGRATION_BRIDGE`, `DEVELOPER_GUIDE`, `INSTALLATION_AND_OPERATIONS`).

### 🔒 Sicherheit & Härtung
- **Eliminierung von Wildcards:** `postMessage('*')` vollständig entfernt. Alle Nachrichten werden an explizite, verifizierte Host-Origins versendet.
- **Origin-Allowlist & Nonce-Handshake:** Eingehende Bridge-Nachrichten werden anhand einer zentralen Origin-Allowlist und Nonces geprüft.
- **Serverseitige Storage-Berechtigungen:**
  - Rig-Storage Schreibzugriffe (`POST /api/v1/storage/rig/:rigId/:key`) erfordern jetzt Eigentümerschaft des Rigs oder die Administrator-Rolle.
  - Global-Storage ist strikt für Administratoren reserviert.
  - Input-Validierung gegen Path Traversal und Injection (`/^[a-zA-Z0-9_.-]{1,128}$/`).
  - Logging unberechtigter Zugriffsversuche in der `audit_log`-Tabelle.
- **Rollen-Korrektur bei Registrierung:** Neue Benutzerkonten erhalten standardmäßig die reguläre Rolle `user`. Die automatische Zuweisung privilegierter Rollen (`creator`) wurde entfernt.
- **API-Client Authentifizierung:** Externe GameChiller-Services authentifizieren sich sicher über den Header `X-API-Key` gegen die Tabelle `gamechiller_clients`.
- **Strikte In-Window Navigation:** Sämtliche `target="_blank"`-Verwendungen in Templates, Admin-Panels und Hub wurden restlos eliminiert.

### 🎨 Design & Barrierefreiheit
- **Reduced Motion Support:** `@media (prefers-reduced-motion: reduce)` in `_shared/css/animations.css` integriert.
- **Autoren- & Copyright-Entkopplung:** Externe Entwickler und Community-Rigs behalten dauerhaft ihren eigenen Autorennamen und Copyright. Standard-Signaturen (`Liath` / `© GameChiller`) sind strikt auf unsere 10 Core-Rigs beschränkt.

---

## [v0.0.2] – 2026-11-13

### 🛠️ Rigs & Services
- Verschiebung aller Rigs in das zentrale Verzeichnis `rigs/`.
- Einführung der modularen Backend Companion Services (`server/services/`).
- Enshrouded Save & Character Engine v1.1.0 mit Zstandard WASM und automatischer Steam-Erkennung.
- Celestial Gravity Sandbox: Orbit-Physik, Katapult-Steuerung und N-Körper Gravitation.
- RPG Dice & Loot Vault: Physik-Würfel, Audio-Synthese und Diablo-Kistensimulator.

---

## [v0.0.1] – 2026-11-12

### 🐣 Initialer Prototyp
- Erstveröffentlichung des PlayRig Decks und Studios.
- Lokale MySQL-Persistenz auf Port 3307.
- 10 Flagship-Rigs aus den Bereichen Gaming, Animationen, Creative und Helper.
