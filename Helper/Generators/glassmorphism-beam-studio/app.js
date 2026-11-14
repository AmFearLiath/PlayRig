/**
 * GLASSMORPHISM & BEAM STUDIO - CONTROLLER
 */

(function () {
  'use strict';

  const card = document.getElementById('preview-card');
  const cardWrap = document.getElementById('card-wrap');
  const stage = document.getElementById('stage-area');
  const beam = document.getElementById('beam-border');
  const codeBox = document.getElementById('code-output');

  let state = {
    blur: 16,
    opacity: 0.65,
    radius: 24,
    borderAlpha: 0.2,
    enableBeam: true,
    beamSpeed: 6,
    beamC1: '#00d2ff',
    beamC2: '#6366f1',
    format: 'css'
  };

  function updateStyles() {
    card.style.backdropFilter = `blur(${state.blur}px)`;
    card.style.webkitBackdropFilter = `blur(${state.blur}px)`;
    card.style.background = `rgba(15, 23, 42, ${state.opacity})`;
    card.style.borderRadius = `${state.radius}px`;
    card.style.borderColor = `rgba(255, 255, 255, ${state.borderAlpha})`;

    if (state.enableBeam) {
      beam.style.display = 'block';
      beam.style.animationDuration = `${state.beamSpeed}s`;
      beam.style.background = `conic-gradient(from 0deg, transparent 70%, ${state.beamC1}, ${state.beamC2})`;
    } else {
      beam.style.display = 'none';
    }

    generateCode();
  }

  function generateCode() {
    if (state.format === 'css') {
      codeBox.value = `.glass-card {
  /* Glassmorphism Surface */
  background: rgba(15, 23, 42, ${state.opacity});
  backdrop-filter: blur(${state.blur}px);
  -webkit-backdrop-filter: blur(${state.blur}px);
  border-radius: ${state.radius}px;
  border: 1px solid rgba(255, 255, 255, ${state.borderAlpha});
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
  position: relative;
  overflow: hidden;
}

${state.enableBeam ? `/* Border Beam Runner */
.glass-card::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  padding: 2px;
  background: conic-gradient(from 0deg, transparent 70%, ${state.beamC1}, ${state.beamC2});
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  animation: beam-spin ${state.beamSpeed}s linear infinite;
}

@keyframes beam-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}` : ''}`;
    } else {
      codeBox.value = `<!-- Tailwind CSS Container -->
<div class="relative overflow-hidden rounded-[${state.radius}px] border border-white/[${state.borderAlpha}] bg-slate-900/[${state.opacity}] p-8 backdrop-blur-[${state.blur}px] shadow-2xl">
  <h2 class="text-2xl font-bold text-white">Glassmorphism UI</h2>
  <p class="mt-2 text-slate-300">Gebaut mit Tailwind CSS und PlayRig Tokens.</p>
</div>`;
    }
  }

  // 3D Tilt Effect
  stage.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);

    const rotX = -dy * 12;
    const rotY = dx * 12;

    cardWrap.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  });

  stage.addEventListener('mouseleave', () => {
    cardWrap.style.transform = 'rotateX(0deg) rotateY(0deg)';
  });

  // Slider inputs
  document.getElementById('slider-blur').addEventListener('input', (e) => {
    state.blur = parseInt(e.target.value);
    document.getElementById('val-blur').textContent = `${state.blur}px`;
    updateStyles();
  });

  document.getElementById('slider-opacity').addEventListener('input', (e) => {
    state.opacity = parseFloat(e.target.value);
    document.getElementById('val-opacity').textContent = state.opacity.toFixed(2);
    updateStyles();
  });

  document.getElementById('slider-radius').addEventListener('input', (e) => {
    state.radius = parseInt(e.target.value);
    document.getElementById('val-radius').textContent = `${state.radius}px`;
    updateStyles();
  });

  document.getElementById('slider-border').addEventListener('input', (e) => {
    state.borderAlpha = parseFloat(e.target.value);
    document.getElementById('val-border').textContent = state.borderAlpha.toFixed(2);
    updateStyles();
  });

  document.getElementById('slider-beam-speed').addEventListener('input', (e) => {
    state.beamSpeed = parseInt(e.target.value);
    document.getElementById('val-beam-speed').textContent = `${state.beamSpeed}s`;
    updateStyles();
  });

  document.getElementById('check-enable-beam').addEventListener('change', (e) => {
    state.enableBeam = e.target.checked;
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
      document.querySelectorAll('.bg-thumb-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      stage.className = `stage-section bg-${btn.dataset.bg}`;
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

  document.getElementById('btn-copy-code').addEventListener('click', () => {
    navigator.clipboard.writeText(codeBox.value);
    window.showToast('📋 CSS Code in Zwischenablage kopiert!', 'success');
  });

  document.getElementById('btn-randomize').addEventListener('click', () => {
    state.blur = Math.floor(Math.random() * 28) + 8;
    state.opacity = Math.floor((Math.random() * 0.6 + 0.2) * 20) / 20;
    state.radius = Math.floor(Math.random() * 32) + 12;
    state.borderAlpha = Math.floor((Math.random() * 0.4 + 0.1) * 20) / 20;
    state.beamSpeed = Math.floor(Math.random() * 8) + 3;

    document.getElementById('slider-blur').value = state.blur;
    document.getElementById('val-blur').textContent = `${state.blur}px`;
    document.getElementById('slider-opacity').value = state.opacity;
    document.getElementById('val-opacity').textContent = state.opacity.toFixed(2);
    document.getElementById('slider-radius').value = state.radius;
    document.getElementById('val-radius').textContent = `${state.radius}px`;
    document.getElementById('slider-border').value = state.borderAlpha;
    document.getElementById('val-border').textContent = state.borderAlpha.toFixed(2);
    document.getElementById('slider-beam-speed').value = state.beamSpeed;
    document.getElementById('val-beam-speed').textContent = `${state.beamSpeed}s`;

    updateStyles();
    window.showToast('🎲 Zufälliger Style generiert!', 'info');
  });

  updateStyles();
})();

