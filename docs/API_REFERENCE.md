# 🛠️ PlayRig API v1 – Technische Referenz

**Basis-URL:** `/api/v1`  
**Spezifikations-Version:** v1.0.0  
**Status:** Aktiv & Produktion  
**Autor:** Liath • **Copyright:** © GameChiller  

---

## 1. Allgemeines & Standard-Envelope

Alle Endpunkte antworten im einheitlichen JSON-Envelope-Format:

### Erfolgreiche Antwort (HTTP 200 / 201)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "version": "v1.0.0",
    "timestamp": "2026-11-14T03:00:00.000Z"
  }
}
```

### Fehlerhafte Antwort (HTTP 400 / 401 / 403 / 404 / 413 / 500)
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Menschenlesbare Fehlerbeschreibung"
  },
  "meta": {
    "timestamp": "2026-11-14T03:00:00.000Z"
  }
}
```

---

## 2. Authentifizierungsverfahren

Die API unterstützt zwei sichere Authentifizierungsmechanismen:

1. **User Bearer Token (GameChiller Benutzer):**
   ```http
   Authorization: Bearer <session_token>
   ```
2. **API-Client Key (Autorisierte GameChiller-Komponenten & Services):**
   ```http
   X-API-Key: <client_api_key>
   ```
3. **Gastmodus (Fallback):**
   Werden keine Authentifizierungs-Header mitgesendet, weist das System automatisch eine temporäre Gast-Identität (`role: "guest"`, `scopes: ["rigs:read", "storage:session"]`) zu.

---

## 3. Endpunkt-Übersicht

### 3.1 Authentifizierung & Kontext (`/api/v1/auth`)

#### `GET /api/v1/auth/me`
Liefert das Profil und die Scopes des aktuell authentifizierten Benutzers.
- **Erforderliche Scopes:** `public` (oder Bearer Token)
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "liath",
    "displayName": "Liath",
    "role": "admin",
    "scopes": ["*"],
    "isGuest": false
  }
}
```

#### `GET /api/v1/auth/guest`
Erzeugt eine signierte Gast-Session mit temporärem Token.
- **Response (200 OK):** Liefert Gast-Identität und Bearer Token.

#### `GET /api/v1/auth/context`
Liefert den vollständigen GameChiller Plattform-Kontext (Benutzer, Community, Server, Modul, Theme).
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": { "id": "guest", "displayName": "Gastspieler", "isGuest": true },
    "community": { "id": "c-gamechiller-01", "name": "GameChiller Network" },
    "game": { "id": "enshrouded", "title": "Enshrouded" },
    "theme": "cyber-cyan"
  }
}
```

#### `POST /api/v1/auth/login`
Authentifiziert einen bestehenden Benutzer.
- **Body:** `{ "username": "...", "password": "..." }`
- **Response (200 OK):** Enthält `token`, `user` und `expiresIn`.

#### `POST /api/v1/auth/register`
Registriert einen neuen Benutzer. Neue Konten erhalten standardmäßig die reguläre Rolle `user`.
- **Body:** `{ "username": "...", "password": "...", "displayName": "..." }`
- **Response (201 Created):** `{ "success": true, "data": { "token": "...", "user": { "role": "user" } } }`

---

### 3.2 Rig-Verwaltung (`/api/v1/rigs`)

#### `GET /api/v1/rigs`
Ruft alle registrierten Rigs ab (mit Filtermöglichkeiten).
- **Query-Parameter:**
  - `category` (z. B. `gaming`, `animations`)
  - `search` (Suchbegriff)
  - `status` (`active`, `wip`, `deprecated`)
- **Response (200 OK):** Array aller Rig-Objekte inklusive Metadaten und `hasStandaloneDocs`.

#### `GET /api/v1/rigs/:id`
Ruft Detaildaten eines einzelnen Rigs ab.
- **Response (200 OK):** Vollständiges Rig-Manifest aus der Datenbank.

#### `GET /api/v1/rigs/:id/docs`
Ruft die autonome Standalone-Dokumentation (`docs.json`) des Rigs ab.
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "voxel-sphere-architect",
    "name": "Minecraft Voxel Sphere Architect",
    "version": "v1.0.0",
    "features": [...],
    "permissions": ["rigs:read", "storage:user"],
    "faq": [...]
  }
}
```

#### `GET /api/v1/rigs/:id/screenshot`
Liefert das geprüfte Preview-Bild des Rigs als Binärdatei (`image/png`).
- **Response (200 OK):** Bildinhalt (`Content-Type: image/png`). Bei fehlendem Bild greift ein SVG-Fallback.

#### `POST /api/v1/rigs/status`
Aktualisiert den Status eines Rigs (`active`, `wip`, `deprecated`).
- **Berechtigung:** Erfordert Rolle `admin` oder `creator` (Eigentümer).
- **Body:** `{ "id": "rig-id", "status": "deprecated" }`

#### `POST /api/v1/rigs/validate-zip`
Führt eine tiefe statische Sicherheitsanalyse und Strukturprüfung eines vollständigen ZIP-Archivs durch, **ohne** Dateien auf der Festplatte abzulegen.
- **Berechtigung:** Öffentlich (kein Token erforderlich).
- **Payload:**
```json
{
  "zipBase64": "data:application/zip;base64,UEsDBBQAAAA..."
}
```
- **Prüfkriterien des Scanners:**
  - **Zip-Slip & Pfad-Traversal:** Verhindert das Ausbrechen aus dem Zielverzeichnis (`../`, absolute Pfade).
  - **Gefährliche Dateitypen:** Sofortige Ablehnung von ausführbaren Dateien (`.exe`, `.dll`, `.bat`, `.cmd`, `.sh`, `.php`, `.vbs`, etc.).
  - **Dynamischer Code:** Erkennung von `eval()`, `new Function()`, `setTimeout(string)`.
  - **Prozess-Ausführung:** Blockiert Aufrufe von `require('child_process')`, `process.exit`, `child_process.exec`.
  - **Token- und Cookie-Exfiltration:** Blockiert unautorisierte Zugriffe auf `document.cookie` oder `localStorage.getItem('token')`.
  - **Cryptominer:** Erkennung bekannter Mining-Signaturen (`coinhive`, `monero-miner`).
  - **Einstiegspunkt:** Prüft das Vorhandensein einer `index.html` (im Root oder einem einheitlichen Unterordner).
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "score": 95,
    "status": "passed",
    "report": {
      "valid": true,
      "score": 95,
      "status": "passed",
      "filesScanned": 8,
      "entryFile": "index.html",
      "metadata": {
        "title": "Voxel Galaxy Lab",
        "category": "gaming",
        "author": "CommunityModder",
        "copyright": "© CommunityModder"
      },
      "issues": []
    },
    "fileCount": 8
  },
  "meta": { "version": "v1.0.0", "timestamp": "2026-11-14T09:30:00.000Z" }
}
```

#### `POST /api/v1/rigs/import-zip`
Importiert ein geprüftes ZIP-Archiv, entpackt es sicher, bindet automatisch die PlayRig Bridge und Design Tokens ein, erzeugt bei Bedarf ein konformes `docs.json` und registriert das Rig mit Standardeinstellungen in der MySQL-Datenbank.
- **Berechtigung:** Erfordert Rolle `creator` oder `admin`.
- **Payload:**
```json
{
  "zipBase64": "data:application/zip;base64,UEsDBBQAAAA...",
  "title": "Mein Super Rig",
  "category": "gaming",
  "subcategory": "Sandbox",
  "author": "Alex Creator",
  "copyright": "© Alex Creator"
}
```
- **Besonderheiten:**
  - **Autoren- und Copyright-Integrität:** Eigene Rigs behalten immer den angegebenen Namen und ihr eigenes Copyright. Lediglich von Liath für GameChiller entwickelte Core-Rigs tragen die Signatur `Liath` / `© GameChiller`.
  - **Sofort lauffähig (Out-of-the-Box):** Das System scannt `index.html`. Falls die PlayRig Design-Tokens (`tokens.css`, `themes.css`, etc.) oder die Bridge (`playrig-bridge.js`) fehlen, werden sie mit korrekten relativen Pfaden automatisch injiziert.
  - **Sicherheits-Blockierung:** Rigs mit einem Score unter 70 oder kritischen Verstößen (Zip-Slip, Binaries, Backdoors) werden mit HTTP 400 (`SECURITY_SCAN_FAILED`) abgewiesen und im Audit-Log vermerkt.
- **Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "rig": {
      "id": "rig-mein-super-rig-x9z2",
      "title": "Mein Super Rig",
      "category": "gaming",
      "subcategory": "Sandbox",
      "path": "rigs/gaming/Sandbox/rig-mein-super-rig-x9z2/index.html",
      "version": "v1.0.0",
      "author": "Alex Creator",
      "copyright": "© Alex Creator",
      "status": "active",
      "access": "public"
    },
    "report": { "score": 100, "status": "passed" },
    "directUrl": "/rigs/gaming/Sandbox/rig-mein-super-rig-x9z2/index.html",
    "studioUrl": "/studio"
  },
  "meta": { "version": "v1.0.0", "timestamp": "2026-11-14T09:30:00.000Z" }
}
```

---

### 3.3 Scoped Storage Engine (`/api/v1/storage`)

Alle Storage-Keys und IDs müssen dem Schema `^[a-zA-Z0-9_.-]{1,128}$` entsprechen.

#### `GET /api/v1/storage/user/:key`
Liest eine Einstellung des aktuell authentifizierten Benutzers (oder Gastes).

#### `POST /api/v1/storage/user/:key`
Speichert eine Einstellung für den aktuellen Benutzer.
- **Body:** `{ "value": { ... beliebige JSON-Daten ... } }`
- **Limit:** Max. 5 MB pro Wert.

#### `DELETE /api/v1/storage/user/:key`
Löscht einen Eintrag des aktuellen Benutzers.

#### `GET /api/v1/storage/rig/:rigId/:key`
Liest rig-spezifische Konfigurationen.

#### `POST /api/v1/storage/rig/:rigId/:key`
Schreibt rig-spezifische Konfigurationen.
- **Berechtigung:** Nur der **Eigentümer des Rigs** oder ein **Administrator** darf schreiben. Unberechtigte Aufrufe werden mit HTTP 403 abgewiesen und im Audit-Log vermerkt.

#### `GET /api/v1/storage/global/:key`
Liest plattformweite Konfigurationen (erfordert Scope `storage:global:read` oder Admin).

#### `POST /api/v1/storage/global/:key`
Schreibt plattformweite Konfigurationen.
- **Berechtigung:** Ausschließlich Rolle `admin`.

---

### 3.4 Companion Services (`/api/v1/services`)

#### `GET /api/v1/services`
Liefert die Liste aller registrierten Backend-Companion-Services (z. B. `enshrouded`).

#### `GET /api/v1/services/:id/status`
Prüft den Health-Status des entsprechenden Companion-Services.
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "enshrouded",
    "name": "Enshrouded Save & Character Engine",
    "status": "healthy",
    "version": "v1.1.0"
  }
}
```

---

### 3.5 Spezifikation (`/api/v1/docs`)

#### `GET /api/v1/docs`
Gibt das vollständige, maschinenlesbare OpenAPI-Schema der PlayRig-API zurück.

---

### 3.6 GitHub & System Updater (`/api/v1/updater`)

Echtzeit-Synchronisation des Systems und der Rigs mit dem offiziellen GitHub-Repository (`https://github.com/AmFearLiath/PlayRig`).

#### `GET /api/v1/updater/status`
Prüft den Synchronisationsstatus mit `origin/main` (gecached für 30s).
- **Berechtigung:** Öffentlich (kein Token erforderlich).
- **Query-Parameter:** `force=true` (optional, erzwingt frischen Remote-Fetch).
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "hasUpdate": true,
    "behind": 2,
    "ahead": 0,
    "branch": "main",
    "repoUrl": "https://github.com/AmFearLiath/PlayRig",
    "local": { "hash": "d6383f0", "message": "feat: merge PR..." },
    "remote": { "hash": "e819ac2", "message": "feat: new rig..." },
    "incomingCommits": [
      { "hash": "e819ac2", "author": "Liath", "relativeTime": "2 hours ago", "message": "feat: new rig..." }
    ],
    "isClean": true,
    "modifiedCount": 0,
    "lastChecked": "2026-11-14T11:00:00.000Z"
  }
}
```

#### `POST /api/v1/updater/check`
Erzwingt eine sofortige Prüfung gegen `origin/main`.
- **Response (200 OK):** Identisch mit `GET /updater/status`.

#### `POST /api/v1/updater/apply`
Führt die System- und Rig-Aktualisierung durch (`git pull --rebase origin main`, gefolgt von automatischem Re-Sync der MySQL-Datenbank).
- **Berechtigung:** Erfordert Rolle `admin`.
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "status": { "hasUpdate": false, "behind": 0, ... },
    "logs": [
      "[11:30:00] Starte Aktualisierung von https://github.com/AmFearLiath/PlayRig...",
      "[11:30:02] Ziehe Änderungen von origin/main per Rebase...",
      "[11:30:04] Synchronisiere MySQL-Datenbank & Rigs...",
      "[11:30:05] System ist jetzt auf Stand: e819ac2"
    ]
  }
}
```

#### `POST /api/v1/updater/push-rig`
Überträgt ein einzelnes Rig in einen isolierten Feature-Branch auf GitHub für Pull-Requests.
- **Berechtigung:** Erfordert Rolle `creator` oder `admin`.
- **Payload:**
```json
{
  "rigId": "rpg-dice-loot-vault",
  "branchName": "rig/rpg-dice-loot-vault-v2",
  "commitMessage": "feat(rpg): neue Loot-Tabellen hinzugefügt"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "branch": "rig/rpg-dice-loot-vault-v2",
    "pullRequestUrl": "https://github.com/AmFearLiath/PlayRig/pull/new/rig%2Frpg-dice-loot-vault-v2",
    "rig": { "id": "rpg-dice-loot-vault", "title": "Retro RPG Dice & Loot Vault" }
  }
}
```

