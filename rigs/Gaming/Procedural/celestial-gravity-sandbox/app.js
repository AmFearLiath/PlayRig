/**
 * PLAYRIG - CELESTIAL GRAVITY ASTROPHYSICS LABORATORY
 * Real N-Body Gravity, Keplerian Moon Spawner & Interactive Body Inspector
 * Author: Liath • Copyright: © GameChiller • Version: v0.0.1
 */

(function () {
  'use strict';

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

  // --- Web Audio Procedural Cosmic Space Drone ---
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
    filter.frequency.setValueAtTime(260, audioCtx.currentTime);

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
          droneOsc1?.stop();
          droneOsc2?.stop();
        } catch (e) {}
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
      osc.frequency.setValueAtTime(140 * Math.min(intensity, 2), audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(25, audioCtx.currentTime + 0.45);

      gain.gain.setValueAtTime(0.25 * Math.min(intensity, 1.5), audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
    } catch (e) {}
  }

  // --- Simulation State ---
  let bodies = [];
  let particles = [];
  let G = 1.0;
  let trailAlpha = 0.08;
  let simSpeed = 1.0;
  let isPaused = false;
  let selectedSpawnType = 'planet';

  // Overlays
  let showVectors = true;
  let showTrails = true;
  let showGrid = true;

  // Selection
  let selectedBody = null;

  // Mouse Sling State
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let dragCurrent = { x: 0, y: 0 };
  let hasMovedSignificantly = false;

  // --- Celestial Body Class ---
  class CelestialBody {
    constructor(options = {}) {
      this.name = options.name || 'Unbekannt';
      this.x = options.x || 0;
      this.y = options.y || 0;
      this.vx = options.vx || 0;
      this.vy = options.vy || 0;
      this.mass = options.mass || 10;
      this.radius = options.radius || 6;
      this.color = options.color || '#38bdf8';
      this.type = options.type || 'planet'; // 'star', 'planet', 'moon', 'giant', 'blackhole'
      this.isLocked = options.isLocked || false; // Fixed anchor
      this.showTrail = options.showTrail !== false;
      this.history = [];
      this.parent = options.parent || null;
    }

    draw(ctx) {
      // Glow Shader for Stars and Black Holes
      if (this.type === 'star') {
        const radGlow = this.radius * 3.8;
        const grad = ctx.createRadialGradient(this.x, this.y, this.radius * 0.4, this.x, this.y, radGlow);
        grad.addColorStop(0, this.color);
        grad.addColorStop(0.35, 'rgba(251, 191, 36, 0.45)');
        grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radGlow, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.type === 'blackhole') {
        const radGlow = this.radius * 3.2;
        const grad = ctx.createRadialGradient(this.x, this.y, this.radius, this.x, this.y, radGlow);
        grad.addColorStop(0, '#00f0ff');
        grad.addColorStop(0.35, 'rgba(168, 85, 247, 0.6)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radGlow, 0, Math.PI * 2);
        ctx.fill();
      }

      // Main Body Sphere
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(1.8, this.radius), 0, Math.PI * 2);
      ctx.fillStyle = this.type === 'blackhole' ? '#000000' : this.color;
      ctx.fill();

      // Atmospheric Rim or Event Horizon Border
      if (this.type === 'blackhole') {
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#00f0ff';
        ctx.stroke();
      } else if (this.type === 'star') {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.stroke();
      }

      // Anchor Pin Indicator if Locked
      if (this.isLocked) {
        ctx.save();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Name Label (Subtle Monospace)
      if (this.mass > 3) {
        ctx.save();
        ctx.font = '600 10px "JetBrains Mono", Consolas, monospace';
        ctx.fillStyle = 'rgba(226, 232, 240, 0.7)';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x, this.y + this.radius + 14);
        ctx.restore();
      }

      // Velocity Vector Arrow
      if (showVectors && !this.isLocked && (Math.abs(this.vx) > 0.05 || Math.abs(this.vy) > 0.05)) {
        const vScale = 15;
        const endX = this.x + this.vx * vScale;
        const endY = this.y + this.vy * vScale;

        ctx.save();
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Arrow head
        const angle = Math.atan2(this.vy, this.vx);
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - 5 * Math.cos(angle - Math.PI / 6), endY - 5 * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - 5 * Math.cos(angle + Math.PI / 6), endY - 5 * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        ctx.restore();
      }

      // Selection Target Reticle
      if (selectedBody === this) {
        const reticleRadius = this.radius + 10;
        const time = performance.now() * 0.002;

        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([8, 6]);

        ctx.beginPath();
        ctx.arc(this.x, this.y, reticleRadius, time, time + Math.PI * 2);
        ctx.stroke();

        // Crosshairs
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
        const chLen = 6;
        ctx.beginPath();
        ctx.moveTo(this.x - reticleRadius - chLen, this.y); ctx.lineTo(this.x - reticleRadius + 2, this.y);
        ctx.moveTo(this.x + reticleRadius - 2, this.y); ctx.lineTo(this.x + reticleRadius + chLen, this.y);
        ctx.moveTo(this.x, this.y - reticleRadius - chLen); ctx.lineTo(this.x, this.y - reticleRadius + 2);
        ctx.moveTo(this.x, this.y + reticleRadius - 2); ctx.lineTo(this.x, this.y + reticleRadius + chLen);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // --- Collision Shockwave Particles ---
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

  function spawnExplosion(x, y, color, count = 25) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 0.6 + Math.random() * 4.0;
      particles.push(new Particle(
        x, y,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd,
        color
      ));
    }
  }

  // --- Physics Simulation Engine ---
  function stepPhysics(dt) {
    const softening = 35; // Prevents infinite slingshot spikes
    const num = bodies.length;

    // Calculate Gravitational Interactions
    for (let i = 0; i < num; i++) {
      const b1 = bodies[i];
      if (b1.isLocked) continue; // Locked body ignores incoming forces

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

    // Update coordinates
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (!b.isLocked) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
    }

    // Inelastic Mergers & Consumptions
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const b1 = bodies[i];
        const b2 = bodies[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < (b1.radius + b2.radius) * 0.85) {
          // If one is blackhole, it always consumes
          const isB1BH = b1.type === 'blackhole';
          const isB2BH = b2.type === 'blackhole';

          // Winner is heavier or Black Hole
          let winner = b1;
          let loser = b2;
          let loserIdx = j;

          if (isB2BH && !isB1BH) {
            winner = b2; loser = b1; loserIdx = i;
          } else if (b2.mass > b1.mass && !isB1BH) {
            winner = b2; loser = b1; loserIdx = i;
          }

          // Combine mass and momentum
          const totalMass = winner.mass + loser.mass;
          if (!winner.isLocked) {
            winner.vx = (winner.mass * winner.vx + loser.mass * loser.vx) / totalMass;
            winner.vy = (winner.mass * winner.vy + loser.mass * loser.vy) / totalMass;
            winner.x = (winner.mass * winner.x + loser.mass * loser.x) / totalMass;
            winner.y = (winner.mass * winner.y + loser.mass * loser.y) / totalMass;
          }

          winner.mass = totalMass;
          winner.radius = Math.cbrt(Math.pow(winner.radius, 3) + Math.pow(loser.radius, 3));

          spawnExplosion(winner.x, winner.y, winner.color, 30);
          playMergeBoom(totalMass / 150);

          if (selectedBody === loser) {
            selectBody(winner);
          }

          bodies.splice(loserIdx, 1);
          if (loserIdx === i) {
            i--;
            break;
          } else {
            j--;
          }
        }
      }
    }

    // Particles update
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      if (particles[i].alpha <= 0) particles.splice(i, 1);
    }
  }

  // --- Scientific Space Presets ---
  function loadPreset(preset) {
    bodies = [];
    particles = [];
    selectedBody = null;
    closeInspector();

    const cx = width / 2;
    const cy = height / 2;

    if (preset === 'solarsystem') {
      // 1. Sonne (Massive Central Anchor)
      const sun = new CelestialBody({
        name: 'Sol (Sonne)',
        x: cx, y: cy,
        vx: 0, vy: 0,
        mass: 750, radius: 18,
        color: '#fbbf24',
        type: 'star',
        isLocked: true
      });
      bodies.push(sun);

      // Helper for Kepler circular velocity: v = sqrt(G * M / r)
      function createPlanet(name, dist, mass, radius, color, type) {
        const v = Math.sqrt((G * 750) / dist);
        return new CelestialBody({
          name, x: cx, y: cy - dist,
          vx: v, vy: 0,
          mass, radius, color, type
        });
      }

      // Merkur
      bodies.push(createPlanet('Merkur', 65, 3, 3, '#94a3b8', 'planet'));

      // Venus
      bodies.push(createPlanet('Venus', 110, 8, 5, '#f59e0b', 'planet'));

      // Erde
      const earth = createPlanet('Erde', 170, 14, 6.5, '#38bdf8', 'planet');
      bodies.push(earth);

      // Mond Luna (Im stabilen Kreisorbit um die Erde)
      const moonDist = 20;
      const vMoonRel = Math.sqrt((G * earth.mass) / moonDist);
      const moon = new CelestialBody({
        name: 'Mond (Luna)',
        x: earth.x, y: earth.y - moonDist,
        vx: earth.vx + vMoonRel, vy: 0,
        mass: 1.5, radius: 2.2,
        color: '#f8fafc',
        type: 'moon',
        parent: earth
      });
      bodies.push(moon);

      // Mars + Phobos
      const mars = createPlanet('Mars', 240, 6, 4.5, '#ef4444', 'planet');
      bodies.push(mars);
      const phobosDist = 14;
      const vPhobosRel = Math.sqrt((G * mars.mass) / phobosDist);
      bodies.push(new CelestialBody({
        name: 'Phobos',
        x: mars.x, y: mars.y - phobosDist,
        vx: mars.vx + vPhobosRel, vy: 0,
        mass: 0.8, radius: 1.8,
        color: '#e2e8f0',
        type: 'moon',
        parent: mars
      }));

      // Jupiter + Galileische Monde
      const jupiter = createPlanet('Jupiter', 340, 85, 12, '#f59e0b', 'giant');
      bodies.push(jupiter);

      // Io & Europa
      const ioDist = 26;
      const vIoRel = Math.sqrt((G * jupiter.mass) / ioDist);
      bodies.push(new CelestialBody({
        name: 'Io',
        x: jupiter.x, y: jupiter.y - ioDist,
        vx: jupiter.vx + vIoRel, vy: 0,
        mass: 1.8, radius: 2.3,
        color: '#fef08a',
        type: 'moon',
        parent: jupiter
      }));

      const europaDist = 38;
      const vEuropaRel = Math.sqrt((G * jupiter.mass) / europaDist);
      bodies.push(new CelestialBody({
        name: 'Europa',
        x: jupiter.x, y: jupiter.y - europaDist,
        vx: jupiter.vx + vEuropaRel, vy: 0,
        mass: 1.5, radius: 2.1,
        color: '#bae6fd',
        type: 'moon',
        parent: jupiter
      }));

    } else if (preset === 'binary') {
      const sep = 110;
      const starM = 320;
      const vStar = Math.sqrt((G * starM) / (sep * 2));

      bodies.push(new CelestialBody({
        name: 'Alpha Centauri A',
        x: cx - sep / 2, y: cy,
        vx: 0, vy: -vStar,
        mass: starM, radius: 13,
        color: '#fbbf24', type: 'star'
      }));

      bodies.push(new CelestialBody({
        name: 'Alpha Centauri B',
        x: cx + sep / 2, y: cy,
        vx: 0, vy: vStar,
        mass: starM, radius: 13,
        color: '#00f0ff', type: 'star'
      }));

      // Circumbinary Planet
      const dist1 = 260;
      const v1 = Math.sqrt((G * starM * 2) / dist1);
      bodies.push(new CelestialBody({
        name: 'Kepler-16b',
        x: cx, y: cy - dist1,
        vx: v1, vy: 0,
        mass: 16, radius: 6,
        color: '#a855f7', type: 'planet'
      }));

    } else if (preset === 'figure8') {
      // Mathematically exact Chenciner & Montgomery Figure-8 choreography
      const m = 350;
      const x1 = -0.97000436 * 140;
      const y1 = 0.24308753 * 140;
      const vx3 = 0.93240737 * 0.9;
      const vy3 = 0.86473146 * 0.9;

      bodies.push(new CelestialBody({
        name: 'Körper 1 (Alpha)',
        x: cx + x1, y: cy + y1,
        vx: -vx3 / 2, vy: -vy3 / 2,
        mass: m, radius: 11,
        color: '#00f0ff', type: 'star'
      }));

      bodies.push(new CelestialBody({
        name: 'Körper 2 (Beta)',
        x: cx - x1, y: cy - y1,
        vx: -vx3 / 2, vy: -vy3 / 2,
        mass: m, radius: 11,
        color: '#ec4899', type: 'star'
      }));

      bodies.push(new CelestialBody({
        name: 'Körper 3 (Gamma)',
        x: cx, y: cy,
        vx: vx3, vy: vy3,
        mass: m, radius: 11,
        color: '#10b981', type: 'star'
      }));

    } else if (preset === 'blackhole') {
      const bh = new CelestialBody({
        name: 'Gargantua (Schwarzes Loch)',
        x: cx, y: cy,
        vx: 0, vy: 0,
        mass: 2200, radius: 18,
        color: '#000000',
        type: 'blackhole',
        isLocked: true
      });
      bodies.push(bh);

      // Accretion disk
      const count = 75;
      for (let i = 0; i < count; i++) {
        const dist = 65 + Math.random() * 260;
        const angle = Math.random() * Math.PI * 2;
        const v = Math.sqrt((G * 2200) / dist);
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist;
        const vx = -Math.sin(angle) * v;
        const vy = Math.cos(angle) * v;

        const colors = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fef08a'];
        const col = colors[Math.floor(Math.random() * colors.length)];
        bodies.push(new CelestialBody({
          name: `Akkretion #${i+1}`,
          x: px, y: py,
          vx: vx, vy: vy,
          mass: 1.2 + Math.random() * 2, radius: 2.2,
          color: col, type: 'moon',
          showTrail: Math.random() < 0.35
        }));
      }
    }
  }

  // --- Cosmic Grid Overlay ---
  function drawCosmicGrid(ctx, w, h) {
    if (!showGrid) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.lineWidth = 1;

    const gridSize = 60;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Barycenter Marker
    const cx = w / 2;
    const cy = h / 2;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    ctx.restore();
  }

  // --- Main Animation Loop ---
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

    // Fading background for orbital motion trail
    if (showTrails) {
      ctx.fillStyle = `rgba(3, 7, 18, ${trailAlpha})`;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    drawCosmicGrid(ctx, width, height);

    if (!isPaused) {
      // Sub-stepping for physics accuracy
      const subSteps = 3;
      const dt = (Math.min(delta, 0.05) * simSpeed) / subSteps;
      for (let s = 0; s < subSteps; s++) {
        stepPhysics(dt * 30);
      }
    }

    // Render bodies
    bodies.forEach(b => b.draw(ctx));

    // Render explosion particles
    particles.forEach(p => p.draw(ctx));

    // Render mouse sling vector preview
    if (isDragging) {
      ctx.beginPath();
      ctx.moveTo(dragStart.x, dragStart.y);
      ctx.lineTo(dragCurrent.x, dragCurrent.y);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      const previewR = selectedSpawnType === 'blackhole' ? 16 : (selectedSpawnType === 'star' ? 14 : (selectedSpawnType === 'giant' ? 10 : 5));
      ctx.beginPath();
      ctx.arc(dragStart.x, dragStart.y, previewR, 0, Math.PI * 2);
      ctx.fillStyle = selectedSpawnType === 'blackhole' ? '#000' : (selectedSpawnType === 'star' ? '#fbbf24' : '#38bdf8');
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }

    // Update Telemetry & Inspector if active
    updateTelemetry();

    // Stats
    document.getElementById('stat-bodies').textContent = bodies.length;
    const totalM = bodies.reduce((sum, b) => sum + Math.round(b.mass), 0);
    document.getElementById('stat-mass').textContent = totalM + ' M☉';

    requestAnimationFrame(loop);
  }

  // --- Inspector Drawer Logic ---
  const inspectorEl = document.getElementById('body-inspector');
  const inspNameInput = document.getElementById('insp-name-input');
  const inspTypeBadge = document.getElementById('insp-type-badge');
  const inspPosEl = document.getElementById('insp-pos');
  const inspVelEl = document.getElementById('insp-vel');
  const inspLockToggle = document.getElementById('insp-lock-toggle');
  const inspTrailToggle = document.getElementById('insp-trail-toggle');
  const inspMassSlider = document.getElementById('insp-mass-slider');
  const inspMassVal = document.getElementById('insp-mass-val');
  const inspRadiusSlider = document.getElementById('insp-radius-slider');
  const inspRadiusVal = document.getElementById('insp-radius-val');
  const inspSpeedSlider = document.getElementById('insp-speed-slider');
  const inspSpeedVal = document.getElementById('insp-speed-val');

  function selectBody(body) {
    selectedBody = body;
    if (!body) {
      closeInspector();
      return;
    }

    inspNameInput.value = body.name;
    inspTypeBadge.textContent = body.type.toUpperCase();
    inspTypeBadge.className = 'badge ' + (
      body.type === 'blackhole' ? 'badge-rose' :
      body.type === 'star' ? 'badge-amber' :
      body.type === 'giant' ? 'badge-purple' :
      body.type === 'moon' ? 'badge-slate' : 'badge-cyan'
    );

    inspLockToggle.checked = body.isLocked;
    inspTrailToggle.checked = body.showTrail;
    inspMassSlider.value = Math.min(1500, Math.round(body.mass));
    inspMassVal.textContent = Math.round(body.mass);
    inspRadiusSlider.value = Math.min(36, Math.round(body.radius));
    inspRadiusVal.textContent = Math.round(body.radius) + ' px';
    inspSpeedSlider.value = 1.0;
    inspSpeedVal.textContent = '1.0x';

    inspectorEl.style.display = 'flex';
  }

  function closeInspector() {
    selectedBody = null;
    inspectorEl.style.display = 'none';
  }

  function updateTelemetry() {
    if (!selectedBody) return;
    const speed = Math.sqrt(selectedBody.vx * selectedBody.vx + selectedBody.vy * selectedBody.vy);
    inspPosEl.textContent = `X: ${Math.round(selectedBody.x)}, Y: ${Math.round(selectedBody.y)}`;
    inspVelEl.textContent = `${speed.toFixed(2)} AU/s`;
  }

  // Inspector Event Handlers
  inspNameInput.addEventListener('input', (e) => {
    if (selectedBody) selectedBody.name = e.target.value;
  });

  inspLockToggle.addEventListener('change', (e) => {
    if (selectedBody) {
      selectedBody.isLocked = e.target.checked;
      if (selectedBody.isLocked) {
        selectedBody.vx = 0;
        selectedBody.vy = 0;
      }
    }
  });

  inspTrailToggle.addEventListener('change', (e) => {
    if (selectedBody) selectedBody.showTrail = e.target.checked;
  });

  inspMassSlider.addEventListener('input', (e) => {
    if (selectedBody) {
      selectedBody.mass = parseFloat(e.target.value);
      inspMassVal.textContent = Math.round(selectedBody.mass);
    }
  });

  inspRadiusSlider.addEventListener('input', (e) => {
    if (selectedBody) {
      selectedBody.radius = parseFloat(e.target.value);
      inspRadiusVal.textContent = Math.round(selectedBody.radius) + ' px';
    }
  });

  inspSpeedSlider.addEventListener('input', (e) => {
    if (selectedBody) {
      const mult = parseFloat(e.target.value);
      inspSpeedVal.textContent = mult.toFixed(2) + 'x';
      const curSpeed = Math.sqrt(selectedBody.vx * selectedBody.vx + selectedBody.vy * selectedBody.vy);
      if (curSpeed > 0.001) {
        selectedBody.vx = (selectedBody.vx / curSpeed) * (curSpeed * mult);
        selectedBody.vy = (selectedBody.vy / curSpeed) * (curSpeed * mult);
      }
    }
  });

  // Calculate & Set Perfect Circular Orbit around dominant mass
  document.getElementById('btn-auto-circularize')?.addEventListener('click', () => {
    if (!selectedBody || selectedBody.isLocked) return;

    // Find heaviest other body
    let primary = null;
    let maxM = 0;
    bodies.forEach(b => {
      if (b !== selectedBody && b.mass > maxM) {
        maxM = b.mass;
        primary = b;
      }
    });

    if (!primary) return;

    const dx = selectedBody.x - primary.x;
    const dy = selectedBody.y - primary.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10) return;

    const vCirc = Math.sqrt((G * primary.mass) / dist);
    // Tangential direction
    const angle = Math.atan2(dy, dx) + Math.PI / 2;
    selectedBody.vx = primary.vx + Math.cos(angle) * vCirc;
    selectedBody.vy = primary.vy + Math.sin(angle) * vCirc;
  });

  // Add Moon in stable orbit around selected parent
  document.getElementById('btn-add-moon')?.addEventListener('click', () => {
    if (!selectedBody) return;

    const moonDist = selectedBody.radius * 3.4 + 14;
    const vMoonRel = Math.sqrt((G * selectedBody.mass) / moonDist);

    const moon = new CelestialBody({
      name: `${selectedBody.name}-Mond`,
      x: selectedBody.x,
      y: selectedBody.y - moonDist,
      vx: selectedBody.vx + vMoonRel,
      vy: selectedBody.vy,
      mass: Math.max(1.2, selectedBody.mass * 0.08),
      radius: Math.max(2.2, selectedBody.radius * 0.32),
      color: '#f8fafc',
      type: 'moon',
      parent: selectedBody
    });

    bodies.push(moon);
    selectBody(moon);
  });

  // Delete body
  document.getElementById('btn-delete-body')?.addEventListener('click', () => {
    if (!selectedBody) return;
    const idx = bodies.indexOf(selectedBody);
    if (idx !== -1) bodies.splice(idx, 1);
    closeInspector();
  });

  document.getElementById('btn-close-inspector')?.addEventListener('click', closeInspector);

  // Color picker buttons
  document.querySelectorAll('.col-pick-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (selectedBody) {
        selectedBody.color = e.target.dataset.color;
        if (selectedBody.color === '#000000') selectedBody.type = 'blackhole';
      }
    });
  });

  // --- Mouse & Sling Interactions ---
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Check if clicked an existing body
    let clickedBody = null;
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      const dx = mx - b.x;
      const dy = my - b.y;
      if (dx * dx + dy * dy <= (b.radius + 12) * (b.radius + 12)) {
        clickedBody = b;
        break;
      }
    }

    if (clickedBody) {
      selectBody(clickedBody);
      return;
    }

    // Otherwise, prepare mouse sling
    dragStart = { x: mx, y: my };
    dragCurrent = { ...dragStart };
    isDragging = true;
    hasMovedSignificantly = false;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    dragCurrent = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const distSq = (dragCurrent.x - dragStart.x)**2 + (dragCurrent.y - dragStart.y)**2;
    if (distSq > 16) hasMovedSignificantly = true;
  });

  window.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;

    if (!hasMovedSignificantly) {
      // Clicked on empty space: deselect inspector
      closeInspector();
      return;
    }

    // Slingshot velocity (pullback opposite to direction)
    const vx = (dragStart.x - dragCurrent.x) * 0.05;
    const vy = (dragStart.y - dragCurrent.y) * 0.05;

    let mass = 12;
    let radius = 6;
    let color = '#38bdf8';
    let type = selectedSpawnType;
    let name = `Planet #${bodies.length + 1}`;

    if (type === 'moon') {
      mass = 2; radius = 2.5; color = '#f8fafc'; name = `Mond #${bodies.length + 1}`;
    } else if (type === 'giant') {
      mass = 65; radius = 11; color = '#f59e0b'; name = `Gasriese #${bodies.length + 1}`;
    } else if (type === 'star') {
      mass = 500; radius = 15; color = '#fbbf24'; name = `Stern #${bodies.length + 1}`;
    } else if (type === 'blackhole') {
      mass = 1800; radius = 18; color = '#000000'; name = `Schwarzes Loch #${bodies.length + 1}`;
    }

    const newBody = new CelestialBody({
      name, x: dragStart.x, y: dragStart.y,
      vx, vy, mass, radius, color, type
    });

    bodies.push(newBody);
    selectBody(newBody);
  });

  // --- UI Controls & Quick Toggles ---
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

  document.getElementById('btn-reset-preset').addEventListener('click', () => {
    const activePreset = document.querySelector('.preset-btn.active')?.dataset.preset || 'solarsystem';
    loadPreset(activePreset);
  });

  document.getElementById('btn-recenter').addEventListener('click', () => {
    if (bodies.length === 0) return;
    let totalM = 0, comX = 0, comY = 0;
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
    closeInspector();
  });

  // Toggles
  const vecBtn = document.getElementById('btn-toggle-vectors');
  vecBtn.addEventListener('click', () => {
    showVectors = !showVectors;
    vecBtn.classList.toggle('active', showVectors);
  });

  const trailsBtn = document.getElementById('btn-toggle-trails');
  trailsBtn.addEventListener('click', () => {
    showTrails = !showTrails;
    trailsBtn.classList.toggle('active', showTrails);
  });

  const gridBtn = document.getElementById('btn-toggle-grid');
  gridBtn.addEventListener('click', () => {
    showGrid = !showGrid;
    gridBtn.classList.toggle('active', showGrid);
  });

  const soundBtn = document.getElementById('btn-toggle-sound');
  soundBtn.addEventListener('click', () => {
    if (isSoundActive) {
      stopDrone();
      soundBtn.textContent = '🔇 Raum-Ambient: Aus';
    } else {
      startDrone();
      soundBtn.textContent = '🔊 Raum-Ambient: An';
    }
  });

  // Start Simulation
  resize();
  loadPreset('solarsystem');
  requestAnimationFrame(loop);
})();
