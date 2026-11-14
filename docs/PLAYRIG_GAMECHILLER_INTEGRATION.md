# PlayRig – GameChiller Integrations- & Architekturhandbuch

**Plattform:** GameChiller Ecosystem  
**Modul:** PlayRig Core & Runtime Environment  
**Autor:** Liath  
**Copyright:** © GameChiller  
**Version:** v1.0.0 (PlayRig Core & API v1) / v0.0.2 (Rigs)  
**Datum:** 2026-11-14  

---

## 1. Einleitung und Projektkontext

### 1.1 GameChiller Plattform
**GameChiller** ist eine zentrale, modulare Gaming-Community-Plattform. Sie verbindet:
- **Community-Verwaltung:** Mitglieder, Gilden, Gruppen, Foren und Aktivitäts-Feeds.
- **Benutzeridentitäten:** Zentrale Authentifizierung, Rollen (Gast, Mitglied, Moderator, Admin, Entwickler), Profile und Berechtigungsskalierung.
- **Spiele- und Serververwaltung:** Anbindung von Gameservern (z. B. Enshrouded, Minecraft, Palworld), Statusabfragen, Backups und Mod-Management.
- **Modulare Subsysteme:** Tools, Dashboards, Widgets und Medien-Pipelines in einer homogenen Web-Umgebung.

### 1.2 PlayRig als Erweiterungs- und Ausführungsumgebung
**PlayRig** fungiert innerhalb von GameChiller als standardisierte Erweiterungs-, Entwicklungs- und Ausführungsumgebung für eigenständige Webanwendungen (sogenannte **Rigs**).
PlayRig ermöglicht:
- Den schnellen Entwurf, Code-Test und Export von Web-Tools im integrierten **PlayRig Studio**.
- Die Präsentation, das Entdecken und Starten von Rigs im **PlayRig Deck (Katalog)**.
- Die isolierte Ausführung mit Zugriff auf gemeinsame Plattformressourcen (Benutzerdaten, Serverkontext, Cloud-Speicher, Backend-Services).
- Die vollständige Eigenständigkeit der Rigs: Jedes Rig funktioniert sowohl eingebettet in GameChiller als auch standalone ohne Plattformverbindung.

---

## 2. Zentrale Architektur

Die Integration zwischen PlayRig und GameChiller basiert auf drei synergetischen Kernkomponenten:

```
+---------------------------------------------------------------------------------+
|                               GAMECHILLER PLATTFORM                              |
|  [Community Management]   [Server Management]   [Identity / RBAC]   [Dashboard] |
+----------------------------------------+----------------------------------------+
                                         |
                       +-----------------+-----------------+
                       |                                   |
                       v                                   v
        +------------------------------+   +------------------------------+
        |       PLAYRIG API (v1)       |   |        PLAYRIG BRIDGE        |
        |   REST Endpoints, JSON Env   |   |   Bidirektionales PostMessage|
        |   Auth, Scopes, Cloud-Store  |   |   Context, Events, Navigation|
        +--------------+---------------+   +--------------+---------------+
                       |                                  |
                       +-----------------+----------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                             PLAYRIG RUNTIME SANDBOX                             |
|  [Host Window / Sandbox Runner]   <--->   [Iframe / Embedded Rig]               |
|  Controlled postMessage Pipeline          window.PlayRig SDK                    |
|  In-Window Navigation Enforcement         Fallback-Mechanismen                  |
+---------------------------------------------------------------------------------+
```

### 2.1 PlayRig Bridge
Die technische Schnittstelle im Frontend (`_shared/js/playrig-bridge.js`). Sie stellt das globale JavaScript-Objekt `window.PlayRig` bereit, kapselt die bidirektionale Nachrichtenschnittstelle (`window.postMessage`) zwischen Parent-Window und eingebettetem Rig, synchronisiert Context-Events und stellt asynchrone Helfer für Speicher und Navigation zur Verfügung.

### 2.2 PlayRig API (`/api/v1`)
Die offizielle, versionierte REST-API von PlayRig. Sie dient autorisierten GameChiller-Komponenten (Dashboard, Community-Server, Studio, Rigs) als einheitlicher Einstiegspunkt für Benutzeridentitäten, Rig-Metadaten, Standalone-Dokumentation, Cloud-Speicher und Backend-Services.

### 2.3 PlayRig Runtime
Die kontrollierte Ausführungsumgebung (Sandbox Runner). Sie isoliert Rigs, erzwingt Sicherheitsregeln (Sandbox-Attribute, Berechtigungsprüfungen), leitet Context-Daten kontrolliert weiter und stellt sicher, dass Navigationsaktionen niemals unkontrolliert neue Tabs öffnen.

---

## 3. Benutzeridentität, Rollen und Berechtigungssystem (RBAC)

GameChiller behält die vollständige Autorisierungskontrolle. Die Autorisierung wird serverseitig in der PlayRig API validiert.

### 3.1 Identitätsmodell
Ein Benutzerkontext umfasst folgende Attribute:
- `id`: Eindeutige Kennung (z. B. `user_101` oder `guest_849201`).
- `username`: Interner Accountname.
- `displayName`: Öffentlicher Anzeigename für Rigs und Leaderboards.
- `roles`: Array der Rollen (`guest`, `user`, `creator`, `moderator`, `admin`).
- `scopes`: Feinmaschig definierte Berechtigungskennungen.
- `isGuest`: Boolescher Indikator für Gast-Sessions.

### 3.2 Berechtigungs-Scopes (Fine-Grained Permissions)
| Scope | Beschreibung | Standardrolle |
|---|---|---|
| `rig:read` | Rigs und Katalogeinträge abrufen | Gast, User |
| `rig:execute` | Rigs in der Sandbox starten | Gast, User |
| `rig:create` | Neue Rigs im Studio anlegen oder importieren | User, Creator |
| `rig:edit` | Eigene Rigs bearbeiten oder forken | User, Creator |
| `rig:delete` | Rigs löschen | Creator, Admin |
| `storage:user:read` | Eigene persistente Benutzereinstellungen lesen | Gast, User |
| `storage:user:write`| Eigene persistente Benutzereinstellungen speichern | Gast (Session), User |
| `storage:rig:read`  | Rig-weite Konfigurationen lesen | Gast, User |
| `storage:rig:write` | Rig-weite Konfigurationen speichern | Creator, Admin |
| `storage:global:read`| Globale Plattformkonfiguration lesen | User |
| `storage:global:write`| Globale Konfiguration modifizieren | Admin |
| `service:enshrouded`| Enshrouded GameServer-Service nutzen | User |
| `service:minecraft` | Minecraft GameServer-Service nutzen | User |

### 3.3 Gastmodus
Nicht angemeldete Benutzer erhalten automatisch eine Gast-Identität (`/api/v1/auth/guest`).
- Gastsitzungen besitzen reduzierte Berechtigungen (`rig:read`, `rig:execute`, `storage:user:read`, `storage:user:write`).
- Benutzer-Speicherdaten von Gästen werden temporär in der In-Memory- bzw. Session-Schicht gehalten und verfallen nach Beendigung der Browsersitzung, sofern kein Account registriert wird.

---

## 4. Datenübergabe und Kontext-Synchronisation

### 4.1 Kontextstruktur (`Context Object`)
```json
{
  "user": {
    "id": 1,
    "username": "liath",
    "displayName": "Liath",
    "roles": ["admin", "creator"],
    "isGuest": false
  },
  "community": {
    "id": "gc_comm_alpha",
    "name": "GameChiller Pioneer Corps",
    "role": "founder"
  },
  "game": {
    "id": "enshrouded",
    "title": "Enshrouded",
    "genre": "Survival RPG"
  },
  "server": {
    "id": "srv_de_01",
    "name": "Flameborn Realm EU #1",
    "status": "online",
    "endpoint": "https://gamesrv1.gamechiller.de:15637"
  },
  "module": {
    "id": "enshrouded-save-editor",
    "mode": "embedded",
    "version": "v0.0.2"
  },
  "theme": "dark",
  "locale": "de-DE",
  "timestamp": 1731550000000
}
```

### 4.2 Lifecycle der Datenübergabe
1. **Initialisierung:** Beim Laden eines Rigs sendet die PlayRig Runtime das Event `PLAYRIG_INIT_CONTEXT` via `postMessage` mit dem initialen Kontextobjekt.
2. **Quittierung:** Das Rig empfängt den Kontext über `window.PlayRig.onContext((ctx) => { ... })` und richtet Theme, Sprache und Serverschnittstellen ein.
3. **Laufzeit-Aktualisierung:** Ändert sich der Plattformstatus (z. B. Spielersitzung, Server-Status), sendet GameChiller ein inkrementelles Update, welches im Rig ohne Seiten-Reload verarbeitet wird.

---

## 5. PlayRig Bridge (`_shared/js/playrig-bridge.js`)

Das clientseitige SDK `window.PlayRig` stellt standardisierte Methoden bereit:

```javascript
// 1. Kontext & Benutzerdaten
window.PlayRig.onContext((ctx) => {
  console.log('Willkommen, ' + ctx.user.displayName);
  console.log('Aktiver Server: ' + ctx.server?.name);
});

// 2. Persistenter Cloud-Speicher (Server-basiert)
await window.PlayRig.storage.set('inventory_filter', { rarity: 'legendary' });
const filter = await window.PlayRig.storage.get('inventory_filter');

// 3. Sichere In-Window Navigation
window.PlayRig.navigate('/studio');

// 4. Benachrichtigungen an GameChiller senden
window.PlayRig.notify('Speicherstand erfolgreich gepatcht!', 'success');

// 5. Benutzerdefinierte Plattform-Events
window.PlayRig.sendEvent('ACHIEVEMENT_UNLOCKED', { id: 'first_blood' });
```

### Abwärtskompatibilität
Um bestehende Implementierungen nahtlos zu unterstützen, ist `window.NexusEmbed` als transparenter Alias für `window.PlayRig` definiert. Legacy-Aufrufe (`window.NexusEmbed.saveUserData(...)`) werden ohne Codeänderungen an die neue Architektur weitergeleitet.

---

## 6. Zentrale PlayRig API (v1) Referenz

Alle Anfragen und Antworten nutzen das standardisierte JSON-Envelope-Format:
```json
// Erfolgreiche Antwort (HTTP 200/201)
{
  "success": true,
  "data": { ... },
  "timestamp": 1731550000000
}

// Fehlerhafte Antwort (HTTP 400/401/403/404/500)
{
  "success": false,
  "error": "Fehlermeldung",
  "code": "ERROR_CODE",
  "timestamp": 1731550000000
}
```

### Endpunkt-Übersicht

| Endpunkt | Methode | Scope / Berechtigung | Beschreibung |
|---|---|---|---|
| `/api/v1/auth/me` | GET | `public` / Bearer | Profil & Scopes des aktuell authentifizierten Benutzers |
| `/api/v1/auth/guest` | GET | `public` | Erzeugt eine temporäre Gast-Identität mit Token |
| `/api/v1/auth/context` | GET | `public` | Vollständiger Plattform-Kontext (User, Game, Server, Theme) |
| `/api/v1/auth/login` | POST | `public` | Benutzer-Login (Session & Token) |
| `/api/v1/auth/register` | POST | `public` | Neuer Benutzer-Account mit Standardrechten |
| `/api/v1/auth/logout` | POST | `public` | Session beenden |
| `/api/v1/rigs` | GET | `rig:read` | Liste aller registrierten Rigs mit Metadaten & Services |
| `/api/v1/rigs/:id` | GET | `rig:read` | Detaildaten eines Rigs (Manifest, Permissions, Status) |
| `/api/v1/rigs/:id/docs` | GET | `rig:read` | Standalone-Dokumentation (`docs.json`) des Rigs |
| `/api/v1/rigs/:id/screenshot` | GET | `rig:read` | Aktueller Screenshot-Pfad und Snapshot-Status |
| `/api/v1/rigs/status` | POST | `rig:edit` | Status aktualisieren (`active`, `maintenance`, `deprecated`) |
| `/api/v1/storage/user/:key` | GET | `storage:user:read` | Benutzerspezifischen Einstellungswert lesen |
| `/api/v1/storage/user/:key` | POST | `storage:user:write` | Benutzerspezifischen Einstellungswert speichern |
| `/api/v1/storage/rig/:rigId/:key` | GET | `storage:rig:read` | Rig-spezifischen Einstellungswert lesen |
| `/api/v1/storage/rig/:rigId/:key` | POST | `storage:rig:write` | Rig-spezifischen Einstellungswert speichern |
| `/api/v1/storage/global/:key` | GET | `storage:global:read`| Plattformweiten Konfigurationswert abrufen |
| `/api/v1/storage/global/:key` | POST | `storage:global:write`| Plattformweiten Konfigurationswert aktualisieren (Admin) |
| `/api/v1/services` | GET | `public` | Katalog aller registrierten Backend-Services |
| `/api/v1/services/:id/status` | GET | `public` | Status & Health-Check eines Backend-Services |
| `/api/v1/docs` | GET | `public` | Vollständige maschinenlesbare OpenAPI-Spezifikation |

---

## 7. Zentrale Speicherung (`rig_storage`)

Die Datenbanktabelle `rig_storage` gewährleistet die kontrollierte Persistenz unter strikter Mandantentrennung:

```sql
CREATE TABLE IF NOT EXISTS rig_storage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  rig_id VARCHAR(100) NULL,
  scope_type ENUM('user', 'rig', 'global') NOT NULL,
  storage_key VARCHAR(150) NOT NULL,
  storage_value LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_scope_entry (user_id, rig_id, scope_type, storage_key)
);
```

- **User-Scope:** Isolierte Einstellungen pro Benutzer (`user_id = X`, `rig_id = NULL`, `scope_type = 'user'`).
- **Rig-Scope:** Globale Rig-Konfigurationen (`user_id = NULL`, `rig_id = 'voxel-sphere'`, `scope_type = 'rig'`).
- **Global-Scope:** Plattformweite Parameter (`scope_type = 'global'`).

---

## 8. Darstellung und einheitliches Fensterverhalten

### 8.1 In-Window Navigation Enforcement
Um unkontrolliertes Tab-Chaos beim Öffnen und Bedienen mehrerer Rigs zu unterbinden, gilt folgendes Paradigma:
- **Links bleiben grundsätzlich im selben Browserfenster.**
- Das Attribut `target="_blank"` ist in PlayRig und im GameChiller-Ökosystem standardmäßig verboten.
- Rigs navigieren über `window.PlayRig.navigate(url)` oder standardmäßige relative Anchor-Tags (`<a href="...">`) im selben Fenster.
- Externe Links oder Vollbild-Previews navigieren im vorhandenen Browsertab; die Zurück-Navigation bleibt browserkonform intakt.

---

## 9. Deck Spotlight – Screenshot Pipeline

Die Spotlight-Darstellung eines Rigs im PlayRig Deck wurde von interaktiven Iframes auf **statische Screenshots** umgestellt:
1. **Performance & Ressourcenschonung:** Drei bis fünf interaktive WebGL/Three.js-Kontexte beim Laden der Startseite führten zu GPU-Spitzen und Akkubelastung.
2. **Snapshot-Präsentation:** Jedes Rig besitzt eine geprüfte Snapshot-Datei (`thumbnail.png` bzw. `screenshot.png`).
3. **Aktualisierung:** Über den Button `📸 Aktualisieren` im Spotlight kann der Snapshot-Status über den Endpunkt `/api/v1/rigs/:id/screenshot` jederzeit neu validiert werden.

---

## 10. PlayRig Studio – Reorganisation

Im PlayRig Studio (`/studio`) wurde der Workflow zur Erstellung und Verwaltung von Rigs optimiert:
- **Button-Paarung:** In der Sektion `Meine Rigs & Code` stehen der Erstellungs- und der Import-Button unmittelbar nebeneinander:
  - `+ Neu` (Icon: Lucide `plus`): Öffnet das Modalfenster zur Neuanlage eines Rigs.
  - `Importieren` (Icon: Lucide `upload`): Öffnet den schnellen JSON/ZIP-Rig-Importer.
- **Validierung:** Importierte Rigs werden gegen das Manifest-Schema (`id`, `name`, `version`, `category`, `permissions`) validiert, bevor sie in die lokale SQLite/MySQL-Datenbank aufgenommen werden.

---

## 11. Rig-Dokumentation vs. Zentrale Plattform-Dokumentation

Es gilt das Prinzip der **strikten Trennung** (§ 13):

1. **Zentrale Plattform-Dokumentation (`docs/`):**
   - Befasst sich ausschließlich mit der Plattform-Architektur, der Bridge, der REST-API `/api/v1`, Sicherheitsmechanismen und Integrationsrichtlinien für Entwickler.
   - Datei: `docs/PLAYRIG_GAMECHILLER_INTEGRATION.md`.

2. **Standalone Rig-Dokumentation (`docs.json` im Rig-Verzeichnis):**
   - Jedes der 10 registrierten Rigs verfügt über eine eigene, autonome Dokumentationsdatei im Stammverzeichnis des Rigs (`rigs/.../docs.json`).
   - Sie dokumentiert ausschließlich rig-spezifische Features, UI-Controls, Tastaturkürzel, Parameter und spezifische Event-Payloads.
   - Kann im Deck über den Button `📖 Handbuch & Docs` bzw. über den Endpunkt `/api/v1/rigs/:id/docs` eingesehen werden.

---

## 12. Sandbox-Sicherheit und Isolation

- **Iframe Sandboxing:** Die Sandbox-Runner verwenden restriktive Attribute: `allow-scripts allow-forms allow-same-origin allow-popups`.
- **Origin-Validierung:** Bei `window.postMessage` prüft die Bridge die Herkunftsnachrichten gegen `window.location.origin`.
- **Storage-Quota:** JSON-Speicherzugriffe sind auf 5 MB pro Schlüssel beschränkt, um DoS-Angriffe zu verhindern.
- **Rate-Limiting:** Kritische API-Endpunkte unterliegen einem Rate-Limiter (maximal 120 Requests pro Minute pro Client-IP).

---

## 13. Audit & Verifikation

- Alle 10 Rigs (`Voxel Sphere Architect`, `Speedrun Splits Tracker`, `Enshrouded Save Editor`, `Celestial Gravity Sandbox`, `RPG Dice Loot Vault`, `Crosshair Scope Lab`, `Cyber Matrix Rain Lab`, `Particle Gravity Vortex`, `Glassmorphism Beam Studio`, `Audio Reactive Ribbon`) sind vollständig in die neue Registry und API v1 eingebunden.
- In-Window Navigation und Deck Spotlight Screenshot-Rendering sind vollständig verifiziert.
