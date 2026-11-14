# 🌐 PlayRig – Integration Bridge Handbuch

**Schnittstelle:** PlayRig Bridge (`_shared/js/playrig-bridge.js`)  
**Protokoll-Version:** v1.0.0  
**Autor:** Liath • **Copyright:** © GameChiller  

---

## 1. Architektur und Vertrauensmodell

Die **PlayRig Bridge** regelt die kontrollierte und sichere Kommunikation zwischen dem Master-Portal (GameChiller) und den eingebetteten PlayRig-Anwendungen (Rigs).

### Grundprinzipien:
1. **Kein Wildcard-Messaging:**  
   Die Bridge versendet Nachrichten niemals an `'*'`. Als Ziel wird immer das verifizierte Origin des Host-Fensters verwendet.
2. **Origin Allowlist:**  
   Nachrichten vom Host werden nur akzeptiert, wenn `event.origin` in der zentralen Allowlist enthalten ist (z. B. `localhost:3000`, `gamechiller.de`, `*.gamechiller.de`).
3. **Source Verification:**  
   Wenn ein Rig im Iframe läuft, werden nur Nachrichten akzeptiert, deren `event.source === window.parent` ist.
4. **Nonce-gesicherter Handshake:**  
   Initialisierungs-Nachrichten können ein Session-Nonce enthalten, das für nachfolgende Aufrufe validiert wird.

```
+-------------------------------------------------------------------------+
|                      GAMECHILLER HOST (Parent Window)                   |
+------------------------------------+------------------------------------+
                                     |
               postMessage(event, verifiedTargetOrigin)
             [PLAYRIG_INIT_CONTEXT, PLAYRIG_REQUEST_SCREENSHOT]
                                     |
                                     v
+------------------------------------+------------------------------------+
|                       PLAYRIG RIG (Child Iframe)                        |
|                                                                         |
|  1. isOriginAllowed(event.origin)? ──────> [Nein] ──> Reject & Log      |
|  2. event.source === window.parent? ────> [Nein] ──> Reject & Log      |
|  3. Validate JSON Message Schema                                        |
|  4. window.PlayRig.emit(type, payload)                                  |
|                                                                         |
|  Antwort via postToHost():                                              |
|  window.parent.postMessage({ type, nonce, timestamp }, hostOrigin)      |
+-------------------------------------------------------------------------+
```

---

## 2. JavaScript SDK API (`window.PlayRig`)

Jedes Rig hat über das globale Objekt `window.PlayRig` Zugriff auf standardisierte Schnittstellen:

### 2.1 Kontext & Identität

```javascript
// Registriert einen Listener für Plattform-Updates und liefert sofort den aktuellen Kontext
window.PlayRig.onContext((ctx) => {
  console.log('Angemeldeter Benutzer:', ctx.user.displayName);
  console.log('Aktuelle Community:', ctx.community?.name);
  console.log('Aktiver Server:', ctx.server?.endpoint);
});

// Direkter Zugriff auf aktive Daten
const user = window.PlayRig.getUser();
const hasWriteAccess = window.PlayRig.hasPermission('storage:user');
```

### 2.2 Scoped Cloud Storage

```javascript
// 1. Daten speichern (synct automatisch mit API v1 und Fallback auf LocalStorage)
await window.PlayRig.storage.set('game_settings', { sensitivity: 1.5, volume: 80 });

// 2. Daten abrufen (mit Default-Fallback)
const settings = await window.PlayRig.storage.get('game_settings', { sensitivity: 1.0 });

// 3. Daten löschen
await window.PlayRig.storage.delete('game_settings');
```

### 2.3 Strict In-Window Navigation

```javascript
// Navigiert immer im selben Browserfenster (Parent fängt ab und navigiert kontrolliert)
window.PlayRig.navigate('/studio');
```

### 2.4 Benachrichtigungen

```javascript
// Sendet Toast an das Host-Portal und zeigt lokalen Toast an
window.PlayRig.notify('Level erfolgreich abgeschlossen!', 'success', 3000);
```

### 2.5 Ereignisse (Events)

```javascript
// Plattform-Event senden (kanonische Methode)
window.PlayRig.sendEvent('ACHIEVEMENT_UNLOCKED', { id: 'speedrun_pb', time: '12:45.32' });

// Auf Plattform-Events hören
window.PlayRig.on('gamechiller:pause', () => {
  pauseGameLoop();
});
```

---

## 3. Standardisiertes Nachrichtenprotokoll

| Nachrichtentyp | Richtung | Beschreibung |
|---|---|---|
| `PLAYRIG_INIT_CONTEXT` | Host -> Rig | Übergibt den initialen Plattform-Kontext (User, Server, Theme, Nonce). |
| `PLAYRIG_UPDATE_CONTEXT`| Host -> Rig | Aktualisiert inkrementelle Kontext-Daten während der Laufzeit. |
| `PLAYRIG_SET_THEME` | Host -> Rig | Weist das Rig an, das aktive Design-Themeset zu wechseln. |
| `PLAYRIG_REQUEST_SCREENSHOT` | Host -> Rig | Fordert das Rig auf, einen Canvas-Snapshot zu erstellen. |
| `PLAYRIG_SCREENSHOT_CAPTURED`| Rig -> Host | Liefert das Base64-PNG-Bild (`dataUrl`) zurück an das Host-Deck. |
| `PLAYRIG_SCREENSHOT_ERROR` | Rig -> Host | Signalisiert, dass kein Canvas gerendert werden konnte. |
| `PLAYRIG_NAVIGATE` | Rig -> Host | Weist den Host an, eine In-Window-Navigation durchzuführen. |
| `PLAYRIG_NOTIFY` | Rig -> Host | Übermittelt eine Toast-Benachrichtigung an die Benutzeroberfläche. |
| `PLAYRIG_EVENT` | Rig -> Host | Sendet ein anwendungsspezifisches Ereignis an GameChiller. |
| `PLAYRIG_BRIDGE_READY` | Rig -> Host | Quittiert dem Host die erfolgreiche Initialisierung der Bridge. |

---

## 4. Standalone Fallback & Fehlertoleranz

Wird ein Rig **außerhalb von GameChiller** (z. B. direkt als statische HTML-Datei oder in einem lokalen Testserver) gestartet:
- Erkennt die Bridge automatisch `isInIframe = false`.
- Initialisiert einen sicheren Gast-Kontext (`isGuest: true`, `role: "guest"`).
- `storage.get/set` greift transparent auf `localStorage` zurück.
- `navigate(url)` navigiert standardmäßig per `window.location.href`.
- **Ergebnis:** Das Rig bleibt zu 100 % funktionsfähig, ohne Fehler zu werfen.
