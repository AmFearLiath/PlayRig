const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const JSZip = require('jszip');
const db = require('./db');
const { ensurePortAvailable } = require('./port-helper');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, '..');

// Body Parsers
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Auth Token Extractor Middleware
app.use(async (req, res, next) => {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      req.user = await db.getUserByToken(token);
      req.token = token;
    } catch (e) {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
});

// Require Auth Middleware
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Nicht authentifiziert. Bitte einloggen.' });
  }
  next();
}

// Require Admin Middleware
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Zugriff verweigert. Administrator-Rechte erforderlich.' });
  }
  next();
}

// Robust Rig Directory Resolver
function resolveRigDirectory(rigPath) {
  if (!rigPath) return null;
  const normalized = rigPath.replace(/\\/g, '/');

  // Candidate 1: directly as given
  const full1 = path.join(ROOT_DIR, normalized);
  if (fs.existsSync(full1)) {
    return fs.statSync(full1).isDirectory() ? full1 : path.dirname(full1);
  }

  // Candidate 2: directory name of path
  const full2 = path.join(ROOT_DIR, path.dirname(normalized));
  if (fs.existsSync(full2) && fs.statSync(full2).isDirectory()) {
    return full2;
  }

  // Candidate 3: stripped 'projects/'
  if (normalized.startsWith('projects/')) {
    const stripped = normalized.replace(/^projects\//, '');
    const full3 = path.join(ROOT_DIR, stripped);
    if (fs.existsSync(full3)) {
      return fs.statSync(full3).isDirectory() ? full3 : path.dirname(full3);
    }
    const full4 = path.join(ROOT_DIR, path.dirname(stripped));
    if (fs.existsSync(full4) && fs.statSync(full4).isDirectory()) {
      return full4;
    }
  }

  // Candidate 4: prepend 'projects/'
  const full5 = path.join(ROOT_DIR, 'projects', normalized);
  if (fs.existsSync(full5)) {
    return fs.statSync(full5).isDirectory() ? full5 : path.dirname(full5);
  }

  return null;
}

// ==========================================
// API ROUTES
// ==========================================

// Health & Metrics
app.get('/api/health', async (req, res) => {
  try {
    const rigs = await db.getRigs();
    res.json({
      status: 'online',
      system: 'PlayRig Engine',
      version: '1.0.0',
      database: 'MySQL (Port 3307)',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      rigsCount: rigs.length,
      memoryUsage: process.memoryUsage(),
      platform: os.platform(),
      nodeVersion: process.version
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Benutzername und Passwort sind erforderlich' });
  }

  try {
    const result = await db.authenticate(username, password);
    if (!result) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler: ' + err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
  }

  try {
    const user = await db.registerUser(username, displayName || username, password, 'creator');
    const auth = await db.authenticate(username, password);
    res.status(201).json(auth);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  res.json({ user: req.user });
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  try {
    await db.logout(req.token);
    res.json({ success: true, message: 'Erfolgreich abgemeldet' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function mapRigToLegacy(rig) {
  if (!rig) return null;
  return {
    ...rig,
    isPublic: rig.access === 'public',
    ownerId: rig.author,
    techStack: rig.tags || []
  };
}

// Rigs Routes
async function handleGetRigs(req, res) {
  try {
    const filters = {};
    if (!req.user || req.user.role !== 'admin') {
      filters.access = 'public';
    }
    if (req.query.category) filters.category = req.query.category;
    if (req.query.search) filters.search = req.query.search;
    if (req.query.author) filters.author = req.query.author;
    if (req.query.orderBy) filters.orderBy = req.query.orderBy;
    if (req.query.featured) filters.featured = req.query.featured === 'true' || req.query.featured === '1';

    let rigs = await db.getRigs(filters);

    // If logged in as creator, also include user's own private rigs
    if (req.user && req.user.role !== 'admin') {
      const myPrivateRigs = await db.getRigs({ author: req.user.name, access: 'private' });
      const ids = new Set(rigs.map(r => r.id));
      for (const pr of myPrivateRigs) {
        if (!ids.has(pr.id)) {
          rigs.push(pr);
        }
      }
    }

    res.json(rigs.map(mapRigToLegacy));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

app.get('/api/rigs', handleGetRigs);
app.get('/api/tools', handleGetRigs);

async function handleGetRigById(req, res) {
  try {
    const rig = await db.getRigById(req.params.id);
    if (!rig) {
      return res.status(404).json({ error: 'Rig nicht gefunden' });
    }
    const isOwner = req.user && (req.user.role === 'admin' || rig.author === req.user.name || rig.author === req.user.username);
    if (rig.access === 'private' && !isOwner) {
      return res.status(403).json({ error: 'Dieses Rig ist privat' });
    }
    await db.incrementRigStat(rig.id, 'views');
    res.json(mapRigToLegacy(rig));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

app.get('/api/rigs/:id', handleGetRigById);
app.get('/api/tools/:id', handleGetRigById);

// Create Rig
async function handleCreateRig(req, res) {
  try {
    const rigData = {
      title: req.body.title || 'Neues Rig',
      description: req.body.description || '',
      category: req.body.category || 'creative',
      subcategory: req.body.subcategory || 'General',
      version: req.body.version || 'v0.0.1',
      author: req.user ? (req.user.name || req.user.username) : (req.body.author || 'Liath'),
      copyright: '© GameChiller',
      icon: req.body.icon || 'cube',
      color: req.body.color || '#00d2ff',
      tags: req.body.tags || ['PlayRig', 'HTML5'],
      status: req.body.status || 'active',
      access: req.body.access || (req.body.isPublic ? 'public' : 'private'),
      settings: req.body.settings || { theme: 'cyber-cyan' }
    };

    const folderSlug = rigData.title.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    const relFolder = `${rigData.category}/${rigData.subcategory}/${folderSlug}`;
    rigData.path = `${relFolder}/index.html`;

    const newRig = await db.createRig(rigData, req.user);

    // Scaffold physical files
    const targetDir = path.join(ROOT_DIR, relFolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });

      const starterHtml = `<!DOCTYPE html>
<html lang="de" data-theme="${rigData.settings.theme || 'cyber-cyan'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${newRig.title} | PlayRig</title>
  
  <!-- PlayRig Tokens & Styles -->
  <link rel="stylesheet" href="../../../_shared/css/tokens.css">
  <link rel="stylesheet" href="../../../_shared/css/themes.css">
  <link rel="stylesheet" href="../../../_shared/css/base.css">
  <link rel="stylesheet" href="../../../_shared/css/components.css">
  <link rel="stylesheet" href="../../../_shared/css/animations.css">
  <link rel="stylesheet" href="./style.css">
</head>
<body class="fx-spotlight-active">
  <!-- PlayRig Standard Topbar -->
  <header style="height: 52px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; background: rgba(10, 15, 29, 0.85); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border-subtle); position: sticky; top: 0; z-index: 100;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <a href="/" target="_top" class="btn btn-ghost btn-sm" style="border: 1px solid var(--border-subtle); color: var(--text-secondary); text-decoration: none;">← PlayRig Deck</a>
      <span style="font-weight: 700; font-size: 1rem; color: #fff;">${newRig.title}</span>
      <span class="badge badge-cyan">${newRig.category}</span>
    </div>
    <div style="font-size: 0.75rem; color: var(--text-dim); font-family: var(--font-mono);">
      ${newRig.version || 'v0.0.1'} • © GameChiller • Author: ${newRig.author || 'Liath'}
    </div>
  </header>

  <div style="padding: 40px 24px; max-width: 1000px; margin: 0 auto;">
    <div class="glass-panel fx-beam" style="padding: 32px; border-radius: var(--radius-xl);">
      <h2 style="margin-top: 0; font-size: 1.8rem;"><span class="gradient-text">${newRig.title}</span></h2>
      <p style="color: var(--text-secondary); font-size: 1rem; margin-top: 8px;">${newRig.description || 'Bereit für deine neuen Ideen und Code.'}</p>
      
      <div style="margin-top: 24px; display: flex; gap: 12px;">
        <button id="btn-action" class="btn btn-primary fx-ripple">Interaktive Aktion starten</button>
      </div>
    </div>
  </div>

  <!-- PlayRig Core Scripts -->
  <script src="../../../_shared/js/toast.js"></script>
  <script src="../../../_shared/js/embed-bridge.js"></script>
  <script src="../../../_shared/js/fx-engine.js"></script>
  <script src="./app.js"></script>
</body>
</html>`;

      const starterCss = `/* PlayRig Stylesheet für ${newRig.title} */
body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background: var(--bg-canvas);
  color: var(--text-primary);
  font-family: var(--font-sans);
}
`;

      const starterJs = `// PlayRig Script für ${newRig.title}
// Author: ${newRig.author || 'Liath'} | Copyright: © GameChiller
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-action');
  if (btn) {
    btn.addEventListener('click', () => {
      if (window.PlayRigFX) window.PlayRigFX.triggerSparkle(btn);
      if (window.showToast) window.showToast('${newRig.title} läuft perfekt!', 'success');
    });
  }
});
`;

      fs.writeFileSync(path.join(targetDir, 'index.html'), starterHtml, 'utf8');
      fs.writeFileSync(path.join(targetDir, 'style.css'), starterCss, 'utf8');
      fs.writeFileSync(path.join(targetDir, 'app.js'), starterJs, 'utf8');
    }

    res.status(201).json(mapRigToLegacy(newRig));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

app.post('/api/rigs', requireAuth, handleCreateRig);
app.post('/api/tools', requireAuth, handleCreateRig);

// Update Rig
async function handleUpdateRig(req, res) {
  try {
    const updated = await db.updateRig(req.params.id, req.body, req.user);
    if (!updated) return res.status(404).json({ error: 'Rig nicht gefunden' });
    res.json(mapRigToLegacy(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

app.put('/api/rigs/:id', requireAuth, handleUpdateRig);
app.put('/api/tools/:id', requireAuth, handleUpdateRig);

// Delete Rig
async function handleDeleteRig(req, res) {
  try {
    const success = await db.deleteRig(req.params.id, req.user);
    if (!success) return res.status(404).json({ error: 'Rig nicht gefunden' });
    res.json({ success: true, message: 'Rig erfolgreich gelöscht' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

app.delete('/api/rigs/:id', requireAuth, handleDeleteRig);
app.delete('/api/tools/:id', requireAuth, handleDeleteRig);

// Rig-Importer
app.post('/api/rigs/import', requireAuth, async (req, res) => {
  try {
    const {
      source = 'codepen',
      url,
      title,
      html = '',
      css = '',
      js = '',
      cdns = [],
      category = 'creative',
      subcategory = 'Imported',
      theme = 'cyber-cyan'
    } = req.body;

    let importedTitle = title || 'Imported Rig';
    let importedHtml = html;
    let importedCss = css;
    let importedJs = js;
    let originalAuthor = 'External Creator';

    if (url && (url.includes('codepen.io') || source === 'codepen')) {
      const penMatch = url.match(/codepen\.io\/([^/]+)\/(?:pen|details|full)\/([^/?#]+)/i);
      if (penMatch) {
        const username = penMatch[1];
        const penId = penMatch[2];
        originalAuthor = username;
        if (!title) importedTitle = `CodePen ${penId} (@${username})`;

        try {
          const [resHtml, resCss, resJs] = await Promise.allSettled([
            fetch(`https://codepen.io/${username}/pen/${penId}.html`).then(r => r.ok ? r.text() : ''),
            fetch(`https://codepen.io/${username}/pen/${penId}.css`).then(r => r.ok ? r.text() : ''),
            fetch(`https://codepen.io/${username}/pen/${penId}.js`).then(r => r.ok ? r.text() : '')
          ]);

          if (resHtml.status === 'fulfilled' && resHtml.value) importedHtml = resHtml.value;
          if (resCss.status === 'fulfilled' && resCss.value) importedCss = resCss.value;
          if (resJs.status === 'fulfilled' && resJs.value) importedJs = resJs.value;
        } catch (fetchErr) {
          console.warn('Direct fetch failed, falling back to input body:', fetchErr.message);
        }
      }
    }

    const slug = 'rig-imp-' + Date.now().toString(36);
    const relFolder = `${category}/${subcategory}/${slug}`;
    const targetDir = path.join(ROOT_DIR, relFolder);

    const cdnArray = Array.isArray(cdns) ? cdns : (cdns ? cdns.split('\n').filter(Boolean) : []);
    const cdnTags = cdnArray
      .map(c => c.trim().endsWith('.css') ? `<link rel="stylesheet" href="${c.trim()}">` : `<script src="${c.trim()}"></script>`)
      .join('\n  ');

    let fullHtml = importedHtml.trim();
    if (!fullHtml.includes('<!DOCTYPE') && !fullHtml.includes('<html')) {
      fullHtml = `<!DOCTYPE html>
<html lang="de" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${importedTitle} | PlayRig</title>
  
  <link rel="stylesheet" href="../../../_shared/css/tokens.css">
  <link rel="stylesheet" href="../../../_shared/css/themes.css">
  <link rel="stylesheet" href="../../../_shared/css/base.css">
  <link rel="stylesheet" href="../../../_shared/css/components.css">
  <link rel="stylesheet" href="../../../_shared/css/animations.css">
  
  ${cdnTags}
  
  <link rel="stylesheet" href="./style.css">
</head>
<body class="fx-spotlight-active">
  <header style="height: 52px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; background: rgba(10, 15, 29, 0.85); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border-subtle); position: sticky; top: 0; z-index: 100;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <a href="/" target="_top" class="btn btn-ghost btn-sm" style="border: 1px solid var(--border-subtle); color: var(--text-secondary); text-decoration: none;">← PlayRig Deck</a>
      <span style="font-weight: 700; font-size: 1rem; color: #fff;">${importedTitle}</span>
      <span class="badge badge-indigo">Imported</span>
    </div>
    <div style="font-size: 0.75rem; color: var(--text-dim); font-family: var(--font-mono);">
      v0.0.1 • © GameChiller • Author: Liath (via @${originalAuthor})
    </div>
  </header>

  <main id="app-viewport" style="padding: 24px;">
${importedHtml}
  </main>

  <script src="../../../_shared/js/toast.js"></script>
  <script src="../../../_shared/js/embed-bridge.js"></script>
  <script src="../../../_shared/js/fx-engine.js"></script>
  <script src="./app.js"></script>
</body>
</html>`;
    }

    const newRig = await db.createRig({
      id: slug,
      title: importedTitle,
      description: `Importiert via Rig-Importer (@${originalAuthor}). Vollständig an das PlayRig-Ökosystem angebunden.`,
      category,
      subcategory,
      path: `${relFolder}/index.html`,
      version: 'v0.0.1',
      author: req.user ? (req.user.name || req.user.username) : 'Liath',
      copyright: '© GameChiller',
      icon: 'download',
      color: '#6366f1',
      tags: ['Imported', source, 'PlayRig'],
      status: 'active',
      access: 'private',
      settings: { theme, source, originalAuthor, cdns: cdnArray }
    }, req.user);

    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'index.html'), fullHtml, 'utf8');
    fs.writeFileSync(path.join(targetDir, 'style.css'), importedCss, 'utf8');
    fs.writeFileSync(path.join(targetDir, 'app.js'), importedJs, 'utf8');

    res.status(201).json(mapRigToLegacy(newRig));
  } catch (err) {
    res.status(400).json({ error: 'Import fehlgeschlagen: ' + err.message });
  }
});

app.post('/api/tools/import', requireAuth, (req, res) => {
  res.redirect(307, '/api/rigs/import');
});

// Fork (Clone) Rig
async function handleForkRig(req, res) {
  try {
    const sourceRig = await db.getRigById(req.params.id);
    if (!sourceRig) return res.status(404).json({ error: 'Quell-Rig nicht gefunden' });

    const forkedRig = await db.forkRig(req.params.id, req.user);

    const sourceDir = resolveRigDirectory(sourceRig.path);
    const targetDir = path.join(ROOT_DIR, path.dirname(forkedRig.path));

    if (sourceDir && fs.existsSync(sourceDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      const files = fs.readdirSync(sourceDir);
      for (const file of files) {
        const srcFile = path.join(sourceDir, file);
        const stat = fs.statSync(srcFile);
        if (stat.isFile()) {
          fs.copyFileSync(srcFile, path.join(targetDir, file));
        }
      }
    }

    res.status(201).json(mapRigToLegacy(forkedRig));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

app.post('/api/rigs/:id/fork', requireAuth, handleForkRig);
app.post('/api/tools/:id/fork', requireAuth, handleForkRig);

// Get Project Source Files for In-Page Editing
async function handleGetFiles(req, res) {
  try {
    const rig = await db.getRigById(req.params.id);
    if (!rig) return res.status(404).json({ error: 'Rig nicht gefunden' });

    const isOwner = req.user && (req.user.role === 'admin' || rig.author === req.user.name || rig.author === req.user.username);
    if (rig.access === 'private' && !isOwner) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    const rigDir = resolveRigDirectory(rig.path);
    if (!rigDir || !fs.existsSync(rigDir)) {
      return res.status(404).json({ error: `Rig-Verzeichnis '${rig.path}' nicht auf Festplatte gefunden` });
    }

    const filenames = fs.readdirSync(rigDir);
    const files = [];

    for (const name of filenames) {
      const fullPath = path.join(rigDir, name);
      const stat = fs.statSync(fullPath);
      if (stat.isFile() && (name.endsWith('.html') || name.endsWith('.css') || name.endsWith('.js') || name.endsWith('.json') || name.endsWith('.md'))) {
        files.push({
          name,
          content: fs.readFileSync(fullPath, 'utf8')
        });
      }
    }

    // If index.html is missing for any reason, scaffold fallback
    if (!files.some(f => f.name === 'index.html')) {
      const fallbackHtml = `<!DOCTYPE html>\n<html>\n<head>\n  <title>${rig.title}</title>\n</head>\n<body>\n  <h1>${rig.title}</h1>\n</body>\n</html>`;
      fs.writeFileSync(path.join(rigDir, 'index.html'), fallbackHtml, 'utf8');
      files.push({ name: 'index.html', content: fallbackHtml });
    }

    res.json({ rig: mapRigToLegacy(rig), tool: mapRigToLegacy(rig), files });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Lesen der Dateien: ' + err.message });
  }
}

app.get('/api/rigs/:id/files', requireAuth, handleGetFiles);
app.get('/api/tools/:id/files', requireAuth, handleGetFiles);

// Save Project Source Files
async function handleSaveFiles(req, res) {
  try {
    const rig = await db.getRigById(req.params.id);
    if (!rig) return res.status(404).json({ error: 'Rig nicht gefunden' });

    const isOwner = req.user && (req.user.role === 'admin' || rig.author === req.user.name || rig.author === req.user.username);
    if (!isOwner) {
      return res.status(403).json({ error: 'Keine Berechtigung zum Bearbeiten der Dateien' });
    }

    const { files } = req.body;
    if (!Array.isArray(files)) {
      return res.status(400).json({ error: 'Dateien im Array erwartet' });
    }

    let rigDir = resolveRigDirectory(rig.path);
    if (!rigDir) {
      rigDir = path.join(ROOT_DIR, path.dirname(rig.path));
      fs.mkdirSync(rigDir, { recursive: true });
    }

    for (const f of files) {
      if (f.name && typeof f.content === 'string') {
        const safeName = path.basename(f.name);
        fs.writeFileSync(path.join(rigDir, safeName), f.content, 'utf8');
      }
    }

    await db.logAudit(req.user.id, req.user.username, 'FILES_SAVED', `Updated files for Rig ${rig.id}`);
    res.json({ success: true, message: 'Dateien erfolgreich im Rig gespeichert' });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Schreiben der Dateien: ' + err.message });
  }
}

app.put('/api/rigs/:id/files', requireAuth, handleSaveFiles);
app.put('/api/tools/:id/files', requireAuth, handleSaveFiles);

// Single-Rig ZIP Export
async function handleExportRig(req, res) {
  try {
    const rig = await db.getRigById(req.params.id);
    if (!rig) return res.status(404).json({ error: 'Rig nicht gefunden' });

    const rigDir = resolveRigDirectory(rig.path);
    if (!rigDir || !fs.existsSync(rigDir)) {
      return res.status(404).json({ error: 'Projektverzeichnis nicht gefunden' });
    }

    const zip = new JSZip();
    const files = fs.readdirSync(rigDir);

    for (const filename of files) {
      const fullPath = path.join(rigDir, filename);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        zip.file(filename, fs.readFileSync(fullPath));
      }
    }

    const readmeContent = `# ${rig.title} (${rig.version || 'v0.0.1'})
Author: ${rig.author || 'Liath'}
Copyright: ${rig.copyright || '© GameChiller'}
Kategorie: ${rig.category} / ${rig.subcategory}

## Beschreibung
${rig.description}

## Einbettung & Verwendung
\`\`\`html
<iframe src="index.html" width="100%" height="800" frameborder="0" allowfullscreen></iframe>
\`\`\`
`;
    zip.file('README.md', readmeContent);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const filename = `${rig.id}-${rig.version || 'v0.0.1'}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(zipBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Erstellen des ZIP-Exports: ' + err.message });
  }
}

app.get('/api/rigs/:id/export', handleExportRig);
app.get('/api/tools/:id/export', handleExportRig);

// Save Rig Thumbnail Screenshot
async function handleSaveThumbnail(req, res) {
  try {
    const rig = await db.getRigById(req.params.id);
    if (!rig) return res.status(404).json({ error: 'Rig nicht gefunden' });

    const isOwner = req.user && (req.user.role === 'admin' || rig.author === req.user.name || rig.author === req.user.username);
    if (!isOwner) return res.status(403).json({ error: 'Keine Berechtigung zum Speichern des Thumbnails' });

    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Keine Bilddaten (Base64) übermittelt' });

    const rigDir = resolveRigDirectory(rig.path);
    if (!rigDir || !fs.existsSync(rigDir)) {
      return res.status(404).json({ error: 'Projektverzeichnis nicht gefunden' });
    }

    const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imgBuffer = Buffer.from(base64Clean, 'base64');
    const thumbFilename = 'thumbnail.png';
    const thumbPath = path.join(rigDir, thumbFilename);

    fs.writeFileSync(thumbPath, imgBuffer);

    // Relative web path for thumbnail
    const relThumb = '/' + path.relative(ROOT_DIR, thumbPath).replace(/\\/g, '/');
    await db.updateRig(rig.id, { thumbnail: relThumb }, req.user);

    res.json({ success: true, thumbnail: relThumb, message: 'Thumbnail erfolgreich gespeichert' });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Speichern des Screenshots: ' + err.message });
  }
}

app.post('/api/rigs/:id/thumbnail', requireAuth, handleSaveThumbnail);
app.post('/api/tools/:id/thumbnail', requireAuth, handleSaveThumbnail);

// Categories Routes
app.get('/api/categories', async (req, res) => {
  try {
    const cats = await db.getCategories();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ENSHROUDED SAVE EDITOR API ROUTES
// ============================================================================
const enshroudedService = require('./enshrouded-service.js');
enshroudedService.loadCatalogs(ROOT_DIR);

app.get('/api/enshrouded/game-status', async (req, res) => {
  try {
    const running = await enshroudedService.isGameRunning();
    res.json({ running });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/enshrouded/detect-saves', async (req, res) => {
  try {
    const saves = await enshroudedService.detectSaves();
    res.json({ saves });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/enshrouded/read-save', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Spielstand-Datei nicht gefunden' });
    }
    const rawBuffer = fs.readFileSync(filePath);
    const parsed = await enshroudedService.parseSV2C(rawBuffer);

    const cdBlock = parsed.blocks.find(b => b.name === 'character_data');
    let charName = 'Unbekannt';
    if (cdBlock && cdBlock.payload && cdBlock.payload.length >= 9) {
      const len = cdBlock.payload.readUInt32LE(5);
      charName = cdBlock.payload.toString('utf8', 9, 9 + len);
    }

    const pcBlock = parsed.blocks.find(b => b.name === 'player_character');
    if (!pcBlock || !pcBlock.payload) {
      return res.status(400).json({ error: 'player_character Block nicht gefunden' });
    }

    const items = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'rigs', 'Gaming', 'Enshrouded', 'Save-Editor', 'data', 'items.json'), 'utf8'));
    const skills = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'rigs', 'Gaming', 'Enshrouded', 'Save-Editor', 'data', 'skills.json'), 'utf8'));
    const isItem = (id) => Object.prototype.hasOwnProperty.call(items, id);
    const isSkill = (id) => Object.prototype.hasOwnProperty.call(skills.nodes, id);
    const ESPACOS = new Set(['Armour_Head', 'Armour_UpperBody', 'Armour_Arms', 'Armour_LowerBody', 'Armour_Feet', 'Armour_Ring', 'Shield', 'HookShot', 'Glider', 'Backpack']);
    const ehEquipavel = (id) => ESPACOS.has(items[id]?.slot);

    const characterModel = enshroudedService.parseCharacter(pcBlock.payload, isItem, isSkill, ehEquipavel);

    let knowledge = { containerState: 1, entries: [] };
    const pkBlock = parsed.blocks.find(b => b.name === 'player_knowledge');
    if (pkBlock && pkBlock.payload) {
      try {
        knowledge = enshroudedService.parseKnowledge(pkBlock.payload);
      } catch (ke) {
        console.warn('Knowledge parsing error:', ke.message);
      }
    }

    res.json({
      filePath,
      name: charName,
      character: characterModel,
      knowledge,
      blocksMeta: parsed.blocks.map(b => ({ name: b.name, size: b.size, compressed: b.compressed })),
      rawSaveBase64: rawBuffer.toString('base64')
    });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Lesen des Spielstands: ' + err.message });
  }
});

app.post('/api/enshrouded/write-save', async (req, res) => {
  try {
    const { filePath, rawSaveBase64, characterModel, knowledge, newName } = req.body;
    if (!filePath) return res.status(400).json({ error: 'Kein Dateipfad angegeben' });

    let backupPath = null;
    if (fs.existsSync(filePath)) {
      backupPath = enshroudedService.createBackup(filePath);
    }

    const rawBuffer = Buffer.from(rawSaveBase64, 'base64');
    const parsed = await enshroudedService.parseSV2C(rawBuffer);

    if (newName) {
      const cdBlock = parsed.blocks.find(b => b.name === 'character_data');
      if (cdBlock && cdBlock.payload) {
        const nameBuf = Buffer.from(newName, 'utf8');
        const newPayload = Buffer.alloc(9 + nameBuf.length);
        cdBlock.payload.copy(newPayload, 0, 0, 5);
        newPayload.writeUInt32LE(nameBuf.length, 5);
        nameBuf.copy(newPayload, 9);
        cdBlock.payload = newPayload;
        cdBlock.changed = true;
      }
    }

    if (characterModel) {
      const pcBlock = parsed.blocks.find(b => b.name === 'player_character');
      if (pcBlock) {
        characterModel._raw = {
          head: Buffer.from(characterModel._raw.head),
          mid: Buffer.from(characterModel._raw.mid),
          between: Buffer.from(characterModel._raw.between),
          tail: Buffer.from(characterModel._raw.tail)
        };
        pcBlock.payload = enshroudedService.buildCharacter(characterModel);
        pcBlock.changed = true;
      }
    }

    if (knowledge && knowledge.entries) {
      const pkBlock = parsed.blocks.find(b => b.name === 'player_knowledge');
      if (pkBlock) {
        pkBlock.payload = enshroudedService.buildKnowledge(knowledge);
        pkBlock.changed = true;
      }
    }

    const outputBuffer = await enshroudedService.buildSV2C(parsed);
    fs.writeFileSync(filePath, outputBuffer);

    res.json({
      success: true,
      backupPath,
      fileSize: outputBuffer.length,
      modified: new Date()
    });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Speichern: ' + err.message });
  }
});

app.post('/api/enshrouded/parse-file', express.raw({ type: 'application/octet-stream', limit: '50mb' }), async (req, res) => {
  try {
    const rawBuffer = req.body;
    if (!rawBuffer || rawBuffer.length === 0) return res.status(400).json({ error: 'Keine Dateidaten erhalten' });

    const parsed = await enshroudedService.parseSV2C(rawBuffer);
    const cdBlock = parsed.blocks.find(b => b.name === 'character_data');
    let charName = 'Unbekannt';
    if (cdBlock && cdBlock.payload && cdBlock.payload.length >= 9) {
      const len = cdBlock.payload.readUInt32LE(5);
      charName = cdBlock.payload.toString('utf8', 9, 9 + len);
    }

    const pcBlock = parsed.blocks.find(b => b.name === 'player_character');
    if (!pcBlock || !pcBlock.payload) {
      return res.status(400).json({ error: 'player_character Block nicht gefunden' });
    }

    const items = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'rigs', 'Gaming', 'Enshrouded', 'Save-Editor', 'data', 'items.json'), 'utf8'));
    const skills = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'rigs', 'Gaming', 'Enshrouded', 'Save-Editor', 'data', 'skills.json'), 'utf8'));
    const isItem = (id) => Object.prototype.hasOwnProperty.call(items, id);
    const isSkill = (id) => Object.prototype.hasOwnProperty.call(skills.nodes, id);
    const ESPACOS = new Set(['Armour_Head', 'Armour_UpperBody', 'Armour_Arms', 'Armour_LowerBody', 'Armour_Feet', 'Armour_Ring', 'Shield', 'HookShot', 'Glider', 'Backpack']);
    const ehEquipavel = (id) => ESPACOS.has(items[id]?.slot);

    const characterModel = enshroudedService.parseCharacter(pcBlock.payload, isItem, isSkill, ehEquipavel);

    let knowledge = { containerState: 1, entries: [] };
    const pkBlock = parsed.blocks.find(b => b.name === 'player_knowledge');
    if (pkBlock && pkBlock.payload) {
      try {
        knowledge = enshroudedService.parseKnowledge(pkBlock.payload);
      } catch (ke) {}
    }

    res.json({
      name: charName,
      character: characterModel,
      knowledge,
      blocksMeta: parsed.blocks.map(b => ({ name: b.name, size: b.size, compressed: b.compressed })),
      rawSaveBase64: rawBuffer.toString('base64')
    });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Verarbeiten: ' + err.message });
  }
});

app.post('/api/enshrouded/build-file', async (req, res) => {
  try {
    const { rawSaveBase64, characterModel, knowledge, newName } = req.body;
    const rawBuffer = Buffer.from(rawSaveBase64, 'base64');
    const parsed = await enshroudedService.parseSV2C(rawBuffer);

    if (newName) {
      const cdBlock = parsed.blocks.find(b => b.name === 'character_data');
      if (cdBlock && cdBlock.payload) {
        const nameBuf = Buffer.from(newName, 'utf8');
        const newPayload = Buffer.alloc(9 + nameBuf.length);
        cdBlock.payload.copy(newPayload, 0, 0, 5);
        newPayload.writeUInt32LE(nameBuf.length, 5);
        nameBuf.copy(newPayload, 9);
        cdBlock.payload = newPayload;
        cdBlock.changed = true;
      }
    }

    if (characterModel) {
      const pcBlock = parsed.blocks.find(b => b.name === 'player_character');
      if (pcBlock) {
        characterModel._raw = {
          head: Buffer.from(characterModel._raw.head),
          mid: Buffer.from(characterModel._raw.mid),
          between: Buffer.from(characterModel._raw.between),
          tail: Buffer.from(characterModel._raw.tail)
        };
        pcBlock.payload = enshroudedService.buildCharacter(characterModel);
        pcBlock.changed = true;
      }
    }

    if (knowledge && knowledge.entries) {
      const pkBlock = parsed.blocks.find(b => b.name === 'player_knowledge');
      if (pkBlock) {
        pkBlock.payload = enshroudedService.buildKnowledge(knowledge);
        pkBlock.changed = true;
      }
    }

    const outputBuffer = await enshroudedService.buildSV2C(parsed);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="character_edited.ksd"');
    res.send(outputBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Erstellen der Datei: ' + err.message });
  }
});

app.post('/api/categories', requireAuth, async (req, res) => {
  try {
    const { name, icon, description, subcategories, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Name erforderlich' });
    const cat = await db.addCategory({ name, icon, description, subcategories, sort_order });
    res.json(cat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Only Routes
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const { username, password, displayName, role } = req.body;
  try {
    const user = await db.registerUser(username, displayName || username, password, role || 'user');
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/logs', requireAdmin, async (req, res) => {
  try {
    const logs = await db.getAuditLogs(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/system', requireAdmin, (req, res) => {
  res.json({
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    cpus: os.cpus().length,
    uptime: os.uptime(),
    nodeVersion: process.version,
    processUptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    database: 'MySQL 3307 Connected'
  });
});

// ==========================================
// STATIC FILE SERVING & ROUTING
// ==========================================
// Dedicated Studio route
app.use('/studio', express.static(path.join(ROOT_DIR, 'studio')));

// Dedicated Admin Panel route
app.use('/admin', express.static(path.join(ROOT_DIR, 'admin')));

// Serve root static workspace (Hub, _shared, and all tool subdirectories)
app.use(express.static(ROOT_DIR));

app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.get('/favicon.ico', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.sendFile(path.join(ROOT_DIR, 'favicon.svg'));
});

// Start Database & Server
async function startServer() {
  try {
    // Check and resolve any port collision before initializing
    await ensurePortAvailable(PORT);

    console.log('[PlayRig Engine] Verbinde mit MySQL Datenbank (Port 3307)...');
    await db.init();

    // Initialize Extensible Backend Services
    const serviceManager = require('./services');
    await serviceManager.initAll({ rootDir: ROOT_DIR, db });
    serviceManager.registerRoutes(app);

    app.listen(PORT, () => {
      console.log(`
  ==============================================================
   🚀 PLAYRIG ENGINE SERVER GESTARTET (MySQL 3307)
  ==============================================================
   ➜ PlayRig Deck:          http://localhost:${PORT}
   ➜ PlayRig Studio:        http://localhost:${PORT}/studio
   ➜ Admin Panel:           http://localhost:${PORT}/admin
   ➜ API Health:            http://localhost:${PORT}/api/health
  ==============================================================
   Standard-Zugänge:
   • Admin:    admin / admin123
   • Creator:  creator / creator123
  ==============================================================
      `);
    });
  } catch (err) {
    console.error('[PlayRig Engine] Fataler Startfehler:', err.message);
    process.exit(1);
  }
}

startServer();
