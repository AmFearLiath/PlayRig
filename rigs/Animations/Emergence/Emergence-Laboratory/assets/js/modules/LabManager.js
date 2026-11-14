import { SPECIES, WorldEngine } from '../core/WorldEngine.js';

/** Manages isolated specimen cultures and controlled return to the world. */
export class LabManager {
  constructor(world) { this.world = world; this.samples = []; this.selectedId = null; this.nextSampleId = 1; this.culture = null; this.conditions = { temperature: 22, food: 70, mutation: 20 }; this.experiments = []; }
  addSample(organism, label = null) {
    if (!organism) return null;
    const sample = { sampleId: this.nextSampleId++, label: label || `${SPECIES[organism.type].label} #${organism.id}`, sourceId: organism.id, sourceGeneration: this.world.generation, type: organism.type, genome: structuredClone(organism.genome), energy: organism.energy, age: organism.age, lineage: organism.lineage, parentId: organism.parentId, createdAt: new Date().toISOString(), result: null };
    this.samples.unshift(sample); this.selectedId = sample.sampleId; this.culture = null; return sample;
  }
  addRandomSample() { const list = [...this.world.organisms.values()]; if (!list.length) return null; return this.addSample(list[Math.floor(this.world.random() * list.length)]); }
  selected() { return this.samples.find(s => s.sampleId === this.selectedId) || null; }
  select(id) { this.selectedId = Number(id); this.culture = null; return this.selected(); }
  duplicate() { const s = this.selected(); if (!s) return null; const copy = structuredClone(s); copy.sampleId = this.nextSampleId++; copy.label += ' · Kopie'; copy.createdAt = new Date().toISOString(); this.samples.unshift(copy); this.selectedId = copy.sampleId; this.culture = null; return copy; }
  mutateSelected(strength = .12) { const s = this.selected(); if (!s) return null; const g = { ...s.genome }, keys = Object.keys(g), key = keys[Math.floor(this.world.random() * keys.length)]; g[key] = Math.max(0, Math.min(1, g[key] + (this.world.random() * 2 - 1) * strength)); s.genome = g; s.label += ' · modifiziert'; return { key, value: g[key] }; }
  runCulture(generations = 25) {
    const s = this.selected(); if (!s) return null;
    const culture = { population: [{ type: s.type, genome: { ...s.genome }, energy: s.energy, age: s.age }], generation: 0, births: 0, deaths: 0, mutations: 0, conditions: { ...this.conditions }, maxPopulation: 1 };
    for (let g = 0; g < generations; g++) {
      const next = [];
      for (const cell of culture.population) {
        const thermalFit = Math.max(0, 1 - Math.abs(this.conditions.temperature - (10 + cell.genome.thermal * 30)) / 55);
        const nutrition = this.conditions.food / 100;
        const energy = cell.energy - .5 + thermalFit * nutrition * (cell.genome.efficiency + .2);
        if (energy <= 0) { culture.deaths++; continue; }
        const survivor = { ...cell, energy, age: cell.age + 1 }; next.push(survivor);
        if (energy > (cell.type === 'predator' ? 3.1 : 2.1) && next.length < 500 && Math.random() < .16 + cell.genome.fertility * .15) {
          const child = { ...survivor, genome: { ...survivor.genome }, age: 0, energy: energy * .55 };
          if (Math.random() < this.conditions.mutation / 1000) { const keys = Object.keys(child.genome), key = keys[Math.floor(Math.random() * keys.length)]; child.genome[key] = Math.max(0, Math.min(1, child.genome[key] + (Math.random() * 2 - 1) * .12)); culture.mutations++; }
          next.push(child); culture.births++;
        }
      }
      culture.population = next; culture.generation++; culture.maxPopulation = Math.max(culture.maxPopulation, next.length);
      if (!next.length) break;
    }
    const average = {}; for (const key of Object.keys(s.genome)) average[key] = culture.population.length ? culture.population.reduce((a, o) => a + o.genome[key], 0) / culture.population.length : s.genome[key];
    culture.averageGenome = average; culture.result = culture.population.length ? 'viable' : 'extinct'; this.culture = culture; s.result = structuredClone(culture); return culture;
  }
  returnToWorld(kind = 'individual') {
    const s = this.selected(); if (!s) return 0;
    const genome = this.culture?.averageGenome || s.genome; const sample = { ...s, genome, x: Math.floor(this.world.width / 2), y: Math.floor(this.world.height / 2) };
    const amount = kind === 'population' ? Math.min(40, Math.max(2, Math.round(Math.sqrt(this.culture?.population.length || 9)))) : 1;
    return this.world.spawnFromSample(sample, amount);
  }
  saveResult() { const s = this.selected(); if (!s || !this.culture) return null; const record = { id: `EXP-${Date.now()}`, sample: structuredClone(s), culture: structuredClone(this.culture), savedAt: new Date().toISOString() }; this.experiments.unshift(record); return record; }
  serialize() { return { samples: this.samples, selectedId: this.selectedId, nextSampleId: this.nextSampleId, experiments: this.experiments }; }
  restore(data) { this.samples = data.samples || []; this.selectedId = data.selectedId ?? null; this.nextSampleId = data.nextSampleId || 1; this.experiments = data.experiments || []; }
}
