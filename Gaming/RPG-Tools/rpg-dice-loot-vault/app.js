/**
 * RPG DICE & LOOT VAULT - APP LOGIC
 */

(function () {
  'use strict';

  let selectedSides = 20;
  let modifier = 0;
  let rollMode = 'normal';
  let soundEnabled = true;
  let isRolling = false;

  const canvas = document.getElementById('dice-canvas');
  const ctx = canvas.getContext('2d');
  let width, height;

  // Active dice particles / physics entities
  let activeDice = [];
  let particles = [];

  // Audio Context (Synthesized effects, no external assets required)
  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playDiceClack() {
    if (!soundEnabled) return;
    try {
      const ac = getAudio();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220 + Math.random() * 280, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.05);

      gain.gain.setValueAtTime(0.2, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.05);
    } catch (e) {}
  }

  function playCritSound() {
    if (!soundEnabled) return;
    try {
      const ac = getAudio();
      const now = ac.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.25, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.4);
      });
    } catch (e) {}
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    width = canvas.width = rect.width * (window.devicePixelRatio || 1);
    height = canvas.height = rect.height * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  }

  class PhysicsDie {
    constructor(sides, x, y, targetVal) {
      this.sides = sides;
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 14;
      this.vy = -Math.random() * 8 - 4;
      this.angle = Math.random() * Math.PI * 2;
      this.vAngle = (Math.random() - 0.5) * 0.4;
      this.targetVal = targetVal;
      this.currentVal = Math.floor(Math.random() * sides) + 1;
      this.size = 46;
      this.bounces = 0;
      this.stopped = false;
    }

    update() {
      if (this.stopped) return;

      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.5; // gravity
      this.angle += this.vAngle;

      // Random face flicker while flying
      if (Math.random() < 0.3) {
        this.currentVal = Math.floor(Math.random() * this.sides) + 1;
      }

      const boundW = canvas.width / (window.devicePixelRatio || 1);
      const boundH = canvas.height / (window.devicePixelRatio || 1);

      // Floor bounce
      if (this.y + this.size > boundH - 20) {
        this.y = boundH - 20 - this.size;
        this.vy = -this.vy * 0.55;
        this.vx *= 0.75;
        this.vAngle *= 0.6;
        this.bounces++;
        playDiceClack();

        if (Math.abs(this.vy) < 0.6 && Math.abs(this.vx) < 0.4) {
          this.stopped = true;
          this.currentVal = this.targetVal;
        }
      }

      // Walls bounce
      if (this.x - this.size < 20) {
        this.x = 20 + this.size;
        this.vx = -this.vx * 0.6;
        playDiceClack();
      } else if (this.x + this.size > boundW - 20) {
        this.x = boundW - 20 - this.size;
        this.vx = -this.vx * 0.6;
        playDiceClack();
      }
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(4, 6, this.size * 0.9, 0, Math.PI * 2);
      ctx.fill();

      // Die Body
      const isD20 = this.sides === 20;
      const isGold = isD20 && this.targetVal === 20 && this.stopped;

      const grad = ctx.createRadialGradient(0, -10, 5, 0, 0, this.size);
      if (isGold) {
        grad.addColorStop(0, '#fef08a');
        grad.addColorStop(0.7, '#f59e0b');
        grad.addColorStop(1, '#b45309');
      } else {
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(0.7, '#0f172a');
        grad.addColorStop(1, '#020617');
      }

      ctx.fillStyle = grad;
      ctx.strokeStyle = isGold ? '#fbbf24' : '#38bdf8';
      ctx.lineWidth = 2.5;

      // Hexagonal / Poly Shape
      ctx.beginPath();
      const points = this.sides === 4 ? 3 : this.sides === 6 ? 4 : this.sides === 8 ? 4 : 6;
      for (let i = 0; i < points; i++) {
        const rad = (i * 2 * Math.PI) / points - Math.PI / 2;
        const px = Math.cos(rad) * this.size;
        const py = Math.sin(rad) * this.size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Value Text
      ctx.rotate(-this.angle); // Keep number upright
      ctx.fillStyle = isGold ? '#000000' : '#ffffff';
      ctx.font = `900 ${Math.floor(this.size * 0.68)}px var(--font-mono)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.currentVal, 0, 0);

      ctx.restore();
    }
  }

  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 12;
      this.vy = (Math.random() - 0.5) * 12 - 3;
      this.color = color;
      this.size = Math.random() * 5 + 3;
      this.life = 1.0;
      this.decay = Math.random() * 0.02 + 0.015;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.2;
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
    for (let i = 0; i < 60; i++) {
      particles.push(new Particle(x, y, colors[Math.floor(Math.random() * colors.length)]));
    }
  }

  function animate() {
    const boundW = canvas.width / (window.devicePixelRatio || 1);
    const boundH = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, boundW, boundH);

    // Subtle arena grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
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

    particles.forEach((p, idx) => {
      p.update();
      p.draw();
      if (p.life <= 0) particles.splice(idx, 1);
    });

    requestAnimationFrame(animate);
  }

  // Perform Roll Action
  function rollDice() {
    if (isRolling) return;
    isRolling = true;

    const boundW = canvas.width / (window.devicePixelRatio || 1);
    const boundH = canvas.height / (window.devicePixelRatio || 1);

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

    if (dieCount === 1) {
      activeDice.push(new PhysicsDie(selectedSides, boundW / 2, 80, finalRoll));
    } else {
      activeDice.push(new PhysicsDie(selectedSides, boundW / 2 - 50, 80, roll1));
      activeDice.push(new PhysicsDie(selectedSides, boundW / 2 + 50, 80, roll2));
    }

    playDiceClack();

    // Check completion
    setTimeout(() => {
      isRolling = false;
      const total = finalRoll + modifier;
      document.getElementById('result-total').textContent = total;

      let breakdownStr = `D${selectedSides} (${finalRoll})`;
      if (rollMode === 'adv') breakdownStr = `Vorteil [${roll1}, ${roll2}] -> ${finalRoll}`;
      if (rollMode === 'disadv') breakdownStr = `Nachteil [${roll1}, ${roll2}] -> ${finalRoll}`;
      if (modifier !== 0) breakdownStr += ` ${modifier >= 0 ? '+' : ''}${modifier}`;

      document.getElementById('result-breakdown').textContent = breakdownStr;

      // Critical Hit (Nat 20)
      if (selectedSides === 20 && finalRoll === 20) {
        playCritSound();
        spawnCritExplosion(boundW / 2, boundH / 2);
        const banner = document.getElementById('crit-banner');
        banner.classList.add('show');
        setTimeout(() => banner.classList.remove('show'), 1800);
      }

      // Add to history log
      addHistoryLog(`D${selectedSides}`, breakdownStr, total);
    }, 1100);
  }

  function addHistoryLog(type, formula, total) {
    const list = document.getElementById('roll-history-list');
    const item = document.createElement('div');
    item.className = 'log-entry';
    item.innerHTML = `
      <span>${type}: <span style="color:#cbd5e1;">${formula}</span></span>
      <span class="log-total">= ${total}</span>
    `;
    list.prepend(item);
  }

  // --- RPG LOOT VAULT GENERATOR ---
  const LOOT_DATA = {
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
    lores: [
      '„Geschmiedet in den Tiefen einer kollabierenden Supernova.“',
      '„Trägt die unauslöschliche Glut der ersten Krieger.“',
      '„Das Flüstern der Leere begleitet jeden geschwungenen Hieb.“',
      '„Von den Elfenältesten mit alchemistischem Sternengold geweiht.“'
    ]
  };

  function summonLoot() {
    const rarityChoice = document.getElementById('select-loot-rarity').value;
    const rarities = ['Gewöhnlich', 'Selten', 'Episch', 'Legendär', 'Mythisch'];
    let chosenRarity = 'Legendär';

    if (rarityChoice === 'rare') chosenRarity = 'Selten';
    else if (rarityChoice === 'epic') chosenRarity = 'Episch';
    else if (rarityChoice === 'legendary') chosenRarity = 'Legendär';
    else if (rarityChoice === 'mythic') chosenRarity = 'Mythisch';
    else chosenRarity = rarities[Math.floor(Math.random() * rarities.length)];

    const isWeapon = Math.random() > 0.4;
    const baseType = isWeapon
      ? LOOT_DATA.weapons[Math.floor(Math.random() * LOOT_DATA.weapons.length)]
      : LOOT_DATA.armor[Math.floor(Math.random() * LOOT_DATA.armor.length)];

    const prefix = LOOT_DATA.prefixes[Math.floor(Math.random() * LOOT_DATA.prefixes.length)];
    const suffix = LOOT_DATA.suffixes[Math.floor(Math.random() * LOOT_DATA.suffixes.length)];
    const title = `${prefix}-${baseType} ${suffix}`;

    const numStats = chosenRarity === 'Mythisch' ? 4 : chosenRarity === 'Legendär' ? 3 : 2;
    const shuffledStats = [...LOOT_DATA.stats].sort(() => 0.5 - Math.random()).slice(0, numStats);
    const lore = LOOT_DATA.lores[Math.floor(Math.random() * LOOT_DATA.lores.length)];

    const container = document.getElementById('loot-item-display');
    const rarityClass = chosenRarity === 'Mythisch' ? 'rarity-mythic' : 'rarity-legendary';
    container.className = `loot-item-card ${rarityClass}`;

    container.innerHTML = `
      <div class="loot-beam"></div>
      <div class="loot-item-header">
        <span class="loot-item-type">${baseType}</span>
        <span class="loot-rarity-badge">${chosenRarity}</span>
      </div>
      <h4 class="loot-item-title">${title}</h4>
      <div class="loot-stats-list">
        ${shuffledStats.map(s => `<div class="stat-line affix">${s}</div>`).join('')}
        <div class="stat-line lore">${lore}</div>
      </div>
    `;

    playCritSound();
    window.showToast(`✨ ${chosenRarity} Loot erhalten: '${title}'!`, 'success');
  }

  // --- EVENTS ---
  window.addEventListener('resize', resizeCanvas);

  document.querySelectorAll('.dice-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dice-select-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSides = parseInt(btn.dataset.sides);
      rollDice();
    });
  });

  document.querySelectorAll('.roll-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.roll-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rollMode = btn.dataset.mode;
    });
  });

  document.getElementById('btn-roll-dice').addEventListener('click', rollDice);
  document.getElementById('btn-summon-loot').addEventListener('click', summonLoot);

  document.getElementById('btn-clear-tray').addEventListener('click', () => {
    activeDice = [];
    particles = [];
  });

  document.getElementById('btn-clear-log').addEventListener('click', () => {
    document.getElementById('roll-history-list').innerHTML = '';
  });

  document.getElementById('btn-sound-toggle').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    document.getElementById('btn-sound-toggle').textContent = soundEnabled ? '🔊 Sound: An' : '🔇 Sound: Aus';
  });

  document.getElementById('btn-mod-inc').addEventListener('click', () => {
    modifier++;
    document.getElementById('input-modifier').value = modifier;
  });

  document.getElementById('btn-mod-dec').addEventListener('click', () => {
    modifier--;
    document.getElementById('input-modifier').value = modifier;
  });

  document.getElementById('input-modifier').addEventListener('change', (e) => {
    modifier = parseInt(e.target.value) || 0;
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      rollDice();
    }
  });

  // Init
  resizeCanvas();
  animate();
  rollDice();
})();

