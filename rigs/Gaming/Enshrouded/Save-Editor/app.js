/**
 * ENSHROUDED SAVE EDITOR - APP LOGIC
 * High-End PlayRig Character & Inventory Workstation
 */

(function () {
  'use strict';

  // State Management
  const state = {
    // Catalogs
    items: {},
    skills: {},
    capacities: {},

    // Current Active Savegame
    filePath: null,
    fileName: 'character0.ksd',
    characterName: 'Liath',
    model: null,
    knowledge: { containerState: 1, entries: [] },
    blocksMeta: [],
    rawSaveBase64: null,

    // UI State
    selectedContainer: null, // 'equipment' or 'main' or 'extra'
    selectedSlotIndex: null,
    hasUnsavedChanges: false,
    history: [],
    historyIndex: -1,
    activeTab: 'tab-inventory',
    spawnerCategory: 'all',
    spawnerRarity: 'all',
    spawnerQuery: '',
    isGameRunning: false
  };

  // DOM Elements
  const els = {
    onboardingModal: document.getElementById('onboarding-modal'),
    permissionBox: document.getElementById('permission-prompt-box'),
    detectedBox: document.getElementById('detected-characters-box'),
    detectedList: document.getElementById('detected-characters-list'),
    manualDropBox: document.getElementById('manual-drop-box'),
    dropzone: document.getElementById('dropzone'),
    inputManualFile: document.getElementById('input-manual-file'),
    inputDropzoneFile: document.getElementById('input-dropzone-file'),

    workspace: document.getElementById('editor-workspace'),
    processPill: document.getElementById('process-status-pill'),
    processText: document.getElementById('process-status-text'),
    activeFilePill: document.getElementById('active-file-pill'),
    activeFileName: document.getElementById('active-file-name'),
    btnChangeChar: document.getElementById('btn-change-character'),

    // Character Top Banner
    charAvatarInitials: document.getElementById('char-avatar-initials'),
    charBadgeLevel: document.getElementById('char-badge-level'),
    charNameInput: document.getElementById('char-name-input'),
    charSlotLabel: document.getElementById('char-slot-label'),
    unsavedBadge: document.getElementById('unsaved-badge'),
    inputCharLevel: document.getElementById('input-char-level'),
    inputCharXp: document.getElementById('input-char-xp'),
    btnLevelDec: document.getElementById('btn-level-dec'),
    btnLevelInc: document.getElementById('btn-level-inc'),
    btnMaxXp: document.getElementById('btn-max-xp'),
    metricSkillsCount: document.getElementById('metric-skills-count'),
    metricInventoryCount: document.getElementById('metric-inventory-count'),
    btnSave: document.getElementById('btn-save-savegame'),
    btnDownloadKsd: document.getElementById('btn-download-ksd'),
    btnUndo: document.getElementById('btn-undo'),
    btnRedo: document.getElementById('btn-redo'),

    // Tabs
    navTabs: document.querySelectorAll('.nav-tab'),
    tabPanes: document.querySelectorAll('.tab-pane'),

    // Inventory & Backpack
    mainBackpackGrid: document.getElementById('main-backpack-grid'),
    extraBackpackGrid: document.getElementById('extra-backpack-grid'),
    extraCapacityBadge: document.getElementById('extra-capacity-badge'),

    // Inspector
    inspectorEmptyState: document.getElementById('inspector-empty-state'),
    inspectorDetails: document.getElementById('inspector-details'),
    inspectorSlotBadge: document.getElementById('inspector-slot-badge'),
    inspectorImg: document.getElementById('inspector-img'),
    inspectorName: document.getElementById('inspector-name'),
    inspectorRarityBadge: document.getElementById('inspector-rarity-badge'),
    inspectorCategoryBadge: document.getElementById('inspector-category-badge'),
    inspectorDebugId: document.getElementById('inspector-debug-id'),
    inspectorCount: document.getElementById('inspector-count'),
    inspectorStackMax: document.getElementById('inspector-stack-max'),
    inspectorDurability: document.getElementById('inspector-durability'),
    inspectorLevel: document.getElementById('inspector-level'),
    inspectorUpgrades: document.getElementById('inspector-upgrades'),
    btnInspectorMaxStack: document.getElementById('btn-inspector-max-stack'),
    btnInspectorRepair: document.getElementById('btn-inspector-repair'),
    btnInspectorDuplicate: document.getElementById('btn-inspector-duplicate'),
    btnInspectorClear: document.getElementById('btn-inspector-clear'),

    // Quick Actions
    btnRepairAll: document.getElementById('btn-repair-all'),
    btnStackAll: document.getElementById('btn-stack-all'),

    // Spawner
    spawnerSearchInput: document.getElementById('spawner-search-input'),
    spawnerCategoryChips: document.getElementById('spawner-category-chips'),
    spawnerRaritySelect: document.getElementById('spawner-rarity-select'),
    spawnerResultsCount: document.getElementById('spawner-results-count'),
    spawnerCatalogGrid: document.getElementById('spawner-catalog-grid'),

    // Skills & Knowledge
    skillsListContainer: document.getElementById('skills-list-container'),
    btnSkillsUnlockAll: document.getElementById('btn-skills-unlock-all'),
    btnSkillsReset: document.getElementById('btn-skills-reset'),
    knowledgeListContainer: document.getElementById('knowledge-list-container'),
    metricKnowledgeTotal: document.getElementById('metric-knowledge-total'),
    knowledgeSearch: document.getElementById('knowledge-search'),
    btnUnlockAllRecipes: document.getElementById('btn-unlock-all-recipes'),

    // Power Tools
    powerToolLevel50: document.getElementById('power-tool-level50'),
    powerToolRepairAll: document.getElementById('power-tool-repair-all'),
    powerToolMaxStacks: document.getElementById('power-tool-max-stacks'),
    powerToolUnlockAll: document.getElementById('power-tool-unlock-all'),

    // Safety Modal
    unsavedModal: document.getElementById('unsaved-safety-modal'),
    btnBackDeck: document.getElementById('btn-back-to-deck'),
    safetySaveLeave: document.getElementById('safety-btn-save-leave'),
    safetyDiscardLeave: document.getElementById('safety-btn-discard-leave'),
    safetyCancel: document.getElementById('safety-btn-cancel')
  };

  // --- INITIALIZATION ---
  async function init() {
    await loadDataCatalogs();
    bindEvents();
    checkGameStatus();
    setInterval(checkGameStatus, 10000);

    // Check if permission already granted previously
    const autoScanGranted = localStorage.getItem('playrig_enshrouded_auto_scan') === 'true';
    if (autoScanGranted) {
      els.permissionBox.style.display = 'none';
      els.detectedBox.style.display = 'flex';
      scanAndShowDetectedSaves();
    }
  }

  // --- DATA CATALOGS LOADER ---
  async function loadDataCatalogs() {
    try {
      const [itemsRes, skillsRes, capRes] = await Promise.all([
        fetch('./data/items.json').then(r => r.json()),
        fetch('./data/skills.json').then(r => r.json()),
        fetch('./data/backpack-capacities.json').then(r => r.json())
      ]);
      state.items = itemsRes;
      state.skills = skillsRes;
      state.capacities = capRes;
    } catch (err) {
      console.error('Fehler beim Laden der Spieldaten:', err);
      showToast('Fehler beim Laden der Spieldaten: ' + err.message, 'error');
    }
  }

  // --- GAME PROCESS MONITOR ---
  async function checkGameStatus() {
    try {
      const res = await fetch('/api/enshrouded/game-status');
      const data = await res.json();
      state.isGameRunning = data.running;

      if (state.isGameRunning) {
        els.processPill.className = 'process-pill process-warning';
        els.processText.textContent = 'Achtung: Enshrouded läuft!';
        els.processPill.title = 'Das Spiel läuft aktuell. Um Datenverlust zu verhindern, schließe das Spiel vor dem Speichern.';
      } else {
        els.processPill.className = 'process-pill process-safe';
        els.processText.textContent = 'Spiel beendet (Sicher)';
        els.processPill.title = 'Enshrouded ist nicht gestartet. Änderungen können sicher gespeichert werden.';
      }
    } catch (e) {
      // Standalone mode without local server
    }
  }

  // --- SAVE DETECTION & SELECTION ---
  async function scanAndShowDetectedSaves() {
    els.detectedList.innerHTML = '<div style="color:var(--text-dim); padding:20px; text-align:center;">Scanne Steam-Speicherorte...</div>';
    try {
      const res = await fetch('/api/enshrouded/detect-saves');
      const data = await res.json();
      const saves = data.saves || [];

      if (saves.length === 0) {
        els.detectedList.innerHTML = `
          <div style="grid-column: 1/-1; text-align:center; padding: 24px; color:var(--text-muted);">
            Keine Enshrouded-Charaktere im Standard-Steam-Ordner gefunden.<br>
            Nutze die manuelle Dateiauswahl unten.
          </div>
        `;
        return;
      }

      els.detectedList.innerHTML = '';
      saves.forEach(save => {
        const card = document.createElement('div');
        card.className = 'detected-char-card';
        const formattedDate = new Date(save.modified).toLocaleString('de-DE', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        card.innerHTML = `
          <div class="char-card-header">
            <span class="char-card-name">${escapeHtml(save.name || 'Unbekannt')}</span>
            <span class="badge badge-amber">Level ${save.level || 1}</span>
          </div>
          <div class="char-card-details">
            <span><strong>Datei:</strong> ${escapeHtml(save.file)}</span>
            <span><strong>Zuletzt gespielt:</strong> ${formattedDate}</span>
            <span style="font-size:0.7rem; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(save.path)}</span>
          </div>
          <button class="btn btn-primary btn-sm fx-ripple" style="margin-top:4px;">
            Diesen Charakter laden ▶
          </button>
        `;

        card.addEventListener('click', () => loadSaveByPath(save.path, save.file));
        els.detectedList.appendChild(card);
      });
    } catch (err) {
      els.detectedList.innerHTML = `<div style="color:var(--rose-400); padding:16px;">Fehler bei der Suche: ${err.message}</div>`;
    }
  }

  // Load a save file from server disk
  async function loadSaveByPath(filePath, fileName) {
    showToast(`Lade Spielstand '${fileName}'...`, 'info', 2000);
    try {
      const res = await fetch('/api/enshrouded/read-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Laden fehlgeschlagen');

      applyLoadedSave(data, filePath, fileName);
    } catch (err) {
      showToast('Fehler beim Laden: ' + err.message, 'error', 4500);
    }
  }

  // Parse raw uploaded file buffer directly
  async function loadSaveFromRawBuffer(buffer, fileName) {
    showToast(`Verarbeite '${fileName}'...`, 'info', 2000);
    try {
      const res = await fetch('/api/enshrouded/parse-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parsing fehlgeschlagen');

      applyLoadedSave(data, null, fileName);
    } catch (err) {
      showToast('Fehler beim Lesen des Spielstands: ' + err.message, 'error', 4500);
    }
  }

  function applyLoadedSave(data, filePath, fileName) {
    state.filePath = filePath;
    state.fileName = fileName;
    state.characterName = data.name || 'Liath';
    state.model = data.character;
    state.knowledge = data.knowledge || { containerState: 1, entries: [] };
    state.blocksMeta = data.blocksMeta || [];
    state.rawSaveBase64 = data.rawSaveBase64;
    state.hasUnsavedChanges = false;
    state.history = [];
    state.historyIndex = -1;

    // Push initial snapshot
    pushHistory('Spielstand geladen');

    // UI Updates
    els.onboardingModal.classList.remove('active');
    els.workspace.style.display = 'flex';
    els.activeFilePill.style.display = 'inline-flex';
    els.activeFileName.textContent = fileName;
    els.btnChangeChar.style.display = 'inline-flex';

    renderAll();
    showToast(`Charakter '${state.characterName}' (Level ${state.model.level}) erfolgreich geladen!`, 'success', 4000);
  }

  // --- RENDER WORKSPACE ---
  function renderAll() {
    renderCharacterBanner();
    renderEquipment();
    renderBackpack();
    renderSelectedInspector();
    renderSkills();
    renderKnowledge();
    renderSpawnerCatalog();
    updateUnsavedStatus();
  }

  function renderCharacterBanner() {
    if (!state.model) return;
    const name = state.characterName || 'Liath';
    els.charNameInput.value = name;
    els.charAvatarInitials.textContent = name.substring(0, 2).toUpperCase();
    els.charBadgeLevel.textContent = state.model.level;
    els.charSlotLabel.textContent = `Slot: ${state.fileName}`;

    els.inputCharLevel.value = state.model.level;
    els.inputCharXp.value = state.model.xp;
    els.metricSkillsCount.textContent = (state.model.skills || []).length;

    const totalInv = (state.model.equipment || []).length + (state.model.main || []).length + (state.model.extra || []).length;
    els.metricInventoryCount.textContent = totalInv;
  }

  // Helper: Get icon path for item
  function getItemIconUrl(item) {
    if (!item || !item.debug) return null;
    return `./assets/icons/${item.debug}_icon.webp`;
  }

  // Helper: Get localized German item name
  function getItemName(itemId) {
    const it = state.items[itemId];
    if (!it) return `Item #${itemId}`;
    return it.de || it.en || it.debug;
  }

  // Helper: Get item rarity class
  function getItemRarity(itemId) {
    const it = state.items[itemId];
    return it?.rarity || 'Common';
  }

  // Render 16 Equipment Slots
  function renderEquipment() {
    if (!state.model) return;
    const equipList = state.model.equipment || [];

    const slotTypes = [
      'Armour_Head', 'Armour_UpperBody', 'Armour_Arms', 'Armour_LowerBody',
      'Armour_Feet', 'Armour_Ring_1', 'Armour_Ring_2', 'Shield',
      'Glider', 'HookShot', 'Backpack'
    ];

    slotTypes.forEach(slotType => {
      const slotEl = document.getElementById(`equip-${slotType}`);
      if (!slotEl) return;
      slotEl.innerHTML = '';
      slotEl.className = 'inv-slot';

      let entry = null;
      let slotIdx = -1;

      // Find equipped entry matching this type
      if (slotType === 'Armour_Ring_1') {
        const rings = equipList.filter(e => state.items[e.itemId]?.slot === 'Armour_Ring');
        entry = rings[0];
        slotIdx = entry ? equipList.indexOf(entry) : -1;
      } else if (slotType === 'Armour_Ring_2') {
        const rings = equipList.filter(e => state.items[e.itemId]?.slot === 'Armour_Ring');
        entry = rings[1];
        slotIdx = entry ? equipList.indexOf(entry) : -1;
      } else {
        const foundIdx = equipList.findIndex(e => state.items[e.itemId]?.slot === slotType);
        if (foundIdx !== -1) {
          entry = equipList[foundIdx];
          slotIdx = foundIdx;
        }
      }

      slotEl.dataset.slotIndex = slotIdx;

      if (entry) {
        const itemInfo = state.items[entry.itemId];
        const rarity = itemInfo?.rarity || 'Common';
        slotEl.classList.add(`rarity-${rarity}`);

        const iconUrl = getItemIconUrl(itemInfo);
        if (iconUrl) {
          const img = document.createElement('img');
          img.className = 'inv-slot-img';
          img.src = iconUrl;
          img.alt = getItemName(entry.itemId);
          img.onerror = () => { img.style.display = 'none'; };
          slotEl.appendChild(img);
        }

        if (entry.count > 1) {
          const countSpan = document.createElement('span');
          countSpan.className = 'inv-slot-count';
          countSpan.textContent = entry.count;
          slotEl.appendChild(countSpan);
        }

        if (entry.maxDurability && entry.durability !== undefined) {
          const durWrap = document.createElement('div');
          durWrap.className = 'inv-slot-durability';
          const pct = Math.min(100, Math.max(0, (entry.durability / entry.maxDurability) * 100));
          const bar = document.createElement('div');
          bar.className = 'durability-bar' + (pct < 25 ? ' low' : pct < 60 ? ' medium' : '');
          bar.style.width = `${pct}%`;
          durWrap.appendChild(bar);
          slotEl.appendChild(durWrap);
        }
      }

      if (state.selectedContainer === 'equipment' && state.selectedSlotIndex === slotIdx && slotIdx !== -1) {
        slotEl.classList.add('selected');
      }

      slotEl.onclick = () => {
        selectSlot('equipment', slotIdx, entry);
      };
    });
  }

  // Render 40 Backpack Slots & Extra Container
  function renderBackpack() {
    if (!state.model) return;
    const mainList = state.model.main || [];
    const extraList = state.model.extra || [];

    // Main 40 slots
    els.mainBackpackGrid.innerHTML = '';
    const mainCount = 40;

    for (let slot = 0; slot < mainCount; slot++) {
      const entry = mainList.find(e => e.slot === slot);
      const slotEl = createSlotElement('main', slot, entry);
      els.mainBackpackGrid.appendChild(slotEl);
    }

    // Extra backpack container (capacity depends on worn backpack)
    const wornBackpack = (state.model.equipment || []).find(e => state.items[e.itemId]?.slot === 'Backpack');
    const backpackDebug = wornBackpack ? state.items[wornBackpack.itemId]?.debug : null;
    const extraCapacity = (backpackDebug && state.capacities[backpackDebug]) || extraList.length || 0;

    els.extraCapacityBadge.textContent = `${extraCapacity} Slots`;
    els.extraBackpackGrid.innerHTML = '';

    if (extraCapacity > 0) {
      for (let slot = 0; slot < extraCapacity; slot++) {
        const entry = extraList.find(e => e.slot === slot);
        const slotEl = createSlotElement('extra', slot, entry);
        els.extraBackpackGrid.appendChild(slotEl);
      }
    } else {
      els.extraBackpackGrid.innerHTML = '<div style="grid-column:1/-1; padding:12px; font-size:0.8rem; color:var(--text-dim); text-align:center;">Kein Rucksack mit Zusatztaschen angelegt.</div>';
    }
  }

  function createSlotElement(container, slotIndex, entry) {
    const slotEl = document.createElement('div');
    slotEl.className = 'inv-slot';
    slotEl.dataset.container = container;
    slotEl.dataset.slotIndex = slotIndex;

    if (entry) {
      const itemInfo = state.items[entry.itemId];
      const rarity = itemInfo?.rarity || 'Common';
      slotEl.classList.add(`rarity-${rarity}`);

      const iconUrl = getItemIconUrl(itemInfo);
      if (iconUrl) {
        const img = document.createElement('img');
        img.className = 'inv-slot-img';
        img.src = iconUrl;
        img.alt = getItemName(entry.itemId);
        img.onerror = () => { img.style.display = 'none'; };
        slotEl.appendChild(img);
      }

      if (entry.count > 1) {
        const countSpan = document.createElement('span');
        countSpan.className = 'inv-slot-count';
        countSpan.textContent = entry.count;
        slotEl.appendChild(countSpan);
      }

      if (entry.maxDurability && entry.durability !== undefined) {
        const durWrap = document.createElement('div');
        durWrap.className = 'inv-slot-durability';
        const pct = Math.min(100, Math.max(0, (entry.durability / entry.maxDurability) * 100));
        const bar = document.createElement('div');
        bar.className = 'durability-bar' + (pct < 25 ? ' low' : pct < 60 ? ' medium' : '');
        bar.style.width = `${pct}%`;
        durWrap.appendChild(bar);
        slotEl.appendChild(durWrap);
      }
    }

    if (state.selectedContainer === container && state.selectedSlotIndex === slotIndex) {
      slotEl.classList.add('selected');
    }

    slotEl.onclick = () => {
      selectSlot(container, slotIndex, entry);
    };

    return slotEl;
  }

  // --- SELECTION & INSPECTOR ---
  function selectSlot(container, slotIndex, entry) {
    state.selectedContainer = container;
    state.selectedSlotIndex = slotIndex;

    // Refresh slot outlines
    document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('selected'));
    const activeEl = document.querySelector(`.inv-slot[data-container="${container}"][data-slot-index="${slotIndex}"]`);
    if (activeEl) activeEl.classList.add('selected');

    renderSelectedInspector();
  }

  function getSelectedEntry() {
    if (!state.model || state.selectedSlotIndex === null) return null;
    const list = state.model[state.selectedContainer];
    if (!list) return null;
    if (state.selectedContainer === 'equipment') {
      return list[state.selectedSlotIndex] || null;
    }
    return list.find(e => e.slot === state.selectedSlotIndex) || null;
  }

  function renderSelectedInspector() {
    const entry = getSelectedEntry();
    if (!entry) {
      els.inspectorEmptyState.style.display = 'block';
      els.inspectorDetails.style.display = 'none';
      els.inspectorSlotBadge.textContent = state.selectedSlotIndex !== null
        ? `${state.selectedContainer} (Slot ${state.selectedSlotIndex} - Leer)`
        : 'Kein Slot gewählt';
      return;
    }

    els.inspectorEmptyState.style.display = 'none';
    els.inspectorDetails.style.display = 'block';
    els.inspectorSlotBadge.textContent = `${state.selectedContainer} Slot ${state.selectedSlotIndex}`;

    const item = state.items[entry.itemId];
    const name = getItemName(entry.itemId);
    const rarity = getItemRarity(entry.itemId);

    els.inspectorName.textContent = name;
    els.inspectorRarityBadge.textContent = rarity;
    els.inspectorRarityBadge.className = `rarity-pill rarity-${rarity}`;
    els.inspectorCategoryBadge.textContent = item?.category || 'Item';
    els.inspectorDebugId.textContent = `ID: ${entry.itemId} (${item?.debug || 'Custom'})`;

    const iconUrl = getItemIconUrl(item);
    if (iconUrl) {
      els.inspectorImg.src = iconUrl;
      els.inspectorImg.style.display = 'block';
    } else {
      els.inspectorImg.style.display = 'none';
    }

    // Inputs
    els.inspectorCount.value = entry.count || 1;
    els.inspectorStackMax.textContent = `Max: ${item?.maxStack || 1}`;

    const durGroup = document.getElementById('inspector-durability-group');
    if (entry.maxDurability) {
      durGroup.style.display = 'block';
      els.inspectorDurability.value = entry.durability;
      els.inspectorDurability.max = entry.maxDurability;
    } else {
      durGroup.style.display = 'none';
    }

    const lvlGroup = document.getElementById('inspector-level-group');
    if (entry.level !== undefined) {
      lvlGroup.style.display = 'block';
      els.inspectorLevel.value = entry.level;
    } else {
      lvlGroup.style.display = 'none';
    }

    const upgGroup = document.getElementById('inspector-upgrades-group');
    if (entry.maxUpgrades !== undefined) {
      upgGroup.style.display = 'block';
      els.inspectorUpgrades.value = entry.upgrades || 0;
      els.inspectorUpgrades.max = entry.maxUpgrades;
    } else {
      upgGroup.style.display = 'none';
    }
  }

  // --- SPAWNER & ITEM CATALOG ---
  function renderSpawnerCatalog() {
    const grid = els.spawnerCatalogGrid;
    grid.innerHTML = '';

    const query = state.spawnerQuery.toLowerCase().trim();
    const cat = state.spawnerCategory;
    const rarity = state.spawnerRarity;

    let matches = [];
    for (const id in state.items) {
      const it = state.items[id];
      if (cat !== 'all' && it.category !== cat) continue;
      if (rarity !== 'all' && it.rarity !== rarity) continue;

      if (query) {
        const nameDe = (it.de || '').toLowerCase();
        const nameEn = (it.en || '').toLowerCase();
        const debug = (it.debug || '').toLowerCase();
        if (!nameDe.includes(query) && !nameEn.includes(query) && !debug.includes(query) && !id.includes(query)) {
          continue;
        }
      }

      matches.push({ id: Number(id), ...it });
      if (matches.length >= 100) break; // Limit dom nodes for fast performance
    }

    els.spawnerResultsCount.textContent = `${matches.length} Treffer angezeigt (von 4.262 Gegenständen)`;

    matches.forEach(item => {
      const card = document.createElement('div');
      card.className = `spawner-item-card rarity-${item.rarity || 'Common'}`;
      const name = item.de || item.en || item.debug;
      const iconUrl = getItemIconUrl(item);

      card.innerHTML = `
        <img class="spawner-item-img" src="${iconUrl}" alt="${name}" onerror="this.style.opacity='0.2'">
        <div class="spawner-item-info">
          <div class="spawner-item-name" title="${name}">${escapeHtml(name)}</div>
          <div class="spawner-item-meta">${item.rarity || 'Common'} • ${item.category || ''}</div>
        </div>
        <button class="btn btn-secondary btn-sm" title="Einfügen" style="padding:4px 8px; font-size:0.75rem;">➕</button>
      `;

      card.onclick = () => spawnItemIntoSave(item);
      grid.appendChild(card);
    });
  }

  function spawnItemIntoSave(item) {
    if (!state.model) return;

    const newEntry = {
      itemId: item.id,
      count: item.maxStack || 1,
      flags: 0
    };

    if (item.minLevel) newEntry.level = item.minLevel;
    if (item.maxDurability) {
      newEntry.durability = item.maxDurability;
      newEntry.maxDurability = item.maxDurability;
    }

    // If a slot is currently selected, put it there
    if (state.selectedContainer && state.selectedSlotIndex !== null) {
      const targetContainer = state.selectedContainer;
      const targetSlot = state.selectedSlotIndex;

      if (targetContainer === 'equipment') {
        // Replace equipped entry at index
        state.model.equipment[targetSlot] = { ...newEntry, slot: targetSlot };
      } else {
        // Replace or insert in main or extra
        const list = state.model[targetContainer];
        const existingIdx = list.findIndex(e => e.slot === targetSlot);
        if (existingIdx !== -1) {
          list[existingIdx] = { ...newEntry, slot: targetSlot };
        } else {
          list.push({ ...newEntry, slot: targetSlot });
        }
      }
      pushHistory(`Item '${item.de || item.en}' eingefügt`);
      renderEquipment();
      renderBackpack();
      renderSelectedInspector();
      showToast(`'${item.de || item.en}' in Slot eingefügt!`, 'success');
      return;
    }

    // Otherwise, find first free backpack slot
    const mainList = state.model.main;
    let freeSlot = -1;
    for (let s = 0; s < 40; s++) {
      if (!mainList.some(e => e.slot === s)) {
        freeSlot = s;
        break;
      }
    }

    if (freeSlot !== -1) {
      mainList.push({ ...newEntry, slot: freeSlot });
      pushHistory(`Item '${item.de || item.en}' in Rucksack gelegt`);
      renderBackpack();
      showToast(`'${item.de || item.en}' in Rucksack-Slot ${freeSlot} abgelegt!`, 'success');
    } else {
      showToast('Rucksack ist voll! Bitte wähle einen Slot zum Ersetzen.', 'warning');
    }
  }

  // --- SKILLS & KNOWLEDGE ---
  function renderSkills() {
    if (!state.model) return;
    const container = els.skillsListContainer;
    container.innerHTML = '';

    const nodes = state.skills.nodes || {};
    const unlockedIds = new Set((state.model.skills || []).map(s => s.id));

    let count = 0;
    for (const nodeId in nodes) {
      const node = nodes[nodeId];
      const isUnlocked = unlockedIds.has(Number(nodeId));

      const card = document.createElement('div');
      card.className = `skill-card ${isUnlocked ? 'unlocked' : ''}`;
      const name = node.de || node.en || `Skill #${nodeId}`;
      const desc = node.descDe || node.descEn || '';

      card.innerHTML = `
        <div>
          <div class="skill-name">${escapeHtml(name)}</div>
          <div class="skill-desc">${escapeHtml(desc.substring(0, 90))}...</div>
        </div>
        <button class="btn btn-sm ${isUnlocked ? 'btn-ghost' : 'btn-secondary'}">
          ${isUnlocked ? '✓ Gelernt' : 'Freischalten'}
        </button>
      `;

      card.querySelector('button').onclick = () => {
        toggleSkill(Number(nodeId));
      };

      container.appendChild(card);
      count++;
      if (count >= 60) break; // Limit initial DOM nodes
    }
  }

  function toggleSkill(nodeId) {
    if (!state.model) return;
    const list = state.model.skills || [];
    const idx = list.findIndex(s => s.id === nodeId);
    if (idx !== -1) {
      list.splice(idx, 1);
      pushHistory(`Skill #${nodeId} verlernt`);
    } else {
      list.push({ id: nodeId, level: 1 });
      pushHistory(`Skill #${nodeId} gelernt`);
    }
    renderSkills();
    renderCharacterBanner();
  }

  function renderKnowledge() {
    if (!state.knowledge) return;
    const entries = state.knowledge.entries || [];
    els.metricKnowledgeTotal.textContent = entries.length;

    const container = els.knowledgeListContainer;
    container.innerHTML = '';

    entries.slice(0, 80).forEach(e => {
      const row = document.createElement('div');
      row.className = 'knowledge-item';
      const itemName = getItemName(e.id);
      row.innerHTML = `
        <span style="color:#fff; font-weight:600;">${escapeHtml(itemName)}</span>
        <span class="badge badge-cyan" style="font-size:0.7rem;">Entdeckt</span>
      `;
      container.appendChild(row);
    });
  }

  // --- POWER TOOLS ---
  function applyPowerToolLevel50() {
    if (!state.model) return;
    state.model.level = 50;
    state.model.xp = 50000;
    pushHistory('Level auf 50 & 50.000 XP gesetzt');
    renderCharacterBanner();
    showToast('⚡ Charakter ist nun sofort Level 50 mit 50.000 XP!', 'success');
  }

  function applyPowerToolRepairAll() {
    if (!state.model) return;
    let count = 0;
    const repair = (e) => {
      if (e.maxDurability) {
        e.durability = e.maxDurability;
        count++;
      }
    };
    (state.model.equipment || []).forEach(repair);
    (state.model.main || []).forEach(repair);
    (state.model.extra || []).forEach(repair);

    pushHistory('Alle Items repariert');
    renderEquipment();
    renderBackpack();
    renderSelectedInspector();
    showToast(`🔧 ${count} Gegenstände auf 100% Haltbarkeit repariert!`, 'success');
  }

  function applyPowerToolMaxStacks() {
    if (!state.model) return;
    let count = 0;
    const maxStack = (e) => {
      const it = state.items[e.itemId];
      if (it && it.maxStack > 1) {
        e.count = it.maxStack;
        count++;
      }
    };
    (state.model.main || []).forEach(maxStack);
    (state.model.extra || []).forEach(maxStack);

    pushHistory('Alle Stacks maximiert');
    renderBackpack();
    renderSelectedInspector();
    showToast(`📦 ${count} Stacks auf ihr Maximum gefüllt!`, 'success');
  }

  function applyPowerToolUnlockAllRecipes() {
    if (!state.knowledge) return;
    // Add all craftable blueprints and resource items to knowledge
    const newEntries = [];
    for (const id in state.items) {
      newEntries.push({ id: Number(id), value: 7 }); // 7 = pegou + usou + inspecionou
    }
    state.knowledge.entries = newEntries;
    pushHistory('Alle Rezepte und Entdeckungen freigeschaltet');
    renderKnowledge();
    showToast(`📜 ${newEntries.length} Rezepte & Entdeckungen gelernt!`, 'success');
  }

  // --- HISTORY & UNDO / REDO ---
  function pushHistory(desc) {
    if (!state.model) return;
    const snapshot = JSON.parse(JSON.stringify({
      characterName: state.characterName,
      model: state.model,
      knowledge: state.knowledge
    }));

    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push({ desc, snapshot });
    state.historyIndex++;
    state.hasUnsavedChanges = true;
    updateUnsavedStatus();
  }

  function undo() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      restoreSnapshot(state.history[state.historyIndex]);
      showToast('↩ Rückgängig: ' + state.history[state.historyIndex].desc, 'info');
    }
  }

  function redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      restoreSnapshot(state.history[state.historyIndex]);
      showToast('↪ Wiederholen: ' + state.history[state.historyIndex].desc, 'info');
    }
  }

  function restoreSnapshot(historyItem) {
    const snap = historyItem.snapshot;
    state.characterName = snap.characterName;
    state.model = JSON.parse(JSON.stringify(snap.model));
    state.knowledge = JSON.parse(JSON.stringify(snap.knowledge));
    renderAll();
    updateUnsavedStatus();
  }

  function updateUnsavedStatus() {
    els.btnUndo.disabled = state.historyIndex <= 0;
    els.btnRedo.disabled = state.historyIndex >= state.history.length - 1;
    els.unsavedBadge.style.display = state.hasUnsavedChanges ? 'inline-block' : 'none';
  }

  // --- SAVE & EXPORT ---
  async function saveToDisk() {
    if (!state.model) return;

    if (state.isGameRunning) {
      const confirmRun = confirm('⚠️ Enshrouded läuft aktuell auf deinem Computer! Wenn du jetzt speicherst, überschreibt das Spiel deine Änderungen möglicherweise. Trotzdem fortfahren?');
      if (!confirmRun) return;
    }

    showToast('Erstelle Sicherheits-Backup und speichere Spielstand...', 'info', 3000);

    try {
      const res = await fetch('/api/enshrouded/write-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: state.filePath,
          rawSaveBase64: state.rawSaveBase64,
          characterModel: state.model,
          knowledge: state.knowledge,
          newName: state.characterName
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen');

      state.hasUnsavedChanges = false;
      updateUnsavedStatus();

      showToast(`💾 Spielstand erfolgreich gespeichert! Backup angelegt unter: ${data.backupPath || 'Dokumente'}`, 'success', 6000);
    } catch (err) {
      showToast('Fehler beim Speichern: ' + err.message, 'error', 5000);
    }
  }

  async function downloadKsdFile() {
    if (!state.model) return;
    showToast('Erzeuge .ksd Datei zum Herunterladen...', 'info', 2000);

    try {
      const res = await fetch('/api/enshrouded/build-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawSaveBase64: state.rawSaveBase64,
          characterModel: state.model,
          knowledge: state.knowledge,
          newName: state.characterName
        })
      });

      if (!res.ok) throw new Error('Export fehlgeschlagen');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = state.fileName || 'character0.ksd';
      a.click();
      URL.revokeObjectURL(url);

      showToast(`⬇ Datei '${state.fileName}' heruntergeladen!`, 'success');
    } catch (err) {
      showToast('Export-Fehler: ' + err.message, 'error');
    }
  }

  // --- EVENTS BINDING ---
  function bindEvents() {
    // Permission Flow
    document.getElementById('btn-grant-permission').addEventListener('click', () => {
      localStorage.setItem('playrig_enshrouded_auto_scan', 'true');
      els.permissionBox.style.display = 'none';
      els.detectedBox.style.display = 'flex';
      scanAndShowDetectedSaves();
    });

    document.getElementById('btn-choose-manual').addEventListener('click', () => {
      els.permissionBox.style.display = 'none';
      els.manualDropBox.style.display = 'block';
    });

    document.getElementById('btn-back-to-auto').addEventListener('click', () => {
      els.manualDropBox.style.display = 'none';
      els.permissionBox.style.display = 'flex';
    });

    document.getElementById('btn-refresh-detected').addEventListener('click', scanAndShowDetectedSaves);

    els.btnChangeChar.addEventListener('click', () => {
      els.onboardingModal.classList.add('active');
      els.detectedBox.style.display = 'flex';
      scanAndShowDetectedSaves();
    });

    // Drag and Drop
    const dropzone = els.dropzone;
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    dropzone.addEventListener('click', () => els.inputDropzoneFile.click());
    els.inputDropzoneFile.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
    });
    els.inputManualFile.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
    });

    function handleFileSelect(file) {
      if (!file.name.endsWith('.ksd')) {
        showToast('Bitte wähle eine gültige .ksd Datei aus.', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        loadSaveFromRawBuffer(reader.result, file.name);
      };
      reader.readAsArrayBuffer(file);
    }

    // Character Name Edit
    els.charNameInput.addEventListener('change', (e) => {
      state.characterName = e.target.value;
      pushHistory(`Name geändert zu '${state.characterName}'`);
      renderCharacterBanner();
    });

    // Level & XP Controls
    els.btnLevelInc.addEventListener('click', () => {
      if (!state.model) return;
      state.model.level = Math.min(100, state.model.level + 1);
      pushHistory(`Level erhöht auf ${state.model.level}`);
      renderCharacterBanner();
    });

    els.btnLevelDec.addEventListener('click', () => {
      if (!state.model) return;
      state.model.level = Math.max(1, state.model.level - 1);
      pushHistory(`Level gesenkt auf ${state.model.level}`);
      renderCharacterBanner();
    });

    els.inputCharLevel.addEventListener('change', (e) => {
      if (!state.model) return;
      state.model.level = parseInt(e.target.value) || 1;
      pushHistory(`Level gesetzt auf ${state.model.level}`);
      renderCharacterBanner();
    });

    els.inputCharXp.addEventListener('change', (e) => {
      if (!state.model) return;
      state.model.xp = parseInt(e.target.value) || 0;
      pushHistory(`XP gesetzt auf ${state.model.xp}`);
      renderCharacterBanner();
    });

    els.btnMaxXp.addEventListener('click', () => {
      if (!state.model) return;
      state.model.xp = 50000;
      pushHistory('XP auf 50.000 gesetzt');
      renderCharacterBanner();
    });

    // Inspector Inputs
    els.inspectorCount.addEventListener('change', (e) => {
      const entry = getSelectedEntry();
      if (!entry) return;
      entry.count = Math.max(1, parseInt(e.target.value) || 1);
      pushHistory(`Anzahl geändert: ${entry.count}`);
      renderBackpack();
      renderEquipment();
    });

    els.btnInspectorMaxStack.addEventListener('click', () => {
      const entry = getSelectedEntry();
      if (!entry) return;
      const it = state.items[entry.itemId];
      entry.count = it?.maxStack || 100;
      els.inspectorCount.value = entry.count;
      pushHistory(`Stack maximiert auf ${entry.count}`);
      renderBackpack();
      renderEquipment();
    });

    els.btnInspectorRepair.addEventListener('click', () => {
      const entry = getSelectedEntry();
      if (!entry || !entry.maxDurability) return;
      entry.durability = entry.maxDurability;
      els.inspectorDurability.value = entry.durability;
      pushHistory('Item voll repariert');
      renderBackpack();
      renderEquipment();
    });

    els.inspectorLevel.addEventListener('change', (e) => {
      const entry = getSelectedEntry();
      if (!entry) return;
      entry.level = parseInt(e.target.value) || 1;
      pushHistory(`Item-Level auf ${entry.level} gesetzt`);
      renderEquipment();
    });

    els.btnInspectorDuplicate.addEventListener('click', () => {
      const entry = getSelectedEntry();
      if (!entry) return;
      spawnItemIntoSave(state.items[entry.itemId]);
    });

    els.btnInspectorClear.addEventListener('click', () => {
      const entry = getSelectedEntry();
      if (!entry) return;
      const list = state.model[state.selectedContainer];
      const idx = list.indexOf(entry);
      if (idx !== -1) {
        list.splice(idx, 1);
        pushHistory('Item gelöscht');
        renderEquipment();
        renderBackpack();
        renderSelectedInspector();
      }
    });

    // Quick Actions
    els.btnRepairAll.addEventListener('click', applyPowerToolRepairAll);
    els.btnStackAll.addEventListener('click', applyPowerToolMaxStacks);

    // Spawner search and filters
    els.spawnerSearchInput.addEventListener('input', (e) => {
      state.spawnerQuery = e.target.value;
      renderSpawnerCatalog();
    });

    els.spawnerCategoryChips.querySelectorAll('.spawner-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        els.spawnerCategoryChips.querySelectorAll('.spawner-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.spawnerCategory = chip.dataset.cat;
        renderSpawnerCatalog();
      });
    });

    els.spawnerRaritySelect.addEventListener('change', (e) => {
      state.spawnerRarity = e.target.value;
      renderSpawnerCatalog();
    });

    // Power Tools
    els.powerToolLevel50.addEventListener('click', applyPowerToolLevel50);
    els.powerToolRepairAll.addEventListener('click', applyPowerToolRepairAll);
    els.powerToolMaxStacks.addEventListener('click', applyPowerToolMaxStacks);
    els.powerToolUnlockAll.addEventListener('click', applyPowerToolUnlockAllRecipes);
    els.btnUnlockAllRecipes.addEventListener('click', applyPowerToolUnlockAllRecipes);

    // Save & Download
    els.btnSave.addEventListener('click', saveToDisk);
    els.btnDownloadKsd.addEventListener('click', downloadKsdFile);
    els.btnUndo.addEventListener('click', undo);
    els.btnRedo.addEventListener('click', redo);

    // Tab Navigation
    els.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        els.navTabs.forEach(t => t.classList.remove('active'));
        els.tabPanes.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const targetId = tab.dataset.tab;
        document.getElementById(targetId)?.classList.add('active');
      });
    });

    // Keyboard Shortcuts (Strg+Z, Strg+Y, Strg+S)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveToDisk();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redo();
      }
    });

    // Unsaved Changes Guard
    els.btnBackDeck.addEventListener('click', (e) => {
      if (state.hasUnsavedChanges) {
        e.preventDefault();
        els.unsavedModal.classList.add('active');
      }
    });

    els.safetySaveLeave.addEventListener('click', async () => {
      await saveToDisk();
      window.location.href = '/';
    });

    els.safetyDiscardLeave.addEventListener('click', () => {
      state.hasUnsavedChanges = false;
      window.location.href = '/';
    });

    els.safetyCancel.addEventListener('click', () => {
      els.unsavedModal.classList.remove('active');
    });

    window.addEventListener('beforeunload', (e) => {
      if (state.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Self-start
  document.addEventListener('DOMContentLoaded', init);
})();

