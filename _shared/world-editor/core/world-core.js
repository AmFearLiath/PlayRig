/**
 * PlayRig World Editor — World Core v0.1.0
 * Azgaar Full JSON adapter and shared world model.
 */
export const WORLD_CORE_API_VERSION = "1.0.0";

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const point = value => ({ x: number(value?.[0]), y: number(value?.[1]) });

export function importAzgaarFull(input) {
  const source = typeof input === "string" ? JSON.parse(input) : input;
  if (!source?.pack?.cells || !source?.pack?.vertices) {
    throw new Error("Ungültiger Azgaar Full JSON Export: pack.cells oder pack.vertices fehlt.");
  }

  const pack = source.pack;
  const vertices = pack.vertices.map((vertex, index) => ({
    id: number(vertex.i, index), ...point(vertex.p)
  }));
  const biomes = (pack.biomes || []).map(item => ({ ...item }));
  const biomeMap = new Map(biomes.map(item => [number(item.i), item]));
  const cells = pack.cells.map((cell, index) => {
    const biome = biomeMap.get(number(cell.biome));
    return {
      id: number(cell.i, index),
      center: point(cell.p),
      polygon: (cell.v || []).map(id => vertices[id]).filter(Boolean).map(v => ({ x: v.x, y: v.y })),
      vertexIds: (cell.v || []).slice(),
      neighbors: (cell.c || []).slice(),
      height: number(cell.h),
      area: number(cell.area),
      type: number(cell.t),
      featureId: number(cell.f),
      biomeId: number(cell.biome),
      biomeName: biome?.name || "Unbekannt",
      biomeColor: biome?.color || null,
      cultureId: number(cell.culture),
      stateId: number(cell.state),
      provinceId: number(cell.province),
      religionId: number(cell.religion),
      burgId: number(cell.burg),
      riverId: number(cell.r),
      population: number(cell.pop),
      isWater: number(cell.h) <= 0 || number(cell.t) < 0,
      source: cell
    };
  });

  const list = key => Array.isArray(pack[key]) ? pack[key].filter(item => item && typeof item === "object") : [];
  const info = source.info || {};
  const mapOptions = source.settings?.options?.map || {};
  const width = number(info.width, number(mapOptions.graph?.width, 1920));
  const height = number(info.height, number(mapOptions.graph?.height, 1080));

  return {
    schema: "playrig.world",
    schemaVersion: "1.0.0",
    id: "world-" + String(info.mapId || info.seed || Date.now()),
    name: info.mapName || source.settings?.mapName || "Imported World",
    dimensions: { width, height },
    coordinateSystem: {
      type: "source-pixel",
      origin: "top-left",
      units: "azgaar-map-units",
      geographic: source.mapCoordinates || null
    },
    source: {
      adapter: "azgaar-full-json",
      adapterVersion: "1.0.0",
      applicationVersion: info.version || "unknown",
      exportedAt: info.exportedAt || null,
      seed: String(info.seed || ""),
      originalMapId: info.mapId ?? null,
      raw: source
    },
    terrain: { vertices, cells, biomes, features: list("features") },
    water: {
      rivers: list("rivers"),
      lakes: list("features").filter(item => item.type === "lake"),
      coastlines: []
    },
    regions: {
      cultures: list("cultures"), states: list("states"),
      provinces: list("provinces"), religions: list("religions"),
      zones: list("zones")
    },
    settlements: list("burgs"),
    routes: list("routes"),
    locations: list("markers"),
    resources: { goods: list("goods"), markets: list("markets") },
    grid: source.grid || null,
    metadata: {
      importedAt: new Date().toISOString(),
      sourceFormat: "Azgaar Fantasy Map Generator — Full JSON",
      cellCount: cells.length,
      vertexCount: vertices.length,
      biomeCount: biomes.length
    }
  };
}

export function getWorldSummary(world) {
  return {
    cells: world.terrain.cells.length,
    vertices: world.terrain.vertices.length,
    biomes: world.terrain.biomes.length,
    cultures: world.regions.cultures.length,
    states: world.regions.states.length,
    provinces: world.regions.provinces.length,
    settlements: world.settlements.length,
    rivers: world.water.rivers.length,
    routes: world.routes.length,
    markers: world.locations.length
  };
}

export function createWorldRenderer(canvas, world) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const state = {
    zoom: 1, x: 0, y: 0, fit: 1, mode: "biome",
    showSettlements: true, showRivers: true, showRoutes: false,
    showBorders: true, selected: null, dragging: false
  };
  const w = world.dimensions.width;
  const h = world.dimensions.height;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.fit = Math.min(rect.width / w, rect.height / h) * .96;
    state.x = (rect.width - w * state.fit) / 2;
    state.y = (rect.height - h * state.fit) / 2;
    draw();
  }

  function fillFor(cell) {
    if (cell.isWater) return cell.height < 0 ? "#102c45" : "#173b55";
    if (state.mode === "political") {
      return cell.stateId ? "hsl(" + ((cell.stateId * 47) % 360) + " 38% 34%)" : "#35483f";
    }
    if (state.mode === "height") {
      const v = Math.max(0, Math.min(1, cell.height / 100));
      const c = Math.round(62 + v * 150);
      return "rgb(" + Math.round(c * .72) + "," + Math.round(c * .88) + "," + Math.round(c * .68) + ")";
    }
    return cell.biomeColor || "#596b55";
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#09121b";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(state.x, state.y);
    ctx.scale(state.fit * state.zoom, state.fit * state.zoom);

    for (const cell of world.terrain.cells) {
      if (cell.polygon.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(cell.polygon[0].x, cell.polygon[0].y);
      for (let i = 1; i < cell.polygon.length; i++) ctx.lineTo(cell.polygon[i].x, cell.polygon[i].y);
      ctx.closePath();
      ctx.fillStyle = fillFor(cell);
      ctx.fill();
      if (state.showBorders && cell.stateId) {
        ctx.strokeStyle = "rgba(8,15,20,.25)";
        ctx.lineWidth = .65 / (state.fit * state.zoom);
        ctx.stroke();
      }
      if (state.selected === cell.id) {
        ctx.fillStyle = "rgba(71,196,231,.22)";
        ctx.fill();
        ctx.strokeStyle = "#5ddcff";
        ctx.lineWidth = 2.4 / (state.fit * state.zoom);
        ctx.stroke();
      }
    }

    if (state.showRoutes) {
      for (const route of world.routes) {
        if (!Array.isArray(route.points) || route.points.length < 2) continue;
        ctx.beginPath();
        route.points.forEach((p, i) => i ? ctx.lineTo(number(p[0]), number(p[1])) : ctx.moveTo(number(p[0]), number(p[1])));
        ctx.strokeStyle = "rgba(222,190,130,.78)";
        ctx.lineWidth = 1.8 / (state.fit * state.zoom);
        ctx.stroke();
      }
    }

    if (state.showRivers) {
      for (const river of world.water.rivers) {
        const cells = (river.cells || []).map(id => world.terrain.cells[id]).filter(Boolean);
        if (cells.length < 2) continue;
        ctx.beginPath();
        cells.forEach((cell, i) => i ? ctx.lineTo(cell.center.x, cell.center.y) : ctx.moveTo(cell.center.x, cell.center.y));
        ctx.strokeStyle = "rgba(80,183,220,.9)";
        ctx.lineWidth = Math.max(.8, number(river.width, 1) * 1.8) / (state.fit * state.zoom);
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }

    if (state.showSettlements) {
      for (const burg of world.settlements) {
        ctx.beginPath();
        ctx.arc(number(burg.x), number(burg.y), burg.capital ? 4.1 : 2.3, 0, Math.PI * 2);
        ctx.fillStyle = burg.capital ? "#f3c86a" : "#f2e8d0";
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function worldAt(x, y) {
    const scale = state.fit * state.zoom;
    return { x: (x - state.x) / scale, y: (y - state.y) / scale };
  }

  function selectAt(x, y) {
    const p = worldAt(x, y);
    let found = null, best = Infinity;
    for (const cell of world.terrain.cells) {
      const dx = cell.center.x - p.x, dy = cell.center.y - p.y;
      const distance = dx * dx + dy * dy;
      if (distance < best) { best = distance; found = cell; }
    }
    if (found) {
      state.selected = found.id;
      draw();
      canvas.dispatchEvent(new CustomEvent("worldcellselect", { detail: found }));
    }
  }

  canvas.addEventListener("pointerdown", event => {
    state.dragging = true;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.moved = false;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    if (!state.dragging) return;
    const dx = event.clientX - state.lastX, dy = event.clientY - state.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) state.moved = true;
    state.x += dx; state.y += dy;
    state.lastX = event.clientX; state.lastY = event.clientY;
    if (state.moved) draw();
  });
  canvas.addEventListener("pointerup", event => {
    if (!state.moved) {
      const rect = canvas.getBoundingClientRect();
      selectAt(event.clientX - rect.left, event.clientY - rect.top);
    }
    state.dragging = false;
  });
  canvas.addEventListener("pointercancel", () => state.dragging = false);
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left, py = event.clientY - rect.top;
    const before = worldAt(px, py);
    state.zoom = Math.max(.45, Math.min(12, state.zoom * (event.deltaY < 0 ? 1.12 : .89)));
    const scale = state.fit * state.zoom;
    state.x = px - before.x * scale;
    state.y = py - before.y * scale;
    draw();
  }, { passive: false });

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  return {
    draw,
    setMode(value) { state.mode = value; draw(); },
    setLayer(key, value) { state[key] = Boolean(value); draw(); },
    reset() { state.zoom = 1; resize(); },
    destroy() { observer.disconnect(); }
  };
}
