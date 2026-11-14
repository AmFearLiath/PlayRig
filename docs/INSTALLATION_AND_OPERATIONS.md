# ⚙️ PlayRig – Installations- & Betriebsdokumentation

**Zielgruppe:** DevOps-Engineers, System-Administratoren  
**Stand:** v1.0.0  
**Autor:** Liath • **Copyright:** © GameChiller  

---

## 1. Systemvoraussetzungen

- **Laufzeitumgebung:** Node.js v18.0.0 oder höher (v20+ LTS empfohlen).
- **Datenbank:** MySQL 8.0+ oder MariaDB 10.5+ (Standard: Port `3307`).
- **Betriebssystem:** Windows 10/11, Windows Server, Linux (Debian/Ubuntu) oder macOS.
- **Hardware-Empfehlung:** Min. 2 CPU-Kerne, 4 GB RAM, 10 GB freier SSD-Speicher.

---

## 2. Installation & Konfiguration

### 2.1 Repository & Pakete
```bash
git clone https://github.com/AmFearLiath/PlayRig.git
cd PlayRig
npm install
```

### 2.2 Umgebungsvariablen (`.env` oder Umgebung)
| Variable | Standardwert | Beschreibung |
|---|---|---|
| `PORT` | `3000` | HTTP-Port für Deck, Studio und API |
| `DB_HOST` | `localhost` | Hostname des MySQL-Servers |
| `DB_PORT` | `3307` | TCP-Port des MySQL-Servers |
| `DB_USER` | `root` | Datenbankbenutzer |
| `DB_PASSWORD`| *(leer)* | Datenbankpasswort |
| `DB_NAME` | `playrig_db` | Name der primären Datenbank |

---

## 3. Datenbank-Initialisierung (`server/db.js`)

Beim Start prüft `server/db.js` die Verbindung und führt automatisch alle erforderlichen Schema-Migrationen durch:
- Erstellung der Tabellen: `users`, `rigs`, `rig_storage`, `gamechiller_clients`, `audit_log`.
- Automatischer Seed der Standardkonten (Admin: `admin`, Creator: `creator`).
- Schema-Erweiterungen (`permissions`, `dependencies`, `min_runtime_version`, `docs`).

### Manueller Health-Check der Datenbank
```bash
node -e "require('./server/db.js').init().then(() => console.log('DB Ready!')).catch(console.error);"
```

---

## 4. Server-Betrieb & Port-Management

### 4.1 Server starten
```bash
node server/server.js
```

### 4.2 Port-Konflikt-Lösung (`server/port-helper.js`)
PlayRig verfügt über einen integrierten Port-Manager:
- Ist Port `3000` belegt, erkennt `ensurePortAvailable` den blockierenden Prozess.
- **Interaktiver Modus (Terminal):** Fragt den Administrator, ob der alte Prozess beendet werden soll.
- **Nicht-interaktiver Modus (Service/Daemon):** Beendet verwaiste Prozesse automatisch, um Ausfallzeiten zu verhindern.

### 4.3 Health-Check Endpunkte
- HTTP Health: `GET http://localhost:3000/api/health`
- Context Status: `GET http://localhost:3000/api/v1/auth/context`

---

## 5. Datensicherung & Wartung

### 5.1 Backup der Datenbank
```bash
mysqldump -h localhost -P 3307 -u root -p playrig_db > playrig_backup_$(date +%F).sql
```

### 5.2 Backup der Rigs
Das Verzeichnis `rigs/` enthält sämtliche Assets und kann direkt archiviert werden:
```bash
tar -czvf playrig_rigs_$(date +%F).tar.gz rigs/
```

### 5.3 Audit-Log Inspektion
Alle administrativen Eingriffe und Sicherheitsverletzungen werden in der Tabelle `audit_log` gespeichert:
```sql
SELECT timestamp, username, action, details FROM audit_log ORDER BY id DESC LIMIT 50;
```

