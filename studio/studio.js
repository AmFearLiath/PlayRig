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
      const errMsg = (typeof data.error === 'object' && data.error !== null)
        ? (data.error.message || data.error.code || JSON.stringify(data.error))
        : (data.error || `HTTP ${res.status}`);
      throw new Error(errMsg);
    }
    return data;
  }

  // Initialization
  async function init() {
    bindNavigation();
    bindForms();
    bindRigEditorShortcuts();
    bindStudioPushRigForms();

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
            <button class="btn btn-secondary btn-sm btn-push-rig-branch" data-id="${rig.id}" title="Rig in eigenem Branch zu GitHub pushen">
              🐙 Push
            </button>
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

      tr.querySelector('.btn-push-rig-branch')?.addEventListener('click', () => {
        openStudioPushRigModal(rig);
      });

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

    initZipImporter();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ZIP Project Importer & Security Scanner UI
  let currentZipBase64 = null;
  let currentScanReport = null;

  function setImporterTab(tab) {
    const tabZip = document.getElementById('importer-tab-zip');
    const tabUrl = document.getElementById('importer-tab-url');
    const btnZip = document.getElementById('btn-tab-import-zip');
    const btnUrl = document.getElementById('btn-tab-import-url');

    if (tab === 'zip') {
      if (tabZip) tabZip.style.display = 'block';
      if (tabUrl) tabUrl.style.display = 'none';
      if (btnZip) btnZip.className = 'btn btn-primary btn-sm';
      if (btnUrl) btnUrl.className = 'btn btn-secondary btn-sm';
    } else {
      if (tabZip) tabZip.style.display = 'none';
      if (tabUrl) tabUrl.style.display = 'block';
      if (btnZip) btnZip.className = 'btn btn-secondary btn-sm';
      if (btnUrl) btnUrl.className = 'btn btn-primary btn-sm';
    }
  }

  function resetZipImport() {
    currentZipBase64 = null;
    currentScanReport = null;
    const fileInput = document.getElementById('zip-file-input');
    if (fileInput) fileInput.value = '';
    const resultsPanel = document.getElementById('zip-scan-results');
    if (resultsPanel) resultsPanel.style.display = 'none';

    // Reset mode to create
    const modeCreate = document.getElementById('zip-mode-create');
    if (modeCreate) modeCreate.checked = true;
    toggleZipImportMode('create');

    const dropzone = document.getElementById('zip-dropzone');
    if (dropzone) {
      dropzone.style.display = 'block';
      dropzone.style.borderColor = 'var(--border-strong)';
      dropzone.style.background = 'rgba(3, 7, 18, 0.6)';
      dropzone.innerHTML = `
        <div style="font-size: 2.4rem; margin-bottom: 8px;">📦</div>
        <h3 style="margin: 0 0 6px 0; color: #fff; font-size: 1.15rem;">ZIP-Datei hier ablegen oder durchsuchen</h3>
        <p style="margin: 0; color: var(--text-dim); font-size: 0.85rem;">Unterstützt .zip mit index.html, Assets, Scripts und optionalem docs.json Manifest (Max. 50 MB)</p>
        <input type="file" id="zip-file-input" accept=".zip,application/zip" style="display: none;">
      `;
      const newFileInput = document.getElementById('zip-file-input');
      if (newFileInput) {
        newFileInput.addEventListener('change', () => {
          const f = newFileInput.files?.[0];
          if (f) handleZipFile(f);
        });
      }
    }
  }

  function populateTargetRigSelect() {
    const select = document.getElementById('zip-target-rig-select');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Rig zum Aktualisieren wählen --</option>';

    const rigs = state.rigs || [];
    rigs.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.title} (${r.category} • ${r.id})`;
      select.appendChild(opt);
    });

    if (currentVal) select.value = currentVal;
  }

  function toggleZipImportMode(mode) {
    const targetGroup = document.getElementById('zip-target-rig-group');
    const submitBtn = document.getElementById('btn-submit-zip-import');
    const targetSelect = document.getElementById('zip-target-rig-select');

    if (mode === 'update') {
      if (targetGroup) targetGroup.style.display = 'block';
      populateTargetRigSelect();

      // Try to auto-match if scanReport title or id matches an existing rig
      if (currentScanReport && targetSelect && !targetSelect.value) {
        const match = (state.rigs || []).find(r =>
          (currentScanReport.metadata?.id && r.id.toLowerCase() === currentScanReport.metadata.id.toLowerCase()) ||
          (currentScanReport.metadata?.title && r.title.toLowerCase() === currentScanReport.metadata.title.toLowerCase())
        );
        if (match) {
          targetSelect.value = match.id;
          onTargetRigSelected(match.id);
        }
      }

      if (submitBtn) {
        const currentRigTitle = targetSelect?.options[targetSelect.selectedIndex]?.textContent;
        submitBtn.textContent = targetSelect?.value ? `🔄 Rig mit ZIP-Inhalt aktualisieren` : '🔄 Bestehendes Rig aktualisieren';
      }
    } else {
      if (targetGroup) targetGroup.style.display = 'none';
      if (submitBtn) {
        submitBtn.textContent = '🚀 Projekt freigeben & in meine Rigs importieren';
      }
      // Restore metadata from scanReport
      if (currentScanReport) {
        const titleInput = document.getElementById('zip-import-title');
        const catInput = document.getElementById('zip-import-cat');
        const authorInput = document.getElementById('zip-import-author');
        const copyrightInput = document.getElementById('zip-import-copyright');

        if (titleInput && currentScanReport.metadata?.title) titleInput.value = currentScanReport.metadata.title;
        if (catInput && currentScanReport.metadata?.category) catInput.value = currentScanReport.metadata.category;
        if (authorInput && currentScanReport.metadata?.author) authorInput.value = currentScanReport.metadata.author;
        if (copyrightInput && currentScanReport.metadata?.copyright) copyrightInput.value = currentScanReport.metadata.copyright;
      }
    }
  }

  function onTargetRigSelected(rigId) {
    if (!rigId) return;
    const rig = (state.rigs || []).find(r => r.id === rigId);
    if (!rig) return;

    const titleInput = document.getElementById('zip-import-title');
    const catInput = document.getElementById('zip-import-cat');
    const authorInput = document.getElementById('zip-import-author');
    const copyrightInput = document.getElementById('zip-import-copyright');
    const submitBtn = document.getElementById('btn-submit-zip-import');

    if (titleInput) titleInput.value = rig.title;
    if (catInput && rig.category) catInput.value = rig.category;
    if (authorInput && rig.author) authorInput.value = rig.author;
    if (copyrightInput && rig.copyright) copyrightInput.value = rig.copyright;

    if (submitBtn) {
      submitBtn.textContent = `🔄 '${rig.title}' mit ZIP-Inhalt aktualisieren`;
    }
  }

  function initZipImporter() {
    const dropzone = document.getElementById('zip-dropzone');
    const fileInput = document.getElementById('zip-file-input');
    const confirmForm = document.getElementById('form-confirm-zip-import');
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const input = document.getElementById('zip-file-input');
        if (input) input.click();
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--neon-cyan)';
      dropzone.style.background = 'rgba(0, 240, 255, 0.08)';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'var(--border-strong)';
      dropzone.style.background = 'rgba(3, 7, 18, 0.6)';
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--border-strong)';
      dropzone.style.background = 'rgba(3, 7, 18, 0.6)';
      const file = e.dataTransfer?.files?.[0];
      if (file) handleZipFile(file);
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) handleZipFile(file);
    });

    if (confirmForm) {
      confirmForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentZipBase64) {
          window.showToast('Kein ZIP-Archiv zum Importieren vorhanden.', 'warning');
          return;
        }

        const mode = document.querySelector('input[name="zip-import-mode"]:checked')?.value || 'create';
        const targetRigId = mode === 'update' ? document.getElementById('zip-target-rig-select')?.value : null;

        if (mode === 'update' && !targetRigId) {
          window.showToast('Bitte wähle ein bestehendes Rig zum Aktualisieren aus.', 'warning');
          return;
        }

        const title = document.getElementById('zip-import-title').value.trim();
        const category = document.getElementById('zip-import-cat').value;
        const author = document.getElementById('zip-import-author')?.value.trim();
        const copyright = document.getElementById('zip-import-copyright')?.value.trim();
        const submitBtn = document.getElementById('btn-submit-zip-import');

        try {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = mode === 'update' ? '⏳ Aktualisiere Rig per ZIP...' : '⏳ Entpacke & initialisiere Rig...';
          }
          window.showToast(mode === 'update' ? 'Aktualisiere Rig-Dateien aus ZIP...' : 'Entpacke ZIP und registriere Rig in PlayRig...', 'info');

          const res = await api('/rigs/import-zip', {
            method: 'POST',
            body: JSON.stringify({
              zipBase64: currentZipBase64,
              mode,
              targetRigId,
              title,
              category,
              author,
              copyright
            })
          });

          const rigData = res.data?.rig || res.rig;
          const isUpdated = res.data?.updated;
          const successMsg = isUpdated
            ? `Rig '${rigData?.title || title}' erfolgreich mit ZIP-Dateien aktualisiert!`
            : `Rig '${rigData?.title || title}' erfolgreich importiert und verifiziert!`;
          window.showToast(successMsg, 'success');

          resetZipImport();
          await loadMyTools();
          if (rigData) {
            openRigEditor(rigData);
          } else {
            switchView('view-my-tools');
          }
        } catch (err) {
          window.showToast('Import fehlgeschlagen: ' + err.message, 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '🚀 Projekt freigeben & in meine Rigs importieren';
          }
        }
      });
    }
  }

  async function handleZipFile(file) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      window.showToast('Bitte lade eine gültige .zip Datei hoch.', 'warning');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      window.showToast('Die Datei überschreitet das Limit von 50 MB.', 'warning');
      return;
    }

    const dropzone = document.getElementById('zip-dropzone');
    if (dropzone) {
      dropzone.innerHTML = `
        <div style="font-size: 2.2rem; margin-bottom: 8px;">⏳</div>
        <h3 style="margin: 0 0 6px 0; color: #fff; font-size: 1.1rem;">Prüfe Archiv '${escapeHtml(file.name)}'...</h3>
        <p style="margin: 0; color: var(--neon-cyan); font-size: 0.85rem;">Sicherheits-Scan auf Backdoors, Schadcode und Zip-Slip läuft...</p>
      `;
    }

    window.showToast(`Analysiere '${file.name}' auf Sicherheitsbedrohungen...`, 'info');

    const reader = new FileReader();
    reader.onerror = () => {
      window.showToast('Fehler beim Lesen der lokalen ZIP-Datei.', 'error');
      resetZipImport();
    };

    reader.onload = async () => {
      try {
        const base64Data = reader.result;
        currentZipBase64 = base64Data;

        const res = await api('/rigs/validate-zip', {
          method: 'POST',
          body: JSON.stringify({ zipBase64: base64Data })
        });

        const report = res.data?.report || res.report || res.data;
        currentScanReport = report;

        renderScanResults(file, report);
      } catch (err) {
        window.showToast('Sicherheitsprüfung fehlgeschlagen: ' + err.message, 'error');
        resetZipImport();
      } finally {
        if (dropzone) {
          dropzone.innerHTML = `
            <div style="font-size: 2.4rem; margin-bottom: 8px;">📦</div>
            <h3 style="margin: 0 0 6px 0; color: #fff; font-size: 1.15rem;">ZIP-Datei hier ablegen oder durchsuchen</h3>
            <p style="margin: 0; color: var(--text-dim); font-size: 0.85rem;">Unterstützt .zip mit index.html, Assets, Scripts und optionalem docs.json Manifest (Max. 50 MB)</p>
            <input type="file" id="zip-file-input" accept=".zip,application/zip" style="display: none;">
          `;
          const newFileInput = document.getElementById('zip-file-input');
          if (newFileInput) {
            newFileInput.addEventListener('change', () => {
              const f = newFileInput.files?.[0];
              if (f) handleZipFile(f);
            });
          }
        }
      }
    };

    reader.readAsDataURL(file);
  }

  function renderScanResults(file, report) {
    const resultsPanel = document.getElementById('zip-scan-results');
    const titleEl = document.getElementById('scan-status-title');
    const filesSummaryEl = document.getElementById('scan-files-summary');
    const badgeEl = document.getElementById('scan-score-badge');
    const issuesListEl = document.getElementById('scan-issues-list');
    const submitBtn = document.getElementById('btn-submit-zip-import');

    if (!resultsPanel) return;
    resultsPanel.style.display = 'block';

    const isPassed = report.valid && report.status === 'passed';
    const isWarning = report.valid && report.status === 'warning';
    const isRejected = !report.valid || report.status === 'rejected';

    if (isPassed) {
      if (titleEl) titleEl.innerHTML = '<span style="color: var(--neon-emerald)">Sicherheitsprüfung bestanden</span>';
      if (badgeEl) {
        badgeEl.className = 'badge badge-success';
        badgeEl.textContent = `Score: ${report.score}/100 • Geprüft`;
        badgeEl.style.background = 'rgba(16, 185, 129, 0.2)';
        badgeEl.style.color = '#10b981';
        badgeEl.style.border = '1px solid rgba(16, 185, 129, 0.4)';
      }
    } else if (isWarning) {
      if (titleEl) titleEl.innerHTML = '<span style="color: var(--neon-amber)">Bestanden mit Hinweisen</span>';
      if (badgeEl) {
        badgeEl.className = 'badge badge-warning';
        badgeEl.textContent = `Score: ${report.score}/100 • Warnung`;
        badgeEl.style.background = 'rgba(245, 158, 11, 0.2)';
        badgeEl.style.color = '#f59e0b';
        badgeEl.style.border = '1px solid rgba(245, 158, 11, 0.4)';
      }
    } else {
      if (titleEl) titleEl.innerHTML = '<span style="color: var(--neon-rose)">Blockiert: Schadcode / Verstoß</span>';
      if (badgeEl) {
        badgeEl.className = 'badge badge-danger';
        badgeEl.textContent = `Score: ${report.score}/100 • Abgewiesen`;
        badgeEl.style.background = 'rgba(244, 63, 94, 0.2)';
        badgeEl.style.color = '#f43f5e';
        badgeEl.style.border = '1px solid rgba(244, 63, 94, 0.4)';
      }
    }

    if (filesSummaryEl) {
      filesSummaryEl.textContent = `Archiv: ${file.name} (${(file.size / 1024).toFixed(1)} KB) • ${report.filesScanned || 0} Dateien gescannt • Einstieg: ${report.entryFile || 'index.html'}`;
    }

    // Issues list rendering
    if (issuesListEl) {
      if (!report.issues || report.issues.length === 0) {
        issuesListEl.innerHTML = `
          <div style="padding: 10px 14px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-sm); color: #34d399; display: flex; align-items: center; gap: 8px;">
            <span>✓</span> Keine bösartigen Signaturen, Backdoors, Zip-Slip oder eval()-Aufrufe entdeckt. Projekt ist bereit für PlayRig.
          </div>
        `;
      } else {
        let issuesHtml = '<div style="display: flex; flex-direction: column; gap: 8px;">';
        for (const issue of report.issues) {
          let badgeColor = '#f43f5e';
          let badgeBg = 'rgba(244, 63, 94, 0.15)';
          if (issue.level === 'warning') {
            badgeColor = '#f59e0b';
            badgeBg = 'rgba(245, 158, 11, 0.15)';
          } else if (issue.level === 'info') {
            badgeColor = '#00f0ff';
            badgeBg = 'rgba(0, 240, 255, 0.15)';
          }

          issuesHtml += `
            <div style="padding: 8px 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; gap: 12px;">
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-weight: 600; color: #fff;">${escapeHtml(issue.message)}</span>
                <span style="font-size: 0.75rem; color: var(--text-dim); font-family: var(--font-mono);">${issue.file ? escapeHtml(issue.file) : 'Archiv'}${issue.snippet ? ` — Code: "${escapeHtml(issue.snippet)}"` : ''}</span>
              </div>
              <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: ${badgeColor}; background: ${badgeBg}; padding: 3px 8px; border-radius: 4px; border: 1px solid ${badgeColor};">
                ${issue.level || 'danger'}
              </span>
            </div>
          `;
        }
        issuesHtml += '</div>';
        issuesListEl.innerHTML = issuesHtml;
      }
    }

    // Pre-fill form fields
    const titleInput = document.getElementById('zip-import-title');
    const catInput = document.getElementById('zip-import-cat');
    const authorInput = document.getElementById('zip-import-author');
    const copyrightInput = document.getElementById('zip-import-copyright');

    if (titleInput) {
      titleInput.value = report.metadata?.title || file.name.replace(/\.zip$/i, '').replace(/[-_]/g, ' ');
    }
    if (catInput && report.metadata?.category) {
      catInput.value = report.metadata.category;
    }
    if (authorInput) {
      authorInput.value = report.metadata?.author || (state.user ? (state.user.name || state.user.username) : '');
    }
    if (copyrightInput) {
      if (report.metadata?.copyright) {
        copyrightInput.value = report.metadata.copyright;
      } else {
        const auth = authorInput ? authorInput.value : '';
        const isLiath = auth.toLowerCase() === 'liath' || (state.user && state.user.username === 'creator');
        copyrightInput.value = isLiath ? '© GameChiller' : (auth ? `© ${auth}` : '© GameChiller');
      }
    }

    // Toggle button state based on validity
    if (submitBtn) {
      submitBtn.disabled = isRejected;
      if (isRejected) {
        submitBtn.title = 'Projekt kann aufgrund von Sicherheitsverletzungen nicht importiert werden.';
      } else {
        submitBtn.title = 'Projekt freigeben und in PlayRig importieren';
      }
    }

    // Populate existing rigs dropdown and check for auto-matching
    populateTargetRigSelect();

    const matchedRig = (state.rigs || []).find(r =>
      (report.metadata?.id && r.id.toLowerCase() === report.metadata.id.toLowerCase()) ||
      (report.metadata?.title && r.title.toLowerCase() === report.metadata.title.toLowerCase())
    );

    if (matchedRig) {
      const modeUpdate = document.getElementById('zip-mode-update');
      if (modeUpdate) modeUpdate.checked = true;
      toggleZipImportMode('update');
      const select = document.getElementById('zip-target-rig-select');
      if (select) {
        select.value = matchedRig.id;
        onTargetRigSelected(matchedRig.id);
      }
    } else {
      const modeCreate = document.getElementById('zip-mode-create');
      if (modeCreate) modeCreate.checked = true;
      toggleZipImportMode('create');
    }
  }

  // ==========================================
  // PUSH RIG TO GITHUB BRANCH (STUDIO)
  // ==========================================
  function openStudioPushRigModal(rig) {
    const modal = document.getElementById('modal-studio-push-rig');
    const idInput = document.getElementById('studio-push-rig-id');
    const branchInput = document.getElementById('studio-push-rig-branch');
    const msgInput = document.getElementById('studio-push-rig-message');
    const titleSpan = document.getElementById('studio-push-rig-title');
    const resultBox = document.getElementById('studio-push-rig-result');

    if (!modal) return;
    if (idInput) idInput.value = rig.id;
    if (titleSpan) titleSpan.textContent = `Rig '${rig.title}' zu GitHub pushen`;
    if (branchInput) branchInput.value = `rig/${rig.id}`;
    if (msgInput) msgInput.value = `feat(rig): update ${rig.title} (${rig.id})`;
    if (resultBox) resultBox.style.display = 'none';

    modal.classList.add('active');
  }

  function closeStudioPushRigModal() {
    const modal = document.getElementById('modal-studio-push-rig');
    if (modal) modal.classList.remove('active');
  }

  function bindStudioPushRigForms() {
    const form = document.getElementById('form-studio-push-rig');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rigId = document.getElementById('studio-push-rig-id').value;
        const branchName = document.getElementById('studio-push-rig-branch').value.trim();
        const commitMessage = document.getElementById('studio-push-rig-message').value.trim();
        const submitBtn = document.getElementById('btn-submit-studio-push-rig');
        const resultBox = document.getElementById('studio-push-rig-result');
        const prLink = document.getElementById('studio-push-rig-pr-link');

        try {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Pushe zu GitHub...';
          }
          window.showToast(`Erstelle Branch '${branchName}' & pushe Rig zu GitHub...`, 'info');

          const res = await api('/v1/updater/push-rig', {
            method: 'POST',
            body: JSON.stringify({ rigId, branchName, commitMessage })
          });

          const data = res.data || res;
          window.showToast(`Branch '${data.branch}' erfolgreich zu GitHub übertragen!`, 'success');

          if (resultBox && prLink) {
            resultBox.style.display = 'block';
            prLink.href = data.pullRequestUrl || 'https://github.com/AmFearLiath/PlayRig/pulls';
          }
        } catch (err) {
          window.showToast('Fehler beim Pushen: ' + err.message, 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '🚀 Branch erstellen & pushen';
          }
        }
      });
    }
  }

  async function syncRigsFromDisk() {
    try {
      window.showToast('Scanne Ordner rigs/ auf Festplatte...', 'info');
      const res = await api('/rigs/sync', { method: 'POST' });
      const data = res.data || res;
      const count = data.newlyRegistered?.length || 0;
      const scanned = data.scanned || 0;
      if (count > 0) {
        window.showToast(`Erfolg: ${scanned} Rigs gescannt, ${count} neue Rigs registriert (${data.newlyRegistered.join(', ')})!`, 'success');
      } else {
        window.showToast(`Katalog ist aktuell (${scanned} Rigs auf Festplatte geprüft, keine neuen).`, 'info');
      }
      await loadMyTools();
      await loadDashboard();
    } catch (err) {
      window.showToast('Fehler bei Festplatten-Synchronisation: ' + err.message, 'error');
    }
  }

  window.switchView = switchView;
  window.openRigEditor = openRigEditor;
  window.setImporterTab = setImporterTab;
  window.resetZipImport = resetZipImport;
  window.toggleZipImportMode = toggleZipImportMode;
  window.onTargetRigSelected = onTargetRigSelected;
  window.openStudioPushRigModal = openStudioPushRigModal;
  window.closeStudioPushRigModal = closeStudioPushRigModal;
  window.syncRigsFromDisk = syncRigsFromDisk;

  document.addEventListener('DOMContentLoaded', init);
})();

