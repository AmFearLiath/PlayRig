/**
 * PlayRig Speedrun Splits Tracker // Delta Stopwatch
 * Author: Liath
 * Copyright: © GameChiller
 * Version: v0.0.1
 */

(function() {
  'use strict';

  // Audio Context for procedural SFX
  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, type, duration, gainVal = 0.2) {
    try {
      const ctx = getAudio();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch(e) {}
  }

  function playGoldFanfare() {
    playTone(523.25, 'triangle', 0.15, 0.25); // C5
    setTimeout(() => playTone(659.25, 'triangle', 0.15, 0.25), 100); // E5
    setTimeout(() => playTone(783.99, 'triangle', 0.3, 0.3), 200); // G5
  }

  // Presets definition
  const PRESETS = {
    enshrouded: {
      game: 'Enshrouded',
      category: 'Flame Altar Any%',
      splits: [
        { name: 'Spawn & First Shroud', pb: 95.2, bestSegment: 90.0 },
        { name: 'Braelyn Bridge', pb: 245.5, bestSegment: 145.0 },
        { name: 'Altar Upgrade Lv 2', pb: 420.0, bestSegment: 170.0 },
        { name: 'Spire of Springlands', pb: 650.0, bestSegment: 220.0 },
        { name: 'Fell Wispwyrm Slay', pb: 980.0, bestSegment: 320.0 },
        { name: 'Finish / Final Flame', pb: 1210.0, bestSegment: 225.0 }
      ]
    },
    darksouls: {
      game: 'Dark Souls',
      category: 'Any% Kiln Skip',
      splits: [
        { name: 'Asylum Demon', pb: 180.0, bestSegment: 175.0 },
        { name: 'Gargoyles Bell', pb: 410.0, bestSegment: 220.0 },
        { name: 'Quelaag Bell', pb: 720.0, bestSegment: 300.0 },
        { name: 'Iron Golem', pb: 940.0, bestSegment: 210.0 },
        { name: 'Ornstein & Smough', pb: 1350.0, bestSegment: 395.0 },
        { name: 'Gwyn Lord of Cinder', pb: 1680.0, bestSegment: 310.0 }
      ]
    },
    sm64: {
      game: 'Super Mario 64',
      category: '16 Star',
      splits: [
        { name: 'Bob-omb Battlefield', pb: 110.0, bestSegment: 105.0 },
        { name: 'Whomp\'s Fortress', pb: 290.0, bestSegment: 175.0 },
        { name: 'Bowser in the Dark World', pb: 460.0, bestSegment: 165.0 },
        { name: 'Shifting Sand Land', pb: 620.0, bestSegment: 155.0 },
        { name: 'Bowser in the Fire Sea', pb: 790.0, bestSegment: 160.0 },
        { name: 'Bowser in the Sky', pb: 980.0, bestSegment: 185.0 }
      ]
    },
    bossrush: {
      game: 'RPG Boss Rush',
      category: 'All Bosses',
      splits: [
        { name: 'Boss 1: Guardian Golem', pb: 60.0, bestSegment: 55.0 },
        { name: 'Boss 2: Void Spectre', pb: 140.0, bestSegment: 75.0 },
        { name: 'Boss 3: Inferno Wyrm', pb: 235.0, bestSegment: 90.0 },
        { name: 'Boss 4: Chronos Master', pb: 350.0, bestSegment: 110.0 }
      ]
    }
  };

  // State
  let currentSplits = JSON.parse(JSON.stringify(PRESETS.enshrouded.splits));
  let attempts = 42;
  let timerState = 'STOPPED'; // 'STOPPED', 'RUNNING', 'PAUSED', 'FINISHED'
  let startTime = 0;
  let elapsedTime = 0;
  let pauseStartTime = 0;
  let animFrameId = null;
  let currentSplitIndex = 0;
  let runSplits = []; // stores elapsed time at each split

  // DOM Elements
  const mainTimerEl = document.getElementById('main-timer-display');
  const subDeltaEl = document.getElementById('sub-delta-time');
  const splitsBody = document.getElementById('splits-body');
  const gameTitleInput = document.getElementById('game-title');
  const gameCatInput = document.getElementById('game-category');
  const attemptsEl = document.getElementById('attempts-val');
  const presetSelect = document.getElementById('preset-select');
  const splitBtn = document.getElementById('btn-split');
  const splitBtnLabel = document.getElementById('split-btn-label');
  const pauseBtn = document.getElementById('btn-pause');
  const undoBtn = document.getElementById('btn-undo');
  const skipBtn = document.getElementById('btn-skip');
  const resetBtn = document.getElementById('btn-reset');
  const obsBtn = document.getElementById('btn-obs-mode');
  const addSplitBtn = document.getElementById('btn-add-split');
  const exportBtn = document.getElementById('btn-export-splits');
  const importBtn = document.getElementById('btn-import-splits');
  const fileImportInput = document.getElementById('file-import');

  // Format Helper
  function formatTime(seconds, showMs = true) {
    if (isNaN(seconds) || seconds === null) return '-';
    const isNeg = seconds < 0;
    const abs = Math.abs(seconds);
    const m = Math.floor(abs / 60);
    const s = Math.floor(abs % 60);
    const ms = Math.floor((abs * 100) % 100);

    const padM = String(m).padStart(2, '0');
    const padS = String(s).padStart(2, '0');
    const padMs = String(ms).padStart(2, '0');

    if (showMs) {
      return `${isNeg ? '-' : ''}${padM}:${padS}.${padMs}`;
    }
    return `${isNeg ? '-' : ''}${padM}:${padS}`;
  }

  function formatDelta(deltaSec) {
    if (deltaSec === null || isNaN(deltaSec)) return '';
    const sign = deltaSec > 0 ? '+' : '-';
    const abs = Math.abs(deltaSec);
    const m = Math.floor(abs / 60);
    const s = Math.floor(abs % 60);
    const ms = Math.floor((abs * 10) % 10);
    
    if (m > 0) {
      return `${sign}${m}:${String(s).padStart(2, '0')}.${ms}`;
    }
    return `${sign}${s}.${ms}`;
  }

  // Render Table
  function renderSplits() {
    splitsBody.innerHTML = '';
    currentSplits.forEach((split, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'split-row';
      if (idx === currentSplitIndex && timerState !== 'FINISHED') tr.classList.add('active');
      if (idx < currentSplitIndex) tr.classList.add('completed');

      const runTime = runSplits[idx];
      let deltaStr = '';
      let deltaClass = '';

      if (runTime !== undefined && runTime !== null) {
        const delta = runTime - split.pb;
        deltaStr = formatDelta(delta);
        if (delta <= 0) {
          deltaClass = 'delta-ahead';
        } else {
          deltaClass = 'delta-behind';
        }

        // Check if gold split (best segment)
        const prevRunTime = idx > 0 ? (runSplits[idx - 1] || 0) : 0;
        const segmentDuration = runTime - prevRunTime;
        if (split.bestSegment && segmentDuration < split.bestSegment) {
          tr.classList.add('gold-split');
        }
      }

      tr.innerHTML = `
        <td class="col-icon">${idx + 1}</td>
        <td class="col-name">${split.name}</td>
        <td class="col-delta ${deltaClass}">${deltaStr}</td>
        <td class="col-time">${runTime !== undefined ? formatTime(runTime, false) : formatTime(split.pb, false)}</td>
      `;
      splitsBody.appendChild(tr);
    });

    // Auto-scroll active row into view
    const activeRow = splitsBody.querySelector('.active');
    if (activeRow) {
      activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Timer Tick
  function tick() {
    if (timerState === 'RUNNING') {
      const now = performance.now();
      elapsedTime = (now - startTime) / 1000;
      updateDisplay();
      animFrameId = requestAnimationFrame(tick);
    }
  }

  function updateDisplay() {
    const m = Math.floor(elapsedTime / 60);
    const s = Math.floor(elapsedTime % 60);
    const ms = Math.floor((elapsedTime * 100) % 100);

    mainTimerEl.innerHTML = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}<span class="timer-ms">.${String(ms).padStart(2, '0')}</span>`;

    // Update active row delta if running
    if (currentSplitIndex < currentSplits.length) {
      const curPb = currentSplits[currentSplitIndex].pb;
      const liveDelta = elapsedTime - curPb;
      subDeltaEl.textContent = formatDelta(liveDelta);
      subDeltaEl.className = 'sub-time ' + (liveDelta <= 0 ? 'delta-ahead' : 'delta-behind');
    }
  }

  // Timer Actions
  function startTimer() {
    if (timerState === 'STOPPED') {
      startTime = performance.now();
      timerState = 'RUNNING';
      attempts++;
      attemptsEl.textContent = attempts;
      splitBtnLabel.textContent = 'SPLIT';
      playTone(440, 'sine', 0.1, 0.2);
      animFrameId = requestAnimationFrame(tick);
    } else if (timerState === 'PAUSED') {
      startTime += performance.now() - pauseStartTime;
      timerState = 'RUNNING';
      animFrameId = requestAnimationFrame(tick);
    }
    renderSplits();
  }

  function split() {
    if (timerState === 'STOPPED') {
      startTimer();
      return;
    }
    if (timerState !== 'RUNNING') return;

    runSplits[currentSplitIndex] = elapsedTime;

    // Check segment duration against gold
    const prevTime = currentSplitIndex > 0 ? runSplits[currentSplitIndex - 1] : 0;
    const segmentTime = elapsedTime - prevTime;
    const currentSplitObj = currentSplits[currentSplitIndex];

    if (!currentSplitObj.bestSegment || segmentTime < currentSplitObj.bestSegment) {
      currentSplitObj.bestSegment = segmentTime;
      playGoldFanfare();
    } else {
      playTone(660, 'sine', 0.1, 0.2);
    }

    currentSplitIndex++;

    if (currentSplitIndex >= currentSplits.length) {
      finishRun();
    } else {
      renderSplits();
    }
  }

  function finishRun() {
    timerState = 'FINISHED';
    cancelAnimationFrame(animFrameId);
    splitBtnLabel.textContent = 'FINISHED';

    // Check if new PB
    const lastPB = currentSplits[currentSplits.length - 1].pb;
    if (!lastPB || elapsedTime < lastPB) {
      // New personal best! Update PBs
      currentSplits.forEach((s, i) => {
        if (runSplits[i] !== undefined) s.pb = runSplits[i];
      });
      playGoldFanfare();
      alert(`🎉 NEUER PERSONAL BEST! Zeit: ${formatTime(elapsedTime)}`);
    }

    renderSplits();
    saveToStorage();
  }

  function togglePause() {
    if (timerState === 'RUNNING') {
      timerState = 'PAUSED';
      pauseStartTime = performance.now();
      cancelAnimationFrame(animFrameId);
      pauseBtn.innerHTML = '<span class="btn-icon">▶</span> Resume';
    } else if (timerState === 'PAUSED') {
      startTime += (performance.now() - pauseStartTime);
      timerState = 'RUNNING';
      pauseBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
      animFrameId = requestAnimationFrame(tick);
    }
  }

  function resetTimer() {
    if (confirm('Möchtest du den aktuellen Run wirklich zurücksetzen?')) {
      cancelAnimationFrame(animFrameId);
      timerState = 'STOPPED';
      elapsedTime = 0;
      currentSplitIndex = 0;
      runSplits = [];
      splitBtnLabel.textContent = 'START / SPLIT';
      pauseBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
      subDeltaEl.textContent = '±0.00';
      subDeltaEl.className = 'sub-time';
      mainTimerEl.innerHTML = '00:00<span class="timer-ms">.00</span>';
      playTone(220, 'sine', 0.15, 0.3);
      renderSplits();
    }
  }

  function undoSplit() {
    if (currentSplitIndex > 0) {
      currentSplitIndex--;
      runSplits.pop();
      if (timerState === 'FINISHED') {
        timerState = 'RUNNING';
        animFrameId = requestAnimationFrame(tick);
      }
      renderSplits();
    }
  }

  function skipSplit() {
    if (timerState === 'RUNNING' && currentSplitIndex < currentSplits.length - 1) {
      runSplits[currentSplitIndex] = null;
      currentSplitIndex++;
      renderSplits();
    }
  }

  // Presets & LocalStorage
  function loadPreset(key) {
    if (PRESETS[key]) {
      const p = PRESETS[key];
      gameTitleInput.value = p.game;
      gameCatInput.value = p.category;
      currentSplits = JSON.parse(JSON.stringify(p.splits));
      resetTimer();
    }
  }

  function saveToStorage() {
    const data = {
      game: gameTitleInput.value,
      category: gameCatInput.value,
      attempts: attempts,
      splits: currentSplits
    };
    localStorage.setItem('playrig_splits_data', JSON.stringify(data));
  }

  function loadFromStorage() {
    const saved = localStorage.getItem('playrig_splits_data');
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d.splits && Array.isArray(d.splits)) {
          gameTitleInput.value = d.game || 'Enshrouded';
          gameCatInput.value = d.category || 'Any%';
          attempts = d.attempts || 1;
          attemptsEl.textContent = attempts;
          currentSplits = d.splits;
        }
      } catch(e) {}
    }
  }

  // OBS Modes
  let obsModeIndex = 0; // 0 = off, 1 = chroma green, 2 = transparent
  function toggleObsMode() {
    obsModeIndex = (obsModeIndex + 1) % 3;
    document.body.classList.remove('obs-mode', 'obs-chroma', 'obs-transparent');

    if (obsModeIndex === 1) {
      document.body.classList.add('obs-mode', 'obs-chroma');
      obsBtn.textContent = '🟩 Chroma Green';
    } else if (obsModeIndex === 2) {
      document.body.classList.add('obs-mode', 'obs-transparent');
      obsBtn.textContent = '👻 Transparent';
    } else {
      obsBtn.textContent = '🎥 OBS Mode';
    }
  }

  // Event Listeners
  splitBtn.addEventListener('click', split);
  pauseBtn.addEventListener('click', togglePause);
  resetBtn.addEventListener('click', resetTimer);
  undoBtn.addEventListener('click', undoSplit);
  skipBtn.addEventListener('click', skipSplit);
  obsBtn.addEventListener('click', toggleObsMode);

  presetSelect.addEventListener('change', (e) => loadPreset(e.target.value));

  addSplitBtn.addEventListener('click', () => {
    const name = prompt('Name des neuen Segments:', `Segment ${currentSplits.length + 1}`);
    if (name) {
      const lastPb = currentSplits.length > 0 ? currentSplits[currentSplits.length - 1].pb + 120 : 120;
      currentSplits.push({ name: name, pb: lastPb, bestSegment: 120 });
      renderSplits();
      saveToStorage();
    }
  });

  exportBtn.addEventListener('click', () => {
    const data = {
      game: gameTitleInput.value,
      category: gameCatInput.value,
      attempts: attempts,
      splits: currentSplits
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gameTitleInput.value.replace(/\s+/g, '_')}_splits.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener('click', () => fileImportInput.click());
  fileImportInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const d = JSON.parse(evt.target.result);
        if (d.splits) {
          gameTitleInput.value = d.game || 'Game';
          gameCatInput.value = d.category || 'Any%';
          currentSplits = d.splits;
          resetTimer();
          saveToStorage();
        }
      } catch(err) {
        alert('Fehler beim Importieren: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Global Hotkeys
  window.addEventListener('keydown', (e) => {
    // Ignore hotkeys when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space' || e.code === 'Numpad1') {
      e.preventDefault();
      split();
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      resetTimer();
    } else if (e.code === 'KeyP') {
      e.preventDefault();
      togglePause();
    } else if (e.code === 'KeyU') {
      e.preventDefault();
      undoSplit();
    } else if (e.code === 'KeyS') {
      e.preventDefault();
      skipSplit();
    }
  });

  // Init
  loadFromStorage();
  renderSplits();
})();

