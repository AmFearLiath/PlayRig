/**
 * CROSSHAIR & SCOPE LAB - ENGINE
 */

(function () {
  'use strict';

  const anchor = document.getElementById('crosshair-render');
  const viewport = document.getElementById('viewport-box');

  let state = {
    length: 6,
    thickness: 2,
    gap: 3,
    outline: 1,
    hasDot: false,
    dotSize: 2,
    tStyle: false,
    color: '#00ff66',
    recoilSpread: 0
  };

  let isSpraying = false;
  let sprayTimer = null;

  function renderCrosshair() {
    anchor.innerHTML = '';

    const currentGap = state.gap + state.recoilSpread;
    const l = state.length;
    const t = state.thickness;
    const outline = state.outline;
    const c = state.color;

    const outlineStyle = outline > 0 ? `box-shadow: 0 0 0 ${outline}px #000000;` : '';

    // Center Dot
    if (state.hasDot) {
      const dot = document.createElement('div');
      dot.style.position = 'absolute';
      dot.style.width = `${state.dotSize}px`;
      dot.style.height = `${state.dotSize}px`;
      dot.style.left = `-${state.dotSize / 2}px`;
      dot.style.top = `-${state.dotSize / 2}px`;
      dot.style.backgroundColor = c;
      if (outline > 0) dot.style.boxShadow = `0 0 0 ${outline}px #000000`;
      anchor.appendChild(dot);
    }

    // Top Line (skip if tStyle)
    if (!state.tStyle) {
      const top = document.createElement('div');
      top.style.position = 'absolute';
      top.style.width = `${t}px`;
      top.style.height = `${l}px`;
      top.style.left = `-${t / 2}px`;
      top.style.bottom = `${currentGap}px`;
      top.style.backgroundColor = c;
      if (outlineStyle) top.style.cssText += outlineStyle;
      anchor.appendChild(top);
    }

    // Bottom Line
    const bottom = document.createElement('div');
    bottom.style.position = 'absolute';
    bottom.style.width = `${t}px`;
    bottom.style.height = `${l}px`;
    bottom.style.left = `-${t / 2}px`;
    bottom.style.top = `${currentGap}px`;
    bottom.style.backgroundColor = c;
    if (outlineStyle) bottom.style.cssText += outlineStyle;
    anchor.appendChild(bottom);

    // Left Line
    const left = document.createElement('div');
    left.style.position = 'absolute';
    left.style.width = `${l}px`;
    left.style.height = `${t}px`;
    left.style.right = `${currentGap}px`;
    left.style.top = `-${t / 2}px`;
    left.style.backgroundColor = c;
    if (outlineStyle) left.style.cssText += outlineStyle;
    anchor.appendChild(left);

    // Right Line
    const right = document.createElement('div');
    right.style.position = 'absolute';
    right.style.width = `${l}px`;
    right.style.height = `${t}px`;
    right.style.left = `${currentGap}px`;
    right.style.top = `-${t / 2}px`;
    right.style.backgroundColor = c;
    if (outlineStyle) right.style.cssText += outlineStyle;
    anchor.appendChild(right);

    updateExportCodes();
  }

  function updateExportCodes() {
    // CS2 Code
    const cs2 = `cl_crosshairsize ${state.length};
cl_crosshairthickness ${state.thickness / 2};
cl_crosshairgap ${state.gap};
cl_crosshair_drawoutline ${state.outline > 0 ? 1 : 0};
cl_crosshair_outlinethickness ${state.outline};
cl_crosshairdot ${state.hasDot ? 1 : 0};
cl_crosshair_t ${state.tStyle ? 1 : 0};
cl_crosshaircolor 5;`;
    document.getElementById('cs2-code-box').value = cs2;

    // Valorant Code representation
    const val = `0;P;c;1;o;${state.outline > 0 ? 1 : 0};d;${state.hasDot ? 1 : 0};z;${state.dotSize};0t;${state.thickness};0l;${state.length};0o;${state.gap};0a;1.0;0f;0;1b;0`;
    document.getElementById('val-code-box').value = val;
  }

  // --- RECOIL SPRAY SIMULATION ---
  viewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isSpraying = true;
    sprayTimer = setInterval(() => {
      if (state.recoilSpread < 22) {
        state.recoilSpread += 1.5;
        renderCrosshair();
      }
    }, 40);
  });

  window.addEventListener('mouseup', () => {
    isSpraying = false;
    clearInterval(sprayTimer);
    const recover = setInterval(() => {
      if (state.recoilSpread > 0) {
        state.recoilSpread = Math.max(0, state.recoilSpread - 2);
        renderCrosshair();
      } else {
        clearInterval(recover);
      }
    }, 30);
  });

  // --- CONTROLS ---
  document.getElementById('slider-length').addEventListener('input', (e) => {
    state.length = parseInt(e.target.value);
    document.getElementById('val-length').textContent = `${state.length}px`;
    renderCrosshair();
  });

  document.getElementById('slider-thickness').addEventListener('input', (e) => {
    state.thickness = parseInt(e.target.value);
    document.getElementById('val-thickness').textContent = `${state.thickness}px`;
    renderCrosshair();
  });

  document.getElementById('slider-gap').addEventListener('input', (e) => {
    state.gap = parseInt(e.target.value);
    document.getElementById('val-gap').textContent = `${state.gap}px`;
    renderCrosshair();
  });

  document.getElementById('slider-outline').addEventListener('input', (e) => {
    state.outline = parseInt(e.target.value);
    document.getElementById('val-outline').textContent = `${state.outline}px`;
    renderCrosshair();
  });

  document.getElementById('check-dot').addEventListener('change', (e) => {
    state.hasDot = e.target.checked;
    renderCrosshair();
  });

  document.getElementById('slider-dot-size').addEventListener('input', (e) => {
    state.dotSize = parseInt(e.target.value);
    document.getElementById('val-dot-size').textContent = `${state.dotSize}px`;
    renderCrosshair();
  });

  document.getElementById('check-t-style').addEventListener('change', (e) => {
    state.tStyle = e.target.checked;
    renderCrosshair();
  });

  document.querySelectorAll('.swatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.swatch-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.color = btn.dataset.c;
      renderCrosshair();
    });
  });

  document.getElementById('input-custom-color').addEventListener('input', (e) => {
    state.color = e.target.value;
    renderCrosshair();
  });

  document.querySelectorAll('.scene-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.scene-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      viewport.className = `crosshair-viewport scene-${btn.dataset.scene}`;
    });
  });

  // Presets
  const PRESETS = {
    dot: { length: 0, thickness: 0, gap: 0, outline: 1, hasDot: true, dotSize: 3, tStyle: false, color: '#00ff66' },
    classic: { length: 7, thickness: 2, gap: 4, outline: 1, hasDot: false, dotSize: 2, tStyle: false, color: '#00ff66' },
    pro: { length: 4, thickness: 2, gap: 2, outline: 1, hasDot: false, dotSize: 2, tStyle: false, color: '#00d2ff' },
    circle: { length: 3, thickness: 3, gap: 5, outline: 1, hasDot: true, dotSize: 2, tStyle: false, color: '#ff0055' }
  };

  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const p = PRESETS[chip.dataset.preset];
      if (p) {
        state = { ...state, ...p };
        document.getElementById('slider-length').value = state.length;
        document.getElementById('val-length').textContent = `${state.length}px`;
        document.getElementById('slider-thickness').value = state.thickness;
        document.getElementById('val-thickness').textContent = `${state.thickness}px`;
        document.getElementById('slider-gap').value = state.gap;
        document.getElementById('val-gap').textContent = `${state.gap}px`;
        document.getElementById('slider-outline').value = state.outline;
        document.getElementById('val-outline').textContent = `${state.outline}px`;
        document.getElementById('check-dot').checked = state.hasDot;
        document.getElementById('check-t-style').checked = state.tStyle;
        renderCrosshair();
      }
    });
  });

  // Copy Buttons
  document.getElementById('btn-copy-cs2').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('cs2-code-box').value);
    window.showToast('CS2 Befehle kopiert!', 'success');
  });

  document.getElementById('btn-copy-val').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('val-code-box').value);
    window.showToast('Valorant Code kopiert!', 'success');
  });

  document.getElementById('btn-copy-svg').addEventListener('click', () => {
    const svgCode = `<svg width="64" height="64" viewBox="-32 -32 64 64" xmlns="http://www.w3.org/2000/svg">
  ${state.hasDot ? `<rect x="${-state.dotSize / 2}" y="${-state.dotSize / 2}" width="${state.dotSize}" height="${state.dotSize}" fill="${state.color}" />` : ''}
  ${!state.tStyle ? `<rect x="${-state.thickness / 2}" y="${-state.gap - state.length}" width="${state.thickness}" height="${state.length}" fill="${state.color}" />` : ''}
  <rect x="${-state.thickness / 2}" y="${state.gap}" width="${state.thickness}" height="${state.length}" fill="${state.color}" />
  <rect x="${-state.gap - state.length}" y="${-state.thickness / 2}" width="${state.length}" height="${state.thickness}" fill="${state.color}" />
  <rect x="${state.gap}" y="${-state.thickness / 2}" width="${state.length}" height="${state.thickness}" fill="${state.color}" />
</svg>`;
    navigator.clipboard.writeText(svgCode);
    window.showToast('SVG Code kopiert!', 'success');
  });

  // Export PNG (Transparent 128x128)
  document.getElementById('btn-export-png').addEventListener('click', () => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    const cx = 64, cy = 64;

    const drawLine = (x, y, w, h) => {
      if (state.outline > 0) {
        g.fillStyle = '#000000';
        g.fillRect(x - state.outline, y - state.outline, w + state.outline * 2, h + state.outline * 2);
      }
      g.fillStyle = state.color;
      g.fillRect(x, y, w, h);
    };

    if (state.hasDot) {
      drawLine(cx - state.dotSize / 2, cy - state.dotSize / 2, state.dotSize, state.dotSize);
    }
    if (!state.tStyle) {
      drawLine(cx - state.thickness / 2, cy - state.gap - state.length, state.thickness, state.length);
    }
    drawLine(cx - state.thickness / 2, cy + state.gap, state.thickness, state.length);
    drawLine(cx - state.gap - state.length, cy - state.thickness / 2, state.length, state.thickness);
    drawLine(cx + state.gap, cy - state.thickness / 2, state.length, state.thickness);

    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'crosshair.png';
    a.click();
    window.showToast('Transparentes PNG heruntergeladen!', 'success');
  });

  renderCrosshair();
})();

