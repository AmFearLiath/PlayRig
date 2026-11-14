/**
 * PLAYRIG API v1 - GITHUB & SYSTEM UPDATER ROUTES
 * REST Endpoints for system synchronization and rig branch publishing.
 *
 * Author: Liath • Copyright: © GameChiller
 */

const express = require('express');
const router = express.Router();
const updater = require('../../../updater');
const db = require('../../../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/v1/updater/status - Check if updates are available
router.get('/status', async (req, res) => {
  try {
    const force = req.query.force === 'true' || req.query.force === '1';
    const status = await updater.checkStatus({ force });
    res.json({
      success: true,
      data: status,
      meta: { version: 'v1.0.0', timestamp: new Date().toISOString() }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_CHECK_ERROR', message: err.message }
    });
  }
});

// POST /api/v1/updater/check - Force check against GitHub
router.post('/check', async (req, res) => {
  try {
    const status = await updater.checkStatus({ force: true });
    res.json({
      success: true,
      data: status,
      meta: { version: 'v1.0.0', timestamp: new Date().toISOString() }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_CHECK_ERROR', message: err.message }
    });
  }
});

// POST /api/v1/updater/apply - Apply Git pull & database re-sync (Admin only)
router.post('/apply', requireAdmin, async (req, res) => {
  try {
    const result = await updater.applyUpdate({ db });

    await db.logAudit?.(
      req.user.id,
      req.user.username,
      'SYSTEM_UPDATE_APPLIED',
      `System erfolgreich auf GitHub Stand ${result.status.local.hash} aktualisiert.`
    );

    res.json({
      success: true,
      data: result,
      meta: { version: 'v1.0.0', timestamp: new Date().toISOString() }
    });
  } catch (err) {
    await db.logAudit?.(
      req.user.id,
      req.user.username,
      'SYSTEM_UPDATE_FAILED',
      `Fehler bei System-Aktualisierung: ${err.message}`
    );

    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_APPLY_ERROR', message: err.message }
    });
  }
});

// POST /api/v1/updater/push-rig - Push specific Rig to a dedicated GitHub branch
router.post('/push-rig', requireAuth, async (req, res) => {
  try {
    const { rigId, branchName, commitMessage } = req.body;
    if (!rigId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_RIG_ID', message: 'Keine Rig-ID angegeben.' }
      });
    }

    const result = await updater.pushRigToBranch({
      rigId,
      branchName,
      commitMessage,
      user: req.user,
      db
    });

    await db.logAudit?.(
      req.user.id,
      req.user.username,
      'RIG_PUSHED_TO_BRANCH',
      `Rig '${rigId}' erfolgreich in Branch '${result.branch}' zu GitHub gepusht.`
    );

    res.json({
      success: true,
      data: result,
      meta: { version: 'v1.0.0', timestamp: new Date().toISOString() }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'RIG_PUSH_ERROR', message: err.message }
    });
  }
});

module.exports = router;
