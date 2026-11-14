# 📚 PlayRig – Zentrale Plattform- & Entwicklerdokumentation

**Plattform:** GameChiller Ökosystem  
**Modul:** PlayRig Core & Runtime Engine  
**Version:** v1.0.0 (API & Platform) / v0.0.2 (Rigs)  
**Autor der Plattform:** Liath  
**Copyright:** © GameChiller  

---

## 🗺️ Dokumentationsübersicht

Willkommen in der zentralen technischen Dokumentation der **PlayRig Engine**. Diese Handbücher beschreiben die vollständige Architektur, die Integrationsschnittstellen zu GameChiller, die REST-API sowie Richtlinien für Entwickler und Administratoren.

| Dokument | Zielgruppe | Inhalt |
|---|---|---|
| [📖 Systemdokumentation](SYSTEM_DOCUMENTATION.md) | Architekten, Lead Devs | Vollständige Systemübersicht, Module, Sandboxing, Datenhaltung & Sicherheitsmodell. |
| [🛠️ API-Referenz (v1)](API_REFERENCE.md) | Backend- & Frontend-Devs | Vollständige Spezifikation aller Endpunkte (`/api/v1/*`), Authentifizierung, Scopes & JSON Envelopes. |
| [🌐 Integration Bridge](INTEGRATION_BRIDGE.md) | Plattform-Integratoren | Bidirektionale Bridge (`_shared/js/playrig-bridge.js`), Nonce-Handshake, Origin-Allowlist & Events. |
| [💻 Entwickler-Leitfaden](DEVELOPER_GUIDE.md) | Rig-Entwickler | Schritt-für-Schritt-Anleitung zum Erstellen, Testen und Publizieren eigener Rigs im Studio. |
| [⚙️ Installation & Betrieb](INSTALLATION_AND_OPERATIONS.md) | DevOps, System-Admins | Systemanforderungen, MySQL-Setup (Port 3307), Server-Bootstrap, Health-Checks & Troubleshooting. |
| [📜 Changelog](CHANGELOG.md) | Alle | Detaillierte Versionshistorie, Security Fixes, API-Updates und Migrationsschritte. |
| [⚖️ System-Grundregeln](file:///f:/_HTML_Tools/GRUNDREGELN.md) | Alle | Verbindliches Architektur-, Sicherheits- und Entwicklungsmanifest. |

---

## ⚡ Schnellübersicht: Kernprinzipien

1. **GameChiller als Master-Portal:**  
   GameChiller verwaltet Benutzer, Identitäten, Community-Rollen und Gameserver. PlayRig bleibt ein **vollständig eigenständiges, autonom lauffähiges System** und funktioniert auch ohne Plattformanbindung im Offline- oder Standalone-Modus.
2. **Keine Sicherheits-Wildcards:**  
   Die Bridge (`_shared/js/playrig-bridge.js`) nutzt verifizierte Host-Origins anstelle von `postMessage('*')`. Alle eingehenden Nachrichten werden über eine zentrale Allowlist und Nonces geprüft.
3. **Strikte In-Window-Navigation:**  
   PlayRig öffnet standardmäßig keine neuen Tabs (`target="_blank"` ist untersagt). Die gesamte Interaktion verbleibt im selben Browserfenster.
4. **Deck Spotlight Snapshot-Prinzip:**  
   Im Deck werden für Vorschauen ausschließlich statische Snapshots gerendert. Das eigentliche Rig wird niemals nur für eine Vorschau ausgeführt.
5. **Autorenschaft & Copyright:**  
   Nur die 10 Core-Flagship-Rigs tragen standardmäßig `Author: Liath` und `© GameChiller`. Externe Entwickler und Community-Rigs behalten dauerhaft ihren eigenen Namen und ihr eigenes Copyright.

