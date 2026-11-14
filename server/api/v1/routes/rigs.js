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
const JSZip = require('jszip');
const db = require('../../../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const RigSecurityScanner = require('../../../security-scanner');

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

// Helper to extract ZIP buffer into file map
async function extractZipEntries(zipBuffer) {
  const zip = await JSZip.loadAsync(zipBuffer);
  const files = {};
  for (const filename of Object.keys(zip.files)) {
    const entry = zip.files[filename];
    if (entry.dir) continue;
    // Safe relative normalized path
    const safePath = filename.replace(/\\/g, '/').replace(/^\/+/, '');
    files[safePath] = await entry.async('nodebuffer');
  }
  return files;
}

// POST /api/v1/rigs/validate-zip - Inspect & Scan ZIP archive without saving
router.post('/validate-zip', async (req, res) => {
  try {
    const { zipBase64 } = req.body;
    if (!zipBase64) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PAYLOAD', message: 'Kein ZIP-Archiv übermittelt (zipBase64 erforderlich).' }
      });
    }

    const cleanBase64 = zipBase64.replace(/^data:application\/(?:zip|x-zip-compressed);base64,/, '').trim();
    const zipBuffer = Buffer.from(cleanBase64, 'base64');
    const zipFiles = await extractZipEntries(zipBuffer);
    const scanReport = RigSecurityScanner.scanProject(zipFiles);

    res.json({
      success: true,
      data: {
        report: scanReport,
        fileCount: Object.keys(zipFiles).length
      },
      meta: { version: 'v1.0.0', timestamp: new Date().toISOString() }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: { code: 'ZIP_PARSE_ERROR', message: 'Das ZIP-Archiv konnte nicht gelesen werden: ' + err.message }
    });
  }
});

// POST /api/v1/rigs/import-zip - Authenticated Import of complete ZIP project
router.post('/import-zip', requireAuth, async (req, res) => {
  try {
    const { zipBase64, title, category, subcategory, author, copyright } = req.body;
    if (!zipBase64) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PAYLOAD', message: 'Kein ZIP-Archiv übermittelt.' }
      });
    }

    const cleanBase64 = zipBase64.replace(/^data:application\/(?:zip|x-zip-compressed);base64,/, '').trim();
    const zipBuffer = Buffer.from(cleanBase64, 'base64');
    const zipFiles = await extractZipEntries(zipBuffer);

    // Deep Security & Validity Inspection
    const scanReport = RigSecurityScanner.scanProject(zipFiles);
    if (!scanReport.valid) {
      await db.logAudit?.(
        req.user.id,
        req.user.username,
        'RIG_IMPORT_SECURITY_BLOCK',
        `ZIP-Import wegen Sicherheitsverletzungen abgewiesen (Score: ${scanReport.score})`
      );

      return res.status(400).json({
        success: false,
        error: {
          code: 'SECURITY_SCAN_FAILED',
          message: 'Das ZIP-Projekt hat die Sicherheits- und Validitätsprüfung nicht bestanden.',
          score: scanReport.score,
          issues: scanReport.issues
        }
      });
    }

    // Determine Metadata & Hierarchy
    const targetTitle = title || scanReport.metadata.title || 'Importiertes Rig';
    const targetCat = category || scanReport.metadata.category || 'creative';
    const targetSubcat = subcategory || scanReport.metadata.subcategory || 'Imported';
    
    const importAuthor = author || scanReport.metadata.author || (req.user ? (req.user.name || req.user.username) : 'Community Creator');
    const isLiath = importAuthor.toLowerCase() === 'liath' || (req.user && (req.user.username === 'creator' || req.user.name === 'Liath'));
    const importCopyright = copyright || scanReport.metadata.copyright || (isLiath ? '© GameChiller' : `© ${importAuthor}`);

    const baseSlug = targetTitle.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    const rigSlug = 'rig-' + baseSlug.substring(0, 32) + '-' + Date.now().toString(36).slice(-4);
    const relRigDir = path.join('rigs', targetCat, targetSubcat, rigSlug).replace(/\\/g, '/');
    const targetDir = path.join(ROOT_DIR, relRigDir);

    // Unzip safe files into directory
    fs.mkdirSync(targetDir, { recursive: true });

    // Determine entry point directory prefix if zip wrapped in root folder
    let prefixToRemove = '';
    if (scanReport.entryFile && scanReport.entryFile.includes('/')) {
      const parts = scanReport.entryFile.split('/');
      parts.pop(); // remove index.html
      prefixToRemove = parts.join('/') + '/';
    }

    for (const [relPath, buffer] of Object.entries(zipFiles)) {
      let finalRelPath = relPath;
      if (prefixToRemove && finalRelPath.startsWith(prefixToRemove)) {
        finalRelPath = finalRelPath.substring(prefixToRemove.length);
      }
      if (!finalRelPath) continue;

      const destPath = path.join(targetDir, finalRelPath);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, buffer);
    }

    // Ready-to-Run Enhancement: Ensure index.html connects to PlayRig Bridge and tokens
    const indexHtmlPath = path.join(targetDir, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      let html = fs.readFileSync(indexHtmlPath, 'utf8');

      // Relative path to _shared
      const depth = relRigDir.split('/').length;
      const sharedRel = '../'.repeat(depth) + '_shared';

      let modified = false;

      // Inject Tokens & CSS if missing
      if (!html.includes('tokens.css')) {
        const cssTags = `
  <!-- PlayRig Tokens & Themes -->
  <link rel="stylesheet" href="${sharedRel}/css/tokens.css">
  <link rel="stylesheet" href="${sharedRel}/css/themes.css">
  <link rel="stylesheet" href="${sharedRel}/css/base.css">
  <link rel="stylesheet" href="${sharedRel}/css/components.css">
  <link rel="stylesheet" href="${sharedRel}/css/animations.css">`;
        if (html.includes('</head>')) {
          html = html.replace('</head>', `${cssTags}\n</head>`);
          modified = true;
        }
      }

      // Inject PlayRig Bridge if missing
      if (!html.includes('playrig-bridge.js') && !html.includes('embed-bridge.js')) {
        const jsTags = `
  <!-- PlayRig Runtime Bridge -->
  <script src="${sharedRel}/js/toast.js"></script>
  <script src="${sharedRel}/js/playrig-bridge.js"></script>`;
        if (html.includes('</body>')) {
          html = html.replace('</body>', `${jsTags}\n</body>`);
          modified = true;
        } else {
          html += jsTags;
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(indexHtmlPath, html, 'utf8');
      }
    }

    // Ensure docs.json exists
    const docsJsonPath = path.join(targetDir, 'docs.json');
    if (!fs.existsSync(docsJsonPath)) {
      const docsManifest = {
        "$schema": "https://playrig.gamechiller.de/schemas/rig-docs-v1.json",
        "id": rigSlug,
        "name": targetTitle,
        "version": scanReport.metadata.version || "v1.0.0",
        "author": importAuthor,
        "copyright": importCopyright,
        "overview": `Vollständig importiertes Projekt (${scanReport.filesScanned} Dateien). Erfolgreich auf Schadcode und Backdoors geprüft.`,
        "features": [
          "Importiertes vollwertiges Web-Rig",
          "Automatisches PlayRig Bridge Binding",
          "Sofort lauffähig im Deck & Studio"
        ],
        "permissions": ["rigs:read", "storage:user"],
        "security": {
          "score": scanReport.score,
          "inspectedAt": new Date().toISOString(),
          "status": scanReport.status
        }
      };
      fs.writeFileSync(docsJsonPath, JSON.stringify(docsManifest, null, 2), 'utf8');
    }

    // Register Rig in Database
    const newRig = await db.createRig({
      id: rigSlug,
      title: targetTitle,
      description: `Importiertes ZIP-Projekt mit ${scanReport.filesScanned} Dateien. Sicherheitsprüfung: Status ${scanReport.status.toUpperCase()} (Score: ${scanReport.score}/100).`,
      category: targetCat,
      subcategory: targetSubcat,
      path: `${relRigDir}/index.html`,
      version: scanReport.metadata.version || 'v1.0.0',
      author: importAuthor,
      copyright: importCopyright,
      icon: 'archive',
      color: '#00f0ff',
      tags: ['ZIP-Import', targetCat, 'Verified'],
      status: 'active',
      access: 'public',
      settings: {
        imported: true,
        importSource: 'zip-upload',
        securityScore: scanReport.score,
        filesCount: scanReport.filesScanned
      }
    }, req.user);

    await db.logAudit?.(
      req.user.id,
      req.user.username,
      'RIG_ZIP_IMPORT_SUCCESS',
      `Rig '${targetTitle}' (${rigSlug}) erfolgreich aus ZIP importiert (Score: ${scanReport.score})`
    );

    res.status(201).json({
      success: true,
      data: {
        rig: newRig,
        report: scanReport,
        directUrl: `/${newRig.path}`,
        studioUrl: `/studio`
      },
      meta: { version: 'v1.0.0', timestamp: new Date().toISOString() }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'IMPORT_EXECUTION_ERROR', message: 'Fehler beim Entpacken und Importieren: ' + err.message }
    });
  }
});

module.exports = router;
