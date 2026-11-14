/**
 * AUDIO REACTIVE RIBBON - VISUALIZER ENGINE
 */

(function () {
  'use strict';

  const canvas = document.getElementById('ribbon-canvas');
  const ctx = canvas.getContext('2d');

  let width, height;
  let audioCtx = null;
  let analyser = null;
  let dataArray = null;
  let isPlayingSynth = false;
  let synthInterval = null;

  let lineCount = 24;
  let amplitude = 1.2;
  let tiltAngle = 45;
  let color1 = '#f43f5e';
  let color2 = '#8b5cf6';

  let time = 0;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // --- PROCEDURAL SYNTHWAVE BEAT GENERATOR ---
  function startSynthBeat() {
    initAudio();
    if (isPlayingSynth) {
      stopSynthBeat();
      return;
    }

    isPlayingSynth = true;
    document.getElementById('btn-play-synth-beat').textContent = '⏹ Demo-Beat stoppen';

    const bassNotes = [110, 110, 130.81, 146.83, 110, 98, 110, 164.81];
    let step = 0;

    synthInterval = setInterval(() => {
      if (!isPlayingSynth) return;
      const now = audioCtx.currentTime;

      // 1. Kick Drum (every 2 steps)
      if (step % 2 === 0) {
        const kickOsc = audioCtx.createOscillator();
        const kickGain = audioCtx.createGain();
        kickOsc.frequency.setValueAtTime(150, now);
        kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.12);
        kickGain.gain.setValueAtTime(0.7, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        kickOsc.connect(kickGain);
        kickGain.connect(analyser);
        kickGain.connect(audioCtx.destination);
        kickOsc.start(now);
        kickOsc.stop(now + 0.12);
      }

      // 2. Hi-Hat (every step)
      const hatOsc = audioCtx.createOscillator();
      const hatGain = audioCtx.createGain();
      hatOsc.type = 'square';
      hatOsc.frequency.setValueAtTime(8000, now);
      hatGain.gain.setValueAtTime(0.06, now);
      hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      hatOsc.connect(hatGain);
      hatGain.connect(analyser);
      hatGain.connect(audioCtx.destination);
      hatOsc.start(now);
      hatOsc.stop(now + 0.04);

      // 3. Synth Bass Note
      const bassFreq = bassNotes[step % bassNotes.length];
      const bassOsc = audioCtx.createOscillator();
      const bassGain = audioCtx.createGain();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(bassFreq, now);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + 0.18);

      bassGain.gain.setValueAtTime(0.3, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      bassOsc.connect(filter);
      filter.connect(bassGain);
      bassGain.connect(analyser);
      bassGain.connect(audioCtx.destination);
      bassOsc.start(now);
      bassOsc.stop(now + 0.2);

      step++;
    }, 180);
  }

  function stopSynthBeat() {
    isPlayingSynth = false;
    if (synthInterval) clearInterval(synthInterval);
    document.getElementById('btn-play-synth-beat').textContent = '▶ Demo-Beat starten';
  }

  // --- MICROPHONE INPUT ---
  async function startMic() {
    initAudio();
    stopSynthBeat();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const micSource = audioCtx.createMediaStreamSource(stream);
      micSource.connect(analyser);
      window.showToast('🎤 Mikrofon verbunden!', 'success');
    } catch (e) {
      window.showToast('Mikrofon-Zugriff verweigert oder nicht verfügbar', 'warning');
    }
  }

  // --- FILE INPUT ---
  function loadAudioFile(file) {
    initAudio();
    stopSynthBeat();
    const reader = new FileReader();
    reader.onload = async () => {
      const audioBuffer = await audioCtx.decodeAudioData(reader.result);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);
      source.connect(audioCtx.destination);
      source.start();
      window.showToast(`🎵 Spielt: ${file.name}`, 'success');
    };
    reader.readAsArrayBuffer(file);
  }

  // --- RENDER 3D PERSPECTIVE RIBBON ---
  function render() {
    time += 0.02;

    // Fade trail
    ctx.fillStyle = 'rgba(2, 4, 10, 0.18)';
    ctx.fillRect(0, 0, width, height);

    let avgFreq = 0;
    if (analyser && dataArray) {
      analyser.getByteFrequencyData(dataArray);
      for (let i = 0; i < dataArray.length; i++) avgFreq += dataArray[i];
      avgFreq = avgFreq / dataArray.length;
    }

    const tiltRad = (tiltAngle * Math.PI) / 180;
    const centerY = height * 0.58;
    const pointsCount = 64;

    for (let l = 0; l < lineCount; l++) {
      const depth = l / lineCount; // 0 = close, 1 = far
      const zOffset = (1 - depth) * 220;
      const lineWidth = Math.max(1, 2.5 * (1 - depth * 0.7));

      ctx.beginPath();
      ctx.lineWidth = lineWidth;

      // Dynamic color interpolation
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, color1);
      grad.addColorStop(1, color2);
      ctx.strokeStyle = grad;
      ctx.globalAlpha = Math.max(0.15, 1 - depth * 0.7);

      for (let p = 0; p <= pointsCount; p++) {
        const u = p / pointsCount;
        const x = u * width;

        // Wave formula driven by audio frequencies
        const freqIdx = Math.floor(u * (dataArray ? dataArray.length * 0.5 : 32)) % (dataArray ? dataArray.length : 32);
        const freqVal = dataArray ? dataArray[freqIdx] / 255 : Math.sin(time + u * 4) * 0.2 + 0.2;

        const wave1 = Math.sin(u * 8 + time * 2 + l * 0.3) * (40 * amplitude);
        const wave2 = Math.cos(u * 4 - time + l * 0.2) * (25 * amplitude);
        const audioDisplacement = freqVal * (140 * amplitude);

        const y = centerY + Math.sin(tiltRad) * zOffset - (wave1 + wave2 + audioDisplacement) * (1 - depth * 0.6);

        if (p === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1.0;
    requestAnimationFrame(render);
  }

  // --- EVENTS ---
  window.addEventListener('resize', resize);

  document.getElementById('btn-play-synth-beat').addEventListener('click', () => {
    initAudio();
    if (!isPlayingSynth) startSynthBeat();
    else stopSynthBeat();
  });

  document.querySelectorAll('.source-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.source-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const src = chip.dataset.source;
      if (src === 'synth') startSynthBeat();
      else if (src === 'mic') startMic();
    });
  });

  document.getElementById('input-audio-file').addEventListener('change', (e) => {
    if (e.target.files.length > 0) loadAudioFile(e.target.files[0]);
  });

  document.querySelectorAll('.color-swatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      color1 = btn.dataset.c1;
      color2 = btn.dataset.c2;
    });
  });

  document.getElementById('slider-lines').addEventListener('input', (e) => {
    lineCount = parseInt(e.target.value);
    document.getElementById('val-lines').textContent = lineCount;
  });

  document.getElementById('slider-amplitude').addEventListener('input', (e) => {
    amplitude = parseFloat(e.target.value);
    document.getElementById('val-amplitude').textContent = `${amplitude.toFixed(1)}x`;
  });

  document.getElementById('slider-tilt').addEventListener('input', (e) => {
    tiltAngle = parseInt(e.target.value);
    document.getElementById('val-tilt').textContent = `${tiltAngle}°`;
  });

  document.getElementById('btn-toggle-hud').addEventListener('click', () => {
    document.getElementById('ribbon-hud').classList.toggle('minimized');
  });

  document.getElementById('btn-fullscreen-toggle').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  });

  // Init
  resize();
  render();
})();

