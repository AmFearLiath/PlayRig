/**
 * PLAYRIG PLATFORM - DECK CONTROLLER
 * Curated Discovery Arena, Interactive Carousels & Deep Catalog
 */

(function () {
  'use strict';

  let currentCategory = 'all';
  let currentSearchQuery = '';
  let currentSortBy = 'featured';
  let currentViewMode = 'detailed'; // 'detailed' | 'compact'
  let activeDeckMode = 'discovery'; // 'discovery' | 'catalog'
  let activeRig = null;
  let currentUser = null;

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay, .sandbox-modal').forEach(m => m.classList.remove('active'));
    const profileDropdown = document.getElementById('hub-profile-dropdown');
    const profileWrapper = document.getElementById('hub-profile-wrapper');
    if (profileDropdown) profileDropdown.classList.remove('active');
    if (profileWrapper) profileWrapper.classList.remove('active');
  }

  // Check Authentication Status on Deck
  async function checkAuthStatus() {
    const token = localStorage.getItem('playrig_token') || localStorage.getItem('nexus_token');
    if (!token) {
      currentUser = null;
      renderAuthUI();
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      currentUser = data.user || null;
    } catch (e) {
      currentUser = null;
    }
    renderAuthUI();
  }

  function renderAuthUI() {
    const container = document.getElementById('hub-auth-container');
    if (!container) return;

    if (!currentUser) {
      container.innerHTML = `
        <button id="btn-hub-login" class="btn btn-primary btn-sm fx-ripple">
          🔑 Anmelden
        </button>
      `;
      container.querySelector('#btn-hub-login').addEventListener('click', () => {
        closeAllModals();
        document.getElementById('hub-login-modal').classList.add('active');
      });
    } else {
      const initials = (currentUser.username || 'U').substring(0, 2).toUpperCase();
      const isAdmin = currentUser.role === 'admin';

      container.innerHTML = `
        <div class="profile-dropdown-wrapper" id="hub-profile-wrapper">
          <div class="user-profile-chip" id="hub-profile-chip" title="Profilmenü öffnen">
            <div class="user-avatar-circle">${initials}</div>
            <div class="user-info-text">
              <span class="user-name">${currentUser.name || currentUser.displayName || currentUser.username}</span>
              <span class="user-role-label">${currentUser.role.toUpperCase()}</span>
            </div>
            <span class="user-chip-caret">▼</span>
          </div>

          <div class="profile-dropdown-menu" id="hub-profile-dropdown">
            <div style="padding: 10px 14px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 4px;">
              <div style="font-weight: 700; font-size: 0.9rem; color: #ffffff;">${currentUser.name || currentUser.displayName || currentUser.username}</div>
              <div style="font-size: 0.75rem; color: var(--cyan-400); font-family: var(--font-mono);">@${currentUser.username} (${currentUser.role})</div>
            </div>
            <a href="/studio" class="dropdown-item">⚡ PlayRig Studio (Code-Editor)</a>
            ${isAdmin ? `<a href="/admin" class="dropdown-item" style="color:var(--rose-400);">🛡️ Admin-Panel (MySQL)</a>` : ''}
            <button type="button" class="dropdown-item" id="btn-dropdown-fx">🎨 FX & Style Lab öffnen</button>
            <button type="button" class="dropdown-item" id="btn-dropdown-toggle-fx-btn">👁️ FX-Button de/aktivieren</button>
            <div class="dropdown-divider"></div>
            <button type="button" class="dropdown-item" id="btn-dropdown-logout" style="color: var(--rose-400);">🚪 Abmelden</button>
          </div>
        </div>
      `;

      const chip = container.querySelector('#hub-profile-chip');
      const dropdown = container.querySelector('#hub-profile-dropdown');
      const wrapper = container.querySelector('#hub-profile-wrapper');

      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
        wrapper.classList.toggle('active');
      });

      document.addEventListener('click', () => {
        dropdown.classList.remove('active');
        wrapper.classList.remove('active');
      });

      container.querySelector('#btn-dropdown-fx')?.addEventListener('click', () => {
        dropdown.classList.remove('active');
        if (window.PlayRigFX && window.PlayRigFX.togglePanel) {
          window.PlayRigFX.togglePanel();
        }
      });

      container.querySelector('#btn-dropdown-toggle-fx-btn')?.addEventListener('click', () => {
        dropdown.classList.remove('active');
        const fxBtn = document.getElementById('nexus-fx-lab-toggle');
        if (fxBtn) {
          fxBtn.classList.toggle('is-hidden');
          const isHidden = fxBtn.classList.contains('is-hidden');
          window.showToast(isHidden ? 'FX-Button ausgeblendet' : 'FX-Button sichtbar', 'info');
        }
      });

      container.querySelector('#btn-dropdown-logout')?.addEventListener('click', async () => {
        const token = localStorage.getItem('playrig_token') || localStorage.getItem('nexus_token');
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (e) {}
        localStorage.removeItem('playrig_token');
        localStorage.removeItem('nexus_token');
        currentUser = null;
        window.showToast('Erfolgreich abgemeldet', 'info');
        checkAuthStatus();
        init();
      });
    }
  }

  // Initialization
  async function init() {
    await checkAuthStatus();

    try {
      const token = localStorage.getItem('playrig_token') || localStorage.getItem('nexus_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/rigs', { headers });
      if (res.ok) {
        const dynamicRigs = await res.json();
        if (Array.isArray(dynamicRigs) && dynamicRigs.length > 0) {
          window.PLAYRIG_REGISTRY = dynamicRigs;
          window.NEXUS_REGISTRY = dynamicRigs;
        }
      }
    } catch (e) {
      // Standalone mode
    }

    renderCategoryFilters();
    renderDiscoveryView();
    renderCatalogTools();
    bindEvents();
  }

  function getRegistry() {
    return window.PLAYRIG_REGISTRY || window.NEXUS_REGISTRY || [];
  }

  // ==========================================================================
  // DISCOVERY & SHOWCASE VIEW (Katalogübersicht)
  // ==========================================================================
  function renderDiscoveryView() {
    const list = getRegistry();
    if (list.length === 0) return;

    // 1. Hero Spotlight (Featured or Top Rig)
    const featuredRig = list.find(r => r.featured) || list[0];
    const heroContainer = document.getElementById('hero-spotlight-section');

    if (heroContainer && featuredRig) {
      const directUrl = `/${featuredRig.path}`;
      const dir = featuredRig.path ? featuredRig.path.substring(0, featuredRig.path.lastIndexOf('/')) : '';
      const screenshotUrl = featuredRig.screenshot || featuredRig.thumbnail || (dir ? `/${dir}/thumbnail.png` : '/_shared/assets/placeholder-rig.png');

      heroContainer.innerHTML = `
        <div class="hero-spotlight-card fx-beam">
          <div class="hero-spotlight-info">
            <div class="hero-spotlight-badge-row">
              <span class="spotlight-featured-pill">⭐ Spotlight Flagship</span>
              <span class="badge badge-indigo">${featuredRig.category} • ${featuredRig.subcategory}</span>
              <span class="badge badge-cyan" style="font-family: var(--font-mono);">${featuredRig.version || 'v0.0.1'}</span>
              ${featuredRig.services && featuredRig.services.required && featuredRig.services.required.length > 0 ? `<span class="badge badge-amber" title="Erfordert Services: ${featuredRig.services.required.join(', ')}">⚡ ${featuredRig.services.required.join(', ')}</span>` : ''}
            </div>

            <h2 class="hero-spotlight-title"><span class="gradient-text">${featuredRig.title}</span></h2>
            <p class="hero-spotlight-desc">${featuredRig.description || 'Interaktives high-end Webmodul mit GameChiller-Integration.'}</p>

            <div class="hero-spotlight-meta-row">
              <span>👤 <strong>${featuredRig.author || 'Creator'}</strong></span>
              <span>${featuredRig.copyright || (featuredRig.author ? '© ' + featuredRig.author : '© Community')}</span>
              <span>👁️ ${featuredRig.views || 142} Aufrufe</span>
              <span>⭐ ${featuredRig.stars || 48} Sterne</span>
            </div>

            <div class="hero-spotlight-actions">
              <button class="btn btn-primary fx-ripple btn-hero-launch">
                Sandbox Runner ▶
              </button>
              <a href="${directUrl}" class="btn btn-secondary">
                Vollbild Vorschau ↗
              </a>
              <button class="btn btn-secondary btn-hero-docs" title="Handbuch und API-Dokumentation">
                📖 Handbuch & Docs
              </button>
              <a href="/studio" class="btn btn-secondary">
                ⚡ Studio
              </a>
              <button class="btn btn-secondary btn-hero-fork" title="Rig klonen">
                ⚡ Fork
              </button>
            </div>
          </div>

          <div class="hero-spotlight-screenshot-wrap">
            <img src="${screenshotUrl}" alt="${featuredRig.title} Screenshot" class="hero-spotlight-screenshot" onerror="this.onerror=null; this.src='/_shared/assets/placeholder-rig.png';" />
            <div class="hero-spotlight-screenshot-overlay">
              <span class="spotlight-mode-badge">Static Snapshot • Instant Load</span>
              <button class="btn btn-secondary btn-sm btn-hero-refresh-ss" title="Screenshot neu generieren / aktualisieren">📸 Aktualisieren</button>
            </div>
          </div>
        </div>
      `;

      heroContainer.querySelector('.btn-hero-launch').addEventListener('click', () => openSandbox(featuredRig));
      heroContainer.querySelector('.btn-hero-docs').addEventListener('click', () => openDocsModal(featuredRig));
      heroContainer.querySelector('.btn-hero-fork').addEventListener('click', () => forkRigFromHub(featuredRig));
      heroContainer.querySelector('.btn-hero-refresh-ss').addEventListener('click', async () => {
        try {
          const img = heroContainer.querySelector('.hero-spotlight-screenshot');
          if (img) {
            img.src = `/api/v1/rigs/${featuredRig.id}/screenshot?t=${Date.now()}`;
            window.showToast?.('Screenshot-Snapshot erfolgreich aktualisiert!', 'success');
          }
        } catch (e) {
          window.showToast?.('Verbindungsfehler beim Screenshot-Refresh', 'error');
        }
      });
    }

    // 2. Carousel: Top Rated (Sorted by Stars)
    const topRated = [...list].sort((a, b) => (b.stars || 0) - (a.stars || 0));
    renderCarouselTrack('rail-top-rated', topRated);

    // 3. Carousel: Most Popular (Sorted by Views)
    const popular = [...list].sort((a, b) => (b.views || 0) - (a.views || 0));
    renderCarouselTrack('rail-popular', popular);

    // 4. Carousel: Animations & Visual FX
    const animations = list.filter(r => r.category.toLowerCase() === 'animations' || (r.tags && r.tags.some(t => t.toLowerCase().includes('anim'))));
    renderCarouselTrack('rail-animations', animations.length > 0 ? animations : list);

    // 5. Carousel: Newest
    const newest = [...list].sort((a, b) => new Date(b.created_at || b.updated_at || Date.now()) - new Date(a.created_at || a.updated_at || Date.now()));
    renderCarouselTrack('rail-newest', newest);
  }

  function renderCarouselTrack(elementId, rigs) {
    const track = document.getElementById(elementId);
    if (!track) return;
    track.innerHTML = '';

    rigs.slice(0, 8).forEach(rig => {
      const card = document.createElement('div');
      card.className = 'showcase-rig-card';

      const thumbUrl = rig.thumbnail || `/${rig.path.replace(/\/[^/]+$/, '')}/thumbnail.png`;
      const directUrl = `/${rig.path}`;

      card.innerHTML = `
        <div class="showcase-card-thumb">
          <span class="badge badge-cyan showcase-card-thumb-badge" style="font-size:0.68rem; font-family:var(--font-mono);">${rig.version || 'v0.0.1'}</span>
          <span class="showcase-card-stats-badge">⭐ ${rig.stars || 0} • 👁️ ${rig.views || 0}</span>
          
          <img class="showcase-thumb-img" src="${thumbUrl}" alt="${rig.title}" loading="lazy"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          
          <div class="showcase-thumb-fallback" style="display: none;">
            <div class="fallback-glow" style="background: ${rig.color || '#00d2ff'};"></div>
            <div class="fallback-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <span class="fallback-label">${rig.subcategory || rig.category}</span>
          </div>

          <div class="showcase-thumb-overlay">
            <button class="btn btn-primary btn-sm fx-ripple btn-thumb-launch">
              Sandbox ▶
            </button>
            <a href="${directUrl}" class="btn btn-secondary btn-sm" title="Vorschau">
              ↗
            </a>
          </div>
        </div>

        <div class="showcase-card-body">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:4px;">
            <span class="badge badge-indigo" style="font-size:0.7rem;">${rig.category} • ${rig.subcategory}</span>
            ${rig.services && rig.services.required && rig.services.required.length > 0 ? `<span class="badge badge-amber" style="font-size:0.62rem;" title="Erfordert PlayRig Backend Service: ${rig.services.required.join(', ')}">⚡ ${rig.services.required.join(', ')}</span>` : ''}
          </div>
          <h4 class="showcase-card-title">${rig.title}</h4>
          <p class="showcase-card-desc">${(rig.description || '').substring(0, 95)}...</p>
          <div style="font-size:0.75rem; color:var(--text-dim);">
            Author: <strong style="color:#fff;">${rig.author || 'Creator'}</strong>
          </div>
        </div>

        <div class="showcase-card-footer">
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm btn-fork" data-id="${rig.id}" title="Rig klonen">⚡ Fork</button>
            <button class="btn btn-secondary btn-sm btn-docs" data-id="${rig.id}" title="Dokumentation">📖</button>
            <a href="/${rig.path}" class="btn btn-ghost btn-sm" title="Vorschau">↗</a>
          </div>
          <button class="btn btn-primary btn-sm btn-launch fx-ripple" data-id="${rig.id}">Sandbox ▶</button>
        </div>
      `;

      card.querySelector('.btn-launch').addEventListener('click', () => openSandbox(rig));
      card.querySelector('.btn-thumb-launch').addEventListener('click', () => openSandbox(rig));
      card.querySelector('.btn-fork').addEventListener('click', () => forkRigFromHub(rig));
      const docsBtn = card.querySelector('.btn-docs');
      if (docsBtn) docsBtn.addEventListener('click', () => openDocsModal(rig));

      track.appendChild(card);
    });
  }

  // ==========================================================================
  // DEEP CATALOG EXPLORER VIEW (Vollständige Katalogansicht)
  // ==========================================================================
  function renderCategoryFilters() {
    const container = document.getElementById('filter-chips');
    if (!container) return;

    const baseCategories = [
      { id: 'all', name: 'Alle Rigs' },
      { id: 'gaming', name: 'Gaming & Sandbox' },
      { id: 'animations', name: 'Animations & Visual FX' },
      { id: 'helper', name: 'Helper & Utility' },
      { id: 'creative', name: 'Creative & Art' },
      { id: 'dev-lab', name: 'Dev Lab & Showcase' }
    ];

    container.innerHTML = '';
    baseCategories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `chip-btn ${currentCategory === cat.id ? 'active' : ''}`;
      btn.dataset.category = cat.id;
      btn.textContent = cat.name;

      btn.addEventListener('click', () => {
        document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = cat.id;
        renderCatalogTools();
      });

      container.appendChild(btn);
    });
  }

  function renderCatalogTools() {
    const container = document.getElementById('tools-grid');
    if (!container) return;

    container.innerHTML = '';
    let list = [...getRegistry()];

    // Filter by Category
    if (currentCategory !== 'all') {
      list = list.filter(r => r.category.toLowerCase() === currentCategory.toLowerCase());
    }

    // Filter by Search Query
    const q = currentSearchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(r =>
        r.title.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.tags && r.tags.some(t => t.toLowerCase().includes(q))) ||
        (r.category && r.category.toLowerCase().includes(q))
      );
    }

    // Sort
    if (currentSortBy === 'stars') {
      list.sort((a, b) => (b.stars || 0) - (a.stars || 0));
    } else if (currentSortBy === 'views') {
      list.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (currentSortBy === 'newest') {
      list.sort((a, b) => new Date(b.created_at || b.updated_at || Date.now()) - new Date(a.created_at || a.updated_at || Date.now()));
    } else {
      list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-dim);">
          <div style="font-size: 2.2rem; margin-bottom: 12px;">🔍</div>
          <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-muted);">Kein passendes Rig gefunden</div>
          <p style="margin-top: 6px; font-size: 0.9rem;">Versuche einen anderen Suchbegriff oder setze die Filter zurück.</p>
        </div>
      `;
      return;
    }

    // COMPACT LIST / TABLE VIEW
    if (currentViewMode === 'compact') {
      const tableWrapper = document.createElement('div');
      tableWrapper.className = 'data-table-card fx-beam';
      tableWrapper.style.gridColumn = '1 / -1';

      tableWrapper.innerHTML = `
        <table class="nexus-table">
          <thead>
            <tr>
              <th style="width: 320px;">Rig Name & Version</th>
              <th>Kategorie & Unterkategorie</th>
              <th>Autor & Copyright</th>
              <th>Stats & Tags</th>
              <th style="text-align: right;">Aktionen</th>
            </tr>
          </thead>
          <tbody id="compact-tbody"></tbody>
        </table>
      `;

      const tbody = tableWrapper.querySelector('#compact-tbody');

      list.forEach(rig => {
        const tr = document.createElement('tr');
        const tagsHtml = (rig.tags || []).slice(0, 3).map(t => `<span class="tool-tag">${t}</span>`).join(' ');

        tr.innerHTML = `
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="user-avatar-circle" style="width: 30px; height: 30px; font-size: 0.8rem; background: var(--gradient-brand);">⚡</div>
              <div>
                <div style="font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 8px;">
                  <span>${rig.title}</span>
                  <span class="badge badge-cyan" style="font-size: 0.68rem; font-family: var(--font-mono);">${rig.version || 'v0.0.1'}</span>
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">${(rig.description || '').substring(0, 80)}...</div>
              </div>
            </div>
          </td>
          <td><span class="badge badge-indigo">${rig.category} • ${rig.subcategory}</span></td>
          <td style="font-size: 0.82rem; color: var(--text-dim);">
            <div style="color: #fff; font-weight: 600;">${rig.author || 'Creator'}</div>
            <div style="font-size: 0.72rem; color: var(--text-dim);">${rig.copyright || (rig.author ? '© ' + rig.author : '© Community')}</div>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--cyan-400);">⭐ ${rig.stars || 0} • 👁️ ${rig.views || 0}</span>
              <div style="display: flex; flex-wrap: wrap; gap: 4px;">${tagsHtml}</div>
            </div>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm btn-fork" data-id="${rig.id}">⚡ Fork</button>
              <button class="btn btn-secondary btn-sm btn-docs" data-id="${rig.id}" title="Dokumentation">📖</button>
              <a href="/api/rigs/${rig.id}/export" class="btn btn-secondary btn-sm">📦</a>
              <button class="btn btn-secondary btn-sm btn-embed" data-id="${rig.id}">Embed</button>
              <a href="/${rig.path}" class="btn btn-ghost btn-sm" title="Vorschau">↗</a>
              <button class="btn btn-primary btn-sm btn-launch fx-ripple" data-id="${rig.id}">Sandbox ▶</button>
            </div>
          </td>
        `;

        tr.querySelector('.btn-launch').addEventListener('click', () => openSandbox(rig));
        tr.querySelector('.btn-embed').addEventListener('click', () => openEmbedModal(rig));
        tr.querySelector('.btn-fork').addEventListener('click', () => forkRigFromHub(rig));
        const rowDocsBtn = tr.querySelector('.btn-docs');
        if (rowDocsBtn) rowDocsBtn.addEventListener('click', () => openDocsModal(rig));

        tbody.appendChild(tr);
      });

      container.appendChild(tableWrapper);
      return;
    }

    // DETAILED CARDS VIEW
    list.forEach(rig => {
      const card = document.createElement('div');
      card.className = 'tool-card fx-beam';

      const catBadge = `<span class="badge badge-indigo">${rig.category} • ${rig.subcategory}</span>`;
      const versionBadge = `<span class="badge badge-cyan" style="font-family: var(--font-mono); font-size: 0.68rem;">${rig.version || 'v0.0.1'}</span>`;
      const tagsHtml = (rig.tags || []).map(t => `<span class="tool-tag">${t}</span>`).join('');

      card.innerHTML = `
        <div class="tool-card-header">
          <div class="tool-card-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
            <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
              ${rig.services && rig.services.required && rig.services.required.length > 0 ? `<span class="badge badge-amber" style="font-size: 0.65rem;" title="Erfordert PlayRig Backend Service">⚡ Service: ${rig.services.required.join(', ')}</span>` : ''}
              ${versionBadge}
            </div>
            ${catBadge}
          </div>
        </div>

        <div class="tool-card-body">
          <h2 class="tool-title">${rig.title}</h2>
          <p class="tool-desc">${rig.description || ''}</p>

          <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 8px;">
            Author: <strong style="color: #fff;">${rig.author || 'Creator'}</strong> • ${rig.copyright || (rig.author ? '© ' + rig.author : '© Community')}
          </div>

          <div class="tool-tags-row">
            ${tagsHtml}
          </div>
        </div>

        <div class="tool-card-footer">
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm btn-fork" data-id="${rig.id}" title="Rig klonen">⚡ Fork</button>
            <button class="btn btn-secondary btn-sm btn-docs" data-id="${rig.id}" title="Handbuch & Dokumentation">📖 Docs</button>
            <button class="btn btn-secondary btn-sm btn-embed" data-id="${rig.id}" title="Embed Code">Embed</button>
          </div>
          <div style="display: flex; gap: 6px;">
            <a href="/api/rigs/${rig.id}/export" class="btn btn-secondary btn-sm" title="Als ZIP herunterladen">📦</a>
            <a href="/${rig.path}" class="btn btn-ghost btn-sm" title="Vorschau">↗</a>
            <button class="btn btn-primary btn-sm btn-launch fx-ripple" data-id="${rig.id}">Sandbox ▶</button>
          </div>
        </div>
      `;

      card.querySelector('.btn-launch').addEventListener('click', () => openSandbox(rig));
      card.querySelector('.btn-embed').addEventListener('click', () => openEmbedModal(rig));
      card.querySelector('.btn-fork').addEventListener('click', () => forkRigFromHub(rig));
      const cardDocsBtn = card.querySelector('.btn-docs');
      if (cardDocsBtn) cardDocsBtn.addEventListener('click', () => openDocsModal(rig));

      container.appendChild(card);
    });
  }

  // Fork Rig from Deck
  async function forkRigFromHub(rig) {
    const token = localStorage.getItem('playrig_token') || localStorage.getItem('nexus_token');
    if (!token) {
      window.showToast('Bitte melde dich oben rechts an, um Rigs für dich zu klonen.', 'info', 4500);
      return;
    }

    try {
      const res = await fetch(`/api/rigs/${rig.id}/fork`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler beim Klonen');

      window.showToast(`Rig '${rig.title}' erfolgreich geklont! Es liegt nun in deinem Studio unter 'Meine Rigs'.`, 'success', 5000);
    } catch (err) {
      window.showToast('Fehler: ' + err.message, 'error');
    }
  }

  // Sandbox Runner
  function openSandbox(rig) {
    closeAllModals();
    activeRig = rig;
    const modal = document.getElementById('sandbox-modal');
    const iframe = document.getElementById('sandbox-frame');
    const titleEl = document.getElementById('sandbox-tool-title');
    const standaloneLink = document.getElementById('sandbox-standalone-link');

    titleEl.textContent = rig.title;
    standaloneLink.href = '/' + rig.path;

    const embedUrl = rig.path.includes('?') ? `/${rig.path}&embed=true` : `/${rig.path}?embed=true`;
    iframe.src = embedUrl;

    modal.classList.add('active');
  }

  function closeSandbox() {
    const modal = document.getElementById('sandbox-modal');
    const iframe = document.getElementById('sandbox-frame');
    modal.classList.remove('active');
    iframe.src = 'about:blank';
    activeRig = null;
  }

  // Embed Snippet Modal
  function openEmbedModal(rig) {
    closeAllModals();
    const modal = document.getElementById('embed-modal');
    const codeArea = document.getElementById('embed-code-area');
    const directUrl = `${window.location.origin}/${rig.path}?embed=true`;

    codeArea.value = `<iframe \n  src="${directUrl}" \n  width="100%" \n  height="750" \n  style="border:none; border-radius:12px; overflow:hidden;" \n  allow="accelerometer; gamepad; autoplay" \n  title="${rig.title}">\n</iframe>`;

    modal.classList.add('active');
  }

  function closeEmbedModal() {
    document.getElementById('embed-modal').classList.remove('active');
  }

  // ==========================================================================
  // STANDALONE RIG DOCUMENTATION MODAL
  // ==========================================================================
  async function openDocsModal(rig) {
    let modal = document.getElementById('docs-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'docs-modal';
      modal.className = 'docs-modal-overlay';
      modal.innerHTML = `
        <div class="docs-modal-card">
          <div class="docs-modal-header">
            <div>
              <h3 id="docs-modal-title" style="margin:0; font-size:1.15rem; color:#fff; display:flex; align-items:center; gap:8px;">
                📖 Rig-Handbuch & API
              </h3>
              <div id="docs-modal-subtitle" style="font-size:0.75rem; color:var(--text-dim); margin-top:2px;"></div>
            </div>
            <button class="btn btn-ghost btn-sm" id="btn-close-docs" style="font-size:1.2rem; line-height:1; padding:4px 8px;">✕</button>
          </div>
          <div class="docs-modal-body" id="docs-modal-content">
            <div style="text-align:center; padding:30px; color:var(--text-dim);">Lade Dokumentation...</div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeDocsModal();
      });
      modal.querySelector('#btn-close-docs').addEventListener('click', closeDocsModal);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display !== 'none') closeDocsModal();
      });
    }

    modal.style.display = 'flex';
    const titleEl = modal.querySelector('#docs-modal-title');
    const subEl = modal.querySelector('#docs-modal-subtitle');
    const contentEl = modal.querySelector('#docs-modal-content');

    titleEl.innerHTML = `📖 <span>${rig.title}</span>`;
    subEl.textContent = `${rig.category} • ${rig.subcategory} | Version: ${rig.version || 'v0.0.2'} | Author: ${rig.author || 'Creator'} (${rig.copyright || (rig.author ? '© ' + rig.author : '© Community')})`;
    contentEl.innerHTML = `<div style="text-align:center; padding:30px; color:var(--cyan-400);">⏳ Lade Standalone-Dokumentation...</div>`;

    let docData = rig.standaloneDocs || null;
    try {
      const res = await fetch(`/api/v1/rigs/${rig.id}/docs`, { credentials: 'same-origin' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && (json.data || json.docs)) {
          docData = json.data || json.docs;
        }
      }
    } catch (e) {
      // Offline fallback
    }

    if (!docData) {
      docData = {
        name: rig.title,
        version: rig.version || 'v0.0.2',
        overview: rig.description || 'Keine detaillierte Beschreibung hinterlegt.',
        features: rig.features || ['Modulare PlayRig-Komponente', 'GameChiller Plattform-Integration', 'Offline-kompatibel'],
        permissions: rig.permissions || ['storage:user:read', 'storage:user:write'],
        services: (rig.services && rig.services.required) || []
      };
    }

    const permissions = docData.permissions || [];
    const services = docData.services || [];
    const features = docData.features || [];
    const apiRef = docData.api_reference || null;
    const faq = docData.faq || [];

    contentEl.innerHTML = `
      <div class="docs-badge-row">
        <span class="badge badge-indigo">${rig.category}</span>
        <span class="badge badge-cyan">v${docData.version || rig.version || '0.0.2'}</span>
        ${services.length > 0 ? `<span class="badge badge-amber">⚡ Services: ${services.join(', ')}</span>` : '<span class="badge badge-ghost">Keine externen Services erforderlich</span>'}
        <span class="badge badge-emerald">GameChiller Verified</span>
      </div>

      <h3>📌 Übersicht & Zweck</h3>
      <p>${docData.overview || docData.description || rig.description || 'Modulare Anwendung für die GameChiller Plattform.'}</p>

      ${features.length > 0 ? `
        <h3>✨ Hauptfunktionen</h3>
        <ul>
          ${features.map(f => `<li>${typeof f === 'string' ? f : `<strong>${f.name}:</strong> ${f.description}`}</li>`).join('')}
        </ul>
      ` : ''}

      <h3>🔐 Erforderliche Berechtigungen (Permissions & Scopes)</h3>
      ${permissions.length > 0 ? `
        <ul>
          ${permissions.map(p => `<li><code style="color:var(--cyan-300);">${p}</code></li>`).join('')}
        </ul>
      ` : '<p style="color:var(--text-dim);">Dieses Rig benötigt keine gesonderten Berechtigungen.</p>'}

      <h3>🌐 GameChiller Bridge & Ereignisse</h3>
      <p>Dieses Rig kommuniziert bidirektional über das globale Objekt <code>window.PlayRig</code>:</p>
      <div class="docs-code-box">// Daten in GameChiller Session speichern
window.PlayRig.storage.set("state", { lastScore: 100 });

// Gespeicherte Daten abrufen
const savedState = await window.PlayRig.storage.get("state");

// Navigation im selben Fenster
window.PlayRig.navigate("/studio");</div>

      ${apiRef ? `
        <h3>🛠️ API-Referenz & Methoden</h3>
        <p>${apiRef.description || 'Spezifische Endpunkte und Schnittstellen dieses Rigs:'}</p>
        ${Array.isArray(apiRef.methods) ? `
          <ul>
            ${apiRef.methods.map(m => `<li><strong>${m.name}</strong>: <code>${m.signature || ''}</code> – ${m.description || ''}</li>`).join('')}
          </ul>
        ` : ''}
      ` : ''}

      ${faq.length > 0 ? `
        <h3>❓ Häufige Fragen & Troubleshooting (FAQ)</h3>
        ${faq.map(item => `
          <div style="margin-bottom:12px;">
            <div style="font-weight:600; color:#fff;">Q: ${item.q || item.question}</div>
            <div style="color:var(--text-dim); margin-top:3px;">A: ${item.a || item.answer}</div>
          </div>
        `).join('')}
      ` : ''}

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--border-default); display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:0.75rem; color:var(--text-dim);">Entwickelt von <strong>${rig.author || 'Creator'}</strong> • ${rig.copyright || (rig.author ? '© ' + rig.author : '© Community')}</span>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('docs-modal').style.display='none';">Schließen</button>
      </div>
    `;
  }

  function closeDocsModal() {
    const modal = document.getElementById('docs-modal');
    if (modal) modal.style.display = 'none';
  }

  // Switch between Discovery and Catalog View Modes
  function setDeckMode(mode) {
    activeDeckMode = mode;
    const btnDiscovery = document.getElementById('btn-mode-discovery');
    const btnCatalog = document.getElementById('btn-mode-catalog');
    const viewDiscovery = document.getElementById('deck-view-discovery');
    const viewCatalog = document.getElementById('deck-view-catalog');

    if (mode === 'discovery') {
      btnDiscovery?.classList.add('active');
      btnCatalog?.classList.remove('active');
      if (viewDiscovery) viewDiscovery.style.display = 'flex';
      if (viewCatalog) viewCatalog.style.display = 'none';
      renderDiscoveryView();
    } else {
      btnCatalog?.classList.add('active');
      btnDiscovery?.classList.remove('active');
      if (viewDiscovery) viewDiscovery.style.display = 'none';
      if (viewCatalog) viewCatalog.style.display = 'flex';
      renderCatalogTools();
    }
  }

  function bindEvents() {
    // Deck Mode Switcher buttons
    document.getElementById('btn-mode-discovery')?.addEventListener('click', () => setDeckMode('discovery'));
    document.getElementById('btn-mode-catalog')?.addEventListener('click', () => setDeckMode('catalog'));

    // Showcase jump-to-catalog links
    document.querySelectorAll('.showcase-filter-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const sort = btn.dataset.sort;
        const cat = btn.dataset.category;

        if (sort) {
          currentSortBy = sort;
          const sortSelect = document.getElementById('catalog-sort-select');
          if (sortSelect) sortSelect.value = sort;
        }
        if (cat) {
          currentCategory = cat;
          document.querySelectorAll('.chip-btn').forEach(b => {
            if (b.dataset.category === cat) b.classList.add('active');
            else b.classList.remove('active');
          });
        }
        setDeckMode('catalog');
      });
    });

    // Search input in Catalog
    const searchInput = document.getElementById('hub-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value;
        renderCatalogTools();
      });

      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          setDeckMode('catalog');
          searchInput.focus();
          searchInput.select();
        }
      });
    }

    // Sort select
    document.getElementById('catalog-sort-select')?.addEventListener('change', (e) => {
      currentSortBy = e.target.value;
      renderCatalogTools();
    });

    // View Switcher (Detailed vs Compact)
    const btnViewDetailed = document.getElementById('view-mode-detailed');
    const btnViewCompact = document.getElementById('view-mode-compact');

    if (btnViewDetailed && btnViewCompact) {
      btnViewDetailed.addEventListener('click', () => {
        btnViewDetailed.classList.add('active', 'accent-cyan');
        btnViewCompact.classList.remove('active', 'accent-cyan');
        currentViewMode = 'detailed';
        renderCatalogTools();
      });

      btnViewCompact.addEventListener('click', () => {
        btnViewCompact.classList.add('active', 'accent-cyan');
        btnViewDetailed.classList.remove('active', 'accent-cyan');
        currentViewMode = 'compact';
        renderCatalogTools();
      });
    }

    // Sandbox Controls
    document.getElementById('btn-close-sandbox')?.addEventListener('click', closeSandbox);
    document.getElementById('btn-reload-sandbox')?.addEventListener('click', () => {
      const iframe = document.getElementById('sandbox-frame');
      iframe.src = iframe.src;
    });

    // Sandbox Screenshot Capture with Typed Secure Protocol
    let screenshotTimeout = null;

    document.getElementById('btn-sandbox-screenshot')?.addEventListener('click', () => {
      if (!activeRig) return;
      const iframe = document.getElementById('sandbox-frame');
      if (!iframe || !iframe.contentWindow) return;

      window.showToast('Erfasse Snapshot aus Sandbox...', 'info', 2000);
      const targetOrigin = window.location.origin;

      if (screenshotTimeout) clearTimeout(screenshotTimeout);
      screenshotTimeout = setTimeout(() => {
        window.showToast('Snapshot-Zeitüberschreitung: Rig antwortete nicht innerhalb von 3s.', 'warning', 3500);
      }, 3000);

      iframe.contentWindow.postMessage({
        type: 'PLAYRIG_REQUEST_SCREENSHOT',
        rigId: activeRig.id,
        timestamp: Date.now()
      }, targetOrigin);
    });

    // Listen for captured screenshot from iframe with origin verification
    window.addEventListener('message', async (event) => {
      // Origin check
      if (event.origin !== window.location.origin && !event.origin.endsWith('.gamechiller.de') && event.origin !== 'http://localhost:3000') {
        return;
      }

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      const isCaptureSuccess = (data.type === 'PLAYRIG_SCREENSHOT_CAPTURED' || data.type === 'playrig-screenshot-captured') && data.dataUrl;
      const isCaptureError = data.type === 'PLAYRIG_SCREENSHOT_ERROR' || data.type === 'playrig-screenshot-error';

      if (isCaptureSuccess) {
        if (screenshotTimeout) clearTimeout(screenshotTimeout);
        if (!activeRig) return;
        const token = localStorage.getItem('playrig_token') || localStorage.getItem('nexus_token');
        if (!token) {
          const a = document.createElement('a');
          a.href = data.dataUrl;
          a.download = `${activeRig.id}-screenshot.png`;
          a.click();
          window.showToast('Snapshot heruntergeladen! (Melde dich an, um ihn als Deck-Vorschau zu speichern)', 'success', 5000);
          return;
        }

        try {
          const res = await fetch(`/api/rigs/${activeRig.id}/thumbnail`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ imageBase64: data.dataUrl })
          });
          const resData = await res.json();
          if (!res.ok) throw new Error(resData.error || 'Fehler beim Speichern');

          window.showToast(`📸 Snapshot erfolgreich als Vorschau für '${activeRig.title}' gespeichert!`, 'success', 5000);
          renderDiscoveryView();
        } catch (err) {
          window.showToast('Fehler beim Speichern des Snapshots: ' + err.message, 'error', 4000);
        }
      } else if (isCaptureError) {
        if (screenshotTimeout) clearTimeout(screenshotTimeout);
        window.showToast('Snapshot fehlgeschlagen: ' + (data.error || 'Kein Canvas-Element für Screenshot gefunden'), 'warning', 4000);
      }
    });

    const wrapper = document.getElementById('sandbox-wrapper');
    document.querySelectorAll('.viewport-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.viewport-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const device = btn.dataset.device;
        wrapper.className = 'sandbox-iframe-wrapper';
        if (device !== 'responsive') {
          wrapper.classList.add(`device-${device}`);
        }
      });
    });

    // Rig-Importer Modal
    const codepenModal = document.getElementById('codepen-import-modal');
    const btnOpenCodepen = document.getElementById('btn-open-codepen-import');
    const btnCloseCodepen = document.getElementById('btn-close-codepen-modal');
    const btnCancelCodepen = document.getElementById('btn-cancel-codepen-import');
    const formCodepen = document.getElementById('form-codepen-import');

    if (btnOpenCodepen) {
      btnOpenCodepen.addEventListener('click', () => {
        closeAllModals();
        codepenModal.classList.add('active');
      });
    }

    if (btnCloseCodepen) btnCloseCodepen.addEventListener('click', () => codepenModal.classList.remove('active'));
    if (btnCancelCodepen) btnCancelCodepen.addEventListener('click', () => codepenModal.classList.remove('active'));

    if (formCodepen) {
      formCodepen.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = document.getElementById('import-pen-url').value;
        const title = document.getElementById('import-pen-title').value;
        const category = document.getElementById('import-pen-cat').value;

        const token = localStorage.getItem('playrig_token') || localStorage.getItem('nexus_token');
        if (!token) {
          window.showToast('Bitte melde dich zuerst an, um Rigs zu importieren.', 'warning', 5000);
          return;
        }

        try {
          window.showToast('Importiere Projekt...', 'info', 3000);
          const res = await fetch('/api/rigs/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ source: 'codepen', url, title, category })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Fehler beim Importieren');

          window.showToast(`Rig erfolgreich importiert: '${data.title}'!`, 'success', 5000);
          codepenModal.classList.remove('active');
          formCodepen.reset();
          init();
        } catch (err) {
          window.showToast('Import-Fehler: ' + err.message, 'error');
        }
      });
    }

    // Deck Login Modal
    const hubLoginModal = document.getElementById('hub-login-modal');
    const btnCloseHubLogin = document.getElementById('btn-close-hub-login');
    const formHubLogin = document.getElementById('hub-login-form');

    if (btnCloseHubLogin) {
      btnCloseHubLogin.addEventListener('click', () => hubLoginModal.classList.remove('active'));
    }

    if (formHubLogin) {
      formHubLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('hub-login-username').value;
        const password = document.getElementById('hub-login-password').value;

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Login fehlgeschlagen');

          localStorage.setItem('playrig_token', data.token);
          currentUser = data.user;
          hubLoginModal.classList.remove('active');
          window.showToast(`Willkommen zurück, ${data.user.name || data.user.username}!`, 'success');
          checkAuthStatus();
          init();
        } catch (err) {
          window.showToast('Login fehlgeschlagen: ' + err.message, 'error');
        }
      });
    }

    document.getElementById('btn-hub-quick-creator')?.addEventListener('click', () => {
      document.getElementById('hub-login-username').value = 'creator';
      document.getElementById('hub-login-password').value = 'creator123';
      formHubLogin?.dispatchEvent(new Event('submit'));
    });

    document.getElementById('btn-hub-quick-admin')?.addEventListener('click', () => {
      document.getElementById('hub-login-username').value = 'admin';
      document.getElementById('hub-login-password').value = 'admin123';
      formHubLogin?.dispatchEvent(new Event('submit'));
    });

    document.getElementById('btn-close-embed-modal')?.addEventListener('click', closeEmbedModal);
    document.getElementById('btn-copy-embed-code')?.addEventListener('click', () => {
      const area = document.getElementById('embed-code-area');
      area.select();
      navigator.clipboard.writeText(area.value).then(() => {
        window.showToast('Embed-Code in Zwischenablage kopiert!', 'success');
      });
    });
  }

  window.setDeckMode = setDeckMode;
  document.addEventListener('DOMContentLoaded', init);
})();
