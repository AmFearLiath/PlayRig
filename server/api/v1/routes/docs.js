/**
 * PLAYRIG API v1 - SPECIFICATION & ENDPOINT DOCUMENTATION
 * Full technical schema of all versioned API endpoints for GameChiller.
 *
 * Author: Liath • Copyright: © GameChiller
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../../..');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');

const AVAILABLE_DOCS = [
  {
    id: 'system',
    file: 'SYSTEM_DOCUMENTATION.md',
    title: 'Systemdokumentation',
    icon: '📖',
    category: 'Architektur',
    description: 'Architektur, Module, Sandbox-Isolation, Datenhaltung & Sicherheitsmodell.'
  },
  {
    id: 'api',
    file: 'API_REFERENCE.md',
    title: 'API-Referenz (v1)',
    icon: '🛠️',
    category: 'Entwicklung',
    description: 'REST-Endpunkte, Authentifizierung, Scopes, Parameter & JSON-Envelopes.'
  },
  {
    id: 'bridge',
    file: 'INTEGRATION_BRIDGE.md',
    title: 'Integration Bridge',
    icon: '🌐',
    category: 'Integration',
    description: 'Bidirektionale Bridge, Origin-Allowlist, Nonce-Handshake & Event-Handling.'
  },
  {
    id: 'developer',
    file: 'DEVELOPER_GUIDE.md',
    title: 'Entwickler-Leitfaden',
    icon: '💻',
    category: 'Entwicklung',
    description: 'Neues Rig erstellen, Tokens, Offline-Storage & Standalone docs.json.'
  },
  {
    id: 'operations',
    file: 'INSTALLATION_AND_OPERATIONS.md',
    title: 'Installation & Betrieb',
    icon: '⚙️',
    category: 'DevOps',
    description: 'MySQL Setup (Port 3307), Server-Bootstrap, Backups & Health-Checks.'
  },
  {
    id: 'manifest',
    file: '../GRUNDREGELN.md',
    title: 'Grundregeln & Manifest',
    icon: '⚖️',
    category: 'Richtlinien',
    description: 'Verbindliches Plattform-Manifest, Master-Portal Trennung & Sicherheitsregeln.'
  },
  {
    id: 'changelog',
    file: 'CHANGELOG.md',
    title: 'Changelog',
    icon: '📜',
    category: 'Historie',
    description: 'Release-Historie, Security Fixes, Features & Breaking Changes.'
  }
];

const API_SPEC = {
  title: 'PlayRig Integration API',
  version: 'v1.0.0',
  description: 'Zentrale, sichere und versionierte Schnittstelle für GameChiller Plattform-Komponenten, Rigs und externe Dienste.',
  baseUrl: '/api/v1',
  author: 'Liath',
  copyright: '© GameChiller',
  auth: {
    type: 'Bearer Token (Session Token) oder X-API-Key',
    headers: ['Authorization: Bearer <token>', 'X-API-Key: <client_key>'],
    guestAccess: 'Unterstützt (eingeschränkte Scopes: rigs:read, storage:session)'
  },
  roles: {
    admin: 'Vollzugriff auf alle Rigs, Services, Speicherbereiche und Benutzerverwaltung.',
    creator: 'Erstellung, Bearbeitung und Verwaltung eigener Rigs sowie Zugriff auf User- und Rig-Speicher.',
    user: 'Ausführung freigegebener Rigs und Zugriff auf eigenen Benutzerspeicher.',
    service: 'Autorisierte externe GameChiller-Hintergrunddienste via X-API-Key.',
    guest: 'Nur lesender Zugriff auf öffentliche Rigs und flüchtige Session-Speicherung.'
  },
  endpoints: [
    // Auth & Identity
    {
      path: '/api/v1/auth/me',
      method: 'GET',
      summary: 'Aktuelles Benutzerprofil und Berechtigungs-Scopes abrufen',
      requiredScope: 'none (Gast-Fallback)',
      response: {
        success: 'true',
        data: { user: { id: 'string', username: 'string', role: 'string' }, isGuest: 'boolean', scopes: 'array' }
      }
    },
    {
      path: '/api/v1/auth/guest',
      method: 'GET',
      summary: 'Standardisierte Gast-Identität mit eingeschränkten Rechten erzeugen',
      requiredScope: 'none',
      response: { success: 'true', data: { user: 'object', isGuest: 'true' } }
    },
    {
      path: '/api/v1/auth/context',
      method: 'GET',
      summary: 'Vollständigen GameChiller Plattform-Kontext abrufen',
      requiredScope: 'none',
      response: { success: 'true', data: { user: 'object', community: 'object', game: 'object', server: 'object' } }
    },
    {
      path: '/api/v1/auth/login',
      method: 'POST',
      summary: 'Benutzer mit Zugangsdaten authentifizieren',
      parameters: { username: 'string', password: 'string' },
      requiredScope: 'none'
    },
    {
      path: '/api/v1/auth/register',
      method: 'POST',
      summary: 'Neuen Benutzer-Account registrieren (Standardrolle: user)',
      parameters: { username: 'string', password: 'string', displayName: 'string' },
      requiredScope: 'none'
    },
    // Rigs & Catalog
    {
      path: '/api/v1/rigs',
      method: 'GET',
      summary: 'Registrierte Rigs abrufen (Filterbar nach category, subcategory, search)',
      requiredScope: 'rigs:read'
    },
    {
      path: '/api/v1/rigs/:id',
      method: 'GET',
      summary: 'Detailmanifest eines Rigs abrufen',
      requiredScope: 'rigs:read'
    },
    {
      path: '/api/v1/rigs/:id/docs',
      method: 'GET',
      summary: 'Autonome Standalone-Dokumentation (docs.json) eines Rigs abrufen',
      requiredScope: 'rigs:read'
    },
    {
      path: '/api/v1/rigs/:id/screenshot',
      method: 'GET',
      summary: 'Geprüftes Snapshot-Vorschaubild als PNG-Binärstream abrufen',
      requiredScope: 'rigs:read'
    },
    {
      path: '/api/v1/rigs/status',
      method: 'POST',
      summary: 'Betriebsstatus eines Rigs aktualisieren (active, wip, deprecated)',
      parameters: { id: 'string', status: 'string' },
      requiredScope: 'rigs:admin / creator'
    },
    // Scoped Cloud Storage
    {
      path: '/api/v1/storage/user/:key',
      method: 'GET',
      summary: 'Benutzerspezifische Einstellung abrufen',
      requiredScope: 'storage:user (Eigener User oder Gast)'
    },
    {
      path: '/api/v1/storage/user/:key',
      method: 'POST',
      summary: 'Benutzerspezifische Einstellung speichern (Max. 5 MB)',
      parameters: { value: 'any (JSON serializable)' },
      requiredScope: 'storage:user'
    },
    {
      path: '/api/v1/storage/rig/:rigId/:key',
      method: 'GET',
      summary: 'Rig-spezifische Konfiguration abrufen',
      requiredScope: 'storage:rig'
    },
    {
      path: '/api/v1/storage/rig/:rigId/:key',
      method: 'POST',
      summary: 'Rig-spezifische Konfiguration speichern (Nur Eigentümer oder Admin)',
      parameters: { value: 'any (JSON serializable)' },
      requiredScope: 'storage:rig (Ownership enforced)'
    },
    {
      path: '/api/v1/storage/global/:key',
      method: 'GET',
      summary: 'Globale Plattform-Einstellung abrufen',
      requiredScope: 'storage:global (oder Admin)'
    },
    {
      path: '/api/v1/storage/global/:key',
      method: 'POST',
      summary: 'Globale PlayRig Plattform-Einstellungen speichern',
      parameters: { value: 'any (JSON serializable)' },
      requiredScope: 'storage:global (Admin only)'
    },
    // Services
    {
      path: '/api/v1/services',
      method: 'GET',
      summary: 'Registrierte Companion Services auflisten',
      requiredScope: 'none'
    },
    {
      path: '/api/v1/services/:id/status',
      method: 'GET',
      summary: 'Status und Diagnose eines Companion Services abrufen',
      requiredScope: 'none'
    }
  ]
};

// GET /api/v1/docs - Returns specification object
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: API_SPEC,
    meta: {
      version: 'v1.0.0',
      timestamp: new Date().toISOString()
    }
  });
});

// GET /api/v1/docs/list - Lists all available documentation handbooks
router.get('/list', (req, res) => {
  res.json({
    success: true,
    data: AVAILABLE_DOCS
  });
});

// GET /api/v1/docs/file/:id - Returns markdown text content of a documentation file
router.get('/file/:id', (req, res) => {
  const docMeta = AVAILABLE_DOCS.find(d => d.id === req.params.id);
  if (!docMeta) {
    return res.status(404).json({
      success: false,
      error: { code: 'DOC_NOT_FOUND', message: `Dokumentation '${req.params.id}' nicht gefunden.` }
    });
  }

  const filePath = path.resolve(DOCS_DIR, docMeta.file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: { code: 'FILE_NOT_FOUND', message: `Datei '${docMeta.file}' nicht auf dem Server vorhanden.` }
    });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({
      success: true,
      data: {
        id: docMeta.id,
        title: docMeta.title,
        icon: docMeta.icon,
        category: docMeta.category,
        description: docMeta.description,
        filename: path.basename(filePath),
        content: content
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'READ_ERROR', message: err.message }
    });
  }
});

module.exports = router;
