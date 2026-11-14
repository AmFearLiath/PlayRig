import { importAzgaarFull, createWorldRenderer, getWorldSummary, WORLD_CORE_API_VERSION } from "../../../../_shared/world-editor/core/world-core.js";
const $ = selector => document.querySelector(selector);
const canvas = $("#world-canvas");
let world = null;
let renderer = null;
let toastTimer = null;

function notify(message, error = false) {
  const el = $("#toast");
  el.textContent = message;
  el.style.borderColor = error ? "#9c4c4c" : "";
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 3200);
}
const fmt = value => new Intl.NumberFormat("de-DE").format(value || 0);

function setLoaded(loaded) {
  $("#export-project").disabled = !loaded;
  $("#reset-view").disabled = !loaded;
  $("#world-status").classList.toggle("ready", loaded);
  $("#world-status").innerHTML = loaded ? "<i></i> World Core aktiv" : "<i></i> Kein World-Projekt geladen";
  $("#empty-state").hidden = loaded;
  $("#canvas-legend").hidden = !loaded;
}

function updateOverview() {
  const s = getWorldSummary(world);
  $("#map-title").textContent = world.name;
  $("#overview-name").textContent = world.name;
  $("#overview-seed").textContent = "Seed: " + (world.source.seed || "unbekannt");
  $("#world-stats").innerHTML = [
    [s.cells, "Zellen"], [s.vertices, "Vertices"],
    [s.settlements, "Siedlungen"], [s.states + s.provinces, "Regionen"]
  ].map(item => "<div><strong>" + fmt(item[0]) + "</strong><small>" + item[1] + "</small></div>").join("");
  $("#source-adapter").textContent = world.source.adapter;
  $("#source-version").textContent = world.source.applicationVersion;
  $("#source-date").textContent = world.source.exportedAt ? new Date(world.source.exportedAt).toLocaleString("de-DE") : "—";
  const geo = world.coordinateSystem.geographic;
  $("#source-coords").textContent = geo ? geo.lonW + "° … " + geo.lonE + "° / " + geo.latS + "° … " + geo.latN + "°" : "Quellpixel";
}

function showCell(cell) {
  $("#inspector-empty").hidden = true;
  $("#inspector-content").hidden = false;
  $("#cell-id").textContent = cell.id;
  $("#cell-readout").textContent = "Cell " + cell.id + " · " + cell.biomeName;
  $("#coordinate-readout").textContent = "X: " + cell.center.x.toFixed(1) + " · Y: " + cell.center.y.toFixed(1);
  const details = [
    ["Biome", cell.biomeName], ["Höhe", cell.height.toFixed(2) + " m (Quellwert)"],
    ["Fläche", cell.area.toFixed(2)], ["Terrain", cell.isWater ? "Wasser" : "Land"],
    ["State ID", cell.stateId || "—"], ["Province ID", cell.provinceId || "—"],
    ["Culture ID", cell.cultureId || "—"], ["Religion ID", cell.religionId || "—"],
    ["Settlement ID", cell.burgId || "—"], ["River ID", cell.riverId || "—"],
    ["Population", cell.population.toFixed(3)], ["Nachbarn", cell.neighbors.length]
  ];
  $("#cell-details").innerHTML = details.map(item => "<dt>" + item[0] + "</dt><dd>" + item[1] + "</dd>").join("");
}

async function loadFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".json")) {
    notify("Bitte einen Azgaar Full JSON Export auswählen. Die .map-Datei bleibt das Originalarchiv.", true);
    return;
  }
  try {
    notify("Karte wird geprüft und importiert …");
    const imported = importAzgaarFull(JSON.parse(await file.text()));
    if (renderer) renderer.destroy();
    world = imported;
    renderer = createWorldRenderer(canvas, world);
    setLoaded(true);
    updateOverview();
    $("#inspector-empty").hidden = false;
    $("#inspector-content").hidden = true;
    $("#cell-readout").textContent = "Keine Zelle ausgewählt";
    notify(world.name + " importiert · " + fmt(world.terrain.cells.length) + " Zellen");
  } catch (error) {
    console.error(error);
    notify("Import fehlgeschlagen: " + error.message, true);
  }
}

$("#world-file").addEventListener("change", event => loadFile(event.target.files?.[0]));
const dropzone = $("#dropzone");
dropzone.addEventListener("dragover", event => { event.preventDefault(); dropzone.classList.add("dragover"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", event => { event.preventDefault(); dropzone.classList.remove("dragover"); loadFile(event.dataTransfer.files?.[0]); });
$("#render-mode").addEventListener("change", event => renderer?.setMode(event.target.value));
[
  ["#layer-settlements", "showSettlements"], ["#layer-rivers", "showRivers"],
  ["#layer-routes", "showRoutes"], ["#layer-borders", "showBorders"]
].forEach(([selector, layer]) => $(selector).addEventListener("change", event => renderer?.setLayer(layer, event.target.checked)));
canvas.addEventListener("worldcellselect", event => showCell(event.detail));
$("#reset-view").addEventListener("click", () => renderer?.reset());

$("#export-project").addEventListener("click", () => {
  if (!world) return;
  const payload = { format: "playrig-world-project", version: "1.0.0", world };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = (world.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "world") + "-playrig-project.json";
  anchor.click();
  URL.revokeObjectURL(url);
  notify("World-Projekt inklusive Quelldaten exportiert.");
});
$("#return-hub").addEventListener("click", () => {
  if (window.PlayRig?.navigate) window.PlayRig.navigate("/");
  else window.location.href = "/";
});
window.addEventListener("beforeunload", () => renderer?.destroy());
setLoaded(false);
console.info("PlayRig World Core API " + WORLD_CORE_API_VERSION + " initialized.");
