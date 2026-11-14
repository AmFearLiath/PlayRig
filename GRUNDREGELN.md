# 📜 PLAYRIG PLATFORM - SYSTEM-GRUNDREGELN & MANIFEST
> **Offizielles, verbindliches Architektur-, Sicherheits- und Entwicklungsmanifest**  
> **Stand:** v1.0.0 • **Ökosystem:** GameChiller Platform & PlayRig Core  
> **Autor der Core-Plattform:** Liath • **Copyright:** © GameChiller  

---

## § 1. Grundsatzarchitektur: GameChiller Master-Portal & Autarkes PlayRig

1. **GameChiller als Master-Portal:**  
   GameChiller ist die zentrale Community- und Gaming-Plattform. Sie verwaltet Benutzeridentitäten, Community-Rollen, Server und globale Berechtigungen.
2. **Eigenständigkeit von PlayRig (Standalone First):**  
   PlayRig ist eine autonome Erweiterungs-, Entwicklungs- und Ausführungsumgebung.  
   - PlayRig darf **niemals technisch oder funktional von GameChiller abhängig** sein.  
   - GameChiller darf **niemals von der internen Implementierung oder Verfügbarkeit** von PlayRig abhängig sein.  
   - Bei Ausfall oder Trennung der Integration funktioniert PlayRig lokal und standalone uneingeschränkt weiter (mit Gast- und Session-Fallback).
3. **Integration Bridge & Vertrauensgrenzen:**  
   Die Kommunikation erfolgt kontrolliert über die **PlayRig Bridge** (`_shared/js/playrig-bridge.js`) und die versionierte REST-API (`/api/v1`).  
   - Externe Identitäten werden nicht ungeprüft übernommen, sondern serverseitig verifiziert.  
   - GameChiller-Rechte verleihen **niemals automatisch lokale Administrator-Rechte** in PlayRig.  
   - Sämtliche Zugriffe sind auf den tatsächlich erteilten Scope beschränkt.

---

## § 2. Sicherheits- & Kommunikationsregeln

1. **Keine Wildcards in postMessage:**  
   Die Verwendung von Wildcard-Zieladressen (`'*'`) bei `postMessage` ist im gesamten PlayRig-System strikt verboten. Alle Nachrichten adressieren konkrete, verifizierte Origins.
2. **Zentrale Origin-Allowlist:**  
   Eingehende Nachrichten werden über eine zentrale Allowlist (`ALLOWED_ORIGINS`) gegen Herkunft und Absender (`event.origin`, `event.source`) validiert. Nicht gelistete Origins werden verworfen.
3. **Replay-Schutz & Schema-Validierung:**  
   Nachrichten nutzen Nonces und ein verbindliches JSON-Schema (`type`, `payload`, `nonce`, `timestamp`).
4. **Storage-Autorisierung:**  
   - **User-Storage (`/api/v1/storage/user/:key`):** Nur der authentifizierte Benutzer selbst darf seine Daten lesen, schreiben und löschen. Zugriff auf fremde Benutzerdaten ist unmöglich.
   - **Rig-Storage (`/api/v1/storage/rig/:rigId/:key`):** Schreib- und Löschrechte sind strikt an die **Eigentümerschaft** des Rigs (`author` / `original_author`) oder die Rolle `admin` gebunden. Zugriffsverletzungen werden im Audit-Log protokolliert.
   - **Global-Storage (`/api/v1/storage/global/:key`):** Lesezugriff erfordert den Scope `storage:global:read`, Schreibzugriff ist ausschließlich Administratoren vorbehalten.
   - **Path Traversal Schutz:** Schlüssel und IDs müssen dem Schema `^[a-zA-Z0-9_.-]{1,128}$` entsprechen.
5. **Standardberechtigungen für Neuregistrierungen:**  
   Neu registrierte Benutzer erhalten standardmäßig die reguläre Rolle **`user`**. Privilegierte Rollen (`creator`, `admin`) werden niemals automatisch vergeben.

---

## § 3. Einheitliche In-Window-Navigation & Deck Spotlight

1. **Strikte In-Window Navigation (Verbot von `target="_blank"`):**  
   - Alle internen Links, Vorschau-Buttons, Dashboard-Links und Aktionen verbleiben grundsätzlich im **selben Browserfenster**.
   - Die Verwendung von `target="_blank"` ist untersagt, um unkontrollierte Tab-Vermehrung zu verhindern.
   - Navigationsaktionen aus eingebetteten Rigs nutzen `PlayRig.navigate(url)`.
2. **Deck Spotlight Snapshot-Prinzip:**  
   - Das Spotlight im PlayRig Deck rendert **ausschließlich statische Screenshots** (`thumbnail.png` / `screenshot.png`).
   - Ein eingebettetes Iframe oder die direkte Ausführung eines Rigs zur bloßen Vorschau ist im Spotlight verboten.
   - Screenshot-Anfragen folgen dem standardisierten Protokoll `PLAYRIG_REQUEST_SCREENSHOT` / `PLAYRIG_SCREENSHOT_CAPTURED`.
   - Bei Rigs ohne Canvas-Unterstützung greift ein Timeout mit transparentem Fallback auf statische Bild-Assets.

---

## § 4. Autorenschaft, Copyright & Versionierung

1. **Core-Rigs vs. Drittentwickler-Rigs:**  
   - **Core-Rigs (unsere 10 Plattform-Rigs):** Tragen verbindlich die Signatur `Author: Liath` und `Copyright: © GameChiller`.
   - **Community- und Drittentwickler-Rigs:** Behalten unverändert ihren **eigenen Namen und ihr eigenes Copyright**. Das System überschreibt fremde Autorenschaften niemals mit Liath oder GameChiller.
2. **Metadaten-Verwaltung im Studio:**  
   Beim Erstellen oder Importieren eines Rigs werden Autor und Copyright im Formular explizit erfasst und in der Datenbank persistiert.
3. **Versionierungs-Standard:**  
   Rigs starten bei `v0.0.1` (bzw. `v1.0.0` bei Release) und nutzen semantische Versionierung (`MAJOR.MINOR.PATCH`).

---

## § 5. Ordnerstruktur & Systemkomponenten

```
_HTML_Tools/
├── _shared/                # Gemeinsame Tokens, Themes, Base-CSS & JS-Bridge
│   ├── css/                # tokens.css, themes.css, base.css, components.css, animations.css
│   └── js/                 # playrig-bridge.js, embed-bridge.js, toast.js, fx-engine.js
├── admin/                  # Geschütztes Administrationspanel
├── docs/                   # Vollständige System-, API-, Bridge- & Entwicklerdokumentation
├── rigs/                   # Alle Rigs nach Kategorien geordnet
│   ├── Animations/         # Canvas-Shaders, Particles-FX
│   ├── Creative/           # Audio-Visual
│   ├── Gaming/             # Minecraft, Enshrouded, RPG-Tools, Shooter-Tools, Procedural, Helper
│   └── Helper/             # Generators
├── server/                 # Express Backend, MySQL Adapter & Services
│   ├── api/v1/             # Versionierte REST-API (auth, rigs, storage, services, docs)
│   ├── services/           # Modulare Companion-Services (z. B. Enshrouded)
│   ├── db.js               # Datenbank-Schema & Migrations (Port 3307)
│   └── server.js           # Server-Bootstrap & Static Mounts
├── studio/                 # In-Window Creator Workstation & Editor
├── hub.js / hub.css        # PlayRig Deck Logik & Styles
└── index.html              # PlayRig Deck Startseite
```

---

## § 6. Zentrale CSS- und Designsystem-Architektur

1. **Design Tokens First:**  
   Farbwerte, Spacings, Radien, Schriftarten und Schatten werden ausschließlich über die zentralen CSS-Variablen in `_shared/css/tokens.css` gesteuert.
2. **Kanonische Themesets:**  
   Themes in `_shared/css/themes.css` definieren Farbpaletten (`cyber-cyan`, `emerald-matrix`, `synthwave-sunset`, `royal-gold`, `crimson-voltage`), ohne lokale Sonderregeln einzuführen.
3. **Barrierefreiheit & Reduced Motion:**  
   Alle zentralen Animationen in `_shared/css/animations.css` respektieren das Media-Query `@media (prefers-reduced-motion: reduce)`.
4. **Wiederverwendbare Komponenten:**  
   Buttons, Badges, Karten und Glassmorphismus-Panels nutzen die Basisklassen aus `_shared/css/components.css`.

---

## § 7. Modulare Backend Companion Services (`server/services/`)

1. **Eigenständige Service-Module:**  
   Spezifische Server-Funktionen (z. B. Zstandard-Dechiffrierung, Save-Game Parsing, Server-Pings) werden als isolierte Klassen abgeleitet von `server/services/base-service.js` implementiert.
2. **Deklarative Abhängigkeiten:**  
   Rigs deklarieren ihre benötigten Services im Manifest (`docs.json` bzw. DB-Spalte `services`). Das Deck visualisiert Service-Anforderungen transparent mit Status-Badges.
3. **Lifecycle:**  
   Der `ServiceManager` (`server/services/index.js`) initialisiert Services dynamisch, bindet ihre REST-Endpunkte ein und überwacht deren Health-Status.

---

## § 8. ZIP-Import, Sicherheitsvalidierung & Standards für KI-Agenten

1. **Verbindliche Sicherheits-Vorabprüfung:**  
   Jedes importierte ZIP-Archiv muss vor dem Entpacken durch den statischen `RigSecurityScanner` validiert werden. Archive mit Zip-Slip Pfad-Traversierung, ausführbaren Binärdateien (`.exe`, `.dll`, `.bat`, `.sh`, `.php`), dynamischem Code (`eval`, `new Function`), Process-Spawn (`child_process`), Token-Sniffing oder Cryptominern werden strikt abgewiesen und im Audit-Log vermerkt.
2. **Sofortige Lauffähigkeit nach Freigabe:**  
   Genehmigte Projekte werden in das Zielverzeichnis extrahiert. Fehlende Token-Verweise (`tokens.css`) und Bridge-Skripte (`playrig-bridge.js`) werden automatisch injiziert, damit das Rig ohne manuelle Konfiguration direkt im Deck und Studio nutzbar ist.
3. **Autoren- und Copyright-Schutz:**  
   Eigene und importierte Rigs tragen stets den Namen und das Copyright des jeweiligen Erstellers. Standardmäßig `Liath` und `© GameChiller` gilt ausschließlich für die von uns entwickelten Plattform-Core-Rigs.
4. **Verbindlicher Standard für KI-Agenten:**  
   Automatisierte Generatoren und KI-Agenten müssen Rigs nach den Vorgaben des Entwickler-Leitfadens (Deep Slate Dark Theme, responsive 60 FPS Canvas/WebGL, prozedurale Web Audio SFX ohne externe MP3-Abhängigkeiten, In-Window Navigation und valides `docs.json` Manifest) auf höchstem technischen und visuellem Level erstellen.
