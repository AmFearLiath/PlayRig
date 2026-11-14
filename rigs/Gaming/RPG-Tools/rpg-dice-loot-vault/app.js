/**
 * PLAYRIG - RPG DICE & LOOT VAULT
 * High-End Polyhedral Physics, Decelerating Slot Ticker & Procedural Web Audio
 * Author: Liath • Copyright: © GameChiller • Version: v0.0.1
 */

(function () {
  'use strict';

  let selectedSides = 20;
  let modifier = 0;
  let rollMode = 'normal'; // 'normal', 'adv', 'disadv'
  let soundEnabled = true;
  let isRolling = false;

  const canvas = document.getElementById('dice-canvas');
  const ctx = canvas.getContext('2d');
  let width, height;

  let activeDice = [];
  let particles = [];
  let animFrameId = null;

  // --- Web Audio Synthesizer (Realistic Wooden Dice SFX) ---
  let audioCtx = null;
  let lastSoundTime = 0;

  function getAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Soft wooden dice clack with acoustic resonance
  function playDiceClack(volume = 0.2) {
    if (!soundEnabled) return;
    const nowMs = performance.now();
    if (nowMs - lastSoundTime < 65) return; // Strict rate-limit: never machine-gun
    lastSoundTime = nowMs;

    try {
      const ac = getAudio();
      const now = ac.currentTime;

      // Primary impact body
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const filter = ac.createBiquadFilter();

      osc.type = 'triangle';
      const baseFreq = 180 + Math.random() * 90;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.05);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, now);

      gain.gain.setValueAtTime(Math.min(volume, 0.3), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ac.destination);

      osc.start(now);
      osc.stop(now + 0.05);

      // Subtle click transient
      const clickOsc = ac.createOscillator();
      const clickGain = ac.createGain();
      clickOsc.type = 'sine';
      clickOsc.frequency.setValueAtTime(800 + Math.random() * 400, now);
      clickGain.gain.setValueAtTime(volume * 0.4, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
      clickOsc.connect(clickGain);
      clickGain.connect(ac.destination);
      clickOsc.start(now);
      clickOsc.stop(now + 0.015);
    } catch (e) {}
  }

  // Subtle tick during decelerating ticker
  function playTickSound(pitchMultiplier = 1.0) {
    if (!soundEnabled) return;
    try {
      const ac = getAudio();
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320 * pitchMultiplier, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.03);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    } catch (e) {}
  }

  // Victorious Gold Nat 20 Fanfare
  function playCritSound() {
    if (!soundEnabled) return;
    try {
      const ac = getAudio();
      const now = ac.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'triangle';
        const startT = now + idx * 0.09;
        osc.frequency.setValueAtTime(freq, startT);
        gain.gain.setValueAtTime(0.2, startT);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.45);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(startT);
        osc.stop(startT + 0.45);
      });
    } catch (e) {}
  }

  // Low Dramatic Nat 1 Thud
  function playFumbleSound() {
    if (!soundEnabled) return;
    try {
      const ac = getAudio();
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const logicalW = Math.max(300, rect.width || canvas.clientWidth || 800);
    const logicalH = Math.max(260, rect.height || canvas.clientHeight || 380);

    canvas.width = Math.round(logicalW * dpr);
    canvas.height = Math.round(logicalH * dpr);

    width = logicalW;
    height = logicalH;

    if (ctx.resetTransform) ctx.resetTransform();
    else ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  // --- Physics Polyhedral Die ---
  class PhysicsDie {
    constructor(sides, x, y, targetVal) {
      this.sides = sides;
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 11;
      this.vy = -Math.random() * 6 - 4;
      this.gravity = 0.75;
      this.angle = Math.random() * Math.PI * 2;
      this.vAngle = (Math.random() - 0.5) * 0.35;
      this.targetVal = targetVal;
      this.currentVal = Math.floor(Math.random() * sides) + 1;
      this.size = 50; // High visibility size
      this.bounces = 0;
      this.stopped = false;
      this.soundCount = 0;
    }

    update() {
      if (this.stopped) return;

      const boundW = width;
      const boundH = height;
      const floorY = boundH - 24 - this.size;

      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;
      this.angle += this.vAngle;

      // Wall collisions
      const leftBound = 24 + this.size;
      const rightBound = boundW - 24 - this.size;

      if (this.x < leftBound) {
        this.x = leftBound;
        this.vx = -this.vx * 0.55;
        this.vAngle *= 0.7;
        if (this.soundCount < 5 && Math.abs(this.vx) > 1.2) {
          playDiceClack(Math.min(0.25, Math.abs(this.vx) * 0.05));
          this.soundCount++;
        }
      } else if (this.x > rightBound) {
        this.x = rightBound;
        this.vx = -this.vx * 0.55;
        this.vAngle *= 0.7;
        if (this.soundCount < 5 && Math.abs(this.vx) > 1.2) {
          playDiceClack(Math.min(0.25, Math.abs(this.vx) * 0.05));
          this.soundCount++;
        }
      }

      // Floor collision & resting mechanics
      if (this.y >= floorY) {
        this.y = floorY;

        if (Math.abs(this.vy) > 1.8) {
          this.vy = -this.vy * 0.45;
          this.vx *= 0.78;
          this.vAngle *= 0.75;
          this.bounces++;
          if (this.soundCount < 5) {
            playDiceClack(Math.min(0.3, Math.abs(this.vy) * 0.06));
            this.soundCount++;
          }
        } else {
          // Rolling / sliding on floor
          this.vy = 0;
          this.vx *= 0.88;
          this.vAngle *= 0.85;

          const faceInterval = this.sides === 6 ? Math.PI / 2 : (Math.PI / 3);
          const targetAngle = Math.round(this.angle / faceInterval) * faceInterval;
          const diff = targetAngle - this.angle;
          this.vAngle += diff * 0.18; // Snap to flat edge/face

          if (Math.abs(this.vx) < 0.15 && Math.abs(this.vAngle) < 0.04) {
            this.stopped = true;
            this.angle = targetAngle;
            this.currentVal = this.targetVal;
            this.vx = 0;
            this.vy = 0;
            this.vAngle = 0;
          }
        }
      }
    }
          this.vx *= 0.78;
          this.vAngle *= 0.75;
          this.bounces++;
          if (this.soundCount < 5) {
            playDiceClack(Math.min(0.3, Math.abs(this.vy) * 0.06));
            this.soundCount++;
          }
        } else {
          // Transition to Rolling / Sliding on floor
          this.vy = 0;
          this.vx *= 0.88;
          this.vAngle *= 0.85;

          // Natural torque alignment towards flat resting face
          // Flat face angle interval
          const faceInterval = this.sides === 6 ? Math.PI / 2 : (Math.PI / 3);
          const targetAngle = Math.round(this.angle / faceInterval) * faceInterval;
          const diff = targetAngle - this.angle;
          this.vAngle += diff * 0.18; // Restorative spring torque

          // Settle down check
          if (Math.abs(this.vx) < 0.15 && Math.abs(this.vAngle) < 0.04) {
            this.stopped = true;
            this.angle = targetAngle; // Exact flat face
            this.currentVal = this.targetVal;
            this.vx = 0;
            this.vy = 0;
            this.vAngle = 0;
          }
        }
      }
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);

      // Floor Shadow
      const boundH = canvas.height / (window.devicePixelRatio || 1);
      const distFromFloor = Math.max(0, (boundH - 24) - (this.y + this.size));
      const shadowScale = Math.max(0.4, 1 - distFromFloor / 180);
      const shadowAlpha = Math.max(0.1, 0.45 - distFromFloor / 220);

      ctx.save();
      ctx.translate(0, this.size + distFromFloor * 0.2);
      ctx.scale(shadowScale, shadowScale * 0.35);
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Rotate die body
      ctx.rotate(this.angle);

      const isNat20 = this.sides === 20 && this.targetVal === 20 && this.stopped;
      const isNat1 = this.sides === 20 && this.targetVal === 1 && this.stopped;

      // Base Palette
      let baseGrad = ctx.createRadialGradient(0, -this.size * 0.3, this.size * 0.1, 0, 0, this.size);
      let strokeColor = '#38bdf8';
      let textColor = '#ffffff';

      if (isNat20) {
        baseGrad = ctx.createRadialGradient(0, -this.size * 0.3, this.size * 0.1, 0, 0, this.size);
        baseGrad.addColorStop(0, '#fef08a');
        baseGrad.addColorStop(0.5, '#f59e0b');
        baseGrad.addColorStop(1, '#b45309');
        strokeColor = '#fef08a';
        textColor = '#1c1917';
      } else if (isNat1) {
        baseGrad.addColorStop(0, '#f87171');
        baseGrad.addColorStop(0.5, '#dc2626');
        baseGrad.addColorStop(1, '#7f1d1d');
        strokeColor = '#fca5a5';
        textColor = '#ffffff';
      } else {
        baseGrad.addColorStop(0, '#334155');
        baseGrad.addColorStop(0.5, '#1e293b');
        baseGrad.addColorStop(1, '#0f172a');
        strokeColor = '#00f0ff';
        textColor = '#f8fafc';
      }

      // Draw Main Polyhedral Facet Body
      ctx.beginPath();
      const points = this.sides === 4 ? 3 : this.sides === 6 ? 4 : 6;
      for (let i = 0; i < points; i++) {
        const rad = (i * 2 * Math.PI) / points - Math.PI / 2;
        const px = Math.cos(rad) * this.size;
        const py = Math.sin(rad) * this.size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      ctx.fillStyle = baseGrad;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = strokeColor;
      ctx.stroke();

      // 3D Facet Bevel Lines for D20/D12/D6
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isNat20 ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.15)';
      const innerSize = this.size * 0.55;

      ctx.beginPath();
      for (let i = 0; i < points; i++) {
        const rad = (i * 2 * Math.PI) / points - Math.PI / 2;
        const outerX = Math.cos(rad) * this.size;
        const outerY = Math.sin(rad) * this.size;
        const innerX = Math.cos(rad) * innerSize;
        const innerY = Math.sin(rad) * innerSize;
        ctx.moveTo(outerX, outerY);
        ctx.lineTo(innerX, innerY);
      }
      ctx.stroke();

      // Inner polygon facet
      ctx.beginPath();
      for (let i = 0; i < points; i++) {
        const rad = (i * 2 * Math.PI) / points - Math.PI / 2;
        const innerX = Math.cos(rad) * innerSize;
        const innerY = Math.sin(rad) * innerSize;
        if (i === 0) ctx.moveTo(innerX, innerY);
        else ctx.lineTo(innerX, innerY);
      }
      ctx.closePath();
      ctx.fillStyle = isNat20 ? 'rgba(254, 240, 138, 0.3)' : 'rgba(0, 0, 0, 0.25)';
      ctx.fill();
      ctx.stroke();

      // Draw Number Upright (Cancel rotation for clean readability)
      ctx.rotate(-this.angle);

      const fontSize = Math.floor(this.size * 0.72);
      ctx.font = `900 ${fontSize}px "JetBrains Mono", Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Text Drop Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 2;

      ctx.fillStyle = textColor;
      ctx.fillText(this.currentVal, 0, 1);

      // Reset shadows
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      ctx.restore();
    }
  }

  // --- Confetti Particles ---
  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 14;
      this.vy = -Math.random() * 10 - 2;
      this.color = color;
      this.size = Math.random() * 5 + 3;
      this.life = 1.0;
      this.decay = Math.random() * 0.02 + 0.015;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.25;
      this.life -= this.decay;
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.life);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function spawnCritExplosion(x, y) {
    const colors = ['#f59e0b', '#fbbf24', '#fef08a', '#ffffff', '#38bdf8'];
    for (let i = 0; i < 70; i++) {
      particles.push(new Particle(x, y, colors[Math.floor(Math.random() * colors.length)]));
    }
  }

  // --- Main Animation Loop ---
  function animate() {
    const boundW = canvas.width / (window.devicePixelRatio || 1);
    const boundH = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, boundW, boundH);

    // Subtle felt arena grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < boundW; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, boundH); ctx.stroke();
    }
    for (let y = 0; y < boundH; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(boundW, y); ctx.stroke();
    }

    activeDice.forEach(d => {
      d.update();
      d.draw();
    });

    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw();
      if (particles[i].life <= 0) particles.splice(i, 1);
    }

    animFrameId = requestAnimationFrame(animate);
  }

  // --- Decelerating Slot-Machine / Odometric Ticker ---
  // Starts fast, smoothly decelerates, locks onto final result, and stops cleanly
  function runDeceleratingTicker(finalTotal, breakdownStr, finalDieRoll, onComplete) {
    const totalEl = document.getElementById('result-total');
    const breakdownEl = document.getElementById('result-breakdown');
    breakdownEl.textContent = 'Würfle...';

    // Delays in ms between each tick (exponential deceleration curve)
    const tickDelays = [
      30, 35, 40, 45, 55, 65, 80, 100, 130, 170, 230, 310, 420
    ];
    let step = 0;

    function nextTick() {
      if (step < tickDelays.length - 1) {
        // Intermediary random display
        const randomVal = Math.floor(Math.random() * selectedSides) + 1;
        totalEl.textContent = randomVal + modifier;

        // Also update die face while rolling
        activeDice.forEach(d => {
          if (!d.stopped) d.currentVal = randomVal;
        });

        const progress = step / tickDelays.length;
        playTickSound(0.8 + progress * 0.4);

        step++;
        setTimeout(nextTick, tickDelays[step]);
      } else {
        // Final locked evaluation
        totalEl.textContent = finalTotal;
        breakdownEl.textContent = breakdownStr;

        // Force stop all dice cleanly
        activeDice.forEach(d => {
          d.stopped = true;
          d.currentVal = d.targetVal;
        });

        if (onComplete) onComplete();
      }
    }

    nextTick();
  }

  // --- Perform Roll Action ---
  function rollDice() {
    if (isRolling) return;
    resizeCanvas(); // Ensure non-zero logical dimensions before roll
    isRolling = true;

    activeDice = [];
    particles = [];

    const roll1 = Math.floor(Math.random() * selectedSides) + 1;
    const roll2 = Math.floor(Math.random() * selectedSides) + 1;

    let finalRoll = roll1;
    let dieCount = 1;

    if (rollMode === 'adv') {
      finalRoll = Math.max(roll1, roll2);
      dieCount = 2;
    } else if (rollMode === 'disadv') {
      finalRoll = Math.min(roll1, roll2);
      dieCount = 2;
    }

    const spawnY = Math.min(90, height * 0.25);
    if (dieCount === 1) {
      activeDice.push(new PhysicsDie(selectedSides, width / 2, spawnY, finalRoll));
    } else {
      activeDice.push(new PhysicsDie(selectedSides, width / 2 - 60, spawnY, roll1));
      activeDice.push(new PhysicsDie(selectedSides, width / 2 + 60, spawnY, roll2));
    }

    playDiceClack(0.25);

    let breakdownStr = `D${selectedSides} (${finalRoll})`;
    if (rollMode === 'adv') breakdownStr = `Vorteil [${roll1}, ${roll2}] ➔ ${finalRoll}`;
    if (rollMode === 'disadv') breakdownStr = `Nachteil [${roll1}, ${roll2}] ➔ ${finalRoll}`;
    if (modifier !== 0) breakdownStr += ` ${modifier >= 0 ? '+' : ''}${modifier}`;

    const total = finalRoll + modifier;

    // Run decelerating ticker in parallel with physics
    runDeceleratingTicker(total, breakdownStr, finalRoll, () => {
      isRolling = false;

      // Critical Hit / Fumble Handling
      if (selectedSides === 20 && finalRoll === 20) {
        playCritSound();
        spawnCritExplosion(width / 2, height / 2);
        const banner = document.getElementById('crit-banner');
        banner.innerHTML = '<span class="crit-text">✨ NAT 20! KRITISCHER ERFOLG ✨</span>';
        banner.classList.add('show');
        setTimeout(() => banner.classList.remove('show'), 2200);
      } else if (selectedSides === 20 && finalRoll === 1) {
        playFumbleSound();
        const banner = document.getElementById('crit-banner');
        banner.innerHTML = '<span class="crit-text" style="color:#ef4444; border-color:#ef4444; text-shadow:0 0 20px rgba(239,68,68,0.8);">💀 NAT 1! KRITISCHER FEHLSCHLAG 💀</span>';
        banner.classList.add('show');
        setTimeout(() => banner.classList.remove('show'), 2200);
      }

      addHistoryLog(`D${selectedSides}`, breakdownStr, total);
    });
  }

  function addHistoryLog(type, formula, total) {
    const list = document.getElementById('roll-history-list');
    if (!list) return;
    const item = document.createElement('div');
    item.className = 'log-entry';
    item.innerHTML = `
      <span>${type}: <span style="color:#cbd5e1;">${formula}</span></span>
      <span class="log-total">= ${total}</span>
    `;
    list.prepend(item);
  }

  // --- RPG LOOT VAULT GENERATOR & CUSTOM SESSION TABLES ---
  const DEFAULT_LOOT_DATA = {
    name: 'Offizielles PlayRig RPG Set',
    weapons: ['Großschwert', 'Kriegsaxt', 'Runendolch', 'Bogen', 'Astralstab', 'Schlaghammer', 'Hellebarde', 'Zauberstab'],
    armor: ['Drachenpanzer', 'Schattenrobe', 'Titanenhelm', 'Astralstiefel', 'Mithril-Handschuhe', 'Geisterkappe'],
    prefixes: ['Sternenfeuer', 'Blutdurstiger', 'Ätherischer', 'Verdammter', 'Uralter', 'Gewitternder', 'Sonnengekrönter', 'Leeren'],
    suffixes: ['der Verdammnis', 'der Ewigkeit', 'des Phoenix', 'der Unendlichkeit', 'des Erwachens', 'der Sternenwacht'],
    stats: [
      '+18% Kritische Trefferchance',
      '+55 Physische Angriffskraft',
      '+40 Astral-Feuerschaden',
      '+240 Max Gesundheit',
      '+15% Angriffsgeschwindigkeit',
      '+18 Mana-Regeneration pro Sekunde',
      '+30% Rüstungsdurchdringung'
    ],
    penalties: [
      '-15% Physische Rüstung',
      'Fluch der Trägheit (-10% Tempo)',
      'Blutzoll (Verbraucht 5 Lebenspunkte pro Treffer)'
    ],
    lores: [
      '„Geschmiedet in den Tiefen einer kollabierenden Supernova.“',
      '„Trägt die unauslöschliche Glut der ersten Krieger.“',
      '„Das Flüstern der Leere begleitet jeden geschwungenen Hieb.“',
      '„Von den Elfenältesten mit alchemistischem Sternengold geweiht.“'
    ]
  };

  let activeLootData = JSON.parse(JSON.stringify(DEFAULT_LOOT_DATA));

  function summonLoot() {
    const rarityChoice = document.getElementById('select-loot-rarity')?.value || 'any';
    const rarities = ['Gewöhnlich', 'Selten', 'Episch', 'Legendär', 'Mythisch'];
    let chosenRarity = 'Legendär';

    if (rarityChoice === 'rare') chosenRarity = ['Selten', 'Episch', 'Legendär', 'Mythisch'][Math.floor(Math.random() * 4)];
    else if (rarityChoice === 'epic') chosenRarity = ['Episch', 'Legendär', 'Mythisch'][Math.floor(Math.random() * 3)];
    else if (rarityChoice === 'legendary') chosenRarity = ['Legendär', 'Mythisch'][Math.floor(Math.random() * 2)];
    else if (rarityChoice === 'mythic') chosenRarity = 'Mythisch';
    else chosenRarity = rarities[Math.floor(Math.random() * rarities.length)];

    const weaponsList = activeLootData.weapons?.length ? activeLootData.weapons : DEFAULT_LOOT_DATA.weapons;
    const armorList = activeLootData.armor?.length ? activeLootData.armor : DEFAULT_LOOT_DATA.armor;
    const prefixList = activeLootData.prefixes?.length ? activeLootData.prefixes : DEFAULT_LOOT_DATA.prefixes;
    const suffixList = activeLootData.suffixes?.length ? activeLootData.suffixes : DEFAULT_LOOT_DATA.suffixes;
    const statsList = activeLootData.stats?.length ? activeLootData.stats : DEFAULT_LOOT_DATA.stats;
    const loresList = activeLootData.lores?.length ? activeLootData.lores : DEFAULT_LOOT_DATA.lores;

    const isWeapon = Math.random() < 0.6;
    const baseName = isWeapon 
      ? weaponsList[Math.floor(Math.random() * weaponsList.length)]
      : armorList[Math.floor(Math.random() * armorList.length)];

    const prefix = prefixList[Math.floor(Math.random() * prefixList.length)];
    const suffix = suffixList[Math.floor(Math.random() * suffixList.length)];
    const fullName = `${prefix} ${baseName} ${suffix}`;

    const numStats = chosenRarity === 'Mythisch' ? 4 : chosenRarity === 'Legendär' ? 3 : chosenRarity === 'Episch' ? 2 : 1;
    const shuffledStats = [...statsList].sort(() => 0.5 - Math.random()).slice(0, numStats);

    // If item has penalties and rolled lower or cursed
    if (activeLootData.penalties?.length && (chosenRarity === 'Gewöhnlich' || Math.random() < 0.25)) {
      const penalty = activeLootData.penalties[Math.floor(Math.random() * activeLootData.penalties.length)];
      shuffledStats.push(`<span style="color:#ef4444;">⚠️ Nachteil: ${penalty}</span>`);
    }

    const lore = loresList[Math.floor(Math.random() * loresList.length)];

    const card = document.getElementById('loot-item-display');
    if (!card) return;

    card.className = 'loot-item-card rarity-' + (
      chosenRarity === 'Mythisch' ? 'mythic' :
      chosenRarity === 'Legendär' ? 'legendary' :
      chosenRarity === 'Episch' ? 'epic' :
      chosenRarity === 'Selten' ? 'rare' : 'common'
    );

    card.innerHTML = `
      <div class="loot-beam"></div>
      <div class="loot-item-header">
        <span class="loot-item-type">${isWeapon ? 'Waffe' : 'Rüstung'} • ${chosenRarity}</span>
        <span class="loot-rarity-badge">${chosenRarity}</span>
      </div>
      <h4 class="loot-item-title">${fullName}</h4>
      <div class="loot-stats-list">
        ${shuffledStats.map(s => `<div class="stat-line">${s}</div>`).join('')}
        <div class="stat-line lore">${lore}</div>
      </div>
    `;

    if (chosenRarity === 'Mythisch' || chosenRarity === 'Legendär') {
      playCritSound();
    } else {
      playDiceClack(0.2);
    }
  }

  // --- JSON TEMPLATE DOWNLOAD & SESSION IMPORT ENGINE ---
  function downloadLootTemplate() {
    const template = {
      name: "Beispiel RPG Beutetabelle & Schicksal",
      author: "GameChiller",
      version: "1.0",
      description: "Anpassbare Loot-Tabelle für Waffen, Rüstungen, Attribute und Nachteile.",
      weapons: [
        "Drachentöter-Zweihänder",
        "Schattenklinge",
        "Runen-Langbogen",
        "Astral-Kriegshammer",
        "Titanenspalter"
      ],
      armor: [
        "Sternenlicht-Panzer",
        "Vortex-Robe",
        "Titanen-Helm",
        "Dämonenleder-Stiefel",
        "Aegis-Schild"
      ],
      prefixes: [
        "Glühender",
        "Uralter",
        "Verfluchter",
        "Göttlicher",
        "Frosthauch",
        "Gewitternder"
      ],
      suffixes: [
        "des Phoenix",
        "der ewigen Nacht",
        "der Vernichtung",
        "des Schicksals",
        "der Unendlichkeit"
      ],
      stats: [
        "+28% Kritischer Schaden",
        "+85 Physische Angriffskraft",
        "+350 Lebenspunkte",
        "+22% Angriffsgeschwindigkeit",
        "+40 Astral-Feuerschaden"
      ],
      penalties: [
        "-15% Rüstungswert",
        "Fluch der Trägheit (-10% Tempo)",
        "Blutzoll (Verbraucht 6 LP pro Hieb)"
      ],
      lores: [
        "„In den Feuern des Schicksalsbergs geschmiedet.“",
        "„Nur die Würdigen können dieses Relikt führen.“",
        "„Ein Flüstern der Leere liegt auf der Klinge.“"
      ]
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'loot_table_template.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function validateLootJSON(data) {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Das Dokument muss ein gültiges JSON-Objekt sein.');
    }
    const hasItems = (Array.isArray(data.weapons) && data.weapons.length > 0) ||
                     (Array.isArray(data.armor) && data.armor.length > 0);
    if (!hasItems) {
      throw new Error('Die Tabelle muss mindestens ein Array "weapons" oder "armor" mit Einträgen enthalten.');
    }
    if (!Array.isArray(data.prefixes) || data.prefixes.length === 0) {
      throw new Error('Es muss ein Array "prefixes" (z. B. ["Uralter", "Glühender"]) vorhanden sein.');
    }
    if (!Array.isArray(data.suffixes) || data.suffixes.length === 0) {
      throw new Error('Es muss ein Array "suffixes" (z. B. ["des Phoenix", "der Nacht"]) vorhanden sein.');
    }
    if (!Array.isArray(data.stats) || data.stats.length === 0) {
      throw new Error('Es muss ein Array "stats" mit Attributen vorhanden sein.');
    }
    return true;
  }

  function applyCustomLootTable(parsed) {
    validateLootJSON(parsed);
    activeLootData = parsed;

    const statusBadge = document.getElementById('session-loot-status');
    const resetBtn = document.getElementById('btn-reset-loot-data');
    if (statusBadge) {
      statusBadge.textContent = '🟢 Eigene Tabelle aktiv (Session)';
      statusBadge.className = 'badge badge-amber';
    }
    if (resetBtn) resetBtn.style.display = 'block';

    if (window.showToast) {
      window.showToast('Beutetabelle verifiziert & für diese Sitzung aktiviert!', 'success');
    } else {
      alert('✅ Beutetabelle verifiziert & für diese Sitzung aktiviert!');
    }
  }

  function resetLootTable() {
    activeLootData = JSON.parse(JSON.stringify(DEFAULT_LOOT_DATA));
    const statusBadge = document.getElementById('session-loot-status');
    const resetBtn = document.getElementById('btn-reset-loot-data');
    if (statusBadge) {
      statusBadge.textContent = 'Standard aktiv';
      statusBadge.className = 'badge badge-slate';
    }
    if (resetBtn) resetBtn.style.display = 'none';

    if (window.showToast) {
      window.showToast('Auf offizielle Standard-Beutetabelle zurückgesetzt.', 'info');
    }
  }

  // --- UI Event Listeners ---
  document.querySelectorAll('.dice-select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.dice-select-btn').forEach(b => b.classList.remove('active-d20', 'active-die'));
      const target = e.currentTarget;
      target.classList.add('active-die');
      selectedSides = parseInt(target.dataset.sides, 10);
      playTickSound(1.2);
      rollDice();
    });
  });

  document.querySelectorAll('.roll-mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.roll-mode-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      rollMode = e.currentTarget.dataset.mode;
      playTickSound(1.0);
    });
  });

  document.getElementById('btn-roll-dice').addEventListener('click', rollDice);

  document.getElementById('btn-clear-tray').addEventListener('click', () => {
    activeDice = [];
    particles = [];
  });

  const modInput = document.getElementById('input-modifier');
  document.getElementById('btn-mod-inc').addEventListener('click', () => {
    modifier = parseInt(modInput.value, 10) + 1;
    modInput.value = modifier;
  });
  document.getElementById('btn-mod-dec').addEventListener('click', () => {
    modifier = parseInt(modInput.value, 10) - 1;
    modInput.value = modifier;
  });
  modInput.addEventListener('change', (e) => {
    modifier = parseInt(e.target.value, 10) || 0;
  });

  const soundBtn = document.getElementById('btn-sound-toggle');
  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊 Sound: An' : '🔇 Sound: Aus';
  });

  const summonBtn = document.getElementById('btn-summon-loot') || document.getElementById('btn-open-chest');
  if (summonBtn) summonBtn.addEventListener('click', summonLoot);

  // Template Download
  document.getElementById('btn-download-loot-template')?.addEventListener('click', downloadLootTemplate);

  // Modal open/close
  const importModal = document.getElementById('loot-import-modal');
  const errorEl = document.getElementById('loot-import-error');
  const fileInput = document.getElementById('file-loot-import');
  const textArea = document.getElementById('text-loot-import');

  function openImportModal() {
    if (!importModal) return;
    if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }
    if (fileInput) fileInput.value = '';
    if (textArea) textArea.value = '';
    importModal.style.display = 'flex';
  }

  function closeImportModal() {
    if (importModal) importModal.style.display = 'none';
  }

  document.getElementById('btn-open-loot-import')?.addEventListener('click', openImportModal);
  document.getElementById('btn-close-loot-modal')?.addEventListener('click', closeImportModal);
  document.getElementById('btn-cancel-loot-modal')?.addEventListener('click', closeImportModal);
  document.getElementById('btn-reset-loot-data')?.addEventListener('click', resetLootTable);

  // File upload input change
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (textArea) textArea.value = evt.target.result;
    };
    reader.readAsText(file);
  });

  // Verify and Submit import
  document.getElementById('btn-submit-loot-import')?.addEventListener('click', () => {
    try {
      const rawText = textArea?.value?.trim();
      if (!rawText) throw new Error('Bitte lade eine JSON-Datei hoch oder füge den JSON-Code in das Textfeld ein.');
      const parsed = JSON.parse(rawText);
      applyCustomLootTable(parsed);
      closeImportModal();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Fehler: ' + err.message;
        errorEl.style.display = 'block';
      } else {
        alert('Fehler: ' + err.message);
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') {
      e.preventDefault();
      rollDice();
    }
  });

  window.addEventListener('resize', resizeCanvas);

  // Initial Setup with small delay to ensure layout is computed
  window.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    animate();
    rollDice();
  });

  setTimeout(() => {
    resizeCanvas();
    if (activeDice.length === 0) {
      animate();
      rollDice();
    }
  }, 100);
})();
