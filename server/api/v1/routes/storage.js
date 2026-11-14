/**
 * PLAYRIG API v1 - CENTRAL STORAGE ENGINE
 * Manages user-specific, rig-specific, and global component settings.
 *
 * Author: Liath • Copyright: © GameChiller
 */

const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/v1/storage/user/:key
router.get('/user/:key', async (req, res) => {
  try {
    const userId = req.user?.id || 'guest';
    const entry = await db.getStorageEntry('user', req.params.key, userId);

    res.json({
      success: true,
      data: entry ? entry.data_value : null,
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
router.post('/user/:key', async (req, res) => {
  try {
    const userId = req.user?.id || 'guest';
    const { value } = req.body;
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
router.delete('/user/:key', async (req, res) => {
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

// GET /api/v1/storage/rig/:rigId/:key
router.get('/rig/:rigId/:key', async (req, res) => {
  try {
    const entry = await db.getStorageEntry('rig', req.params.key, null, req.params.rigId);
    res.json({
      success: true,
      data: entry ? entry.data_value : null,
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

// POST /api/v1/storage/rig/:rigId/:key
router.post('/rig/:rigId/:key', async (req, res) => {
  try {
    const { value } = req.body;
    await db.setStorageEntry('rig', req.params.key, value, null, req.params.rigId);
    res.json({
      success: true,
      data: { key: req.params.key, rigId: req.params.rigId, saved: true }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'STORAGE_WRITE_ERROR', message: err.message }
    });
  }
});

// GET /api/v1/storage/global/:key
router.get('/global/:key', async (req, res) => {
  try {
    const entry = await db.getStorageEntry('global', req.params.key);
    res.json({
      success: true,
      data: entry ? entry.data_value : null,
      meta: { key: req.params.key, scope: 'global' }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'STORAGE_READ_ERROR', message: err.message }
    });
  }
});

// POST /api/v1/storage/global/:key - Admin only
router.post('/global/:key', requireAdmin, async (req, res) => {
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
