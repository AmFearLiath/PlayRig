/**
 * PLAYRIG API v1 - CENTRAL STORAGE ENGINE (SECURED)
 * Manages user-specific, rig-specific, and global component settings.
 *
 * Security:
 * - Serverseitige Eigentümer- & Berechtigungsprüfung
 * - Validierung von Keys und IDs gegen Path-Traversal / Injection
 * - Strikte Mandantentrennung (User, Rig, Global)
 * - Nachvollziehbare Audit-Protokollierung bei Zugriffsverletzungen
 *
 * Author: Liath • Copyright: © GameChiller
 */

const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { requireAuth, requireAdmin, requireScope } = require('../middleware/auth');

const VALID_ID_REGEX = /^[a-zA-Z0-9_.-]{1,128}$/;

function validateKeyAndId(req, res, next) {
  const { key, rigId, userId } = req.params;
  if (key && !VALID_ID_REGEX.test(key)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_STORAGE_KEY', message: 'Ungültiger Storage-Key. Nur a-z, 0-9, _, -, . erlaubt (max. 128 Zeichen).' }
    });
  }
  if (rigId && !VALID_ID_REGEX.test(rigId)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_RIG_ID', message: 'Ungültige Rig-ID.' }
    });
  }
  if (userId && !VALID_ID_REGEX.test(userId)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_USER_ID', message: 'Ungültige Benutzer-ID.' }
    });
  }
  next();
}

// ============================================================================
// USER-SCOPED STORAGE
// ============================================================================

// GET /api/v1/storage/user/:key
router.get('/user/:key', validateKeyAndId, async (req, res) => {
  try {
    const userId = req.user?.id || 'guest';
    const entry = await db.getStorageEntry('user', req.params.key, userId);

    let parsed = null;
    if (entry && entry.data_value !== undefined) {
      try {
        parsed = typeof entry.data_value === 'string' ? JSON.parse(entry.data_value) : entry.data_value;
      } catch (e) {
        parsed = entry.data_value;
      }
    }

    res.json({
      success: true,
      data: parsed,
      meta: {
        key: req.params.key,
        scope: 'user',
        userId: userId,
        updatedAt: entry ? entry.updated_at : null,
        version: 'v1.0.0'
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'STORAGE_READ_ERROR', message: err.message }
    });
  }
});

// POST /api/v1/storage/user/:key
router.post('/user/:key', validateKeyAndId, async (req, res) => {
  try {
    const userId = req.user?.id || 'guest';
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_VALUE', message: 'Kein Speicherwert im Request-Body übergeben.' }
      });
    }

    // Quota guard: Max 5MB per value payload
    const valString = JSON.stringify(value);
    if (valString.length > 5 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'Speicherwert überschreitet das Limit von 5 MB.' }
      });
    }

    await db.setStorageEntry('user', req.params.key, value, userId);

    res.json({
      success: true,
      data: { key: req.params.key, saved: true },
      meta: { scope: 'user', userId, version: 'v1.0.0', timestamp: new Date().toISOString() }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'STORAGE_WRITE_ERROR', message: err.message }
    });
  }
});

// DELETE /api/v1/storage/user/:key
router.delete('/user/:key', validateKeyAndId, async (req, res) => {
  try {
    const userId = req.user?.id || 'guest';
    await db.deleteStorageEntry('user', req.params.key, userId);
    res.json({
      success: true,
      data: { key: req.params.key, deleted: true }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'STORAGE_DELETE_ERROR', message: err.message }
    });
  }
});

// ============================================================================
// RIG-SCOPED STORAGE (Gated by Rig Ownership / Creator Permissions)
// ============================================================================

// GET /api/v1/storage/rig/:rigId/:key
router.get('/rig/:rigId/:key', validateKeyAndId, async (req, res) => {
  try {
    const entry = await db.getStorageEntry('rig', req.params.key, null, req.params.rigId);
    let parsed = null;
    if (entry && entry.data_value !== undefined) {
      try {
        parsed = typeof entry.data_value === 'string' ? JSON.parse(entry.data_value) : entry.data_value;
      } catch (e) {
        parsed = entry.data_value;
      }
    }

    res.json({
      success: true,
      data: parsed,
      meta: {
        key: req.params.key,
        scope: 'rig',
        rigId: req.params.rigId,
        updatedAt: entry ? entry.updated_at : null
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'STORAGE_READ_ERROR', message: err.message }
    });
  }
});

// POST /api/v1/storage/rig/:rigId/:key (Authenticated & Ownership Verified)
router.post('/rig/:rigId/:key', validateKeyAndId, requireAuth, async (req, res) => {
  try {
    const { rigId, key } = req.params;
    const { value } = req.body;

    const rig = await db.getRigById(rigId);
    if (!rig) {
      return res.status(404).json({
        success: false,
        error: { code: 'RIG_NOT_FOUND', message: `Rig '${rigId}' existiert nicht.` }
      });
    }

    // Ownership Verification
    const isAdmin = req.user.role === 'admin';
    const isOwner = (rig.original_author === req.user.username) ||
                    (rig.author === req.user.name) ||
                    (rig.author === req.user.username);

    if (!isAdmin && !isOwner) {
      await db.logAudit?.(
        req.user.id,
        req.user.username,
        'SECURITY_STORAGE_VIOLATION',
        `Unberechtigter Schreibversuch auf Rig-Storage '${rigId}/${key}'`
      );

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_RIG_STORAGE',
          message: 'Zugriff verweigert. Du bist weder Eigentümer noch Administrator dieses Rigs.'
        }
      });
    }

    await db.setStorageEntry('rig', key, value, null, rigId);
    res.json({
      success: true,
      data: { key, rigId, saved: true }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'STORAGE_WRITE_ERROR', message: err.message }
    });
  }
});

// DELETE /api/v1/storage/rig/:rigId/:key
router.delete('/rig/:rigId/:key', validateKeyAndId, requireAuth, async (req, res) => {
  try {
    const { rigId, key } = req.params;
    const rig = await db.getRigById(rigId);
    if (!rig) {
      return res.status(404).json({
        success: false,
        error: { code: 'RIG_NOT_FOUND', message: `Rig '${rigId}' existiert nicht.` }
      });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = (rig.original_author === req.user.username) || (rig.author === req.user.name);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Nur Eigentümer oder Administratoren dürfen Rig-Storage löschen.' }
      });
    }

    await db.deleteStorageEntry('rig', key, null, rigId);
    res.json({
      success: true,
      data: { key, rigId, deleted: true }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'STORAGE_DELETE_ERROR', message: err.message }
    });
  }
});

// ============================================================================
// GLOBAL-SCOPED STORAGE (Admin & System only)
// ============================================================================

// GET /api/v1/storage/global/:key
router.get('/global/:key', validateKeyAndId, async (req, res) => {
  try {
    const entry = await db.getStorageEntry('global', req.params.key);
    let parsed = null;
    if (entry && entry.data_value !== undefined) {
      try {
        parsed = typeof entry.data_value === 'string' ? JSON.parse(entry.data_value) : entry.data_value;
      } catch (e) {
        parsed = entry.data_value;
      }
    }

    res.json({
      success: true,
      data: parsed,
      meta: { key: req.params.key, scope: 'global' }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'STORAGE_READ_ERROR', message: err.message }
    });
  }
});

// POST /api/v1/storage/global/:key - Strictly Administrator only
router.post('/global/:key', validateKeyAndId, requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    await db.setStorageEntry('global', req.params.key, value);
    res.json({
      success: true,
      data: { key: req.params.key, saved: true, scope: 'global' }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'STORAGE_WRITE_ERROR', message: err.message }
    });
  }
});

module.exports = router;
