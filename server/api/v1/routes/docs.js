/**
 * PLAYRIG API v1 - SPECIFICATION & ENDPOINT DOCUMENTATION
 * Full technical schema of all versioned API endpoints for GameChiller.
 *
 * Author: Liath • Copyright: © GameChiller
 */

const express = require('express');
const router = express.Router();

const API_SPEC = {
  title: 'PlayRig Integration API',
  version: 'v1.0.0',
  description: 'Zentrale, sichere und versionierte Schnittstelle für GameChiller Plattform-Komponenten, Rigs und externe Dienste.',
  baseUrl: '/api/v1',
  author: 'Liath',
  copyright: '© GameChiller',
  auth: {
    type: 'Bearer Token (Session Token) oder API Key',
    header: 'Authorization: Bearer <token>',
    guestAccess: 'Unterstützt (eingeschränkte Scopes)'
  },
  roles: {
    admin: 'Vollzugriff auf alle Rigs, Services, Speicherbereiche und Benutzerverwaltung.',
    creator: 'Erstellung, Bearbeitung und Verwaltung eigener Rigs sowie Zugriff auf User- und Rig-Speicher.',
    user: 'Ausführung freigegebener Rigs und Zugriff auf eigenen Benutzerspeicher.',
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
      response: {
        success: 'true',
        data: {
          user: 'object',
          community: { id: 'string', name: 'string', slug: 'string' },
          server: { id: 'string', name: 'string', status: 'string' },
          permissions: 'array'
        }
      }
    },
    {
      path: '/api/v1/auth/login',
      method: 'POST',
      summary: 'Benutzer anmelden und Session-Token anfordern',
      parameters: { username: 'string (required)', password: 'string (required)' }
    },
    {
      path: '/api/v1/auth/register',
      method: 'POST',
      summary: 'Neuen GameChiller Benutzer registrieren',
      parameters: { username: 'string (required)', password: 'string (required)', displayName: 'string' }
    },
    // Rigs & Catalog
    {
      path: '/api/v1/rigs',
      method: 'GET',
      summary: 'Verfügbare Rigs mit Spotlight-Screenshot-URLs und Metadaten auflisten',
      parameters: { category: 'string', subcategory: 'string', search: 'string', status: 'string' },
      requiredScope: 'rigs:read'
    },
    {
      path: '/api/v1/rigs/:id',
      method: 'GET',
      summary: 'Vollständiges Manifest und Details eines Rigs abrufen',
      requiredScope: 'rigs:read'
    },
    {
      path: '/api/v1/rigs/:id/docs',
      method: 'GET',
      summary: 'Eigenständige Dokumentation und Bedienungsanleitung des Rigs abrufen',
      requiredScope: 'rigs:read'
    },
    {
      path: '/api/v1/rigs/:id/screenshot',
      method: 'GET',
      summary: 'Spotlight-Screenshot des Rigs als Bild abrufen',
      requiredScope: 'none'
    },
    {
      path: '/api/v1/rigs/:id/screenshot',
      method: 'POST',
      summary: 'Neuen Spotlight-Screenshot für ein Rig hochladen',
      parameters: { dataUrl: 'string (Base64 PNG)' },
      requiredScope: 'rigs:write'
    },
    {
      path: '/api/v1/rigs/:id/status',
      method: 'PATCH',
      summary: 'Status eines Rigs anpassen (active, pending, disabled)',
      parameters: { status: 'string (active|pending|wip|deprecated)' },
      requiredScope: 'rigs:admin'
    },
    // Storage Engine
    {
      path: '/api/v1/storage/user/:key',
      method: 'GET',
      summary: 'Benutzerspezifische Daten oder Einstellungen abrufen',
      requiredScope: 'storage:user'
    },
    {
      path: '/api/v1/storage/user/:key',
      method: 'POST',
      summary: 'Benutzerspezifische Daten oder Einstellungen speichern',
      parameters: { value: 'any (JSON serializable)' },
      requiredScope: 'storage:user'
    },
    {
      path: '/api/v1/storage/rig/:rigId/:key',
      method: 'GET',
      summary: 'Rig-spezifische Konfigurationsdaten abrufen',
      requiredScope: 'storage:rig'
    },
    {
      path: '/api/v1/storage/rig/:rigId/:key',
      method: 'POST',
      summary: 'Rig-spezifische Konfigurationsdaten speichern',
      parameters: { value: 'any (JSON serializable)' },
      requiredScope: 'storage:rig'
    },
    {
      path: '/api/v1/storage/global/:key',
      method: 'GET',
      summary: 'Globale PlayRig Plattform-Einstellungen abrufen',
      requiredScope: 'none'
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

module.exports = router;
