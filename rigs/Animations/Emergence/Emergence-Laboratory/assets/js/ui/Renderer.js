import { SPECIES } from '../core/WorldEngine.js';

/** Canvas renderer with cached terrain and batched organism drawing. */
export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.world = world;
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCtx = this.terrainCanvas.getContext('2d');
    this.cachedTerrainRevision = -1;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.dpr = dpr;
    this.cachedTerrainRevision = -1;
    this.draw();
  }

  drawTerrain(cw, ch) {
    const { world, terrainCanvas, terrainCtx: ctx } = this;
    if (this.cachedTerrainRevision === world.terrainRevision && terrainCanvas.width === this.canvas.width && terrainCanvas.height === this.canvas.height) return;
    terrainCanvas.width = this.canvas.width;
    terrainCanvas.height = this.canvas.height;
    ctx.fillStyle = '#030811';
    ctx.fillRect(0, 0, terrainCanvas.width, terrainCanvas.height);
    for (let i = 0; i < world.terrain.length; i++) {
      const type = world.terrain[i];
      if (!type) continue;
      const x = (i % world.width) * cw, y = Math.floor(i / world.width) * ch;
      ctx.fillStyle = type === 1 ? '#24545a' : type === 2 ? '#8295a5' : '#7059a8';
      ctx.fillRect(x, y, Math.ceil(cw), Math.ceil(ch));
      if (type === 1) {
        ctx.strokeStyle = '#5dc5b7'; ctx.globalAlpha = .45;
        ctx.strokeRect(x + .5, y + .5, Math.max(1, cw - 1), Math.max(1, ch - 1));
        ctx.globalAlpha = 1;
      }
    }
    this.cachedTerrainRevision = world.terrainRevision;
  }

  draw() {
    const { ctx, canvas, world } = this;
    if (!canvas.width || !canvas.height) return;
    const cw = canvas.width / world.width, ch = canvas.height / world.height;
    this.drawTerrain(cw, ch);
    ctx.drawImage(this.terrainCanvas, 0, 0);

    if (world.mode === 'automaton') {
      const grid = world.automatonGrid;
      ctx.fillStyle = '#00dff3';
      for (let i = 0; i < grid.length; i++) {
        if (grid[i] !== 1) continue;
        ctx.fillRect((i % world.width) * cw, Math.floor(i / world.width) * ch, Math.ceil(cw), Math.ceil(ch));
      }
      ctx.fillStyle = '#a78bfa';
      for (let i = 0; i < grid.length; i++) {
        if (grid[i] !== 2) continue;
        ctx.fillRect((i % world.width) * cw, Math.floor(i / world.width) * ch, Math.ceil(cw), Math.ceil(ch));
      }
      return;
    }

    // Batch paths by species to avoid per-organism shadow and fill operations.
    const paths = { plant: new Path2D(), herbivore: new Path2D(), predator: new Path2D(), decomposer: new Path2D() };
    for (const o of world.organisms.values()) {
      const path = paths[o.type];
      if (!path) continue;
      const x = o.x * cw + cw / 2, y = o.y * ch + ch / 2;
      const radius = Math.max(1, Math.min(cw, ch) * .38);
      if (o.type === 'predator') {
        path.moveTo(x, y - radius); path.lineTo(x + radius, y); path.lineTo(x, y + radius); path.lineTo(x - radius, y); path.closePath();
      } else {
        path.moveTo(x + radius, y); path.arc(x, y, radius, 0, Math.PI * 2);
      }
    }
    for (const type of ['plant', 'herbivore', 'predator', 'decomposer']) {
      ctx.fillStyle = SPECIES[type].color;
      ctx.fill(paths[type]);
    }

    const selected = world.selectedId ? world.organisms.get(world.selectedId) : null;
    if (selected) {
      const x = (selected.x + .5) * cw, y = (selected.y + .5) * ch;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, this.dpr);
      ctx.beginPath(); ctx.arc(x, y, Math.max(2, Math.min(cw, ch) * .65), 0, Math.PI * 2); ctx.stroke();
    }
  }

  hitTest(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / rect.width * this.world.width);
    const y = Math.floor((clientY - rect.top) / rect.height * this.world.height);
    return { x: Math.max(0, Math.min(this.world.width - 1, x)), y: Math.max(0, Math.min(this.world.height - 1, y)) };
  }
}
