/**
 * PlayRig Settlement Core v0.2.0
 * Renderer-independent settlement project model, local editing history and validation.
 */
export const SETTLEMENT_CORE_API_VERSION = "1.0.0";

const clone = value => JSON.parse(JSON.stringify(value));
const id = prefix => prefix + "-" + Math.random().toString(36).slice(2, 10);
const finite = (v, fallback=0) => Number.isFinite(Number(v)) ? Number(v) : fallback;

export function createSettlementProject(world, burg, options = {}) {
  if (!world || !burg || !Number.isFinite(Number(burg.x)) || !Number.isFinite(Number(burg.y))) {
    throw new Error("Für ein Settlement-Projekt werden eine geladene Welt und eine gültige Siedlung benötigt.");
  }
  const radius = Math.max(90, finite(options.radius, 180));
  const project = {
    schema: "playrig.settlement",
    schemaVersion: "1.0.0",
    id: id("settlement"),
    name: options.name || burg.name || "Neue Siedlung",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    world: {
      id: world.id,
      name: world.name,
      sourceAdapter: world.source?.adapter || "unknown",
      sourceMapId: world.source?.originalMapId ?? null,
      sourceSettlementId: burg.i,
      sourceSettlementName: burg.name || "Unbenannt",
      sourceCoordinates: { x: finite(burg.x), y: finite(burg.y) },
      sourceCellId: burg.cell ?? null,
      sourceStateId: burg.state ?? null,
      sourceCultureId: burg.culture ?? null
    },
    origin: { x: finite(burg.x), y: finite(burg.y) },
    settings: {
      radius,
      form: options.form || "organic",
      profile: options.profile || profileFromBurg(burg),
      density: finite(options.density, .62),
      roadDensity: finite(options.roadDensity, .55),
      districtCount: Math.max(3, Math.min(10, Math.round(finite(options.districtCount, 6)))),
      seed: String(options.seed || (world.source?.seed || "playrig") + "-" + burg.i),
      gridSize: 12,
      showGrid: true,
      showPlots: true,
      showEnvironment: true,
      showLabels: true
    },
    boundary: makeBoundary(radius, options.form || "organic", String(options.seed || burg.i)),
    terrain: { sourceCellIds: [], localEdits: [] },
    districts: [],
    roads: [],
    plots: [],
    buildings: [],
    locations: [],
    environment: [],
    selection: null,
    history: { revision: 0, entries: [] },
    metadata: { generatorVersion: "1.0.0", status: "draft", validation: [] }
  };
  project.terrain = extractLocalTerrain(world, burg, radius, project.boundary);
  return project;
}

/**
 * Build a renderer-independent local terrain snapshot from the imported world.
 * Azgaar coordinates are source-map pixels; every stored point is translated
 * into settlement-local coordinates relative to the selected burg.
 */
function extractLocalTerrain(world, burg, radius, boundary) {
  const origin = { x: finite(burg.x), y: finite(burg.y) };
  const limit = radius * 1.65;
  const worldCells = world.terrain?.cells || [];
  const cellsById = new Map(worldCells.map(cell => [cell.id, cell]));
  const sourceCells = worldCells.filter(cell =>
    cell.center && Math.hypot(cell.center.x - origin.x, cell.center.y - origin.y) <= limit
  );
  const selectedIds = new Set(sourceCells.map(cell => cell.id));
  const cells = sourceCells.map(cell => ({
    id: cell.id,
    center: { x: cell.center.x - origin.x, y: cell.center.y - origin.y },
    polygon: (cell.polygon || []).map(point => ({ x: point.x - origin.x, y: point.y - origin.y })),
    height: finite(cell.height),
    area: finite(cell.area),
    biomeId: cell.biomeId,
    biomeName: cell.biomeName || "Unbekannt",
    biomeColor: validColor(cell.biomeColor) ? cell.biomeColor : null,
    isWater: Boolean(cell.isWater),
    riverId: finite(cell.riverId),
    featureId: finite(cell.featureId),
    stateId: finite(cell.stateId)
  })).filter(cell => cell.polygon.length >= 3);

  const rivers = (world.water?.rivers || []).map(river => {
    const points = (river.cells || [])
      .map(id => cellsById.get(id))
      .filter(cell => cell && selectedIds.has(cell.id))
      .map(cell => ({ x: cell.center.x - origin.x, y: cell.center.y - origin.y }));
    return points.length >= 2 ? {
      id: river.i,
      name: river.name || "",
      width: finite(river.width, 1),
      points
    } : null;
  }).filter(Boolean);

  return {
    coordinateSystem: "settlement-local-source-pixels",
    sourceOrigin: origin,
    sourceCellIds: cells.map(cell => cell.id),
    cells,
    rivers,
    boundary: clone(boundary),
    stats: {
      cellCount: cells.length,
      waterCellCount: cells.filter(cell => cell.isWater).length,
      riverCount: rivers.length
    },
    localEdits: []
  };
}

function validColor(value) {
  return typeof value === "string" && (/^#[0-9a-f]{3,8}$/i.test(value) || /^rgba?\(/i.test(value) || /^hsla?\(/i.test(value));
}

function profileFromBurg(burg) {
  const group = String(burg.group || "town").toLowerCase();
  if (group === "capital" || group === "city") return "city";
  if (group === "fort") return "fortress";
  if (group === "village") return "village";
  return "town";
}

function seeded(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
  };
}

function makeBoundary(radius, form, seed) {
  const rand = seeded(seed);
  const points = [];
  const count = 64;
  for (let i=0;i<count;i++) {
    const a = i / count * Math.PI * 2;
    const wave = form === "radial" ? 1 : form === "grid" ? 1 + Math.sin(a*8)*.035 : .88 + rand()*.18 + Math.sin(a*3)*.05;
    points.push({x:Math.cos(a)*radius*wave,y:Math.sin(a)*radius*wave});
  }
  return { type:"polygon", points, radius, form };
}

export function snapshotProject(project) {
  return clone(project);
}

export function restoreProject(target, snapshot) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, clone(snapshot));
  return target;
}

export function commitHistory(project, label, before) {
  project.history.entries.push({ id:id("change"), label, at:new Date().toISOString(), before });
  if (project.history.entries.length > 80) project.history.entries.shift();
  project.history.revision++;
  project.updatedAt = new Date().toISOString();
}

export function undoProject(project) {
  const entry = project.history.entries.pop();
  if (!entry) return false;
  const history = project.history;
  restoreProject(project, entry.before);
  project.history = history;
  project.history.revision++;
  project.updatedAt = new Date().toISOString();
  return true;
}

export function addSettlementObject(project, collection, object) {
  if (!Array.isArray(project[collection])) throw new Error("Unbekannte Settlement-Ebene: " + collection);
  const item = { id:id(collection.slice(0,3)), status:"modified", locked:false, ...clone(object) };
  project[collection].push(item);
  project.updatedAt = new Date().toISOString();
  return item;
}

export function validateSettlement(project) {
  const issues = [];
  const ids = new Set();
  for (const collection of ["districts","roads","plots","buildings","locations","environment"]) {
    for (const item of project[collection] || []) {
      if (!item.id || ids.has(item.id)) issues.push({severity:"error",code:"duplicate-id",message:"Fehlende oder doppelte Objekt-ID",objectId:item.id||null});
      ids.add(item.id);
      if (item.locked && item.status === "generated") continue;
    }
  }
  const boundary = project.settings.radius;
  for (const building of project.buildings) {
    const d = Math.hypot(building.x, building.y);
    if (d + (building.width || 0) > boundary * 1.12) issues.push({severity:"warning",code:"outside-boundary",message:"Gebäude liegt außerhalb der empfohlenen Siedlungsgrenze",objectId:building.id});
  }
  for (const road of project.roads) {
    if (!Array.isArray(road.points) || road.points.length < 2) issues.push({severity:"error",code:"invalid-road",message:"Straße besitzt keine gültige Liniengeometrie",objectId:road.id});
  }
  if (!project.locations.some(item => item.kind === "central-plaza")) {
    issues.push({severity:"warning",code:"missing-center",message:"Kein zentraler Platz definiert"});
  }
  project.metadata.validation = issues;
  return issues;
}

export function serializeSettlement(project) {
  const output = clone(project);
  output.selection = null;
  output.updatedAt = new Date().toISOString();
  return { format:"playrig-settlement-project", version:"1.0.0", settlement:output };
}
