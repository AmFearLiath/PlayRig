/**
 * NEXUS DESIGN SYSTEM - FX & INTERACTIVE ANIMATION ENGINE
 * High-End Micro-Interactions, Mouse Spotlights, 3D Tilt, Border Beams & Web Audio Haptics.
 */

(function () {
  'use strict';

  // State & Settings
  const FX = {
    theme: localStorage.getItem('nexus_fx_theme') || 'cyber-cyan',
    animSpeed: localStorage.getItem('nexus_fx_anim_speed') || '1', // 0, 0.5, 1, 1.5
    borderBeams: localStorage.getItem('nexus_fx_border_beams') !== 'false',
    spotlights: localStorage.getItem('nexus_fx_spotlights') !== 'false',
    tilt: localStorage.getItem('nexus_fx_tilt') !== 'false',
    sound: localStorage.getItem('nexus_fx_sound') === 'true' && false, // Default: completely muted
    hideBtn: localStorage.getItem('nexus_fx_hide_btn') === 'true',
    audioCtx: null
  };

  // Audio Synthesizer (Native Web Audio API, Zero Bloat)
  function playHapticSound(type = 'click') {
    if (!FX.sound) return; // Completely silent by default
    try {
      if (!FX.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) FX.audioCtx = new AudioContextClass();
      }
      if (!FX.audioCtx || FX.audioCtx.state === 'suspended') {
        FX.audioCtx?.resume();
      }
      const ctx = FX.audioCtx;
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'click') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(360, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.02);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
        osc.start(now);
        osc.stop(now + 0.02);
      }
    } catch (e) {
      // Audio not permitted or supported
    }
  }

  // --- Theme Controller ---
  function applyTheme(themeId) {
    FX.theme = themeId;
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('nexus_fx_theme', themeId);
  }

  // --- Animation Settings ---
  function applyAnimSpeed(speed) {
    FX.animSpeed = speed;
    localStorage.setItem('nexus_fx_anim_speed', speed);
    document.documentElement.style.setProperty('--fx-speed', speed);

    if (speed === '0') {
      document.body.setAttribute('data-fx-anim', 'off');
    } else {
      document.body.removeAttribute('data-fx-anim');
    }
  }

  // --- Running Laser Beam Injection ---
  function updateBorderBeams() {
    const headers = document.querySelectorAll('.app-header, .hub-header, .admin-header');
    headers.forEach(h => {
      let beam = h.querySelector('.header-laser-beam');
      if (FX.borderBeams) {
        if (!beam) {
          beam = document.createElement('div');
          beam.className = 'header-laser-beam';
          h.appendChild(beam);
        }
      } else if (beam) {
        beam.remove();
      }
    });

    // Featured cards border beam
    const cards = document.querySelectorAll('.tool-card, .stat-metric-card');
    cards.forEach(c => {
      if (FX.borderBeams) {
        c.classList.add('has-border-beam');
      } else {
        c.classList.remove('has-border-beam');
      }
    });
  }

  // --- Mouse Spotlight & 3D Tilt Engine ---
  function bindInteractiveTracking() {
    document.addEventListener('mousemove', (e) => {
      if (!FX.spotlights && !FX.tilt) return;

      const interactiveElements = document.querySelectorAll('.glass-panel, .tool-card, .stat-metric-card, .admin-metric-card');
      interactiveElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        // Check if mouse is near or inside element
        const isNear = e.clientX >= rect.left - 50 &&
                       e.clientX <= rect.right + 50 &&
                       e.clientY >= rect.top - 50 &&
                       e.clientY <= rect.bottom + 50;

        if (isNear) {
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          if (FX.spotlights) {
            el.classList.add('fx-spotlight');
            el.style.setProperty('--mouse-x', `${x}px`);
            el.style.setProperty('--mouse-y', `${y}px`);
          }

          if (FX.tilt && el.classList.contains('tool-card')) {
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const deltaX = (x - centerX) / centerX;
            const deltaY = (y - centerY) / centerY;
            const rotateX = (-deltaY * 5).toFixed(2);
            const rotateY = (deltaX * 5).toFixed(2);
            el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
          }
        } else {
          if (FX.tilt && el.classList.contains('tool-card')) {
            el.style.transform = '';
          }
        }
      });
    });

    document.addEventListener('mouseleave', () => {
      document.querySelectorAll('.tool-card').forEach(el => { el.style.transform = ''; });
    });
  }

  // --- Button Click Ripples & Audio Triggers ---
  function bindButtonInteractions() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn, .seg-btn, .shape-btn, .chip-btn');
      if (!btn) return;

      playHapticSound('click');

      // Create ripple
      const rect = btn.getBoundingClientRect();
      const circle = document.createElement('span');
      const diameter = Math.max(rect.width, rect.height);
      const radius = diameter / 2;

      circle.style.width = circle.style.height = `${diameter}px`;
      circle.style.left = `${e.clientX - rect.left - radius}px`;
      circle.style.top = `${e.clientY - rect.top - radius}px`;
      circle.classList.add('nexus-ripple');

      const existingRipple = btn.querySelector('.nexus-ripple');
      if (existingRipple) existingRipple.remove();

      btn.appendChild(circle);
      setTimeout(() => circle.remove(), 600);
    });
  }

  // --- Floating FX Lab Customizer UI ---
  function injectFXLabWidget() {
    // Only inject in top window (not inside nested iframes)
    if (window.self !== window.top) return;
    if (document.getElementById('nexus-fx-lab-toggle')) return;

    // Toggle Button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'nexus-fx-lab-toggle';
    toggleBtn.className = `fx-lab-toggle-btn ${FX.hideBtn ? 'is-hidden' : ''}`;
    toggleBtn.innerHTML = `
      <span style="font-size: 1rem;">🎨</span>
      <span>FX & Styles</span>
    `;

    // Panel Drawer
    const panel = document.createElement('div');
    panel.id = 'nexus-fx-lab-panel';
    panel.className = 'fx-lab-panel';
    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-default); padding-bottom: 10px;">
        <div style="font-weight: 800; font-size: 1.05rem; display:flex; align-items:center; gap:8px;">
          <span>🎨</span>
          <span class="gradient-text">FX & Style Lab</span>
        </div>
        <button id="fx-lab-close" class="btn btn-ghost btn-icon" style="width:28px; height:28px;">✕</button>
      </div>

      <!-- Color Palette Themes -->
      <div>
        <label class="form-label" style="font-size: 0.8rem; font-weight:700;">Design Farb-Theme</label>
        <div class="theme-swatch-row">
          <div class="theme-swatch ${FX.theme === 'cyber-cyan' ? 'active' : ''}" data-theme="cyber-cyan" style="background: linear-gradient(135deg, #06b6d4, #6366f1);" title="Cyber Cyan (Standard)"></div>
          <div class="theme-swatch ${FX.theme === 'emerald-matrix' ? 'active' : ''}" data-theme="emerald-matrix" style="background: linear-gradient(135deg, #10b981, #06b6d4);" title="Emerald Matrix"></div>
          <div class="theme-swatch ${FX.theme === 'synthwave-sunset' ? 'active' : ''}" data-theme="synthwave-sunset" style="background: linear-gradient(135deg, #f43f5e, #8b5cf6);" title="Synthwave Sunset"></div>
          <div class="theme-swatch ${FX.theme === 'royal-gold' ? 'active' : ''}" data-theme="royal-gold" style="background: linear-gradient(135deg, #fbbf24, #d97706);" title="Royal Obsidian Gold"></div>
          <div class="theme-swatch ${FX.theme === 'crimson-voltage' ? 'active' : ''}" data-theme="crimson-voltage" style="background: linear-gradient(135deg, #ff4d6d, #be123c);" title="Crimson Voltage"></div>
        </div>
      </div>

      <!-- Animation Speed Slider -->
      <div class="slider-group">
        <div class="slider-header">
          <span class="slider-label">Animations-Tempo</span>
          <span id="fx-label-speed" class="slider-val-pill">${FX.animSpeed === '0' ? 'Aus' : FX.animSpeed + 'x'}</span>
        </div>
        <input type="range" id="fx-slider-speed" class="nexus-slider" min="0" max="2" step="0.5" value="${FX.animSpeed}">
      </div>

      <!-- Visual Effect Toggles -->
      <div style="display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--border-subtle); padding-top: 10px;">
        <label class="nexus-checkbox-label" style="font-size: 0.82rem;">
          <input type="checkbox" id="fx-check-beams" class="nexus-checkbox" ${FX.borderBeams ? 'checked' : ''}>
          <span>Laufendes Laser-Licht (Header & Cards)</span>
        </label>

        <label class="nexus-checkbox-label" style="font-size: 0.82rem;">
          <input type="checkbox" id="fx-check-spotlight" class="nexus-checkbox" ${FX.spotlights ? 'checked' : ''}>
          <span>Mausgesteuertes Spotlight & 3D-Neigung</span>
        </label>

        <label class="nexus-checkbox-label" style="font-size: 0.82rem;">
          <input type="checkbox" id="fx-check-sound" class="nexus-checkbox" ${FX.sound ? 'checked' : ''}>
          <span>Web Audio Feedback (Klick-Sounds)</span>
        </label>

        <label class="nexus-checkbox-label" style="font-size: 0.82rem;">
          <input type="checkbox" id="fx-check-hide-btn" class="nexus-checkbox" ${!FX.hideBtn ? 'checked' : ''}>
          <span>Schwebenden FX-Button anzeigen</span>
        </label>
      </div>

      <div style="text-align: right; font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono);">
        Nexus FX Suite v1.0.0
      </div>
    `;

    document.body.appendChild(toggleBtn);
    document.body.appendChild(panel);

    // Toggle click
    toggleBtn.addEventListener('click', () => {
      panel.classList.toggle('active');
    });

    panel.querySelector('#fx-lab-close').addEventListener('click', () => {
      panel.classList.remove('active');
    });

    // Theme swatches
    panel.querySelectorAll('.theme-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        panel.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        applyTheme(swatch.dataset.theme);
        window.showToast(`Theme geändert: ${swatch.title}`, 'info');
      });
    });

    // Speed slider
    const speedSlider = panel.querySelector('#fx-slider-speed');
    const speedLabel = panel.querySelector('#fx-label-speed');
    speedSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      speedLabel.textContent = val === '0' ? 'Aus' : `${val}x`;
      applyAnimSpeed(val);
    });

    // Beams Checkbox
    panel.querySelector('#fx-check-beams').addEventListener('change', (e) => {
      FX.borderBeams = e.target.checked;
      localStorage.setItem('nexus_fx_border_beams', FX.borderBeams);
      updateBorderBeams();
    });

    // Spotlight Checkbox
    panel.querySelector('#fx-check-spotlight').addEventListener('change', (e) => {
      FX.spotlights = e.target.checked;
      FX.tilt = e.target.checked;
      localStorage.setItem('nexus_fx_spotlights', FX.spotlights);
      localStorage.setItem('nexus_fx_tilt', FX.tilt);
      if (!FX.spotlights) {
        document.querySelectorAll('.tool-card').forEach(c => c.style.transform = '');
      }
    });

    // Hide floating button checkbox
    panel.querySelector('#fx-check-hide-btn').addEventListener('change', (e) => {
      FX.hideBtn = !e.target.checked;
      localStorage.setItem('nexus_fx_hide_btn', FX.hideBtn);
      if (FX.hideBtn) {
        toggleBtn.classList.add('is-hidden');
      } else {
        toggleBtn.classList.remove('is-hidden');
      }
    });

    // Sound Checkbox
    panel.querySelector('#fx-check-sound').addEventListener('change', (e) => {
      FX.sound = e.target.checked;
      localStorage.setItem('nexus_fx_sound', FX.sound);
      if (FX.sound) playHapticSound('click');
    });
  }

  // --- Initialize ---
  function init() {
    applyTheme(FX.theme);
    applyAnimSpeed(FX.animSpeed);
    updateBorderBeams();
    bindInteractiveTracking();
    bindButtonInteractions();
    injectFXLabWidget();

    // Re-run border beams when tools grid is populated
    const observer = new MutationObserver(() => {
      updateBorderBeams();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.NexusFX = {
    setTheme: applyTheme,
    setSpeed: applyAnimSpeed,
    playSound: playHapticSound,
    toggleLab: () => {
      const panel = document.getElementById('nexus-fx-lab-panel');
      if (panel) panel.classList.toggle('active');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

