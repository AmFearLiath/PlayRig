/**
 * PLAYRIG - SPEEDRUN SPLITS TRACKER
 * Pro Delta Stopwatch, Multi-Layouts (Vertical, Horizontal, Compact),
 * Drag & Drop Floating Window, Segment Practice Mode & OBS Chroma Overlays.
 *
 * Author: Liath • Copyright: © GameChiller • Version: v0.0.2
 */

(function () {
  'use strict';

  // --- Sound Synthesizer (Web Audio API) ---
  let audioCtx = null;
  let soundEnabled = true;

  function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, type, duration, gainVal = 0.2) {
    if (!soundEnabled) return;
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
    } catch (e) {}
  }

  function playGoldFanfare() {
    if (!soundEnabled) return;
    playTone(523.25, 'triangle', 0.15, 0.25); // C5
    setTimeout(() => playTone(659.25, 'triangle', 0.15, 0.25), 100); // E5
    setTimeout(() => playTone(783.99, 'triangle', 0.3, 0.3), 200); // G5
  }

  // --- Presets Definition ---
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
    eldenring: {
      game: 'Elden Ring',
      category: 'Any% Unrestricted',
      splits: [
        { name: 'Tutorial Grafted Scion', pb: 70.0, bestSegment: 65.0 },
        { name: 'Stormveil Skip', pb: 210.0, bestSegment: 135.0 },
        { name: 'Academy Red Wolf', pb: 480.0, bestSegment: 260.0 },
        { name: 'Rennala Queen of Moon', pb: 710.0, bestSegment: 220.0 },
        { name: 'Godskin Duo', pb: 1120.0, bestSegment: 390.0 },
        { name: 'Maliketh the Black Blade', pb: 1390.0, bestSegment: 260.0 },
        { name: 'Elden Beast Slain', pb: 1680.0, bestSegment: 280.0 }
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
    hollowknight: {
      game: 'Hollow Knight',
      category: 'Any% No Major Glitches',
      splits: [
        { name: 'Vengeful Spirit & False Knight', pb: 240.0, bestSegment: 225.0 },
        { name: 'Mothwing Cloak (Hornet 1)', pb: 510.0, bestSegment: 260.0 },
        { name: 'Mantis Claw (Wall Jump)', pb: 840.0, bestSegment: 320.0 },
        { name: 'Monomon (Uumuu)', pb: 1350.0, bestSegment: 490.0 },
        { name: 'Lurien (Watcher Knights)', pb: 1980.0, bestSegment: 610.0 },
        { name: 'Hollow Knight Slain', pb: 2420.0, bestSegment: 430.0 }
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

  // --- State Variables ---
  let currentSplits = JSON.parse(JSON.stringify(PRESETS.enshrouded.splits));
  let attempts = 42;
  let timerState = 'STOPPED'; // 'STOPPED', 'RUNNING', 'PAUSED', 'FINISHED'
  let startTime = 0;
  let elapsedTime = 0;
  let pauseStartTime = 0;
  let animFrameId = null;
  let currentSplitIndex = 0;
  let runSplits = []; // stores elapsed time at each split
  let comparisonMode = 'pb'; // 'pb' or 'gold'
  let currentLayout = 'vertical'; // 'vertical', 'horizontal', 'compact'
  let isObsMode = false;

  // Segment Practice Mode State
  let isPracticeMode = false;
  let practiceIndex = -1;

  // --- DOM Elements ---
  const container = document.getElementById('splits-app');
  const mainTimerEl = document.getElementById('main-timer-display');
  const subDeltaEl = document.getElementById('sub-delta-time');
  const subLabelEl = document.getElementById('sub-segment-label');
  const splitsBody = document.getElementById('splits-body');
  const gameTitleInput = document.getElementById('game-title');
  const gameCatInput = document.getElementById('game-category');
  const attemptsEl = document.getElementById('attempts-val');
  const estFinishEl = document.getElementById('est-finish-val');
  const sumOfBestEl = document.getElementById('sum-of-best-val');
  const selectComp = document.getElementById('select-comparison');
  const presetSelect = document.getElementById('preset-select');
  const splitBtn = document.getElementById('btn-split');
  const splitBtnLabel = document.getElementById('split-btn-label');
  const pauseBtn = document.getElementById('btn-pause');
  const undoBtn = document.getElementById('btn-undo');
  const skipBtn = document.getElementById('btn-skip');
  const resetBtn = document.getElementById('btn-reset');
  const soundBtn = document.getElementById('btn-sound-toggle');

  // Layout Buttons
  const btnVert = document.getElementById('btn-layout-vert');
  const btnHoriz = document.getElementById('btn-layout-horiz');
  const btnCompact = document.getElementById('btn-layout-compact');

  // OBS Controls
  const btnObsToggle = document.getElementById('btn-obs-toggle');
  const obsFloatingBar = document.getElementById('obs-floating-bar');
  const obsBgSelect = document.getElementById('obs-bg-select');
  const btnObsRecenter = document.getElementById('btn-obs-recenter');
  const btnObsExit = document.getElementById('btn-obs-exit');

  // Drag Handle
  const dragHandle = document.getElementById('drag-handle');
  const btnCenterPos = document.getElementById('btn-center-pos');

  // Practice Mode Banner
  const practiceBanner = document.getElementById('practice-banner');
  const practiceSegName = document.getElementById('practice-segment-name');
  const practiceTargetTime = document.getElementById('practice-target-time');
  const btnExitPractice = document.getElementById('btn-exit-practice');

  // Info Modal
  const infoModal = document.getElementById('info-modal');
  const btnOpenInfo = document.getElementById('btn-open-info');
  const btnCloseInfo = document.getElementById('btn-close-info');
  const btnCloseInfoFooter = document.getElementById('btn-close-info-footer');

  // Extra Actions
  const btnAttDec = document.getElementById('btn-att-dec');
  const btnAttInc = document.getElementById('btn-att-inc');
  const addSplitBtn = document.getElementById('btn-add-split');
  const exportBtn = document.getElementById('btn-export-splits');
  const importBtn = document.getElementById('btn-import-splits');
  const fileImportInput = document.getElementById('file-import');

  // --- Formatting Helpers ---
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

    if (showMs) return `${isNeg ? '-' : ''}${padM}:${padS}.${padMs}`;
    return `${isNeg ? '-' : ''}${padM}:${padS}`;
  }

  function formatDelta(deltaSec) {
    if (deltaSec === null || isNaN(deltaSec)) return '';
    const sign = deltaSec > 0 ? '+' : '-';
    const abs = Math.abs(deltaSec);
    const m = Math.floor(abs / 60);
    const s = Math.floor(abs % 60);
    const ms = Math.floor((abs * 10) % 10);

    if (m > 0) return `${sign}${m}:${String(s).padStart(2, '0')}.${ms}`;
    return `${sign}${s}.${ms}`;
  }

  // Calculate Sum of Best (Theoretical Best Time)
  function calculateSumOfBest() {
    let total = 0;
    for (const split of currentSplits) {
      if (split.bestSegment) total += split.bestSegment;
      else if (split.pb) total += split.pb;
    }
    return total;
  }

  // Update Estimated Finish Time
  function updatePaceAndSoB() {
    const sob = calculateSumOfBest();
    if (sumOfBestEl) sumOfBestEl.textContent = formatTime(sob, false);

    if (estFinishEl) {
      if (timerState === 'RUNNING' && currentSplitIndex < currentSplits.length) {
        const curPb = currentSplits[currentSplitIndex].pb;
        const liveDelta = elapsedTime - curPb;
        const finalPb = currentSplits[currentSplits.length - 1].pb;
        const estFinish = finalPb + liveDelta;
        estFinishEl.textContent = formatTime(Math.max(0, estFinish), false);
      } else if (timerState === 'FINISHED') {
        estFinishEl.textContent = formatTime(elapsedTime, false);
      } else {
        const lastPb = currentSplits[currentSplits.length - 1]?.pb;
        estFinishEl.textContent = lastPb ? formatTime(lastPb, false) : '--:--';
      }
    }
  }

  // --- Render Splits Table ---
  function renderSplits() {
    splitsBody.innerHTML = '';
    currentSplits.forEach((split, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'split-row';
      if (!isPracticeMode && idx === currentSplitIndex && timerState !== 'FINISHED') tr.classList.add('active');
      if (isPracticeMode && idx === practiceIndex) tr.classList.add('active');
      if (!isPracticeMode && idx < currentSplitIndex) tr.classList.add('completed');

      const runTime = runSplits[idx];
      let deltaStr = '';
      let deltaClass = '';

      if (runTime !== undefined && runTime !== null) {
        const targetCompare = comparisonMode === 'gold' ? (split.bestSegment || split.pb) : split.pb;
        const delta = runTime - targetCompare;
        deltaStr = formatDelta(delta);
        deltaClass = delta <= 0 ? 'delta-ahead' : 'delta-behind';

        // Check if gold split
        const prevRunTime = idx > 0 ? (runSplits[idx - 1] || 0) : 0;
        const segmentDuration = runTime - prevRunTime;
        if (split.bestSegment && segmentDuration < split.bestSegment) {
          tr.classList.add('gold-split');
        }
      }

      const displayTime = runTime !== undefined ? formatTime(runTime, false) : formatTime(split.pb, false);

      tr.innerHTML = `
        <td class="col-icon">${idx + 1}</td>
        <td class="col-name">${split.name}</td>
        <td class="col-delta ${deltaClass}">${deltaStr}</td>
        <td class="col-time">${displayTime}</td>
        <td class="col-actions">
          <div class="row-action-btns">
            <button class="btn-row-action train" data-idx="${idx}" title="Segment isoliert trainieren">🎯</button>
            <button class="btn-row-action resume" data-idx="${idx}" title="Run ab diesem Segment starten">↺</button>
          </div>
        </td>
      `;
      splitsBody.appendChild(tr);
    });

    // Attach row action listeners
    splitsBody.querySelectorAll('.btn-row-action.train').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        startPracticeMode(idx);
      });
    });

    splitsBody.querySelectorAll('.btn-row-action.resume').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        restartFromSegment(idx);
      });
    });

    updatePaceAndSoB();

    // Auto-scroll active row
    const activeRow = splitsBody.querySelector('.active');
    if (activeRow) {
      activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // --- Timer Tick Loop ---
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

    if (isPracticeMode) {
      const targetSec = currentSplits[practiceIndex]?.bestSegment || 60;
      const liveDelta = elapsedTime - targetSec;
      subDeltaEl.textContent = formatDelta(liveDelta);
      subDeltaEl.className = 'sub-time ' + (liveDelta <= 0 ? 'delta-ahead' : 'delta-behind');
      subLabelEl.textContent = 'ZIEL: ' + formatTime(targetSec, false);
      return;
    }

    // Normal Run Delta Update
    if (currentSplitIndex < currentSplits.length) {
      const curPb = currentSplits[currentSplitIndex].pb;
      const liveDelta = elapsedTime - curPb;
      subDeltaEl.textContent = formatDelta(liveDelta);
      subDeltaEl.className = 'sub-time ' + (liveDelta <= 0 ? 'delta-ahead' : 'delta-behind');
      subLabelEl.textContent = `SEGMENT [${currentSplitIndex + 1}/${currentSplits.length}]`;
    }

    updatePaceAndSoB();
  }

  // --- Timer Actions ---
  function startTimer() {
    if (timerState === 'STOPPED') {
      startTime = performance.now();
      timerState = 'RUNNING';
      if (!isPracticeMode) {
        attempts++;
        attemptsEl.textContent = attempts;
      }
      splitBtnLabel.textContent = isPracticeMode ? 'STOP TRAIN' : 'SPLIT';
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

    // In Practice Mode: stop and evaluate single segment
    if (isPracticeMode) {
      finishPracticeSegment();
      return;
    }

    runSplits[currentSplitIndex] = elapsedTime;

    // Check segment duration against gold
    const prevTime = currentSplitIndex > 0 ? (runSplits[currentSplitIndex - 1] || 0) : 0;
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

    const lastPB = currentSplits[currentSplits.length - 1].pb;
    if (!lastPB || elapsedTime < lastPB) {
      // New personal best
      currentSplits.forEach((s, i) => {
        if (runSplits[i] !== undefined) s.pb = runSplits[i];
      });
      playGoldFanfare();
      showCelebration(`🎉 NEUER PERSONAL BEST! Endzeit: ${formatTime(elapsedTime)}`);
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

  let resetConfirmTimer = null;
  function resetTimer(skipConfirm = false) {
    if (skipConfirm || timerState === 'STOPPED') {
      doReset();
      return;
    }

    // Two-step soft reset (click once to prime, click again to confirm, or instant if stopped)
    if (resetBtn.classList.contains('confirming')) {
      clearTimeout(resetConfirmTimer);
      resetBtn.classList.remove('confirming');
      resetBtn.textContent = '↺ Reset';
      doReset();
    } else {
      resetBtn.classList.add('confirming');
      resetBtn.textContent = 'Sicher? (Klick)';
      resetConfirmTimer = setTimeout(() => {
        resetBtn.classList.remove('confirming');
        resetBtn.textContent = '↺ Reset';
      }, 2500);
    }
  }

  function doReset() {
    cancelAnimationFrame(animFrameId);
    timerState = 'STOPPED';
    elapsedTime = 0;
    currentSplitIndex = 0;
    runSplits = [];
    splitBtnLabel.textContent = isPracticeMode ? 'START TRAIN' : 'START / SPLIT';
    pauseBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
    subDeltaEl.textContent = '±0.00';
    subDeltaEl.className = 'sub-time';
    mainTimerEl.innerHTML = '00:00<span class="timer-ms">.00</span>';
    playTone(220, 'sine', 0.15, 0.25);
    renderSplits();
  }

  function undoSplit() {
    if (currentSplitIndex > 0 && !isPracticeMode) {
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
    if (timerState === 'RUNNING' && currentSplitIndex < currentSplits.length - 1 && !isPracticeMode) {
      runSplits[currentSplitIndex] = null;
      currentSplitIndex++;
      renderSplits();
    }
  }

  // --- Toast / Celebration Helper ---
  function showCelebration(msg) {
    if (window.showToast) {
      window.showToast(msg, 'success');
    } else {
      const banner = document.createElement('div');
      banner.className = 'practice-active-banner';
      banner.style.position = 'fixed';
      banner.style.top = '70px';
      banner.style.left = '50%';
      banner.style.transform = 'translateX(-50%)';
      banner.style.zIndex = '99999';
      banner.innerHTML = `<span style="font-weight:800; color:#fbbf24;">${msg}</span>`;
      document.body.appendChild(banner);
      setTimeout(() => banner.remove(), 4000);
    }
  }

  // --- Segment Practice Mode ---
  function startPracticeMode(idx) {
    isPracticeMode = true;
    practiceIndex = idx;
    const splitObj = currentSplits[idx];

    practiceBanner.style.display = 'flex';
    practiceSegName.textContent = splitObj.name;
    practiceTargetTime.textContent = formatTime(splitObj.bestSegment || splitObj.pb, false);

    resetTimer(true);
    splitBtnLabel.textContent = 'START TRAIN';
    renderSplits();
  }

  function finishPracticeSegment() {
    cancelAnimationFrame(animFrameId);
    timerState = 'FINISHED';
    splitBtnLabel.textContent = 'START TRAIN';

    const splitObj = currentSplits[practiceIndex];
    const prevBest = splitObj.bestSegment;

    if (!prevBest || elapsedTime < prevBest) {
      splitObj.bestSegment = elapsedTime;
      playGoldFanfare();
      showCelebration(`✨ NEUES GOLD-SEGMENT FÜR "${splitObj.name}"! Zeit: ${formatTime(elapsedTime)}`);
      saveToStorage();
    } else {
      playTone(480, 'sine', 0.2, 0.2);
    }

    renderSplits();
  }

  function exitPracticeMode() {
    isPracticeMode = false;
    practiceIndex = -1;
    practiceBanner.style.display = 'none';
    resetTimer(true);
  }

  // Restart run from mid-route segment
  function restartFromSegment(idx) {
    resetTimer(true);
    currentSplitIndex = idx;
    // Pre-fill previous splits with their respective PB times
    for (let i = 0; i < idx; i++) {
      runSplits[i] = currentSplits[i].pb;
    }
    const prevTime = idx > 0 ? currentSplits[idx - 1].pb : 0;
    elapsedTime = prevTime;
    startTime = performance.now() - (prevTime * 1000);
    timerState = 'RUNNING';
    animFrameId = requestAnimationFrame(tick);
    splitBtnLabel.textContent = 'SPLIT';
    renderSplits();
  }

  // --- Drag & Drop Floating Window Engine ---
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let elemStartX = 0;
  let elemStartY = 0;

  function initDraggable() {
    // Restore saved position
    const savedPos = localStorage.getItem('playrig_splits_pos');
    if (savedPos) {
      try {
        const { left, top } = JSON.parse(savedPos);
        if (typeof left === 'number' && typeof top === 'number') {
          setFloatingPosition(left, top);
        }
      } catch (e) {}
    }

    dragHandle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return; // Ignore clicks on reset button
      isDragging = true;
      try { dragHandle.setPointerCapture(e.pointerId); } catch (err) {}

      const rect = container.getBoundingClientRect();
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      elemStartX = rect.left;
      elemStartY = rect.top;

      container.style.left = `${elemStartX}px`;
      container.style.top = `${elemStartY}px`;
      container.classList.add('is-floating');
    });

    dragHandle.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      const newLeft = Math.max(10, Math.min(window.innerWidth - container.offsetWidth - 10, elemStartX + dx));
      const newTop = Math.max(10, Math.min(window.innerHeight - 80, elemStartY + dy));

      container.style.left = `${newLeft}px`;
      container.style.top = `${newTop}px`;
    });

    const stopDrag = (e) => {
      if (isDragging) {
        isDragging = false;
        try { dragHandle.releasePointerCapture(e.pointerId); } catch (err) {}
        const rect = container.getBoundingClientRect();
        localStorage.setItem('playrig_splits_pos', JSON.stringify({ left: rect.left, top: rect.top }));
      }
    };

    dragHandle.addEventListener('pointerup', stopDrag);
    dragHandle.addEventListener('pointercancel', stopDrag);

    // Position Reset Buttons
    btnCenterPos.addEventListener('click', resetPosition);
    btnObsRecenter.addEventListener('click', resetPosition);
  }

  function setFloatingPosition(left, top) {
    container.classList.add('is-floating');
    container.style.left = `${Math.max(10, left)}px`;
    container.style.top = `${Math.max(10, top)}px`;
  }

  function resetPosition() {
    container.classList.remove('is-floating');
    container.style.left = '';
    container.style.top = '';
    localStorage.removeItem('playrig_splits_pos');
    playTone(330, 'sine', 0.08, 0.2);
  }

  // --- Layout Manager ---
  function setLayout(layoutName) {
    currentLayout = layoutName;
    container.classList.remove('layout-vertical', 'layout-horizontal', 'layout-compact');
    container.classList.add(`layout-${layoutName}`);

    btnVert.classList.toggle('active', layoutName === 'vertical');
    btnHoriz.classList.toggle('active', layoutName === 'horizontal');
    btnCompact.classList.toggle('active', layoutName === 'compact');

    localStorage.setItem('playrig_splits_layout', layoutName);
    renderSplits();
  }

  btnVert.addEventListener('click', () => setLayout('vertical'));
  btnHoriz.addEventListener('click', () => setLayout('horizontal'));
  btnCompact.addEventListener('click', () => setLayout('compact'));

  // --- OBS Mode & Chroma Backgrounds ---
  function toggleObsMode() {
    isObsMode = !isObsMode;
    document.body.classList.toggle('obs-mode', isObsMode);
    obsFloatingBar.style.display = isObsMode ? 'flex' : 'none';

    if (isObsMode) {
      applyObsBackground(obsBgSelect.value);
    } else {
      document.body.classList.remove('chroma-green', 'chroma-magenta', 'chroma-transparent', 'chroma-glass');
    }
  }

  function applyObsBackground(type) {
    document.body.classList.remove('chroma-green', 'chroma-magenta', 'chroma-transparent', 'chroma-glass');
    document.body.classList.add(`chroma-${type}`);
  }

  btnObsToggle.addEventListener('click', toggleObsMode);
  btnObsExit.addEventListener('click', toggleObsMode);
  obsBgSelect.addEventListener('change', (e) => applyObsBackground(e.target.value));

  // --- Attempts Stepper ---
  btnAttInc.addEventListener('click', () => {
    attempts++;
    attemptsEl.textContent = attempts;
    saveToStorage();
  });

  btnAttDec.addEventListener('click', () => {
    attempts = Math.max(1, attempts - 1);
    attemptsEl.textContent = attempts;
    saveToStorage();
  });

  // --- Presets & LocalStorage ---
  function loadPreset(key) {
    if (PRESETS[key]) {
      const p = PRESETS[key];
      gameTitleInput.value = p.game;
      gameCatInput.value = p.category;
      currentSplits = JSON.parse(JSON.stringify(p.splits));
      resetTimer(true);
      saveToStorage();
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
          gameCatInput.value = d.category || 'Flame Altar Any%';
          attempts = d.attempts || 1;
          attemptsEl.textContent = attempts;
          currentSplits = d.splits;
        }
      } catch (e) {}
    }

    const savedLayout = localStorage.getItem('playrig_splits_layout');
    if (savedLayout && ['vertical', 'horizontal', 'compact'].includes(savedLayout)) {
      setLayout(savedLayout);
    }
  }

  // --- Info Modal Handlers ---
  function openInfoModal() { infoModal.style.display = 'flex'; }
  function closeInfoModal() { infoModal.style.display = 'none'; }

  btnOpenInfo.addEventListener('click', openInfoModal);
  btnCloseInfo.addEventListener('click', closeInfoModal);
  btnCloseInfoFooter.addEventListener('click', closeInfoModal);

  // --- Global Event Listeners ---
  splitBtn.addEventListener('click', split);
  pauseBtn.addEventListener('click', togglePause);
  resetBtn.addEventListener('click', () => resetTimer(false));
  undoBtn.addEventListener('click', undoSplit);
  skipBtn.addEventListener('click', skipSplit);
  btnExitPractice.addEventListener('click', exitPracticeMode);

  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊 Sound' : '🔇 Mute';
  });

  selectComp.addEventListener('change', (e) => {
    comparisonMode = e.target.value;
    renderSplits();
  });

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
        if (d.splits && Array.isArray(d.splits)) {
          gameTitleInput.value = d.game || 'Game';
          gameCatInput.value = d.category || 'Any%';
          currentSplits = d.splits;
          resetTimer(true);
          saveToStorage();
        }
      } catch (err) {
        alert('Fehler beim Importieren: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Hotkeys
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space' || e.code === 'Numpad1') {
      e.preventDefault();
      split();
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      resetTimer(false);
    } else if (e.code === 'KeyP') {
      e.preventDefault();
      togglePause();
    } else if (e.code === 'KeyU') {
      e.preventDefault();
      undoSplit();
    } else if (e.code === 'KeyS') {
      e.preventDefault();
      skipSplit();
    } else if (e.code === 'Escape') {
      closeInfoModal();
      if (isPracticeMode) exitPracticeMode();
    }
  });

  // Global Click Blur (prevent Space/Enter from activating last-clicked buttons)
  document.addEventListener('click', (e) => {
    if (e.target.closest('button')) {
      e.target.closest('button').blur();
    }
  });

  // --- Initial Setup ---
  loadFromStorage();
  initDraggable();
  renderSplits();
})();
