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
      throw new Error(data.error || `HTTP ${res.status}`);
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
      'server': 'MySQL & Server Status'
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
              <a href="/studio" class="btn btn-primary btn-sm" title="Im Studio bearbeiten">⚡ Studio</a>
              <a href="/${rig.path}" target="_blank" class="btn btn-ghost btn-sm">↗</a>
              <button class="btn btn-ghost btn-sm btn-del-rig" data-id="${rig.id}" style="color:var(--rose-400);">✕</button>
            </div>
          </td>
        `;

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
  }

  window.switchView = switchView;
  document.addEventListener('DOMContentLoaded', init);
})();
