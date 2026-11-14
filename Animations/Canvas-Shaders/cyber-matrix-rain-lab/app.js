/**
 * CYBER MATRIX RAIN LAB - ENGINE
 */

(function () {
  'use strict';

  const canvas = document.getElementById('matrix-canvas');
  const ctx = canvas.getContext('2d');

  let width, height;
  let fontSize = 18;
  let columns = 0;
  let drops = [];
  let dropSpeeds = [];

  let selectedCharset = 'katakana';
  let primaryColor = '#10b981';
  let glowColor = '#059669';
  let speedMultiplier = 1.0;
  let enableMouseWave = true;
  let audioPlaying = false;

  // Mouse interaction state
  const mouse = { x: -1000, y: -1000, radius: 140, shockwave: 0 };

  // Character sets
  const CHARSETS = {
    katakana: 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン0123456789',
    binary: '01',
    runes: 'ᚠᚡᚢᚣᚤᚥᚦᚧᚨᚩᚪᚫᚬᚭᚮᚯᚰᚱᚲᚳᚴᚵᚶᚷᚸᚹᚺᚻᚼᚽᚾᚿᛀᛁᛂᛃᛄᛅᛆᛇᛈᛉᛊᛋᛌᛍᛎᛏᛐᛑᛒᛓᛔᛕᛖᛗᛘᛙᛚᛛᛜᛝᛞᛟᛠᛡᛢᛣᛤᛥᛦᛧᛨᛩᛪ',
    matrix: 'ABCDEF0123456789$+-*/=%\"\'#&_(),.;:?!\\|{}<>[]^~'
  };

  function getChar() {
    const set = CHARSETS[selectedCharset] || CHARSETS.katakana;
    return set[Math.floor(Math.random() * set.length)];
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    columns = Math.floor(width / fontSize);

    drops = [];
    dropSpeeds = [];
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100; // staggered start
      dropSpeeds[i] = (Math.random() * 0.7 + 0.6) * speedMultiplier;
    }
  }

  // Procedural Ambient Rain Audio (Synthesized Pink Noise + Low-Pass Filter)
  let audioCtx = null;
  let rainSource = null;
  let gainNode = null;

  function toggleAudio() {
    if (!audioPlaying) {
      startAmbientRain();
      document.getElementById('btn-ambient-audio').textContent = '🌧️ Regen-Audio: An';
      audioPlaying = true;
    } else {
      stopAmbientRain();
      document.getElementById('btn-ambient-audio').textContent = '🌧️ Regen-Audio: Aus';
      audioPlaying = false;
    }
  }

  function startAmbientRain() {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // Pink noise filter algorithm
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      rainSource = audioCtx.createBufferSource();
      rainSource.buffer = noiseBuffer;
      rainSource.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 850;

      gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);

      rainSource.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      rainSource.start();
    } catch (e) {}
  }

  function stopAmbientRain() {
    if (rainSource) {
      try { rainSource.stop(); } catch (e) {}
      rainSource = null;
    }
  }

  // Main Render Loop
  function draw() {
    // Fade out previous frame (creates trail)
    ctx.fillStyle = 'rgba(2, 4, 8, 0.08)';
    ctx.fillRect(0, 0, width, height);

    ctx.font = `bold ${fontSize}px var(--font-mono)`;

    for (let i = 0; i < columns; i++) {
      let x = i * fontSize;
      let y = drops[i] * fontSize;

      // Mouse deflection wave
      if (enableMouseWave) {
        const dx = x - mouse.x;
        const dy = y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const effectRadius = mouse.radius + mouse.shockwave;
        if (dist < effectRadius && dist > 0) {
          const push = (1 - dist / effectRadius) * 25;
          x += (dx / dist) * push;
        }
      }

      const text = getChar();

      // Head glyph is bright glowing white/light green
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = primaryColor;
      ctx.fillText(text, x, y);

      // Trailing glyph
      ctx.fillStyle = primaryColor;
      ctx.shadowBlur = 4;
      ctx.shadowColor = glowColor;
      ctx.fillText(text, x, y - fontSize);

      ctx.shadowBlur = 0; // reset blur

      // Drop down
      drops[i] += (dropSpeeds[i] || 1) * speedMultiplier;

      // Reset when offscreen
      if (drops[i] * fontSize > height && Math.random() > 0.975) {
        drops[i] = 0;
        dropSpeeds[i] = (Math.random() * 0.7 + 0.6);
      }
    }

    if (mouse.shockwave > 0) {
      mouse.shockwave *= 0.94;
      if (mouse.shockwave < 1) mouse.shockwave = 0;
    }

    requestAnimationFrame(draw);
  }

  // --- EVENTS ---
  window.addEventListener('resize', resize);

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
  });

  document.getElementById('btn-burst-pulse').addEventListener('click', () => {
    mouse.x = width / 2;
    mouse.y = height / 2;
    mouse.shockwave = 350;
    window.showToast('💥 EMP-Impuls ausgelöst!', 'info');
  });

  document.querySelectorAll('.glyph-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.glyph-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedCharset = chip.dataset.charset;
    });
  });

  document.querySelectorAll('.color-swatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      primaryColor = btn.dataset.color;
      glowColor = btn.dataset.glow;
    });
  });

  document.getElementById('slider-speed').addEventListener('input', (e) => {
    speedMultiplier = parseFloat(e.target.value);
    document.getElementById('label-speed').textContent = `${speedMultiplier.toFixed(1)}x`;
  });

  document.getElementById('slider-density').addEventListener('input', (e) => {
    fontSize = parseInt(e.target.value);
    document.getElementById('label-density').textContent = `${fontSize}px`;
    resize();
  });

  document.getElementById('check-mouse-wave').addEventListener('change', (e) => {
    enableMouseWave = e.target.checked;
  });

  document.getElementById('btn-ambient-audio').addEventListener('click', toggleAudio);

  document.getElementById('btn-toggle-hud').addEventListener('click', () => {
    const hud = document.getElementById('matrix-hud');
    hud.classList.toggle('minimized');
  });

  document.getElementById('btn-fullscreen-toggle').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });

  // Init
  resize();
  draw();
})();

