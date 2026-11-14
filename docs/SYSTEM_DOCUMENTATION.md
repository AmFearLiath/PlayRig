# 📖 PlayRig – Systemdokumentation

**Plattform:** GameChiller Ecosystem  
**System:** PlayRig Engine  
**Version:** v1.0.0  
**Autor:** Liath • **Copyright:** © GameChiller  

---

## 1. Zweck und Funktionsumfang

**PlayRig** ist eine modulare Web-Anwendungsplattform, die als eigenständige Laufzeit-, Entwicklungs- und Ausführungsumgebung für interaktive Webanwendungen (sogenannte **Rigs**) dient.
Innerhalb des GameChiller-Ökosystems fungiert PlayRig als App-Subsystem für:
- **Gaming-Tools & Save-Editoren** (z. B. Enshrouded Save Editor, Minecraft Voxel Architect).
- **Prozedurale Physik- & Simulations-Rigs** (z. B. Celestial Gravity Sandbox, Particle Vortex).
- **Audio- & Visualisierungs-Tools** (z. B. Web Audio Reactive Ribbon, Matrix Rain).
- **UI- & Effekt-Generatoren** (z. B. Glassmorphism & Border-Beam Studio).
- **Gaming-Utilities** (z. B. Speedrun Splits Tracker, Tactical Crosshair Lab).

---

## 2. Systemarchitektur & Module

```
+-----------------------------------------------------------------------------------+
|                              GAMECHILLER MASTER-PORTAL                            |
|             (Identitäten, Community-Rollen, Gameserver-Verwaltung)                |
+------------------------------------------+----------------------------------------+
                                           |
                                [PlayRig Bridge & API v1]
                                           |
+------------------------------------------v----------------------------------------+
|                                  PLAYRIG ENGINE                                   |
|  +--------------------+   +-----------------------+   +------------------------+  |
|  |    PlayRig Deck    |   |    PlayRig Studio     |   |      Admin Panel       |  |
|  | (Katalog, Spotlight|   | (Code-Editor, Themes, |   |  (RBAC, Audit Logs,    |  |
|  |  Sandbox Runner)   |   |   Rig-Verwaltung)     |   |   System-Monitoring)   |  |
|  +--------------------+   +-----------------------+   +------------------------+  |
|                                           |                                       |
|  +----------------------------------------v------------------------------------+  |
|  |                          PLAYRIG RUNTIME SANDBOX                            |  |
|  |                 (Iframe Isolation, Strict In-Window Nav,                    |  |
|  |                 Origin Verification, Nonce-based Handshake)                 |  |
|  +-----------------------------------------------------------------------------+  |
|                                           |                                       |
|  +----------------------------------------v------------------------------------+  |
|  |                          BACKEND & STORAGE LAYER                            |  |
|  |  Express REST API (/api/v1) • Companion Services • MySQL Storage (Port 3307)|  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### 2.1 PlayRig Deck (`index.html`, `hub.js`, `hub.css`)
Die öffentliche Discovery- und Showcase-Oberfläche:
- **Hero Spotlight:** Präsentiert das aktuelle Flagship-Rig über **statische Snapshots** (`thumbnail.png`), ohne ein Iframe oder WebGL-Kontext auf der Startseite zu instanziieren.
- **Karussell- & Katalog-Tracks:** Sortierung nach Top Rated, Beliebtheit, Kategorien und Neuheiten.
- **Sandbox Runner:** Führt Rigs in einem isolierten Iframe mit Responsive-Controls (1080p, Tablet, Mobile) aus.
- **Dokumentations-Modal:** Zeigt Standalone-Dokumentation (`docs.json`) und Schnittstellen pro Rig an.

### 2.2 PlayRig Studio (`/studio`, `studio/index.html`, `studio/studio.js`)
Die integrierte Creator-Workstation:
- **Metadaten-Verwaltung:** Erfassung von Titel, Slug, Kategorie, Unterkategorie, Version, Tags, Sichtbarkeit sowie explizitem Autor und Copyright.
- **Zwei-Spalten-Editor:** Quellcode-Bearbeitung (HTML, CSS, JS) mit Line-Counters, Syntax-Highlighting und Autosave.
- **CDN-Manager:** 1-Klick-Injektion gängiger Web-Bibliotheken (Three.js, Lucide, Tailwind, MathJS).
- **Themeset-Kopplung:** Dynamischer Wechsel standardisierter Paletten (`cyber-cyan`, `emerald-matrix`, etc.).

### 2.3 Admin Panel (`/admin`, `admin/index.html`, `admin/admin.js`)
Die zentrale Kontrollinstanz für autorisierte Administratoren:
- Benutzerverwaltung (Rollen: `admin`, `creator`, `user`, `service`).
- Vollständige Audit-Protokollierung sicherheitsrelevanter Aktionen (`DELETE_RIG`, `SECURITY_STORAGE_VIOLATION`, etc.).
- Rig-Freigaben und Status-Management (`active`, `wip`, `deprecated`, `pending`).

### 2.4 Companion Services (`server/services/`)
Erweiterbare Micro-Services für spezialisierte Backend-Aufgaben (z. B. Spielstand-Parsing, Dateisystem-Backups). Jeder Service erbt von `BaseService` und registriert eigene API-Routen.

---

## 3. Datenhaltung und Mandantentrennung (`server/db.js`)

PlayRig nutzt standardmäßig einen lokalen **MySQL-Server auf Port 3307** (`playrig_db`):

### 3.1 Tabellenstruktur
1. **`users`:** Benutzerkonten, Hash-Passwörter, Rollen und Status.
2. **`rigs`:** Metadaten der Rigs, Kategorien, Pfade, Autoren, Lizenzen, Views, Stars, Forks, Service-Anforderungen und JSON-Einstellungen.
3. **`rig_storage`:** Zentraler Cloud-Speicher unter strikter Mandantentrennung:
   - `user_id`: Benutzer-spezifische Einstellungen (Key-Value, z. B. Highscores, UI-Präferenzen).
   - `rig_id`: Rig-spezifische Konfigurationen (nur für Eigentümer oder Administratoren beschreibbar).
   - `is_global`: Plattformweite Konfigurationen (ausschließlich Administrator-Zugriff).
4. **`gamechiller_clients`:** Autorisierte externe API-Clients mit eindeutigen API-Keys und zugewiesenen Scopes.
5. **`audit_log`:** Unveränderliche Protokollierung aller administrativen Aktionen und Sicherheitsverletzungen.

---

## 4. Benutzer- und Rollenverwaltung (RBAC)

| Rolle | Standard-Scopes | Beschreibung |
|---|---|---|
| `admin` | `*` | Vollzugriff auf alle Rigs, Storage-Bereiche, Audit-Logs und Benutzerkonten. |
| `creator` | `rigs:read`, `rigs:write`, `storage:user`, `storage:rig` | Kann neue Rigs anlegen, eigene Rigs modifizieren und Rig-Storage eigener Rigs schreiben. |
| `user` | `rigs:read`, `storage:user` | Standardrolle für neu registrierte Benutzer. Kann Rigs ausführen und eigene Einstellungen speichern. |
| `service` | `rigs:read`, `storage:rig`, `server:read` | Autorisierte externe GameChiller-Hintergrunddienste via `X-API-Key`. |
| `guest` | `rigs:read`, `storage:session` | Nicht angemeldete Besucher mit temporärem Lesezugriff. |

---

## 5. Sicherheitskonzept

1. **Keine Wildcards:** Sämtliche `postMessage`-Kommunikation nutzt explizite Origins.
2. **Origin-Validierung:** Eingehende Nachrichten werden über eine Allowlist (`ALLOWED_ORIGINS`) gefiltert.
3. **Replay-Schutz:** Nonce-basierter Handshake zwischen Host und Iframe.
4. **Storage-Gating:**
   - Lese- und Schreibzugriffe auf `rig_storage` werden serverseitig autorisiert.
   - Eigentümerprüfung: Ein User kann niemals Daten fremder Rigs modifizieren.
   - Quota-Limit: Maximal 5 MB pro Speicher-Payload.
   - Input-Validierung: Alle Keys und IDs werden mit `/^[a-zA-Z0-9_.-]{1,128}$/` validiert.
5. **In-Window Navigation:** Keine unkontrollierte Tab-Vermehrung durch Verbot von `target="_blank"`.
6. **Graceful Shutdown & Port-Helper:** Automatisches Beenden blockierender Instanzen mit Sicherheitsprüfung bei Neustarts.
