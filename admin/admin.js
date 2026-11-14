/**
 * PLAYRIG ADMIN PANEL - GOVERNANCE CONTROLLER
 * User Administration, MySQL Audit-Logs, System Categories & Server Status
 */

(function () {
  'use strict';

  const state = {
    token: localStorage.getItem('playrig_token') || localStorage.getItem('nexus_token') || null,
    user: null,
    activeView: 'dashboard',
    users: [],
    rigs: [],
    categories: [],
    logs: [],
    systemInfo: null
  };

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

  async function init() {
    bindNavigation();
    bindForms();

    if (state.token) {
      try {
        const meRes = await api('/auth/me');
        if (meRes.user) {
          state.user = meRes.user;
          if (state.user.role !== 'admin') {
            window.showToast('Administrator-Rechte erforderlich. Weiterleitung zum Studio...', 'warning');
            setTimeout(() => window.location.href = '/studio', 1200);
            return;
          }
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
    checkUpdateNotification();
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
  }

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
      'dashboard': 'System-Übersicht',
      'all-rigs': 'Globale Rig-Registry',
      'users': 'Benutzerverwaltung (MySQL)',
      'categories': 'Kategorien & FX',
      'logs': 'MySQL Audit-Logs',
      'server': 'MySQL & Server Status',
      'updater': 'System-Updater & GitHub Sync'
    };
    document.getElementById('breadcrumb-view-title').textContent = viewTitles[viewName] || 'Admin';

    document.querySelectorAll('.admin-view-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const activePanel = document.getElementById(`view-${viewName}`);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    if (viewName === 'dashboard') loadDashboard();
    if (viewName === 'all-rigs') loadAllRigsView();
    if (viewName === 'users') loadUsersView();
    if (viewName === 'categories') loadCategoriesView();
    if (viewName === 'logs') loadLogsView();
    if (viewName === 'server') loadServerView();
    if (viewName === 'updater') loadUpdaterView();
  }

  function bindNavigation() {
    document.querySelectorAll('.sidebar-nav-item[data-view]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(item.dataset.view);
      });
    });

    // Profile Dropdown Toggle
    const profileChip = document.getElementById('admin-profile-chip');
    const profileDropdown = document.getElementById('admin-profile-dropdown');
    const profileWrapper = document.getElementById('admin-profile-wrapper');

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

    document.getElementById('btn-admin-fx')?.addEventListener('click', () => {
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
  }

  async function loadDashboard() {
    try {
      const [users, rigs, logs] = await Promise.all([
        api('/admin/users'),
        api('/rigs'),
        api('/admin/logs')
      ]);

      state.users = users;
      state.rigs = rigs;

      document.getElementById('metric-total-users').textContent = users.length;
      document.getElementById('metric-total-rigs').textContent = rigs.length;
      document.getElementById('metric-public-rigs').textContent = rigs.filter(r => r.access === 'public' || r.isPublic).length;
      document.getElementById('metric-private-rigs').textContent = rigs.filter(r => r.access === 'private' || !r.isPublic).length;

      const timelineEl = document.getElementById('dashboard-activity-list');
      if (timelineEl) {
        timelineEl.innerHTML = '';
        const recent = logs.slice(0, 8);
        if (recent.length === 0) {
          timelineEl.innerHTML = '<div style="color:var(--text-dim); padding:16px 0;">Keine aktuellen Aktivitäten.</div>';
        } else {
          recent.forEach(log => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid var(--border-subtle); font-size: 0.85rem;';
            row.innerHTML = `
              <div style="display:flex; align-items:center; gap:10px;">
                <span class="badge badge-cyan" style="font-size:0.7rem;">${log.action}</span>
                <span><strong>${log.username || 'System'}:</strong> ${log.details}</span>
              </div>
              <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-dim);">${new Date(log.timestamp).toLocaleTimeString()}</span>
            `;
            timelineEl.appendChild(row);
          });
        }
      }
    } catch (err) {
      window.showToast('Fehler beim Laden des Dashboards: ' + err.message, 'error');
    }
  }

  async function loadAllRigsView() {
    try {
      const rigs = await api('/rigs');
      const tbody = document.getElementById('all-rigs-tbody');
      tbody.innerHTML = '';

      if (rigs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-dim);">Keine Rigs registriert.</td></tr>';
        return;
      }

      rigs.forEach(rig => {
        const tr = document.createElement('tr');
        const isPub = rig.access === 'public' || rig.isPublic;
        tr.innerHTML = `
          <td>
            <div style="font-weight:700; color:#fff;">${rig.title}</div>
            <div style="font-family:var(--font-mono); font-size:0.75rem; color:var(--cyan-400);">${rig.id}</div>
          </td>
          <td><span class="badge badge-indigo">${rig.category} • ${rig.subcategory}</span></td>
          <td style="color:#fff; font-size:0.85rem;">${rig.author || 'Liath'}</td>
          <td>
            <span class="badge badge-${isPub ? 'emerald' : 'amber'}">${isPub ? 'Öffentlich' : 'Privat'}</span>
            <span class="badge badge-cyan" style="margin-left:4px;">${rig.version || 'v0.0.1'}</span>
          </td>
          <td style="font-family:var(--font-mono); font-size:0.78rem; color:var(--text-dim);">
            ${rig.views || 0} Views • ${rig.forks || 0} Forks
          </td>
          <td style="text-align:right;">
            <div style="display:inline-flex; gap:6px;">
              <button class="btn btn-secondary btn-sm btn-push-rig" data-id="${rig.id}" title="Rig in isoliertem Branch zu GitHub pushen">🐙 Push</button>
              <a href="/studio" class="btn btn-primary btn-sm" title="Im Studio bearbeiten">⚡ Studio</a>
              <a href="/${rig.path}" class="btn btn-ghost btn-sm" title="Vorschau im selben Fenster">↗</a>
              <button class="btn btn-ghost btn-sm btn-del-rig" data-id="${rig.id}" style="color:var(--rose-400);">✕</button>
            </div>
          </td>
        `;

        tr.querySelector('.btn-push-rig')?.addEventListener('click', () => {
          openPushRigModal(rig);
        });

        tr.querySelector('.btn-del-rig').addEventListener('click', async () => {
          if (confirm(`Rig '${rig.title}' unwiderruflich aus MySQL und von der Festplatte löschen?`)) {
            try {
              await api(`/rigs/${rig.id}`, { method: 'DELETE' });
              window.showToast(`Rig '${rig.title}' gelöscht`, 'info');
              loadAllRigsView();
            } catch (e) {
              window.showToast('Fehler: ' + e.message, 'error');
            }
          }
        });

        tbody.appendChild(tr);
      });
    } catch (err) {
      window.showToast('Fehler beim Laden der Rigs: ' + err.message, 'error');
    }
  }

  async function loadUsersView() {
    try {
      const users = await api('/admin/users');
      const tbody = document.getElementById('users-table-body');
      tbody.innerHTML = '';

      users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <div class="user-avatar-circle">${u.username.substring(0,2).toUpperCase()}</div>
              <div>
                <div style="font-weight:700;">${u.name || u.displayName || u.username}</div>
                <div style="font-size:0.75rem; color:var(--text-dim);">@${u.username}</div>
              </div>
            </div>
          </td>
          <td><span class="badge badge-${u.role === 'admin' ? 'rose' : 'cyan'}">${u.role.toUpperCase()}</span></td>
          <td style="font-family:var(--font-mono); font-size:0.78rem; color:var(--text-dim);">${new Date(u.created_at || u.createdAt || Date.now()).toLocaleDateString()}</td>
          <td><span class="badge badge-emerald">${u.status || 'active'}</span></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      window.showToast('Fehler beim Laden der Benutzer: ' + err.message, 'error');
    }
  }

  async function loadCategories() {
    try {
      state.categories = await api('/categories');
    } catch (e) {
      console.warn('Categories error:', e);
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
        <div style="display:flex; flex-wrap:wrap; gap:8px;">${subTags}</div>
      `;
      container.appendChild(card);
    });
  }

  async function loadLogsView() {
    try {
      const logs = await api('/admin/logs');
      const tbody = document.getElementById('logs-table-body');
      tbody.innerHTML = '';

      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--text-dim);">Keine Audit-Logs vorhanden.</td></tr>';
        return;
      }

      logs.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-dim);">${new Date(l.timestamp).toLocaleString()}</td>
          <td><span style="font-weight:600; color:#fff;">${l.username || 'system'}</span></td>
          <td><span class="badge badge-cyan" style="font-size:0.7rem;">${l.action}</span></td>
          <td>${l.details}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      window.showToast('Fehler beim Laden der Logs: ' + err.message, 'error');
    }
  }

  async function loadServerView() {
    try {
      const sys = await api('/admin/system');
      const container = document.getElementById('server-stats-grid');
      container.innerHTML = `
        <div class="admin-metric-card">
          <div class="admin-metric-header"><span>Datenbank</span><span>🐬</span></div>
          <div class="admin-metric-value" style="font-size: 1.1rem; color: var(--emerald-400);">MySQL (3307)</div>
          <span style="font-size: 0.75rem; color: var(--text-dim);">playrig_db verbunden</span>
        </div>
        <div class="admin-metric-card">
          <div class="admin-metric-header"><span>Node Version</span><span>⚡</span></div>
          <div class="admin-metric-value" style="font-size: 1.1rem;">${sys.nodeVersion}</div>
          <span style="font-size: 0.75rem; color: var(--text-dim);">${sys.platform} (${sys.arch})</span>
        </div>
        <div class="admin-metric-card">
          <div class="admin-metric-header"><span>Arbeitsspeicher</span><span>🧠</span></div>
          <div class="admin-metric-value" style="font-size: 1.1rem;">${(sys.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)} MB</div>
          <span style="font-size: 0.75rem; color: var(--text-dim);">Heap Belegung</span>
        </div>
        <div class="admin-metric-card">
          <div class="admin-metric-header"><span>Uptime</span><span>⏱️</span></div>
          <div class="admin-metric-value" style="font-size: 1.1rem;">${Math.floor(sys.processUptime / 60)} min</div>
          <span style="font-size: 0.75rem; color: var(--text-dim);">Server Laufzeit</span>
        </div>
      `;
    } catch (err) {
      window.showToast('Fehler: ' + err.message, 'error');
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

        if (auth.user.role !== 'admin') {
          throw new Error('Nur Administratoren haben Zugriff auf das Admin-Panel.');
        }

        state.token = auth.token;
        state.user = auth.user;
        localStorage.setItem('playrig_token', auth.token);

        window.showToast(`Willkommen im Admin-Panel, ${auth.user.name}!`, 'success');
        onAuthenticated();
      } catch (err) {
        window.showToast('Login fehlgeschlagen: ' + err.message, 'error');
      }
    });

    const userForm = document.getElementById('form-create-user');
    if (userForm) {
      userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('new-user-username').value;
        const displayName = document.getElementById('new-user-displayname').value;
        const password = document.getElementById('new-user-password').value;
        const role = document.getElementById('new-user-role').value;

        try {
          await api('/admin/users', {
            method: 'POST',
            body: JSON.stringify({ username, displayName, password, role })
          });
          window.showToast(`Benutzer ${username} in MySQL angelegt!`, 'success');
          userForm.reset();
          loadUsersView();
        } catch (err) {
          window.showToast('Fehler: ' + err.message, 'error');
        }
      });
    }

    bindUpdaterForms();
  }

  // ==========================================
  // UPDATER & GITHUB SYNC
  // ==========================================
  async function checkUpdateNotification() {
    try {
      const res = await api('/v1/updater/status');
      const data = res.data || res;
      updateNotificationBadges(data);
    } catch (e) {
      console.warn('Update-Prüfung im Hintergrund fehlgeschlagen:', e.message);
    }
  }

  function updateNotificationBadges(data) {
    const pill = document.getElementById('admin-update-pill');
    const pillText = document.getElementById('admin-update-pill-text');
    const banner = document.getElementById('dashboard-update-banner');
    const bannerBadge = document.getElementById('banner-update-count-badge');
    const bannerDesc = document.getElementById('dashboard-update-summary');
    const sideBadge = document.getElementById('sidebar-update-badge');

    if (data && data.hasUpdate && data.behind > 0) {
      const countText = `${data.behind} neue${data.behind > 1 ? 'r' : ''} Commit${data.behind > 1 ? 's' : ''}`;
      if (pill) {
        pill.style.display = 'inline-flex';
        pillText.textContent = `🚀 Update verfügbar (${data.behind})`;
      }
      if (banner) {
        banner.style.display = 'flex';
        if (bannerBadge) bannerBadge.textContent = countText;
        if (bannerDesc) bannerDesc.textContent = `Auf GitHub (origin/main) sind ${data.behind} neue Commits verfügbar.`;
      }
      if (sideBadge) {
        sideBadge.style.display = 'inline-block';
        sideBadge.textContent = `${data.behind} NEU`;
      }
    } else {
      if (pill) pill.style.display = 'none';
      if (banner) banner.style.display = 'none';
      if (sideBadge) sideBadge.style.display = 'none';
    }
  }

  async function checkUpdates(force = false) {
    const btn = document.getElementById('btn-force-check-update');
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Prüfe GitHub...';
      }
      window.showToast('Prüfe GitHub auf Updates...', 'info');

      const res = await api('/v1/updater/check', { method: 'POST' });
      const data = res.data || res;
      updateNotificationBadges(data);
      renderUpdaterUI(data);

      if (data.hasUpdate) {
        window.showToast(`${data.behind} neue Commits auf GitHub verfügbar!`, 'success');
      } else {
        window.showToast('System und Rigs sind auf dem neuesten Stand.', 'info');
      }
    } catch (err) {
      window.showToast('Fehler bei Update-Prüfung: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔄 Jetzt prüfen';
      }
    }
  }

  async function loadUpdaterView() {
    try {
      const res = await api('/v1/updater/status');
      const data = res.data || res;
      updateNotificationBadges(data);
      renderUpdaterUI(data);
    } catch (err) {
      window.showToast('Fehler beim Laden des Update-Status: ' + err.message, 'error');
    }
  }

  function renderUpdaterUI(data) {
    if (!data) return;

    const localHash = document.getElementById('updater-local-hash');
    const localMsg = document.getElementById('updater-local-msg');
    const remoteHash = document.getElementById('updater-remote-hash');
    const remoteMsg = document.getElementById('updater-remote-msg');
    const statusText = document.getElementById('updater-status-text');
    const behindAhead = document.getElementById('updater-behind-ahead');
    const worktreeStatus = document.getElementById('updater-worktree-status');
    const lastChecked = document.getElementById('updater-last-checked');
    const actionHeading = document.getElementById('updater-action-heading');
    const actionDesc = document.getElementById('updater-action-desc');
    const btnApply = document.getElementById('btn-apply-update');
    const incomingContainer = document.getElementById('updater-incoming-container');
    const incomingTbody = document.getElementById('updater-incoming-tbody');

    if (localHash) localHash.textContent = data.local?.hash || '--';
    if (localMsg) localMsg.textContent = data.local?.message || 'Kein Commit';
    if (remoteHash) remoteHash.textContent = data.remote?.hash || '--';
    if (remoteMsg) remoteMsg.textContent = data.remote?.message || 'Kein Remote';

    if (statusText) {
      if (data.hasUpdate) {
        statusText.innerHTML = '<span style="color: var(--neon-cyan)">Update verfügbar</span>';
      } else if (data.ahead > 0) {
        statusText.innerHTML = '<span style="color: var(--neon-purple)">Lokale Commits (Ahead)</span>';
      } else {
        statusText.innerHTML = '<span style="color: var(--neon-emerald)">Synchronisiert ✓</span>';
      }
    }

    if (behindAhead) {
      behindAhead.textContent = `${data.behind || 0} Behind • ${data.ahead || 0} Ahead (Branch: ${data.branch || 'main'})`;
    }

    if (worktreeStatus) {
      if (data.isClean) {
        worktreeStatus.innerHTML = '<span style="color: var(--neon-emerald); font-size: 1rem;">Sauber (Keine Diffs)</span>';
      } else {
        worktreeStatus.innerHTML = `<span style="color: var(--neon-amber); font-size: 1rem;">${data.modifiedCount || 0} lokale Dateien modifiziert</span>`;
      }
    }

    if (lastChecked) {
      const timeStr = data.lastChecked ? new Date(data.lastChecked).toLocaleTimeString() : '--';
      lastChecked.textContent = `Zuletzt geprüft: ${timeStr}`;
    }

    if (actionHeading && actionDesc && btnApply) {
      if (data.hasUpdate) {
        actionHeading.textContent = `Update verfügbar: ${data.behind} neue Commits`;
        actionDesc.textContent = `Synchronisiere alle neuen Rigs, Kern-Module und Datenbank-Definitionen von GitHub.`;
        btnApply.style.display = 'inline-block';
        btnApply.className = 'btn btn-primary fx-ripple';
        btnApply.textContent = `🚀 System & Rigs jetzt aktualisieren (${data.behind} Commits)`;
      } else {
        actionHeading.textContent = 'System & Rigs sind aktuell';
        actionDesc.textContent = 'Dein System stimmt mit dem offiziellen Stand auf GitHub überein.';
        btnApply.className = 'btn btn-secondary';
        btnApply.textContent = '🔄 System erneut synchronisieren';
      }
    }

    if (incomingContainer && incomingTbody) {
      if (data.incomingCommits && data.incomingCommits.length > 0) {
        incomingContainer.style.display = 'block';
        incomingTbody.innerHTML = data.incomingCommits.map(c => `
          <tr>
            <td><code class="badge badge-cyan font-mono">${c.hash}</code></td>
            <td style="color:#fff; font-size:0.85rem;">${c.author}</td>
            <td style="color:var(--text-dim); font-size:0.8rem;">${c.relativeTime}</td>
            <td style="color:var(--text-primary); font-size:0.88rem;">${c.message}</td>
          </tr>
        `).join('');
      } else {
        incomingContainer.style.display = 'none';
        incomingTbody.innerHTML = '';
      }
    }
  }

  async function applyUpdate() {
    const btn = document.getElementById('btn-apply-update');
    const consoleContainer = document.getElementById('updater-console-container');
    const consoleOut = document.getElementById('updater-console-output');

    if (!confirm('Möchtest du das PlayRig-System und alle Rigs jetzt mit GitHub synchronisieren?')) {
      return;
    }

    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Aktualisiere System & Rigs...';
      }
      if (consoleContainer) consoleContainer.style.display = 'block';
      if (consoleOut) consoleOut.textContent = 'Starte Update via Git Rebase & DB-Sync...\n';

      window.showToast('Lade neueste Version von GitHub herunter...', 'info');

      const res = await api('/v1/updater/apply', { method: 'POST' });
      const data = res.data || res;

      if (consoleOut && data.logs) {
        consoleOut.textContent = data.logs.join('\n');
      }

      window.showToast('System und Rigs erfolgreich aktualisiert!', 'success');
      await checkUpdates(true);
    } catch (err) {
      if (consoleOut) consoleOut.textContent += `\nFEHLER: ${err.message}`;
      window.showToast('Fehler bei Aktualisierung: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🚀 System & Rigs jetzt aktualisieren';
      }
    }
  }

  // ==========================================
  // PUSH RIG TO GITHUB BRANCH MODAL
  // ==========================================
  function openPushRigModal(rig) {
    const modal = document.getElementById('modal-push-rig');
    const idInput = document.getElementById('push-rig-id');
    const branchInput = document.getElementById('push-rig-branch');
    const msgInput = document.getElementById('push-rig-message');
    const titleSpan = document.getElementById('modal-push-rig-title');
    const resultBox = document.getElementById('push-rig-result');

    if (!modal) return;
    if (idInput) idInput.value = rig.id;
    if (titleSpan) titleSpan.textContent = `Rig '${rig.title}' zu GitHub pushen`;
    if (branchInput) branchInput.value = `rig/${rig.id}`;
    if (msgInput) msgInput.value = `feat(rig): update ${rig.title} (${rig.id})`;
    if (resultBox) resultBox.style.display = 'none';

    modal.classList.add('active');
  }

  function closePushRigModal() {
    const modal = document.getElementById('modal-push-rig');
    if (modal) modal.classList.remove('active');
  }

  function bindUpdaterForms() {
    const form = document.getElementById('form-push-rig');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rigId = document.getElementById('push-rig-id').value;
        const branchName = document.getElementById('push-rig-branch').value.trim();
        const commitMessage = document.getElementById('push-rig-message').value.trim();
        const submitBtn = document.getElementById('btn-submit-push-rig');
        const resultBox = document.getElementById('push-rig-result');
        const prLink = document.getElementById('push-rig-pr-link');

        try {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Pushe zu GitHub...';
          }
          window.showToast(`Erstelle Branch '${branchName}' & übertrage Rig...`, 'info');

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
      const res = await api('/v1/rigs/sync', { method: 'POST' });
      const data = res.data || res;
      const count = data.newlyRegistered?.length || 0;
      const scanned = data.scanned || 0;
      if (count > 0) {
        window.showToast(`Erfolg: ${scanned} Rigs gescannt, ${count} neue Rigs registriert (${data.newlyRegistered.join(', ')})!`, 'success');
      } else {
        window.showToast(`Katalog ist aktuell (${scanned} Rigs auf Festplatte geprüft, keine neuen).`, 'info');
      }
      loadAllRigsView();
      loadDashboardMetrics();
    } catch (err) {
      window.showToast('Fehler bei Festplatten-Synchronisation: ' + err.message, 'error');
    }
  }

  window.switchView = switchView;
  window.checkUpdates = checkUpdates;
  window.applyUpdate = applyUpdate;
  window.syncRigsFromDisk = syncRigsFromDisk;
  window.openPushRigModal = openPushRigModal;
  window.closePushRigModal = closePushRigModal;
  document.addEventListener('DOMContentLoaded', init);
})();
