/**
 * PLAYRIG STUDIO - CREATOR WORKSTATION CONTROLLER
 * Full In-Page Rig Editor, 1-Click CDN Injection & Themesets
 */

(function () {
  'use strict';

  // State
  const state = {
    token: localStorage.getItem('playrig_token') || localStorage.getItem('nexus_token') || null,
    user: null,
    activeView: 'dashboard',
    rigs: [],
    categories: []
  };

  // CDN Library Catalog for 1-Click Inserter
  const CDN_CATALOG = [
    {
      id: 'threejs',
      name: 'Three.js (r128)',
      desc: '3D WebGL Library für Szenen, Geometrien und Meshes',
      url: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
      type: 'js'
    },
    {
      id: 'orbitcontrols',
      name: 'Three OrbitControls',
      desc: 'Kamera-Maussteuerung für Three.js 3D-Szenen',
      url: 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
      type: 'js'
    },
    {
      id: 'gsap',
      name: 'GSAP 3 (GreenSock)',
      desc: 'High-Performance Animations-Engine für Web & UI',
      url: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
      type: 'js'
    },
    {
      id: 'confetti',
      name: 'Canvas Confetti',
      desc: 'High-FPS Partikel- und Konfetti-Effekte',
      url: 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js',
      type: 'js'
    },
    {
      id: 'howler',
      name: 'Howler.js (Audio)',
      desc: 'Web Audio Bibliothek für Soundeffekte und Synthesizer',
      url: 'https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.4/howler.min.js',
      type: 'js'
    },
    {
      id: 'lucide',
      name: 'Lucide Icons',
      desc: 'Moderne SVG Icon-Sammlung',
      url: 'https://unpkg.com/lucide@latest',
      type: 'js'
    },
    {
      id: 'jquery',
      name: 'jQuery (v3.7.1)',
      desc: 'DOM-Manipulation und Event-Handling',
      url: 'https://code.jquery.com/jquery-3.7.1.min.js',
      type: 'js'
    },
    {
      id: 'tailwind',
      name: 'Tailwind CSS (Play CDN)',
      desc: 'Utility-first CSS Framework per Script-Tag',
      url: 'https://cdn.tailwindcss.com',
      type: 'js'
    },
    {
      id: 'fontawesome',
      name: 'FontAwesome 6 (CSS)',
      desc: 'Iconset Stylesheet',
      url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
      type: 'css'
    },
    {
      id: 'bootstrap',
      name: 'Bootstrap 5.3 (CSS)',
      desc: 'CSS Komponenten & Grid System',
      url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
      type: 'css'
    }
  ];

  // API Client
  async function api(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {})
    };

    const res = await fetch(`/api${endpoint}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  // Initialization
  async function init() {
    bindNavigation();
    bindForms();
    bindRigEditorShortcuts();

    if (state.token) {
      try {
        const meRes = await api('/auth/me');
        if (meRes.user) {
          state.user = meRes.user;
          onAuthenticated();
          return;
        }
      } catch (err) {
        console.warn('Token ungültig:', err);
      }
    }

    showLoginModal();
  }

  function onAuthenticated() {
    hideLoginModal();
    updateUserUI();
    loadCategories();
    switchView('dashboard');
  }

  function showLoginModal() {
    document.getElementById('login-modal').classList.add('active');
  }

  function hideLoginModal() {
    document.getElementById('login-modal').classList.remove('active');
  }

  function updateUserUI() {
    const user = state.user;
    if (!user) return;

    document.getElementById('header-user-name').textContent = user.name || user.displayName || user.username;
    document.getElementById('header-user-role').textContent = user.role.toUpperCase();
    document.getElementById('header-user-avatar').textContent = (user.username || 'U').substring(0, 2).toUpperCase();

    document.getElementById('dropdown-user-name').textContent = user.name || user.displayName || user.username;
    document.getElementById('dropdown-user-handle').textContent = `@${user.username} (${user.role})`;

    // Show admin link if user is admin
    const adminLinkHeader = document.getElementById('btn-header-admin-link');
    const adminLinkSidebar = document.getElementById('sidebar-admin-link');
    const adminLinkDropdown = document.getElementById('dropdown-admin-link');
    const isAdmin = user.role === 'admin';

    if (adminLinkHeader) adminLinkHeader.style.display = isAdmin ? 'inline-flex' : 'none';
    if (adminLinkSidebar) adminLinkSidebar.style.display = isAdmin ? 'flex' : 'none';
    if (adminLinkDropdown) adminLinkDropdown.style.display = isAdmin ? 'flex' : 'none';
  }

  // Router & Navigation
  function switchView(viewName) {
    state.activeView = viewName;

    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      if (item.dataset.view === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    const viewTitles = {
      'dashboard': 'Studio Dashboard',
      'my-tools': 'Meine Rigs & Quellcode',
      'create-tool': 'Neues Rig anlegen',
      'codepen-import': 'Rig-Importer & Web Ingest',
      'rig-editor': 'Rig Code & Design Studio',
      'categories': 'Kategorien & FX'
    };
    document.getElementById('breadcrumb-view-title').textContent = viewTitles[viewName] || 'Studio';

    document.querySelectorAll('.studio-view-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const activePanel = document.getElementById(`view-${viewName}`);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    if (viewName === 'dashboard') loadDashboard();
    if (viewName === 'my-tools') loadMyTools();
    if (viewName === 'create-tool') setupCreateToolForm();
    if (viewName === 'categories') loadCategoriesView();
  }

  function bindNavigation() {
    document.querySelectorAll('.sidebar-nav-item[data-view]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(item.dataset.view);
      });
    });

    document.getElementById('btn-header-new-tool').addEventListener('click', () => {
      switchView('create-tool');
    });

    // Profile Dropdown Toggle
    const profileChip = document.getElementById('studio-profile-chip');
    const profileDropdown = document.getElementById('studio-profile-dropdown');
    const profileWrapper = document.getElementById('studio-profile-wrapper');

    if (profileChip && profileDropdown) {
      profileChip.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('active');
        profileWrapper.classList.toggle('active');
      });

      document.addEventListener('click', () => {
        profileDropdown.classList.remove('active');
        profileWrapper.classList.remove('active');
      });
    }

    document.getElementById('btn-studio-fx')?.addEventListener('click', () => {
      profileDropdown.classList.remove('active');
      if (window.PlayRigFX && window.PlayRigFX.togglePanel) {
        window.PlayRigFX.togglePanel();
      }
    });

    document.getElementById('btn-header-logout').addEventListener('click', async () => {
      try {
        await api('/auth/logout', { method: 'POST' });
      } catch (e) {}
      localStorage.removeItem('playrig_token');
      localStorage.removeItem('nexus_token');
      state.token = null;
      state.user = null;
      window.location.reload();
    });

    document.getElementById('btn-quick-creator')?.addEventListener('click', () => {
      document.getElementById('login-username').value = 'creator';
      document.getElementById('login-password').value = 'creator123';
      document.getElementById('login-form').dispatchEvent(new Event('submit'));
    });

    document.getElementById('btn-quick-admin')?.addEventListener('click', () => {
      document.getElementById('login-username').value = 'admin';
      document.getElementById('login-password').value = 'admin123';
      document.getElementById('login-form').dispatchEvent(new Event('submit'));
    });
  }

  // Dashboard View
  async function loadDashboard() {
    try {
      const rigs = await api('/rigs');
      state.rigs = rigs;

      const myRigs = rigs.filter(r => r.author === state.user.name || r.author === state.user.username);
      const publicRigs = rigs.filter(r => r.access === 'public' || r.isPublic);
      const privateRigs = rigs.filter(r => r.access === 'private' || !r.isPublic);

      document.getElementById('metric-total-tools').textContent = rigs.length;
      document.getElementById('metric-my-tools').textContent = myRigs.length;
      document.getElementById('metric-public-tools').textContent = publicRigs.length;
      document.getElementById('metric-private-tools').textContent = privateRigs.length;

      const recentEl = document.getElementById('dashboard-recent-rigs');
      if (recentEl) {
        recentEl.innerHTML = '';
        const recent = rigs.slice(0, 5);
        if (recent.length === 0) {
          recentEl.innerHTML = '<div style="color:var(--text-dim); padding:16px 0;">Noch keine Rigs vorhanden.</div>';
        } else {
          recent.forEach(r => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:rgba(255,255,255,0.02); border:1px solid var(--border-subtle); border-radius:var(--radius-md);';
            row.innerHTML = `
              <div style="display:flex; align-items:center; gap:12px;">
                <div class="user-avatar-circle" style="width:26px; height:26px; font-size:0.75rem;">⚡</div>
                <div>
                  <div style="font-weight:700; color:#fff;">${r.title}</div>
                  <div style="font-size:0.75rem; color:var(--text-dim);">${r.category} • ${r.version || 'v0.0.1'}</div>
                </div>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-primary btn-sm btn-edit-quick" data-id="${r.id}">Code & Studio</button>
                <a href="/${r.path}" class="btn btn-ghost btn-sm" title="Vorschau im selben Fenster">↗</a>
              </div>
            `;
            row.querySelector('.btn-edit-quick').addEventListener('click', () => openRigEditor(r));
            recentEl.appendChild(row);
          });
        }
      }
    } catch (err) {
      window.showToast('Fehler beim Laden: ' + err.message, 'error');
    }
  }

  // My Rigs View
  async function loadMyTools() {
    try {
      const rigs = await api('/rigs');
      state.rigs = rigs;
      renderRigsTable(rigs);
    } catch (err) {
      window.showToast('Fehler beim Laden der Rigs: ' + err.message, 'error');
    }
  }

  function renderRigsTable(rigs) {
    const tbody = document.getElementById('tools-table-body');
    tbody.innerHTML = '';

    if (rigs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-dim);">Noch keine Rigs vorhanden. Klicke auf "+ Neues Rig anlegen" oder importiere ein Projekt!</td></tr>`;
      return;
    }

    rigs.forEach(rig => {
      const tr = document.createElement('tr');
      const isOwner = state.user.role === 'admin' || rig.author === state.user.name || rig.author === state.user.username;
      const isPublic = rig.access === 'public' || rig.isPublic;
      const visClass = isPublic ? 'public' : 'private';
      const visIcon = isPublic ? '🌐' : '🔒';
      const visLabel = isPublic ? 'Öffentlich (Deck)' : 'Privat';

      tr.innerHTML = `
        <td>
          <div style="font-weight: 700; color: #ffffff; font-size: 0.95rem;">${rig.title}</div>
          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--cyan-400);">${rig.id}</div>
        </td>
        <td>
          <span class="badge badge-indigo">${rig.category} • ${rig.subcategory}</span>
        </td>
        <td>
          <span style="font-size: 0.8rem; color: var(--text-muted);">${rig.version || 'v0.0.1'} • <strong>${rig.author || 'Creator'}</strong></span>
        </td>
        <td>
          ${isOwner ? `
            <button class="visibility-toggle-btn ${visClass}" data-id="${rig.id}" data-public="${isPublic}" title="Klicken, um Sichtbarkeit im Deck zu ändern">
              <span>${visIcon}</span>
              <span>${visLabel}</span>
            </button>
          ` : `
            <span class="badge badge-${isPublic ? 'emerald' : 'amber'}">${visLabel}</span>
          `}
        </td>
        <td style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-dim);">
          ${rig.path}
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px;">
            <button class="btn btn-primary btn-sm btn-edit-rig" data-id="${rig.id}" title="Im Vollbild Rig-Editor öffnen & Code bearbeiten">
              ⚡ Code & Studio
            </button>
            <a href="/api/rigs/${rig.id}/export" class="btn btn-secondary btn-sm" title="Als ZIP herunterladen">
              📦
            </a>
            <button class="btn btn-secondary btn-sm btn-fork-rig" data-id="${rig.id}" title="Rig klonen (Fork)">
              ⚡
            </button>
            <a href="/${rig.path}" class="btn btn-ghost btn-sm" title="Vorschau im Browser">
              ↗
            </a>
            ${isOwner ? `
              <button class="btn btn-ghost btn-sm btn-delete-rig" data-id="${rig.id}" title="Löschen" style="color: var(--rose-400);">
                ✕
              </button>
            ` : ''}
          </div>
        </td>
      `;

      const visBtn = tr.querySelector('.visibility-toggle-btn');
      if (visBtn) {
        visBtn.addEventListener('click', async () => {
          const currentPublic = visBtn.dataset.public === 'true';
          const newAccess = currentPublic ? 'private' : 'public';
          try {
            await api(`/rigs/${rig.id}`, {
              method: 'PUT',
              body: JSON.stringify({ access: newAccess, isPublic: !currentPublic })
            });
            window.showToast(`Sichtbarkeit geändert: ${!currentPublic ? 'Jetzt öffentlich im Deck' : 'Jetzt privat'}`, 'success');
            loadMyTools();
          } catch (e) {
            window.showToast('Fehler: ' + e.message, 'error');
          }
        });
      }

      tr.querySelector('.btn-edit-rig').addEventListener('click', () => openRigEditor(rig));

      tr.querySelector('.btn-fork-rig').addEventListener('click', async () => {
        if (confirm(`Möchtest du das Rig '${rig.title}' jetzt für dich klonen (Fork)?`)) {
          try {
            const forked = await api(`/rigs/${rig.id}/fork`, { method: 'POST' });
            window.showToast(`Rig erfolgreich geklont: '${forked.title}'!`, 'success');
            loadMyTools();
          } catch (err) {
            window.showToast('Fehler beim Klonen: ' + err.message, 'error');
          }
        }
      });

      const delBtn = tr.querySelector('.btn-delete-rig');
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          if (confirm(`Möchtest du das Rig '${rig.title}' (${rig.id}) wirklich unwiderruflich löschen?`)) {
            try {
              await api(`/rigs/${rig.id}`, { method: 'DELETE' });
              window.showToast(`Rig '${rig.title}' gelöscht`, 'info');
              loadMyTools();
            } catch (e) {
              window.showToast('Fehler: ' + e.message, 'error');
            }
          }
        });
      }

      tbody.appendChild(tr);
    });
  }

  // Create Rig Form
  async function setupCreateToolForm() {
    await loadCategories();
    const catSelect = document.getElementById('create-tool-category');
    const subcatSelect = document.getElementById('create-tool-subcategory');

    catSelect.innerHTML = '';
    state.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      catSelect.appendChild(opt);
    });

    function updateSubcats() {
      const selectedCat = state.categories.find(c => c.id === catSelect.value || c.name === catSelect.value);
      subcatSelect.innerHTML = '';
      if (selectedCat && selectedCat.subcategories) {
        selectedCat.subcategories.forEach(sub => {
          const opt = document.createElement('option');
          opt.value = sub;
          opt.textContent = sub;
          subcatSelect.appendChild(opt);
        });
      }
    }

    catSelect.addEventListener('change', updateSubcats);
    updateSubcats();

    const titleInput = document.getElementById('create-tool-title');
    const slugInput = document.getElementById('create-tool-id');
    titleInput.addEventListener('input', () => {
      slugInput.value = titleInput.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    });

    const authorInput = document.getElementById('create-tool-author');
    const copyrightInput = document.getElementById('create-tool-copyright');
    if (authorInput && !authorInput.value) {
      if (state.user) {
        const userName = state.user.displayName || state.user.username || '';
        authorInput.value = userName;
        const isLiath = (state.user.username === 'creator' || userName.toLowerCase() === 'liath');
        if (copyrightInput && !copyrightInput.value) {
          copyrightInput.value = isLiath ? '© GameChiller' : (userName ? `© ${userName}` : '');
        }
      }
    }
  }

  // Categories View
  async function loadCategories() {
    try {
      state.categories = await api('/categories');
    } catch (e) {
      console.warn('Categories load error:', e);
    }
  }

  async function loadCategoriesView() {
    await loadCategories();
    const container = document.getElementById('categories-list-container');
    container.innerHTML = '';

    state.categories.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'glass-panel';
      card.style.padding = '20px';

      const subTags = (cat.subcategories || []).map(s => `<span class="badge badge-indigo" style="font-size:0.75rem;">${s}</span>`).join(' ');

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
          <h3 style="font-size: 1.15rem; color: var(--cyan-400); margin:0;">${cat.name}</h3>
          <span style="font-size:0.75rem; color:var(--text-dim);">${cat.subcategories ? cat.subcategories.length : 0} Unterkategorien</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">${cat.description || ''}</p>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${subTags}
        </div>
      `;
      container.appendChild(card);
    });
  }

  // ==========================================================================
  // FULL-PAGE RIG EDITOR
  // ==========================================================================
  let currentRig = null;
  let rigFiles = [];
  let currentRigFile = null;

  async function openRigEditor(rig) {
    currentRig = rig;
    switchView('rig-editor');

    document.getElementById('editor-rig-title').textContent = rig.title;
    document.getElementById('editor-rig-id-badge').textContent = rig.id;
    document.getElementById('editor-rig-version-badge').textContent = rig.version || 'v0.0.1';
    document.getElementById('editor-btn-preview').href = '/' + rig.path;
    document.getElementById('editor-btn-export-zip').onclick = () => {
      window.location.href = `/api/rigs/${rig.id}/export`;
    };

    document.getElementById('editor-btn-fork').onclick = async () => {
      if (confirm(`Möchtest du das Rig '${rig.title}' als neue private Kopie klonen?`)) {
        try {
          const forked = await api(`/rigs/${rig.id}/fork`, { method: 'POST' });
          window.showToast(`Rig erfolgreich geklont: '${forked.title}'!`, 'success');
          openRigEditor(forked);
        } catch (e) {
          window.showToast('Fehler: ' + e.message, 'error');
        }
      }
    };

    const embedUrl = `${window.location.origin}/${rig.path}?embed=true`;
    document.getElementById('editor-embed-code').value = `<iframe src="${embedUrl}" width="100%" height="750" frameborder="0" allowfullscreen></iframe>`;
    document.getElementById('btn-copy-editor-embed').onclick = () => {
      navigator.clipboard.writeText(document.getElementById('editor-embed-code').value);
      window.showToast('Embed-Code in Zwischenablage kopiert!', 'success');
    };

    document.getElementById('editor-meta-title').value = rig.title;
    document.getElementById('editor-meta-version').value = rig.version || 'v0.0.1';
    document.getElementById('editor-meta-author').value = rig.author || (window.CURRENT_USER ? (window.CURRENT_USER.displayName || window.CURRENT_USER.username) : '');
    document.getElementById('editor-meta-copyright').value = rig.copyright || (rig.author ? `© ${rig.author}` : '');
    document.getElementById('editor-meta-status').value = rig.status || 'active';
    document.getElementById('editor-meta-subcategory').value = rig.subcategory || '';
    document.getElementById('editor-meta-desc').value = rig.description || '';
    document.getElementById('editor-meta-tags').value = (rig.tags || []).join(', ');
    document.getElementById('editor-meta-public').checked = (rig.access === 'public' || rig.isPublic);

    const catSelect = document.getElementById('editor-meta-category');
    catSelect.innerHTML = '';
    state.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      if (cat.id === rig.category || cat.name === rig.category) opt.selected = true;
      catSelect.appendChild(opt);
    });

    // Load files from disk
    try {
      const res = await api(`/rigs/${rig.id}/files`);
      rigFiles = res.files || [];
      renderEditorFileTabs();
      setupCDNChecklist();
      setupThemesetSelector();
    } catch (e) {
      window.showToast('Dateien konnten nicht geladen werden: ' + e.message, 'warning');
      rigFiles = [];
    }
  }

  function renderEditorFileTabs() {
    const tabsContainer = document.getElementById('editor-file-tabs');
    tabsContainer.innerHTML = '';
    const textarea = document.getElementById('editor-code-textarea');

    if (rigFiles.length === 0) {
      textarea.value = '// Keine Quellcode-Dateien im Verzeichnis gefunden';
      return;
    }

    rigFiles.forEach((file, index) => {
      const tab = document.createElement('div');
      tab.className = `editor-file-tab ${index === 0 ? 'active' : ''}`;
      tab.innerHTML = `<span>📄</span> <span>${file.name}</span>`;
      tab.addEventListener('click', () => {
        if (currentRigFile) {
          currentRigFile.content = textarea.value;
        }
        document.querySelectorAll('.editor-file-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentRigFile = file;
        textarea.value = file.content;
        updateEditorStats();
      });
      tabsContainer.appendChild(tab);
    });

    currentRigFile = rigFiles[0];
    textarea.value = currentRigFile.content;
    updateEditorStats();
  }

  function updateEditorStats() {
    if (!currentRigFile) return;
    const textarea = document.getElementById('editor-code-textarea');
    const lines = (textarea.value.match(/\n/g) || []).length + 1;
    const chars = textarea.value.length;
    document.getElementById('editor-file-info').textContent = `Datei: ${currentRigFile.name}`;
    document.getElementById('editor-cursor-info').textContent = `${lines} Zeilen • ${chars} Zeichen`;
  }

  function setupCDNChecklist() {
    const container = document.getElementById('editor-cdn-list');
    container.innerHTML = '';

    const htmlFile = rigFiles.find(f => f.name === 'index.html');
    const htmlContent = htmlFile ? htmlFile.content : '';

    CDN_CATALOG.forEach(lib => {
      const isPresent = htmlContent.includes(lib.url) || htmlContent.includes(lib.name.toLowerCase().split(' ')[0]);

      const row = document.createElement('div');
      row.className = 'cdn-item-row';
      row.innerHTML = `
        <div class="cdn-item-info">
          <span class="cdn-item-title">${lib.name}</span>
          <span class="cdn-item-desc">${lib.desc}</span>
        </div>
        <label class="nexus-checkbox-label" style="margin: 0;">
          <input type="checkbox" class="nexus-checkbox cdn-lib-checkbox" data-lib-id="${lib.id}" ${isPresent ? 'checked' : ''}>
        </label>
      `;

      const checkbox = row.querySelector('.cdn-lib-checkbox');
      checkbox.addEventListener('change', () => {
        handleCDNToggle(lib, checkbox.checked);
      });

      container.appendChild(row);
    });
  }

  function handleCDNToggle(lib, shouldAdd) {
    const htmlFile = rigFiles.find(f => f.name === 'index.html');
    if (!htmlFile) {
      window.showToast('index.html wurde nicht gefunden!', 'warning');
      return;
    }

    if (currentRigFile && currentRigFile.name === 'index.html') {
      currentRigFile.content = document.getElementById('editor-code-textarea').value;
    }

    let content = htmlFile.content;
    const tag = lib.type === 'css'
      ? `<link rel="stylesheet" href="${lib.url}">`
      : `<script src="${lib.url}"></script>`;

    if (shouldAdd) {
      if (!content.includes(lib.url)) {
        if (content.includes('</head>')) {
          content = content.replace('</head>', `  <!-- CDN: ${lib.name} -->\n  ${tag}\n</head>`);
        } else {
          content = tag + '\n' + content;
        }
        window.showToast(`${lib.name} in index.html injiziert!`, 'success');
      }
    } else {
      content = content.replace(new RegExp(`<!-- CDN: ${lib.name} -->\\s*`, 'g'), '');
      content = content.replace(tag + '\n', '');
      content = content.replace(tag, '');
      window.showToast(`${lib.name} aus index.html entfernt`, 'info');
    }

    htmlFile.content = content;
    if (currentRigFile && currentRigFile.name === 'index.html') {
      document.getElementById('editor-code-textarea').value = content;
      updateEditorStats();
    }
    markEditorModified();
  }

  function setupThemesetSelector() {
    const htmlFile = rigFiles.find(f => f.name === 'index.html');
    const htmlContent = htmlFile ? htmlFile.content : '';

    const themeMatch = htmlContent.match(/<html[^>]*data-theme=["']([^"']+)["']/i);
    const activeTheme = themeMatch ? themeMatch[1] : 'cyber-cyan';

    document.querySelectorAll('.theme-card-btn').forEach(btn => {
      const theme = btn.dataset.theme;
      if (theme === activeTheme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }

      btn.onclick = () => {
        document.querySelectorAll('.theme-card-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    document.getElementById('btn-apply-theme-to-rig').onclick = () => {
      const selectedBtn = document.querySelector('.theme-card-btn.active');
      const chosenTheme = selectedBtn ? selectedBtn.dataset.theme : 'cyber-cyan';

      if (!htmlFile) return;
      if (currentRigFile && currentRigFile.name === 'index.html') {
        currentRigFile.content = document.getElementById('editor-code-textarea').value;
      }

      let content = htmlFile.content;
      if (content.includes('data-theme=')) {
        content = content.replace(/data-theme=["'][^"']+["']/g, `data-theme="${chosenTheme}"`);
      } else if (content.includes('<html')) {
        content = content.replace(/<html/g, `<html data-theme="${chosenTheme}"`);
      }

      if (!content.includes('themes.css')) {
        content = content.replace('</head>', `  <link rel="stylesheet" href="../../../_shared/css/themes.css">\n</head>`);
      }

      htmlFile.content = content;
      if (currentRigFile && currentRigFile.name === 'index.html') {
        document.getElementById('editor-code-textarea').value = content;
        updateEditorStats();
      }

      markEditorModified();
      window.showToast(`Theme '${chosenTheme}' angewendet!`, 'success');
    };
  }

  function markEditorModified() {
    const indicator = document.getElementById('editor-save-indicator');
    if (indicator) {
      indicator.textContent = '● Ungespeichert';
      indicator.style.color = 'var(--amber-400)';
      indicator.style.background = 'rgba(245, 158, 11, 0.12)';
      indicator.style.borderColor = 'rgba(245, 158, 11, 0.3)';
    }
  }

  function markEditorSaved() {
    const indicator = document.getElementById('editor-save-indicator');
    if (indicator) {
      indicator.textContent = '✓ Gespeichert';
      indicator.style.color = 'var(--emerald-400)';
      indicator.style.background = 'rgba(16, 185, 129, 0.12)';
      indicator.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    }
  }

  function bindRigEditorShortcuts() {
    const textarea = document.getElementById('editor-code-textarea');

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        updateEditorStats();
        markEditorModified();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveRigFiles();
      }
    });

    textarea.addEventListener('input', () => {
      updateEditorStats();
      markEditorModified();
    });

    document.getElementById('editor-btn-save-all').addEventListener('click', saveRigFiles);

    document.querySelectorAll('.editor-sidebar-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.editor-sidebar-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.editor-subtab-pane').forEach(p => p.classList.remove('active'));
        const targetId = tab.dataset.subtab;
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.add('active');
      });
    });

    document.getElementById('btn-editor-back').addEventListener('click', () => {
      switchView('my-tools');
    });

    document.getElementById('editor-form-meta').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentRig) return;

      const title = document.getElementById('editor-meta-title').value;
      const version = document.getElementById('editor-meta-version').value;
      const author = document.getElementById('editor-meta-author').value;
      const copyright = document.getElementById('editor-meta-copyright').value;
      const status = document.getElementById('editor-meta-status').value;
      const category = document.getElementById('editor-meta-category').value;
      const subcategory = document.getElementById('editor-meta-subcategory').value;
      const description = document.getElementById('editor-meta-desc').value;
      const tags = document.getElementById('editor-meta-tags').value.split(',').map(t => t.trim()).filter(Boolean);
      const isPublic = document.getElementById('editor-meta-public').checked;

      try {
        const updated = await api(`/rigs/${currentRig.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title, version, author, copyright, status, category, subcategory, description, tags,
            access: isPublic ? 'public' : 'private',
            isPublic
          })
        });
        currentRig = updated;
        document.getElementById('editor-rig-title').textContent = updated.title;
        document.getElementById('editor-rig-version-badge').textContent = updated.version || 'v0.0.1';
        window.showToast('Metadaten in MySQL aktualisiert!', 'success');
      } catch (err) {
        window.showToast('Fehler: ' + err.message, 'error');
      }
    });
  }

  async function saveRigFiles() {
    if (!currentRig) return;
    if (currentRigFile) {
      currentRigFile.content = document.getElementById('editor-code-textarea').value;
    }

    try {
      await api(`/rigs/${currentRig.id}/files`, {
        method: 'PUT',
        body: JSON.stringify({ files: rigFiles })
      });
      markEditorSaved();
      window.showToast(`Quellcode für '${currentRig.title}' erfolgreich gespeichert!`, 'success');
    } catch (err) {
      window.showToast('Fehler beim Speichern: ' + err.message, 'error');
    }
  }

  function bindForms() {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('login-username').value;
      const p = document.getElementById('login-password').value;

      try {
        const auth = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: u, password: p })
        });

        state.token = auth.token;
        state.user = auth.user;
        localStorage.setItem('playrig_token', auth.token);

        window.showToast(`Willkommen im PlayRig Studio, ${auth.user.name || auth.user.username}!`, 'success');
        onAuthenticated();
      } catch (err) {
        window.showToast('Login fehlgeschlagen: ' + err.message, 'error');
      }
    });

    document.getElementById('form-create-tool').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('create-tool-title').value;
      const id = document.getElementById('create-tool-id').value;
      const category = document.getElementById('create-tool-category').value;
      const subcategory = document.getElementById('create-tool-subcategory').value;
      const theme = document.getElementById('create-tool-theme').value;
      const isPublic = document.getElementById('create-tool-public').checked;
      const description = document.getElementById('create-tool-desc').value;
      const tags = document.getElementById('create-tool-tags').value.split(',').map(t => t.trim()).filter(Boolean);
      const author = document.getElementById('create-tool-author')?.value.trim() || undefined;
      const copyright = document.getElementById('create-tool-copyright')?.value.trim() || undefined;

      try {
        const newRig = await api('/rigs', {
          method: 'POST',
          body: JSON.stringify({
            title, id, category, subcategory,
            author, copyright,
            access: isPublic ? 'public' : 'private',
            isPublic, description, tags, settings: { theme }
          })
        });

        window.showToast(`Rig '${newRig.title}' erfolgreich generiert!`, 'success');
        openRigEditor(newRig);
      } catch (err) {
        window.showToast('Fehler: ' + err.message, 'error');
      }
    });

    const importForm = document.getElementById('admin-form-codepen-import');
    if (importForm) {
      importForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = document.getElementById('admin-import-url').value;
        const title = document.getElementById('admin-import-title').value;
        const category = document.getElementById('admin-import-cat').value;
        const cdns = document.getElementById('admin-import-cdns').value;

        try {
          window.showToast('Lade Projekt herunter & initialisiere Rig...', 'info');
          const imported = await api('/rigs/import', {
            method: 'POST',
            body: JSON.stringify({ source: 'codepen', url, title, category, cdns })
          });
          window.showToast(`Projekt '${imported.title}' erfolgreich als Rig importiert!`, 'success');
          importForm.reset();
          openRigEditor(imported);
        } catch (err) {
          window.showToast('Import fehlgeschlagen: ' + err.message, 'error');
        }
      });
    }
  }

  window.switchView = switchView;
  window.openRigEditor = openRigEditor;

  document.addEventListener('DOMContentLoaded', init);
})();

