/**
 * PLAYRIG - GLASSMORPHISM & BORDER-BEAM STUDIO CONTROLLER
 * High-End Perimeter Border-Beam Engine, Presets Catalog & Multi-Framework Export
 *
 * Author: Liath • Copyright: © GameChiller • Version: v0.0.2
 */

(function () {
  'use strict';

  // DOM Elements
  const card = document.getElementById('preview-card');
  const cardWrap = document.getElementById('card-wrap');
  const stage = document.getElementById('stage-area');
  const codeBox = document.getElementById('code-output');

  // Overlays
  const beamConic = document.getElementById('beam-conic');
  const beamSvg = document.getElementById('beam-svg');
  const svgRect = document.getElementById('svg-tracer-rect');
  const svgStop1 = document.querySelector('#svg-beam-grad stop:nth-child(2)');
  const svgStop2 = document.querySelector('#svg-beam-grad stop:nth-child(3)');
  const cyberBrackets = document.getElementById('cyber-brackets');
  const liquidSheen = document.getElementById('liquid-sheen');
  const noiseGrain = document.getElementById('noise-grain');
  const hexGrid = document.getElementById('hex-grid');

  // Card Content elements
  const cardBadge1 = document.getElementById('card-badge-1');
  const cardBadge2 = document.getElementById('card-badge-2');
  const cardTitle = document.getElementById('card-title');
  const cardDesc = document.getElementById('card-desc');
  const cardTag = document.getElementById('card-tag');
  const btnCardDemo = document.getElementById('btn-card-demo');

  // Control inputs
  const presetSelector = document.getElementById('preset-selector');
  const selectBeamMode = document.getElementById('select-beam-mode');
  const selectSurfaceFx = document.getElementById('select-surface-fx');
  const sliderSpeed = document.getElementById('slider-beam-speed');
  const valSpeed = document.getElementById('val-beam-speed');
  const sliderWidth = document.getElementById('slider-beam-width');
  const valWidth = document.getElementById('val-beam-width');
  const sliderBlur = document.getElementById('slider-blur');
  const valBlur = document.getElementById('val-blur');
  const sliderOpacity = document.getElementById('slider-opacity');
  const valOpacity = document.getElementById('val-opacity');
  const sliderRadius = document.getElementById('slider-radius');
  const valRadius = document.getElementById('val-radius');
  const sliderBorder = document.getElementById('slider-border');
  const valBorder = document.getElementById('val-border');

  const btnRandomize = document.getElementById('btn-randomize');
  const btnReset = document.getElementById('btn-reset-default');
  const btnCopyCode = document.getElementById('btn-copy-code');

  // --- Presets Catalog ---
  const PRESETS = {
    obsidian: {
      name: 'Executive Obsidian',
      beamMode: 'conic-perimeter',
      surfaceFx: 'clean',
      beamSpeed: 4.0,
      beamWidth: 2,
      beamC1: '#00f0ff',
      beamC2: '#6366f1',
      blur: 18,
      opacity: 0.65,
      radius: 24,
      borderAlpha: 0.18,
      bg: 'mesh',
      badge1: 'Obsidian',
      badge2: 'Conic Perimeter',
      title: 'Glassmorphism UI',
      desc: 'Die Animation läuft nun exakt am Außenrahmen der Karte entlang – ohne im Innenraum zu rotieren. Bewege die Maus für plastischen 3D-Lichteinfall.'
    },
    nebula: {
      name: 'Cosmic Nebula',
      beamMode: 'dual-orbit',
      surfaceFx: 'sheen',
      beamSpeed: 3.5,
      beamWidth: 2,
      beamC1: '#d946ef',
      beamC2: '#8b5cf6',
      blur: 24,
      opacity: 0.55,
      radius: 28,
      borderAlpha: 0.22,
      bg: 'sunset',
      badge1: 'Cosmic Nebula',
      badge2: 'Dual Orbit Lasers',
      title: 'Galactic Horizon',
      desc: 'Zwei gegenläufige oder jagende Laser-Kometen umkreisen den Außenrand. Ein dezenter Lichtkanten-Gleiteffekt verleiht der Glasoberfläche Tiefe.'
    },
    cyberpunk: {
      name: 'Cyberpunk 2077',
      beamMode: 'corner-brackets',
      surfaceFx: 'honeycomb',
      beamSpeed: 2.5,
      beamWidth: 3,
      beamC1: '#f59e0b',
      beamC2: '#00f0ff',
      blur: 12,
      opacity: 0.8,
      radius: 8,
      borderAlpha: 0.35,
      bg: 'matrix',
      badge1: 'Night City',
      badge2: 'HUD Brackets',
      title: 'Cyber Deck Terminal',
      desc: 'Sci-Fi HUD-Eckklammern mit pulsierendem Kanten-Feld und hexagonalem Waben-Raster auf der Glasoberfläche.'
    },
    visionos: {
      name: 'VisionOS Frost',
      beamMode: 'svg-tracer',
      surfaceFx: 'sheen',
      beamSpeed: 5.0,
      beamWidth: 1,
      beamC1: '#ffffff',
      beamC2: '#94a3b8',
      blur: 32,
      opacity: 0.45,
      radius: 32,
      borderAlpha: 0.28,
      bg: 'grid',
      badge1: 'VisionOS',
      badge2: 'SVG Edge Tracer',
      title: 'Spatial Frosted Glass',
      desc: 'Kristallklares spaciges Milchglas mit hoher Streuung, hauchdünnem 1px Laser-Kometen und flüssiger Oberflächenspiegelung.'
    },
    royalgold: {
      name: 'Royal Gold',
      beamMode: 'conic-perimeter',
      surfaceFx: 'grain',
      beamSpeed: 4.5,
      beamWidth: 2,
      beamC1: '#fbbf24',
      beamC2: '#f59e0b',
      blur: 20,
      opacity: 0.7,
      radius: 20,
      borderAlpha: 0.25,
      bg: 'mesh',
      badge1: 'PlayRig Royal',
      badge2: 'Golden Perimeter',
      title: 'Vault of the Ancients',
      desc: 'Edles bernsteingoldenes Rahmenlicht mit analoger Filmkörnung auf tiefdunklem, rauchigem Panzerglas.'
    },
    emerald: {
      name: 'Bio-Matrix Green',
      beamMode: 'neon-pulse',
      surfaceFx: 'honeycomb',
      beamSpeed: 2.8,
      beamWidth: 2,
      beamC1: '#10b981',
      beamC2: '#06b6d4',
      blur: 16,
      opacity: 0.75,
      radius: 16,
      borderAlpha: 0.3,
      bg: 'matrix',
      badge1: 'Bio-Hacker',
      badge2: 'Neon Pulse Glow',
      title: 'Neural Node v2',
      desc: 'Pulsierender smaragdgrüner Kanten-Glow mit mikrofeiner Nanostruktur für Cyber-Dashboards und Statusmonitore.'
    }
  };

  // State
  let state = {
    ...PRESETS.obsidian,
    format: 'css'
  };

  // --- Update Styles & Overlays ---
  function updateStyles() {
    // Glass Surface properties
    card.style.backdropFilter = `blur(${state.blur}px)`;
    card.style.webkitBackdropFilter = `blur(${state.blur}px)`;
    card.style.background = `rgba(15, 23, 42, ${state.opacity})`;
    card.style.borderRadius = `${state.radius}px`;
    card.style.borderColor = `rgba(255, 255, 255, ${state.borderAlpha})`;

    // CSS Custom Properties on card
    card.style.setProperty('--beam-c1', state.beamC1);
    card.style.setProperty('--beam-c2', state.beamC2);
    card.style.setProperty('--beam-speed', `${state.beamSpeed}s`);
    card.style.setProperty('--beam-width', `${state.beamWidth}px`);

    // Reset overlay visibility
    beamConic.style.display = 'none';
    beamSvg.style.display = 'none';
    cyberBrackets.style.display = 'none';
    beamConic.className = 'custom-beam-border';

    // Apply Border-Beam Mode
    if (state.beamMode === 'conic-perimeter') {
      beamConic.style.display = 'block';
      beamConic.classList.add('mode-conic');
    } else if (state.beamMode === 'dual-orbit') {
      beamConic.style.display = 'block';
      beamConic.classList.add('mode-dual');
    } else if (state.beamMode === 'rainbow-prism') {
      beamConic.style.display = 'block';
      beamConic.classList.add('mode-rainbow');
    } else if (state.beamMode === 'neon-pulse') {
      beamConic.style.display = 'block';
      beamConic.classList.add('mode-pulse');
    } else if (state.beamMode === 'corner-brackets') {
      cyberBrackets.style.display = 'block';
      cyberBrackets.querySelectorAll('.corner').forEach(c => {
        c.style.borderColor = state.beamC1;
        c.style.borderWidth = `${state.beamWidth + 1}px`;
      });
    } else if (state.beamMode === 'svg-tracer') {
      beamSvg.style.display = 'block';
      if (svgStop1) svgStop1.setAttribute('stop-color', state.beamC1);
      if (svgStop2) svgStop2.setAttribute('stop-color', state.beamC2);

      // Adjust SVG path geometry to match card dimensions
      const cardRect = card.getBoundingClientRect();
      const w = Math.round(cardRect.width || 440);
      const h = Math.round(cardRect.height || 280);
      const inset = Math.floor(state.beamWidth / 2) || 1;

      svgRect.setAttribute('x', inset);
      svgRect.setAttribute('y', inset);
      svgRect.setAttribute('width', Math.max(10, w - inset * 2));
      svgRect.setAttribute('height', Math.max(10, h - inset * 2));
      svgRect.setAttribute('rx', state.radius);
      svgRect.style.strokeWidth = `${state.beamWidth}px`;
      svgRect.style.animationDuration = `${state.beamSpeed}s`;
    }

    // Surface FX
    liquidSheen.style.display = state.surfaceFx === 'sheen' ? 'block' : 'none';
    noiseGrain.style.display = state.surfaceFx === 'grain' ? 'block' : 'none';
    hexGrid.style.display = state.surfaceFx === 'honeycomb' ? 'block' : 'none';

    // Content Text & Tags
    if (cardBadge1) cardBadge1.textContent = state.badge1 || 'PlayRig Glass';
    if (cardBadge2) cardBadge2.textContent = state.badge2 || 'Perimeter Beam';
    if (cardTitle) cardTitle.textContent = state.title || 'Glassmorphism UI';
    if (cardDesc) cardDesc.textContent = state.desc || '';
    if (cardTag) cardTag.textContent = `${state.beamMode} • ${state.beamSpeed}s`;

    generateCode();
  }

  // --- Code Export Generator ---
  function generateCode() {
    if (state.format === 'css') {
      codeBox.value = `/* ==============================================================
   PLAYRIG - PRODUCTION GLASSMORPHISM & PERIMETER BORDER-BEAM
   ============================================================== */

@property --beam-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@keyframes beam-travel {
  from { --beam-angle: 0deg; }
  to { --beam-angle: 360deg; }
}

.glass-card {
  position: relative;
  width: 440px;
  padding: 34px;
  background: rgba(15, 23, 42, ${state.opacity});
  backdrop-filter: blur(${state.blur}px);
  -webkit-backdrop-filter: blur(${state.blur}px);
  border-radius: ${state.radius}px;
  border: 1px solid rgba(255, 255, 255, ${state.borderAlpha});
  box-shadow: 0 24px 50px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}

${state.beamMode !== 'none' ? `/* True Perimeter Border-Beam (Travels along frame perimeter) */
.glass-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: ${state.beamWidth}px;
  background: conic-gradient(
    from var(--beam-angle),
    transparent 0deg,
    transparent 72%,
    ${state.beamC1} 88%,
    ${state.beamC2} 98%,
    transparent 100%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  animation: beam-travel ${state.beamSpeed}s linear infinite;
  z-index: 1;
}` : ''}

.glass-card > * {
  position: relative;
  z-index: 2;
}`;
    } else if (state.format === 'tailwind') {
      codeBox.value = `<!-- Tailwind CSS Container (v3 / v4) -->
<div class="relative overflow-hidden rounded-[${state.radius}px] border border-white/[${state.borderAlpha}] bg-slate-900/[${state.opacity}] p-8 shadow-2xl backdrop-blur-[${state.blur}px]">
  <!-- Border Beam Pseudo-element (Requires custom animation in tailwind.config) -->
  <div class="pointer-events-none absolute inset-0 z-[1] rounded-[inherit] p-[${state.beamWidth}px] [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] [mask-composite:exclude] [animation:beam-spin_${state.beamSpeed}s_linear_infinite] [background:conic-gradient(from_var(--beam-angle,0deg),transparent_70%,${state.beamC1}_88%,${state.beamC2}_98%,transparent_100%)]"></div>

  <div class="relative z-[2] flex flex-col gap-3">
    <div class="flex gap-2">
      <span class="rounded bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-300">${state.badge1}</span>
    </div>
    <h3 class="text-2xl font-bold text-white">${state.title}</h3>
    <p class="text-sm leading-relaxed text-slate-300">${state.desc}</p>
  </div>
</div>`;
    } else if (state.format === 'react') {
      codeBox.value = `import React from 'react';

export function GlassBorderCard() {
  return (
    <div
      style={{
        position: 'relative',
        width: 440,
        padding: '34px',
        background: 'rgba(15, 23, 42, ${state.opacity})',
        backdropFilter: 'blur(${state.blur}px)',
        WebkitBackdropFilter: 'blur(${state.blur}px)',
        borderRadius: '${state.radius}px',
        border: '1px solid rgba(255, 255, 255, ${state.borderAlpha})',
        boxShadow: '0 24px 50px rgba(0, 0, 0, 0.55)',
        overflow: 'hidden'
      }}
    >
      <div className="custom-beam-border" />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>
          ${state.title}
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.55 }}>
          ${state.desc}
        </p>
      </div>
    </div>
  );
}`;
    }
  }

  // --- 3D Tilt Parallax with Smooth Easing ---
  stage.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);

    const rotX = -dy * 11;
    const rotY = dx * 11;

    cardWrap.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  });

  stage.addEventListener('mouseleave', () => {
    cardWrap.style.transform = 'rotateX(0deg) rotateY(0deg)';
  });

  // --- Apply Preset ---
  function applyPreset(key) {
    if (PRESETS[key]) {
      const p = PRESETS[key];
      state = { ...state, ...p };

      // Update control inputs
      presetSelector.value = key;
      selectBeamMode.value = p.beamMode;
      selectSurfaceFx.value = p.surfaceFx;
      sliderSpeed.value = p.beamSpeed;
      valSpeed.textContent = `${p.beamSpeed.toFixed(1)}s`;
      sliderWidth.value = p.beamWidth;
      valWidth.textContent = `${p.beamWidth}px`;
      sliderBlur.value = p.blur;
      valBlur.textContent = `${p.blur}px`;
      sliderOpacity.value = p.opacity;
      valOpacity.textContent = p.opacity.toFixed(2);
      sliderRadius.value = p.radius;
      valRadius.textContent = `${p.radius}px`;
      sliderBorder.value = p.borderAlpha;
      valBorder.textContent = p.borderAlpha.toFixed(2);

      // Active color button
      document.querySelectorAll('.beam-color-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.c1 === p.beamC1 && btn.dataset.c2 === p.beamC2);
      });

      // Active background
      applyBackground(p.bg);

      updateStyles();
    }
  }

  // --- Background Switcher ---
  function applyBackground(bgName) {
    stage.className = 'stage-section';
    if (bgName === 'sunset') stage.classList.add('bg-sunset');
    else if (bgName === 'matrix') stage.classList.add('bg-matrix');
    else if (bgName === 'grid') stage.classList.add('bg-grid');

    document.querySelectorAll('.bg-thumb-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.bg === bgName);
    });
  }

  // --- Randomize Style Engine ---
  function randomizeStyle() {
    const keys = Object.keys(PRESETS);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    applyPreset(randomKey);

    // Add playful tweaks
    state.beamSpeed = Math.round((Math.random() * 4 + 2) * 10) / 10;
    sliderSpeed.value = state.beamSpeed;
    valSpeed.textContent = `${state.beamSpeed.toFixed(1)}s`;

    updateStyles();

    if (window.showToast) {
      window.showToast(`Zufälliger Stil "${state.name}" geladen!`, 'info');
    }
  }

  // --- Event Listeners ---
  presetSelector.addEventListener('change', (e) => applyPreset(e.target.value));

  selectBeamMode.addEventListener('change', (e) => {
    state.beamMode = e.target.value;
    updateStyles();
  });

  selectSurfaceFx.addEventListener('change', (e) => {
    state.surfaceFx = e.target.value;
    updateStyles();
  });

  sliderSpeed.addEventListener('input', (e) => {
    state.beamSpeed = parseFloat(e.target.value);
    valSpeed.textContent = `${state.beamSpeed.toFixed(1)}s`;
    updateStyles();
  });

  sliderWidth.addEventListener('input', (e) => {
    state.beamWidth = parseInt(e.target.value, 10);
    valWidth.textContent = `${state.beamWidth}px`;
    updateStyles();
  });

  sliderBlur.addEventListener('input', (e) => {
    state.blur = parseInt(e.target.value, 10);
    valBlur.textContent = `${state.blur}px`;
    updateStyles();
  });

  sliderOpacity.addEventListener('input', (e) => {
    state.opacity = parseFloat(e.target.value);
    valOpacity.textContent = state.opacity.toFixed(2);
    updateStyles();
  });

  sliderRadius.addEventListener('input', (e) => {
    state.radius = parseInt(e.target.value, 10);
    valRadius.textContent = `${state.radius}px`;
    updateStyles();
  });

  sliderBorder.addEventListener('input', (e) => {
    state.borderAlpha = parseFloat(e.target.value);
    valBorder.textContent = state.borderAlpha.toFixed(2);
    updateStyles();
  });

  document.querySelectorAll('.beam-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.beam-color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.beamC1 = btn.dataset.c1;
      state.beamC2 = btn.dataset.c2;
      updateStyles();
    });
  });

  document.querySelectorAll('.bg-thumb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.bg = btn.dataset.bg;
      applyBackground(state.bg);
    });
  });

  document.querySelectorAll('.code-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.format = tab.dataset.fmt;
      generateCode();
    });
  });

  btnCopyCode.addEventListener('click', () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(codeBox.value).then(() => {
        if (window.showToast) {
          window.showToast('Code erfolgreich in die Zwischenablage kopiert!', 'success');
        } else {
          alert('✅ Code kopiert!');
        }
      });
    } else {
      codeBox.select();
      document.execCommand('copy');
      if (window.showToast) {
        window.showToast('Code kopiert!', 'success');
      }
    }
  });

  btnRandomize.addEventListener('click', randomizeStyle);
  btnReset.addEventListener('click', () => applyPreset('obsidian'));

  btnCardDemo.addEventListener('click', () => {
    if (window.showToast) {
      window.showToast('Interaktiver Button geklickt! Alle Effekte sind responsive.', 'info');
    }
  });

  // Window Resize pass for SVG geometry
  window.addEventListener('resize', () => {
    if (state.beamMode === 'svg-tracer') updateStyles();
  });

  // Initial load
  applyPreset('obsidian');
})();
