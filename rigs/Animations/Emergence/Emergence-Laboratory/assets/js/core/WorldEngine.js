/**
 * WorldEngine – browser-side artificial-life model.
 * Version 2.1 performance refactor:
 * - O(1) spatial occupancy lookup via a typed-array index.
 * - Allocation-light movement, prey search and reproduction placement.
 * - Cached population counts and one-pass genetic variance.
 * - Configurable population ceiling (never removes existing organisms).
 * - Existing v2 world serialization schema remains compatible.
 *
 * This is a simplified scientific model, not a complete biological simulation.
 */
export const SPECIES = {
  plant: { label: 'Produzent', color: '#6bdc9b', energy: 32, static: true },
  herbivore: { label: 'Konsument', color: '#ffc36e', energy: 38, static: false },
  predator: { label: 'Räuber', color: '#ff7185', energy: 46, static: false },
  decomposer: { label: 'Zersetzer', color: '#a78bfa', energy: 30, static: false }
};

const DEFAULT_GENOME = {
  metabolism: 0.5, speed: 0.45, defense: 0.25, fertility: 0.48,
  thermal: 0.5, efficiency: 0.55, vision: 0.4, adaptability: 0.35
};
const GENOME_KEYS = Object.keys(DEFAULT_GENOME);
const DIRECTIONS = [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]];

export class WorldEngine {
  constructor(width = 150, height = 90, seed = 48271) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.cellCount = this.width * this.height;
    this.seed = seed >>> 0 || 1;
    this.generation = 0;
    this.nextId = 1;
    this.organisms = new Map();
    this._turnOrder = [];
    this._birthQueue = [];
    // Stores organism IDs; zero means empty. Spatial lookups are O(1).
    this.occupancy = new Int32Array(this.cellCount);
    this.maxPopulation = this.cellCount;
    this._counts = { plant: 0, herbivore: 0, predator: 0, decomposer: 0 };
    this.terrain = new Uint8Array(this.cellCount); // 0 open, 1 permeable, 2 solid, 3 selective
    this.terrainRevision = 0;
    this.nutrients = new Float32Array(this.cellCount);
    this.moisture = new Float32Array(this.cellCount);
    this.temperature = new Float32Array(this.cellCount);
    this.global = { temperature: 22, light: 75, water: 70, nutrient: 65, toxicity: 0 };
    this.stats = { births: 0, deaths: 0, mutations: 0 };
    this.history = [];
    this.selectedId = null;
    this.mode = 'ecosystem';
    this.mutationRate = .02;
    this.mutationStrength = .12;
    this.automatonGrid = new Uint8Array(this.cellCount);
    this.automatonNext = new Uint8Array(this.cellCount);
    this.automatonRules = { birth: [3], survive: [2, 3], preset: 'conway' };
    for (let i = 0; i < this.cellCount; i++) {
      this.nutrients[i] = .35 + this.random() * .55;
      this.moisture[i] = .35 + this.random() * .55;
      this.temperature[i] = 22;
    }
  }

  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  index(x, y) { return y * this.width + x; }
  coords(i) { return { x: i % this.width, y: Math.floor(i / this.width) }; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  getAt(x, y) {
    if (!this.inBounds(x, y)) return null;
    const id = this.occupancy[this.index(x, y)];
    return id ? (this.organisms.get(id) || null) : null;
  }
  occupied(x, y) { return this.inBounds(x, y) && this.occupancy[this.index(x, y)] !== 0; }

  _adjustCount(type, amount) {
    if (this._counts[type] !== undefined) this._counts[type] += amount;
  }
  _rebuildIndexes() {
    this.occupancy = new Int32Array(this.width * this.height);
    this._counts = { plant: 0, herbivore: 0, predator: 0, decomposer: 0 };
    for (const o of this.organisms.values()) {
      if (!this.inBounds(o.x, o.y)) continue;
      this.occupancy[this.index(o.x, o.y)] = o.id;
      this._adjustCount(o.type, 1);
    }
  }
  removeOrganism(idOrOrganism) {
    const o = typeof idOrOrganism === 'object' ? idOrOrganism : this.organisms.get(idOrOrganism);
    if (!o || !this.organisms.has(o.id)) return false;
    const i = this.index(o.x, o.y);
    if (this.occupancy[i] === o.id) this.occupancy[i] = 0;
    this.organisms.delete(o.id);
    this._adjustCount(o.type, -1);
    return true;
  }

  createOrganism(type, x, y, genome = null, parent = null) {
    if (!SPECIES[type] || !this.inBounds(x, y) || this.occupancy[this.index(x, y)] !== 0) return null;
    if (this.organisms.size >= this.maxPopulation) return null;
    const idx = this.index(x, y), wall = this.terrain[idx];
    if (wall === 2 || (wall === 3 && !['plant', 'decomposer'].includes(type))) return null;
    const id = this.nextId++;
    const organism = {
      id, type, x, y, energy: SPECIES[type].energy, age: 0,
      generation: this.generation, genome: { ...DEFAULT_GENOME, ...(genome || {}) },
      parentId: parent?.id ?? null, lineage: parent?.lineage ?? `L${id}`,
      fitness: 0, alive: true
    };
    this.organisms.set(id, organism);
    this.occupancy[idx] = id;
    this._adjustCount(type, 1);
    return organism;
  }

  seedWorld(amounts = { plant: 850, herbivore: 95, predator: 22, decomposer: 55 }) {
    this.mode = 'ecosystem';
    this.organisms.clear(); this.occupancy.fill(0);
    this._counts = { plant: 0, herbivore: 0, predator: 0, decomposer: 0 };
    this.nextId = 1; this.generation = 0;
    this.stats = { births: 0, deaths: 0, mutations: 0 };
    this.history = []; this.automatonGrid.fill(0); this.automatonNext.fill(0);
    this.terrain.fill(0); this.terrainRevision++;
    for (const [type, count] of Object.entries(amounts)) {
      const wanted = Math.min(Math.max(0, Math.floor(count)), this.maxPopulation);
      for (let n = 0; n < wanted && this.organisms.size < this.maxPopulation; n++) {
        for (let tries = 0; tries < 40; tries++) {
          const x = Math.floor(this.random() * this.width), y = Math.floor(this.random() * this.height);
          if (this.createOrganism(type, x, y)) break;
        }
      }
    }
    this.recordHistory();
  }

  counts() { return { ...this._counts }; }

  neighbors(x, y, radius = 1) {
    const found = [];
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= this.width || yy >= this.height) continue;
      const id = this.occupancy[this.index(xx, yy)];
      if (id) { const organism = this.organisms.get(id); if (organism) found.push({ organism, x: xx, y: yy, distance: Math.abs(dx) + Math.abs(dy) }); }
    }
    return found;
  }

  findNearbyType(x, y, radius, type) {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= this.width || yy >= this.height) continue;
      const id = this.occupancy[this.index(xx, yy)];
      if (!id) continue;
      const candidate = this.organisms.get(id);
      if (candidate?.type === type) return candidate;
    }
    return null;
  }

  passable(type, x, y) {
    if (!this.inBounds(x, y)) return false;
    const i = this.index(x, y);
    if (this.occupancy[i] !== 0) return false;
    const wall = this.terrain[i];
    return wall !== 2 && !(wall === 3 && !['plant', 'decomposer'].includes(type));
  }

  move(o, dx, dy) {
    const x = o.x + dx, y = o.y + dy;
    if (!this.inBounds(x, y)) return false;
    const from = this.index(o.x, o.y), to = this.index(x, y);
    if (this.occupancy[to] !== 0) return false;
    const wall = this.terrain[to];
    if (wall === 2 || (wall === 3 && !['plant', 'decomposer'].includes(o.type))) return false;
    if (this.occupancy[from] !== o.id) return false;
    if (wall === 1) o.energy -= .25;
    this.occupancy[from] = 0; this.occupancy[to] = o.id;
    o.x = x; o.y = y;
    o.energy -= .08 + o.genome.metabolism * .12;
    this.nutrients[from] = Math.min(1, this.nutrients[from] + .012);
    return true;
  }

  mutateGenome(genome, strength = .12) {
    const g = { ...genome }, key = GENOME_KEYS[Math.floor(this.random() * GENOME_KEYS.length)];
    g[key] = Math.max(0, Math.min(1, g[key] + (this.random() * 2 - 1) * strength));
    this.stats.mutations++;
    return g;
  }

  seedAutomaton(density = .28, seed = this.seed) {
    this.mode = 'automaton'; this.seed = seed >>> 0 || 1;
    this.organisms.clear(); this.occupancy.fill(0);
    this._counts = { plant: 0, herbivore: 0, predator: 0, decomposer: 0 };
    this.generation = 0; this.stats = { births: 0, deaths: 0, mutations: 0 };
    this.automatonGrid.fill(0); this.automatonNext.fill(0);
    this.terrain.fill(0); this.terrainRevision++;
    for (let i = 0; i < this.automatonGrid.length; i++) if (this.random() < density) this.automatonGrid[i] = 1;
    this.history = []; this.recordHistory();
  }

  stepAutomaton() {
    let births = 0, deaths = 0, aliveBefore = 0;
    const grid = this.automatonGrid, next = this.automatonNext, width = this.width, height = this.height;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x, state = grid[i], alive = state === 1;
      if (alive) aliveBefore++;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < width && yy < height && grid[yy * width + xx] === 1) n++;
      }
      let value;
      if (this.automatonRules.preset === 'brian') value = state === 1 ? 2 : state === 2 ? 0 : (n === 2 ? 1 : 0);
      else value = alive ? (this.automatonRules.survive.includes(n) ? 1 : 0) : (this.automatonRules.birth.includes(n) ? 1 : 0);
      next[i] = this.terrain[i] === 2 ? 0 : value;
      if (!alive && value === 1) births++;
      if (alive && value !== 1) deaths++;
    }
    this.automatonGrid = next; this.automatonNext = grid;
    this.stats.births = births; this.stats.deaths = deaths;
    this.generation++;
    if (this.generation % 5 === 0) this.recordHistory();
  }

  step() {
    if (this.mode === 'automaton') { this.stepAutomaton(); return; }
    this.stats.births = 0; this.stats.deaths = 0;
    const nutrients = this.nutrients, moisture = this.moisture, temperature = this.temperature;
    const global = this.global, length = this.cellCount;
    const nutrientGain = (global.nutrient / 10000) * .12;
    const moistureDelta = global.water / 10000 - .003;
    for (let i = 0; i < length; i++) {
      nutrients[i] = Math.min(1, nutrients[i] + nutrientGain);
      moisture[i] = Math.min(1, Math.max(0, moisture[i] + moistureDelta));
      temperature[i] += (global.temperature - temperature[i]) * .025;
    }

    // Snapshot the turn order once; newly born organisms act next generation.
    const order = this._turnOrder;
    order.length = 0;
    for (const organism of this.organisms.values()) order.push(organism);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    const births = this._birthQueue;
    births.length = 0;
    for (let oi = 0; oi < order.length; oi++) {
      const o = order[oi];
      if (!this.organisms.has(o.id)) continue;
      o.age++;
      const idx = this.index(o.x, o.y);
      const tempStress = Math.abs(temperature[idx] - (10 + o.genome.thermal * 30)) / 50;
      const toxStress = global.toxicity / 100 * (1 - o.genome.defense * .7);
      o.energy -= .055 + o.genome.metabolism * .12 + tempStress * .12 + toxStress * .28;

      if (o.type === 'plant') {
        const water = moisture[idx], nutrient = nutrients[idx];
        o.energy += (.18 + global.light / 100 * .48) * water * (.45 + nutrient) * (.65 + o.genome.efficiency * .7);
        nutrients[idx] = Math.max(0, nutrient - .003);
      } else if (o.type === 'herbivore') {
        const prey = this.findNearbyType(o.x, o.y, 2, 'plant');
        if (prey) { this.removeOrganism(prey); o.energy += 9 + o.genome.efficiency * 4; this.stats.deaths++; }
        else this.seek(o, 'plant');
      } else if (o.type === 'predator') {
        const prey = this.findNearbyType(o.x, o.y, 2, 'herbivore');
        if (prey) { this.removeOrganism(prey); o.energy += 17 + o.genome.efficiency * 5; this.stats.deaths++; }
        else this.seek(o, 'herbivore');
      } else if (o.type === 'decomposer') {
        o.energy += .15 + nutrients[idx] * .4;
        nutrients[idx] = Math.min(1, nutrients[idx] + .008);
        if (this.random() < .3) this.seek(o, null);
      }

      o.fitness = Math.max(0, o.energy) / (1 + o.age * .015);
      if (o.energy <= 0 || o.age > 160 + o.genome.defense * 220) {
        this.removeOrganism(o); this.stats.deaths++; continue;
      }
      const threshold = o.type === 'plant' ? 27 : o.type === 'herbivore' ? 43 : o.type === 'predator' ? 55 : 38;
      if (o.energy > threshold && this.organisms.size + births.length < this.maxPopulation && this.random() < (.025 + o.genome.fertility * .12)) {
        const spot = this.findEmpty(o.x, o.y, 2);
        if (spot) {
          const genome = this.random() < this.mutationRate ? this.mutateGenome(o.genome, this.mutationStrength) : { ...o.genome };
          births.push({ type: o.type, x: spot.x, y: spot.y, genome, parent: o });
          o.energy *= .66;
        }
      }
    }
    for (let i = 0; i < births.length; i++) {
      const b = births[i];
      if (this.createOrganism(b.type, b.x, b.y, b.genome, b.parent)) this.stats.births++;
    }
    births.length = 0;
    this.generation++;
    if (this.generation % 5 === 0) this.recordHistory();
  }

  seek(o, targetType) {
    const radius = Math.max(1, Math.round(1 + o.genome.vision * 3));
    let bestX = -1, bestY = -1, bestScore = -Infinity;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const x = o.x + dx, y = o.y + dy;
      if (!this.passable(o.type, x, y)) continue;
      const idx = this.index(x, y);
      let score = this.nutrients[idx] * .4 + this.moisture[idx] * .25 - (Math.abs(dx) + Math.abs(dy)) * .04;
      if (targetType && this.findNearbyType(x, y, 1, targetType)) score += 1.2;
      if (score > bestScore) { bestScore = score; bestX = x; bestY = y; }
    }
    if (bestX >= 0 && (this.random() < .65 || o.energy < 15)) {
      this.move(o, Math.sign(bestX - o.x), Math.sign(bestY - o.y));
    } else {
      const d = DIRECTIONS[Math.floor(this.random() * DIRECTIONS.length)];
      this.move(o, d[0], d[1]);
    }
  }

  findEmpty(x, y, radius = 2) {
    // Reservoir sampling avoids allocating a temporary array of candidate cells.
    let chosen = -1, seen = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      if (!this.passable('plant', xx, yy)) continue;
      if (this.random() * ++seen < 1) chosen = this.index(xx, yy);
    }
    return chosen < 0 ? null : { x: chosen % this.width, y: Math.floor(chosen / this.width) };
  }

  recordHistory() {
    const c = this.mode === 'automaton'
      ? { plant: this.automatonGrid.reduce((a, v) => a + (v === 1 ? 1 : 0), 0), herbivore: 0, predator: 0, decomposer: 0 }
      : this.counts();
    this.history.push({ generation: this.generation, ...c });
    if (this.history.length > 240) this.history.shift();
  }

  addBarrier(x, y, type) {
    if (!this.inBounds(x, y)) return;
    this.terrain[this.index(x, y)] = ({ permeable: 1, impermeable: 2, selective: 3 })[type] ?? 2;
    this.terrainRevision++;
  }
  clearBarriers() { this.terrain.fill(0); this.terrainRevision++; }
  setEnvironment(key, value) { if (key in this.global) this.global[key] = Number(value); }
  setMaxPopulation(value) { this.maxPopulation = Math.max(1, Math.min(this.cellCount, Math.floor(Number(value) || this.cellCount))); return this.maxPopulation; }
  capture(id) { const o = this.organisms.get(id); return o ? structuredClone(o) : null; }

  spawnFromSample(sample, count = 1) {
    let made = 0;
    for (let n = 0; n < count && this.organisms.size < this.maxPopulation; n++) {
      const spot = this.findEmpty(sample.x ?? Math.floor(this.width / 2), sample.y ?? Math.floor(this.height / 2), 8) || this.findAnyEmpty();
      if (spot && this.createOrganism(sample.type, spot.x, spot.y, sample.genome, sample)) made++;
      else break;
    }
    return made;
  }

  findAnyEmpty() {
    const start = Math.floor(this.random() * this.cellCount);
    for (let offset = 0; offset < this.cellCount; offset++) {
      const i = (start + offset) % this.cellCount;
      if (this.occupancy[i] !== 0) continue;
      const wall = this.terrain[i];
      if (wall === 2) continue;
      return { x: i % this.width, y: Math.floor(i / this.width) };
    }
    return null;
  }

  geneticVariance() {
    const count = this.organisms.size;
    if (count < 2) return 0;
    const sums = new Float64Array(GENOME_KEYS.length);
    const squares = new Float64Array(GENOME_KEYS.length);
    for (const o of this.organisms.values()) {
      for (let i = 0; i < GENOME_KEYS.length; i++) {
        const value = o.genome[GENOME_KEYS[i]] || 0;
        sums[i] += value; squares[i] += value * value;
      }
    }
    let variance = 0;
    for (let i = 0; i < GENOME_KEYS.length; i++) {
      const mean = sums[i] / count;
      variance += Math.max(0, squares[i] / count - mean * mean);
    }
    return variance / GENOME_KEYS.length;
  }

  serialize() {
    return {
      schema: 'playrig-emergence-world-v2', width: this.width, height: this.height,
      seed: this.seed, generation: this.generation, nextId: this.nextId, mode: this.mode,
      mutationRate: this.mutationRate, mutationStrength: this.mutationStrength,
      maxPopulation: this.maxPopulation, automatonRules: this.automatonRules,
      automatonGrid: Array.from(this.automatonGrid), global: this.global,
      terrain: Array.from(this.terrain), nutrients: Array.from(this.nutrients),
      moisture: Array.from(this.moisture), temperature: Array.from(this.temperature),
      organisms: [...this.organisms.values()], stats: this.stats, history: this.history
    };
  }

  restore(data) {
    if (!data || data.schema !== 'playrig-emergence-world-v2') throw new Error('Unbekanntes Weltformat.');
    this.width = data.width; this.height = data.height; this.cellCount = this.width * this.height;
    this.seed = data.seed; this.generation = data.generation; this.nextId = data.nextId;
    this.mode = data.mode || 'ecosystem'; this.mutationRate = data.mutationRate ?? .02;
    this.mutationStrength = data.mutationStrength ?? .12;
    this.maxPopulation = Math.max(1, Math.min(this.cellCount, data.maxPopulation ?? this.cellCount));
    this.automatonRules = data.automatonRules || { birth: [3], survive: [2, 3], preset: 'conway' };
    this.automatonGrid = Uint8Array.from(data.automatonGrid || new Array(this.cellCount).fill(0));
    this.automatonNext = new Uint8Array(this.cellCount);
    this.global = { ...this.global, ...data.global };
    this.terrain = Uint8Array.from(data.terrain);
    this.nutrients = Float32Array.from(data.nutrients); this.moisture = Float32Array.from(data.moisture);
    this.temperature = Float32Array.from(data.temperature);
    this.organisms = new Map((data.organisms || []).map(o => [o.id, o]));
    this.stats = { ...data.stats }; this.history = data.history || [];
    this.terrainRevision++;
    this._rebuildIndexes();
  }
}
