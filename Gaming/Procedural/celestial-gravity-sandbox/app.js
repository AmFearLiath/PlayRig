/**
 * PlayRig Celestial Gravity Sandbox // N-Body Orbital Physics
 * Author: Liath
 * Copyright: © GameChiller
 * Version: v0.0.1
 */

(function() {
  'use strict';

  // Canvas Setup
  const canvas = document.getElementById('gravity-canvas');
  const ctx = canvas.getContext('2d');
  const wrapper = document.getElementById('canvas-wrapper');

  let width = 0;
  let height = 0;

  function resize() {
    width = canvas.width = wrapper.clientWidth;
    height = canvas.height = wrapper.clientHeight;
  }
  window.addEventListener('resize', resize);

  // Web Audio Procedural Drone
  let audioCtx = null;
  let droneOsc1 = null;
  let droneOsc2 = null;
  let droneGain = null;
  let isSoundActive = false;

  function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function startDrone() {
    initAudio();
    droneOsc1 = audioCtx.createOscillator();
    droneOsc2 = audioCtx.createOscillator();
    droneGain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    droneOsc1.type = 'sine';
    droneOsc1.frequency.setValueAtTime(55, audioCtx.currentTime); // A1

    droneOsc2.type = 'triangle';
    droneOsc2.frequency.setValueAtTime(82.4, audioCtx.currentTime); // E2

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(240, audioCtx.currentTime);

    droneGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    droneGain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 2.0);

    droneOsc1.connect(filter);
    droneOsc2.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(audioCtx.destination);

    droneOsc1.start();
    droneOsc2.start();
    isSoundActive = true;
  }

  function stopDrone() {
    if (droneGain && audioCtx) {
      droneGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.0);
      setTimeout(() => {
        try {
          droneOsc1.stop();
          droneOsc2.stop();
        } catch(e) {}
        droneOsc1 = null;
        droneOsc2 = null;
      }, 1000);
      isSoundActive = false;
    }
  }

  function playMergeBoom(intensity = 1.0) {
    if (!isSoundActive && !audioCtx) return;
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140 * intensity, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.4);

      gain.gain.setValueAtTime(0.25 * Math.min(intensity, 1.5), audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch(e) {}
  }

  // Simulation State
  let bodies = [];
  let particles = [];
  let G = 1.0;
  let trailAlpha = 0.08;
  let simSpeed = 1.0;
  let isPaused = false;
  let selectedSpawnType = 'planet';

  // Mouse Sling State
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let dragCurrent = { x: 0, y: 0 };

  // Celestial Body Class
  class Body {
    constructor(x, y, vx, vy, mass, radius, color, type = 'planet') {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.mass = mass;
      this.radius = radius;
      this.color = color;
      this.type = type;
      this.history = [];
    }

    draw(ctx) {
      // Glow effect for stars & blackholes
      if (this.type === 'star') {
        const radGlow = this.radius * 3.5;
        const grad = ctx.createRadialGradient(this.x, this.y, this.radius * 0.5, this.x, this.y, radGlow);
        grad.addColorStop(0, this.color);
        grad.addColorStop(0.4, 'rgba(251, 191, 36, 0.4)');
        grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radGlow, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.type === 'blackhole') {
        const radGlow = this.radius * 3;
        const grad = ctx.createRadialGradient(this.x, this.y, this.radius, this.x, this.y, radGlow);
        grad.addColorStop(0, '#00f0ff');
        grad.addColorStop(0.3, 'rgba(168, 85, 247, 0.5)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radGlow, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(1.5, this.radius), 0, Math.PI * 2);
      ctx.fillStyle = this.type === 'blackhole' ? '#000' : this.color;
      ctx.fill();

      if (this.type === 'blackhole') {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00f0ff';
        ctx.stroke();
      }
    }
  }

  // Collision Particle
  class Particle {
    constructor(x, y, vx, vy, color) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.alpha = 1.0;
      this.decay = 0.02 + Math.random() * 0.03;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.alpha -= this.decay;
    }
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function spawnExplosion(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 0.5 + Math.random() * 3.5;
      particles.push(new Particle(
        x, y,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd,
        color
      ));
    }
  }

  // Physics Engine Update
  function stepPhysics(dt) {
    const softening = 25; // Epsilon squared to prevent infinite slingshot
    const num = bodies.length;

    // Calculate forces
    for (let i = 0; i < num; i++) {
      const b1 = bodies[i];
      let fx = 0;
      let fy = 0;

      for (let j = 0; j < num; j++) {
        if (i === j) continue;
        const b2 = bodies[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const distSq = dx * dx + dy * dy + softening;
        const dist = Math.sqrt(distSq);

        const force = (G * b1.mass * b2.mass) / distSq;
        fx += force * (dx / dist);
        fy += force * (dy / dist);
      }

      b1.vx += (fx / b1.mass) * dt;
      b1.vy += (fy / b1.mass) * dt;
    }

    // Update positions & check mergers
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }

    // Inelastic Collision & Merging
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const b1 = bodies[i];
        const b2 = bodies[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < (b1.radius + b2.radius) * 0.85) {
          // Merge b2 into b1
          const totalMass = b1.mass + b2.mass;
          b1.vx = (b1.mass * b1.vx + b2.mass * b2.vx) / totalMass;
          b1.vy = (b1.mass * b1.vy + b2.mass * b2.vy) / totalMass;
          b1.x = (b1.mass * b1.x + b2.mass * b2.x) / totalMass;
          b1.y = (b1.mass * b1.y + b2.mass * b2.y) / totalMass;
          b1.mass = totalMass;
          b1.radius = Math.cbrt(Math.pow(b1.radius, 3) + Math.pow(b2.radius, 3));

          if (b2.type === 'blackhole') b1.type = 'blackhole';
          if (b2.type === 'star' && b1.type !== 'blackhole') b1.type = 'star';

          spawnExplosion(b1.x, b1.y, b1.color, 25);
          playMergeBoom(totalMass / 100);

          bodies.splice(j, 1);
          j--;
        }
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      if (particles[i].alpha <= 0) particles.splice(i, 1);
    }
  }

  // Presets
  function loadPreset(preset) {
    bodies = [];
    particles = [];
    const cx = width / 2;
    const cy = height / 2;

    if (preset === 'solar') {
      // Central Star
      bodies.push(new Body(cx, cy, 0, 0, 450, 16, '#fbbf24', 'star'));

      // Planet 1 (Inner rocky)
      const d1 = 80;
      const v1 = Math.sqrt((G * 450) / d1);
      bodies.push(new Body(cx, cy - d1, v1, 0, 8, 4, '#38bdf8', 'planet'));

      // Planet 2 (Habitable)
      const d2 = 150;
      const v2 = Math.sqrt((G * 450) / d2);
      bodies.push(new Body(cx, cy - d2, v2, 0, 15, 6, '#10b981', 'planet'));

      // Planet 3 (Gas Giant)
      const d3 = 240;
      const v3 = Math.sqrt((G * 450) / d3);
      bodies.push(new Body(cx, cy - d3, v3, 0, 35, 9, '#f59e0b', 'planet'));

      // Planet 4 (Outer ice)
      const d4 = 340;
      const v4 = Math.sqrt((G * 450) / d4);
      bodies.push(new Body(cx, cy - d4, v4, 0, 12, 5, '#818cf8', 'planet'));

    } else if (preset === 'binary') {
      const sep = 90;
      const starM = 250;
      const vStar = Math.sqrt((G * starM) / (sep * 2));
      bodies.push(new Body(cx - sep/2, cy, 0, -vStar, starM, 13, '#f59e0b', 'star'));
      bodies.push(new Body(cx + sep/2, cy, 0, vStar, starM, 13, '#00f0ff', 'star'));

      // Circumbinary planets
      const d1 = 220;
      const v1 = Math.sqrt((G * starM * 2) / d1);
      bodies.push(new Body(cx, cy - d1, v1, 0, 12, 5, '#a855f7', 'planet'));

      const d2 = 320;
      const v2 = Math.sqrt((G * starM * 2) / d2);
      bodies.push(new Body(cx, cy - d2, v2, 0, 20, 7, '#10b981', 'planet'));

    } else if (preset === 'chaos') {
      const d = 110;
      const m = 300;
      bodies.push(new Body(cx - d, cy + d * 0.5, 0.4, -0.6, m, 12, '#ef4444', 'star'));
      bodies.push(new Body(cx + d, cy + d * 0.5, -0.6, 0.2, m, 12, '#3b82f6', 'star'));
      bodies.push(new Body(cx, cy - d * 0.8, 0.2, 0.4, m, 12, '#10b981', 'star'));

    } else if (preset === 'ring') {
      bodies.push(new Body(cx, cy, 0, 0, 1200, 18, '#000', 'blackhole'));
      const count = 55;
      for (let i = 0; i < count; i++) {
        const dist = 70 + Math.random() * 260;
        const angle = Math.random() * Math.PI * 2;
        const v = Math.sqrt((G * 1200) / dist);
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist;
        const vx = -Math.sin(angle) * v;
        const vy = Math.cos(angle) * v;
        const colors = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6'];
        const col = colors[Math.floor(Math.random() * colors.length)];
        bodies.push(new Body(px, py, vx, vy, 1.5 + Math.random() * 3, 2.5, col, 'planet'));
      }
    }
  }

  // Animation Loop
  let lastTime = performance.now();
  let frameCount = 0;
  let fpsTimer = 0;

  function loop(now) {
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    frameCount++;
    fpsTimer += delta;
    if (fpsTimer >= 0.5) {
      document.getElementById('stat-fps').textContent = Math.round(frameCount / fpsTimer);
      frameCount = 0;
      fpsTimer = 0;
    }

    // Semi-transparent background for orbital motion trail
    ctx.fillStyle = `rgba(3, 7, 18, ${trailAlpha})`;
    ctx.fillRect(0, 0, width, height);

    if (!isPaused) {
      // Sub-step for physics stability
      const subSteps = 3;
      const dt = (Math.min(delta, 0.05) * simSpeed) / subSteps;
      for (let s = 0; s < subSteps; s++) {
        stepPhysics(dt * 30);
      }
    }

    // Render bodies
    bodies.forEach(b => b.draw(ctx));

    // Render particles
    particles.forEach(p => p.draw(ctx));

    // Render mouse sling vector
    if (isDragging) {
      ctx.beginPath();
      ctx.moveTo(dragStart.x, dragStart.y);
      ctx.lineTo(dragCurrent.x, dragCurrent.y);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Spawn preview circle
      ctx.beginPath();
      ctx.arc(dragStart.x, dragStart.y, selectedSpawnType === 'blackhole' ? 14 : (selectedSpawnType === 'star' ? 12 : 5), 0, Math.PI * 2);
      ctx.fillStyle = selectedSpawnType === 'blackhole' ? '#000' : (selectedSpawnType === 'star' ? '#fbbf24' : '#38bdf8');
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }

    // Stats
    document.getElementById('stat-bodies').textContent = bodies.length;
    const totalM = bodies.reduce((sum, b) => sum + Math.round(b.mass), 0);
    document.getElementById('stat-mass').textContent = totalM;

    requestAnimationFrame(loop);
  }

  // Mouse Sling Event Handlers
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dragCurrent = { ...dragStart };
    isDragging = true;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    dragCurrent = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  });

  window.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;

    // Launch velocity is vector opposite from drag current (slingshot pullback)
    const vx = (dragStart.x - dragCurrent.x) * 0.05;
    const vy = (dragStart.y - dragCurrent.y) * 0.05;

    let mass = 12;
    let radius = 5;
    let color = '#38bdf8';
    let type = selectedSpawnType;

    if (type === 'star') {
      mass = 320;
      radius = 12;
      color = '#fbbf24';
    } else if (type === 'blackhole') {
      mass = 1500;
      radius = 16;
      color = '#000';
    }

    bodies.push(new Body(dragStart.x, dragStart.y, vx, vy, mass, radius, color, type));
  });

  // UI Event Listeners
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      loadPreset(e.target.dataset.preset);
    });
  });

  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      selectedSpawnType = e.target.dataset.type;
    });
  });

  document.getElementById('param-g').addEventListener('input', (e) => {
    G = parseFloat(e.target.value);
    document.getElementById('val-g').textContent = G.toFixed(1);
  });

  document.getElementById('param-trail').addEventListener('input', (e) => {
    trailAlpha = parseFloat(e.target.value);
    document.getElementById('val-trail').textContent = trailAlpha.toFixed(2);
  });

  document.getElementById('param-speed').addEventListener('input', (e) => {
    simSpeed = parseFloat(e.target.value);
    document.getElementById('val-speed').textContent = simSpeed.toFixed(1) + 'x';
  });

  document.getElementById('btn-pause-sim').addEventListener('click', () => {
    isPaused = !isPaused;
    document.getElementById('pause-icon').textContent = isPaused ? '▶' : '⏸';
  });

  document.getElementById('btn-recenter').addEventListener('click', () => {
    if (bodies.length === 0) return;
    // Calculate center of mass
    let totalM = 0;
    let comX = 0;
    let comY = 0;
    bodies.forEach(b => {
      totalM += b.mass;
      comX += b.x * b.mass;
      comY += b.y * b.mass;
    });
    comX /= totalM;
    comY /= totalM;

    const shiftX = width / 2 - comX;
    const shiftY = height / 2 - comY;

    bodies.forEach(b => {
      b.x += shiftX;
      b.y += shiftY;
    });
  });

  document.getElementById('btn-clear-space').addEventListener('click', () => {
    bodies = [];
    particles = [];
  });

  const soundBtn = document.getElementById('btn-toggle-sound');
  soundBtn.addEventListener('click', () => {
    if (isSoundActive) {
      stopDrone();
      soundBtn.textContent = '🔇 Ambient Sound';
    } else {
      startDrone();
      soundBtn.textContent = '🔊 Ambient Sound';
    }
  });

  // Start Simulation
  resize();
  loadPreset('solar');
  requestAnimationFrame(loop);
})();

