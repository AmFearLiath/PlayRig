/**
 * PLAYRIG API v1 - RIGS REGISTRY & LIFECYCLE
 * Provides rig registration, spotlight screenshots, and standalone documentation.
 *
 * Author: Liath • Copyright: © GameChiller
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../../../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const ROOT_DIR = path.resolve(__dirname, '../../../..');

// Helper to locate Rig directory on disk
function getRigDir(rigPath) {
  if (!rigPath) return null;
  const full = path.join(ROOT_DIR, rigPath);
  if (fs.existsSync(full)) {
    return fs.statSync(full).isDirectory() ? full : path.dirname(full);
  }
  return null;
}

// Helper to get standalone Rig docs
function getStandaloneDocs(rig) {
  const dir = getRigDir(rig.path);
  if (dir) {
    const docsJsonPath = path.join(dir, 'docs.json');
    if (fs.existsSync(docsJsonPath)) {
      try {
        return JSON.parse(fs.readFileSync(docsJsonPath, 'utf8'));
      } catch (e) {}
    }

    const readmePath = path.join(dir, 'README.md');
    if (fs.existsSync(readmePath)) {
      return {
        id: rig.id,
        name: rig.title,
        version: rig.version,
        author: rig.author,
        format: 'markdown',
        content: fs.readFileSync(readmePath, 'utf8')
      };
    }
  }

  // Fallback metadata docs
  return {
    id: rig.id,
    name: rig.title,
    version: rig.version || 'v0.0.1',
    author: rig.author || 'Liath',
    copyright: rig.copyright || '© GameChiller',
    purpose: rig.description || 'Interaktives PlayRig Modul.',
    category: rig.category,
    subcategory: rig.subcategory,
    requiredPermissions: rig.permissions || ['rigs:read', 'storage:user'],
    notes: 'Eigenständiges PlayRig Modul. Vollständig kompatibel mit GameChiller Runtime.'
  };
}

// GET /api/v1/rigs - List registered rigs
router.get('/', async (req, res) => {
  try {
    const { category, subcategory, search, status } = req.query;
    let list = await db.getRigs(req.user?.role === 'admin' ? null : req.user);

    if (category && category !== 'all') {
      list = list.filter(r => r.category.toLowerCase() === category.toLowerCase());
    }
    if (subcategory) {
      list = list.filter(r => r.subcategory.toLowerCase() === subcategory.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.title.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        r.id.toLowerCase().includes(q)
      );
    }
    if (status) {
      list = list.filter(r => r.status === status);
    }

    // Attach spotlight screenshot URL and standalone docs availability
    const enriched = list.map(rig => {
      const dir = getRigDir(rig.path);
      const hasDocs = dir ? fs.existsSync(path.join(dir, 'docs.json')) : false;
      const screenshotUrl = rig.screenshot || rig.thumbnail || (dir && fs.existsSync(path.join(dir, 'thumbnail.png')) ? `/${rig.path}/thumbnail.png` : null);

      return {
        ...rig,
        screenshot: screenshotUrl,
        hasStandaloneDocs: hasDocs,
        minRuntimeVersion: rig.min_runtime_version || 'v1.0.0'
      };
    });

    res.json({
      success: true,
      data: enriched,
      meta: {
        total: enriched.length,
        version: 'v1.0.0',
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: err.message }
    });
  }
});

// GET /api/v1/rigs/:id - Detailed Rig manifest
router.get('/:id', async (req, res) => {
  try {
    const rig = await db.getRigById(req.params.id);
    if (!rig) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Rig '${req.params.id}' nicht gefunden.` }
      });
    }

    const dir = getRigDir(rig.path);
    const docs = getStandaloneDocs(rig);
    const screenshotUrl = rig.screenshot || rig.thumbnail || (dir && fs.existsSync(path.join(dir, 'thumbnail.png')) ? `/${rig.path}/thumbnail.png` : null);

    res.json({
      success: true,
      data: {
        ...rig,
        screenshot: screenshotUrl,
        standaloneDocs: docs
      },
      meta: { version: 'v1.0.0', timestamp: new Date().toISOString() }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
});

// GET /api/v1/rigs/:id/docs - Standalone Rig Documentation
router.get('/:id/docs', async (req, res) => {
  try {
    const rig = await db.getRigById(req.params.id);
    if (!rig) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Rig '${req.params.id}' nicht gefunden.` }
      });
    }

    const docs = getStandaloneDocs(rig);
    res.json({
      success: true,
      data: docs,
      meta: {
        rigId: rig.id,
        version: rig.version || 'v0.0.1',
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'DOCS_FETCH_ERROR', message: err.message }
    });
  }
});

// GET /api/v1/rigs/:id/screenshot - Rig Spotlight Screenshot
router.get('/:id/screenshot', async (req, res) => {
  try {
    const rig = await db.getRigById(req.params.id);
    if (!rig) {
      return res.status(404).send('Rig not found');
    }

    const dir = getRigDir(rig.path);
    let imgPath = null;

    if (rig.screenshot && fs.existsSync(path.join(ROOT_DIR, rig.screenshot))) {
      imgPath = path.join(ROOT_DIR, rig.screenshot);
    } else if (dir) {
      const candidates = ['screenshot.png', 'thumbnail.png', 'preview.png'];
      for (const c of candidates) {
        if (fs.existsSync(path.join(dir, c))) {
          imgPath = path.join(dir, c);
          break;
        }
      }
    }

    if (imgPath) {
      res.setHeader('Content-Type', 'image/png');
      res.sendFile(imgPath);
    } else {
      // Default SVG placeholder
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(`
        <svg xmlns="http://www.w3.org/2000/svg" width="600" height="360" viewBox="0 0 600 360">
          <rect width="600" height="360" fill="#0f172a"/>
          <text x="50%" y="45%" text-anchor="middle" fill="#00f0ff" font-family="sans-serif" font-size="22" font-weight="bold">${rig.title}</text>
          <text x="50%" y="58%" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="14">Spotlight Vorschau • GameChiller PlayRig</text>
        </svg>
      `);
    }
  } catch (err) {
    res.status(500).send('Screenshot error');
  }
});

// POST /api/v1/rigs - Register / Create Rig
router.post('/', requireAuth, async (req, res) => {
  try {
    const newRig = await db.createRig(req.body, req.user);
    res.status(201).json({
      success: true,
      data: newRig,
      meta: { version: 'v1.0.0', timestamp: new Date().toISOString() }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: err.message }
    });
  }
});

// PATCH /api/v1/rigs/:id/status - Update Rig status (Admin or Author)
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const rig = await db.getRigById(req.params.id);
    if (!rig) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Rig nicht gefunden' } });
    }

    if (req.user.role !== 'admin' && rig.author !== req.user.username) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Keine Berechtigung' } });
    }

    const updated = await db.updateRigStatus(req.params.id, status);
    res.json({
      success: true,
      data: updated,
      meta: { version: 'v1.0.0', timestamp: new Date().toISOString() }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: err.message }
    });
  }
});

// POST /api/v1/rigs/:id/screenshot - Upload Spotlight Screenshot
router.post('/:id/screenshot', requireAuth, async (req, res) => {
  try {
    const { dataUrl } = req.body;
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_IMAGE', message: 'Ungültiges Base64 Bilddaten-Format.' }
      });
    }

    const rig = await db.getRigById(req.params.id);
    if (!rig) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Rig nicht gefunden.' } });
    }

    const dir = getRigDir(rig.path);
    if (!dir) {
      return res.status(500).json({ success: false, error: { code: 'DIR_NOT_FOUND', message: 'Rig-Verzeichnis nicht gefunden.' } });
    }

    // Save screenshot as screenshot.png in the rig directory
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const targetFile = path.join(dir, 'screenshot.png');
    fs.writeFileSync(targetFile, buffer);

    const relPath = path.relative(ROOT_DIR, targetFile).replace(/\\/g, '/');
    const updated = await db.updateRigScreenshot(rig.id, relPath);

    res.json({
      success: true,
      data: {
        rigId: rig.id,
        screenshot: `/${relPath}`,
        message: 'Spotlight-Screenshot erfolgreich gespeichert.'
      },
      meta: { version: 'v1.0.0', timestamp: new Date().toISOString() }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'SAVE_FAILED', message: err.message }
    });
  }
});

module.exports = router;
