import { WorldEngine, SPECIES } from './core/WorldEngine.js';
import { LabManager } from './modules/LabManager.js';
import { Renderer } from './ui/Renderer.js';
import { WindowManager } from './ui/WindowManager.js';

const $ = id => document.getElementById(id);
const world = new WorldEngine(150, 90, 48271);
world.seedWorld();
const renderer = new Renderer($('world-canvas'), world);
const lab = new LabManager(world);
const windows = new WindowManager();
let running = false, speed = 8, lastFrame = 0, accumulator = 0, selectedTool = 'select', pendingSpawn = null, pendingWall = 'impermeable', brush = 2, pointerDown = false, lastPaint = '', selectedOrganism = null;
let snapshots = [];
const populationChart = $('population-chart').getContext('2d');
const analysisChart = $('analysis-chart').getContext('2d');

function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2300); }
function counts() { return world.counts(); }
function allCount() { return world.mode === 'automaton' ? world.automatonGrid.reduce((a,v)=>a+(v===1?1:0),0) : world.organisms.size; }
function setRunning(value) { running = value; $('play-button').textContent = running ? 'Ⅱ' : '▶'; $('run-state').textContent = running ? 'SIMULATION LÄUFT' : 'PAUSIERT'; $('run-indicator').parentElement.classList.toggle('running', running); }
function updateUI() {
  const c = counts(), pop = allCount();
  $('world-mode-label').textContent = world.mode === 'automaton' ? 'CELLULAR AUTOMATON' : 'ECOSYSTEM SIMULATION';
  $('hud-generation').textContent = String(world.generation).padStart(6, '0'); $('hud-population').textContent = pop.toLocaleString('de-DE'); $('hud-species').textContent = Object.values(c).filter(v => v > 0).length.toLocaleString('de-DE');
  $('count-plants').textContent = c.plant; $('count-herbivores').textContent = c.herbivore; $('count-predators').textContent = c.predator;
  $('eco-plants').textContent = c.plant; $('eco-herbivores').textContent = c.herbivore; $('eco-predators').textContent = c.predator;
  $('evo-generation').textContent = world.generation.toLocaleString('de-DE'); $('evo-mutations').textContent = world.stats.mutations.toLocaleString('de-DE'); $('evo-species').textContent = Object.values(c).filter(v => v > 0).length;
  $('analysis-pop').textContent = pop.toLocaleString('de-DE'); $('analysis-births').textContent = world.stats.births.toLocaleString('de-DE'); $('analysis-deaths').textContent = world.stats.deaths.toLocaleString('de-DE'); $('analysis-variance').textContent = world.geneticVariance().toFixed(3);
  if (selectedOrganism && !world.organisms.has(selectedOrganism.id)) { selectedOrganism = null; world.selectedId = null; renderSelected(); }
  drawChart(populationChart, 480, 140); drawChart(analysisChart, 700, 210); renderer.draw();
}
function drawChart(ctx, width, height) {
  const hist = world.history; ctx.clearRect(0,0,width,height); ctx.fillStyle = '#07131e'; ctx.fillRect(0,0,width,height); ctx.strokeStyle = '#1a3143'; ctx.lineWidth = 1;
  for (let i=1;i<4;i++){const y=height*i/4;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
  if (hist.length < 2) return; const max = Math.max(10,...hist.flatMap(h=>[h.plant,h.herbivore,h.predator]));
  for (const [key,color] of [['plant','#6bdc9b'],['herbivore','#ffc36e'],['predator','#ff7185']]) { ctx.beginPath(); hist.forEach((h,i)=>{const x=i/(hist.length-1)*width,y=height-8-(h[key]/max)*(height-18); if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}); ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke(); }
}
function renderSelected() {
  const box = $('selected-organism'), btn = $('sample-selected');
  if (!selectedOrganism || !world.organisms.has(selectedOrganism.id)) { box.className='empty-state'; box.textContent='Noch kein Organismus ausgewählt.'; btn.disabled=true; $('genome-inspector').innerHTML='<span class="muted">Wähle einen Organismus aus der Welt.</span>'; return; }
  const o = world.organisms.get(selectedOrganism.id); selectedOrganism = o; btn.disabled=false;
  box.className='selected-card'; box.innerHTML = `<strong style="color:${SPECIES[o.type].color}">${SPECIES[o.type].label} #${o.id}</strong><p class="muted">Generation ${o.generation} · Alter ${o.age} · Energie ${o.energy.toFixed(1)} · Linie ${escapeHtml(o.lineage)}</p>`;
  $('selection-info').textContent = `${SPECIES[o.type].label} #${o.id} · Energie ${o.energy.toFixed(1)} · Alter ${o.age}`;
  $('genome-inspector').innerHTML = Object.entries(o.genome).map(([k,v])=>`<div class="gene-row"><span>${geneLabel(k)}</span><span class="gene-track"><i style="width:${Math.round(v*100)}%"></i></span><span class="gene-value">${Math.round(v*100)}%</span></div>`).join('');
  const ancestors = []; let parent = o.parentId, guard=0; while(parent && guard++<8){const p=world.organisms.get(parent); if(!p)break;ancestors.push(p);parent=p.parentId;} $('lineage-list').innerHTML = ancestors.length ? ancestors.map(a=>`<div class="lineage-item">↳ ${SPECIES[a.type].label} #${a.id} · Gen ${a.generation}</div>`).join('') : `<div class="lineage-item">Ursprung / Linie ${escapeHtml(o.lineage)}</div>`;
}
function geneLabel(key) { return ({metabolism:'Stoffwechsel',speed:'Bewegung',defense:'Verteidigung',fertility:'Fortpflanzung',thermal:'Temperaturtoleranz',efficiency:'Effizienz',vision:'Wahrnehmung',adaptability:'Anpassung'})[key] || key; }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function paintAt(clientX,clientY) {
  const {x,y}=renderer.hitTest(clientX,clientY), key=`${x},${y}`; if(key===lastPaint)return; lastPaint=key;
  if(world.mode==='automaton'){if(selectedTool==='draw')world.automatonGrid[world.index(x,y)]=1;else if(selectedTool==='erase')world.automatonGrid[world.index(x,y)]=0;else if(selectedTool==='wall')world.addBarrier(x,y,pendingWall);else {toast('Im Automatenmodus bitte das Zell-Werkzeug verwenden.');}renderer.draw();return;}
  if(selectedTool==='select'){const o=world.getAt(x,y); selectedOrganism=o; world.selectedId=o?.id??null; renderSelected(); renderer.draw(); return;}
  if(selectedTool==='spawn' && pendingSpawn){let n=0;const amount=Math.min(100,Math.max(1,Number($('spawn-amount').value)||1));for(let i=0;i<amount;i++){const spot=world.findEmpty(x,y,Math.max(2,Math.ceil(Math.sqrt(amount))));if(!spot)break;if(world.createOrganism(pendingSpawn,spot.x,spot.y))n++;}toast(`${n} ${SPECIES[pendingSpawn].label}(en) eingesetzt.`);pendingSpawn=null;selectedTool='select';updateToolButtons();updateUI();return;}
  if(selectedTool==='wall'){for(let dy=-brush+1;dy<brush;dy++)for(let dx=-brush+1;dx<brush;dx++){if(dx*dx+dy*dy>brush*brush)continue;world.addBarrier(x+dx,y+dy,pendingWall);}renderer.draw();return;}
  if(selectedTool==='erase'){const o=world.getAt(x,y);if(o)world.removeOrganism(o);else {world.terrain[world.index(x,y)]=0;world.terrainRevision++;}updateUI();return;}
  if(selectedTool==='environment'){for(let dy=-brush+1;dy<brush;dy++)for(let dx=-brush+1;dx<brush;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<world.width&&yy<world.height)world.nutrients[world.index(xx,yy)]=Math.min(1,world.nutrients[world.index(xx,yy)]+.25);}renderer.draw();return;}
}
function updateToolButtons(){document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('selected',b.dataset.tool===selectedTool));}
function renderSamples() {
  const list=$('sample-list'); list.replaceChildren(); if(!lab.samples.length){list.innerHTML='<div class="empty-state">Noch keine Proben vorhanden.</div>';return;}
  for(const s of lab.samples){const row=document.createElement('button');row.className='sample-item'+(s.sampleId===lab.selectedId?' selected':'');row.innerHTML=`<span><b>${escapeHtml(s.label)}</b><small>Quelle #${s.sourceId} · Generation ${s.sourceGeneration}</small></span><span class="sample-tag">${SPECIES[s.type].label.toUpperCase()}</span>`;row.addEventListener('click',()=>{lab.select(s.sampleId);renderSamples();renderLabSelected();});list.append(row);}
}
function renderLabSelected(){const s=lab.selected();const box=$('lab-selected');if(!s){box.className='empty-state';box.textContent='Wähle eine Probe aus dem Archiv.';$('lab-genome-editor').innerHTML='<span class="muted">Genom wird nach Auswahl einer Probe angezeigt.</span>';return;}box.className='lab-result';box.innerHTML=`<strong>${escapeHtml(s.label)}</strong><br>${SPECIES[s.type].label} · Ursprungs-ID ${s.sourceId} · Linie ${escapeHtml(s.lineage)}`;
  $('lab-genome-editor').innerHTML=Object.entries(s.genome).map(([key,value])=>`<div class="genome-edit"><label><span>${geneLabel(key)}</span><output>${Math.round(value*100)}%</output></label><input type="range" min="0" max="100" value="${Math.round(value*100)}" data-gene="${key}"></div>`).join('');
  $('lab-genome-editor').querySelectorAll('[data-gene]').forEach(input=>input.addEventListener('input',()=>{s.genome[input.dataset.gene]=Number(input.value)/100;input.previousElementSibling.querySelector('output').textContent=input.value+'%';}));
  $('return-organism').disabled=false;$('return-population').disabled=false;$('save-sample').disabled=!lab.culture;
}
function renderExperiments(){const list=$('experiment-list');list.replaceChildren();if(!snapshots.length){list.innerHTML='<div class="empty-state">Noch keine Experimente gespeichert.</div>';return;}for(const s of snapshots){const row=document.createElement('div');row.className='experiment-item';row.innerHTML=`<span><b>${escapeHtml(s.name)}</b><small>Generation ${s.world.generation} · ${s.world.organisms.length} Organismen</small></span><button class="footer-action" data-load="${s.id}">Laden</button>`;row.querySelector('button').addEventListener('click',()=>loadSnapshot(s));list.append(row);}}
function makeSnapshot(name){return{id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name,createdAt:new Date().toISOString(),world:world.serialize(),lab:lab.serialize()};}
function saveSnapshot(){const name=$('experiment-name').value.trim()||`Experiment ${snapshots.length+1}`;snapshots.unshift(makeSnapshot(name));persist();renderExperiments();toast('Experiment-Snapshot gespeichert.');}
function syncPopulationLimit(){const input=$('population-limit');input.max=world.cellCount;input.value=Math.min(world.maxPopulation,world.cellCount);$('population-limit-value').textContent=world.maxPopulation.toLocaleString('de-DE');}
function loadSnapshot(s){try{world.restore(s.world);syncPopulationLimit();lab.restore(s.lab||{});selectedOrganism=null;renderSelected();renderSamples();renderLabSelected();updateUI();toast(`„${s.name}“ geladen.`);}catch(e){toast(`Import fehlgeschlagen: ${e.message}`);}}
function persist(){try{localStorage.setItem('playrig-emergence-state',JSON.stringify({world:world.serialize(),lab:lab.serialize(),snapshots}));}catch(e){console.warn('Lokaler Speicher nicht verfügbar',e);}}
function loadLocal(){try{const d=JSON.parse(localStorage.getItem('playrig-emergence-state')||'null');if(d?.world){world.restore(d.world);lab.restore(d.lab||{});snapshots=d.snapshots||[];}}catch(e){console.warn('Lokaler Speicher konnte nicht geladen werden',e);}}
function downloadJson(filename,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}

// Main simulation controls.
$('play-button').addEventListener('click',()=>setRunning(!running));$('step-button').addEventListener('click',()=>{setRunning(false);world.step();updateUI();});$('reset-button').addEventListener('click',()=>{setRunning(false);world.seedWorld();selectedOrganism=null;renderSelected();updateUI();toast('Welt zurückgesetzt.');});$('random-button').addEventListener('click',()=>{setRunning(false);world.seedWorld({plant:500+Math.floor(world.random()*600),herbivore:45+Math.floor(world.random()*90),predator:8+Math.floor(world.random()*25),decomposer:25+Math.floor(world.random()*60)});selectedOrganism=null;renderSelected();updateUI();toast('Neue Ausgangspopulation erzeugt.');});
$('speed-slider').addEventListener('input',e=>{speed=Number(e.target.value);$('speed-value').textContent=`${speed} TPS`;});
syncPopulationLimit();
$('population-limit').addEventListener('input',e=>{const value=world.setMaxPopulation(e.target.value);$('population-limit-value').textContent=value.toLocaleString('de-DE');});$('save-world-button').addEventListener('click',()=>{persist();toast('Welt lokal gespeichert.');});$('export-button').addEventListener('click',()=>downloadJson('emergence-world.json',{format:'playrig-emergence-export',version:2,world:world.serialize(),lab:lab.serialize(),snapshots}));

// Life tools and organism insertion.
document.querySelectorAll('[data-spawn]').forEach(b=>b.addEventListener('click',()=>{pendingSpawn=b.dataset.spawn;selectedTool='spawn';updateToolButtons();toast(`${SPECIES[pendingSpawn].label} ausgewählt – Zielposition in der Welt anklicken.`);}));document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{selectedTool=b.dataset.tool;pendingSpawn=null;updateToolButtons();}));$('brush-size').addEventListener('input',e=>{brush=Number(e.target.value);$('brush-value').textContent=brush;});$('sample-selected').addEventListener('click',()=>{const s=lab.addSample(selectedOrganism);if(s){renderSamples();renderLabSelected();windows.open('laboratory');toast('Probe ins Labor übernommen.');}});
$('world-canvas').addEventListener('pointerdown',e=>{pointerDown=true;lastPaint='';if(e.shiftKey){selectedTool='spawn';pendingSpawn='plant';}paintAt(e.clientX,e.clientY);});$('world-canvas').addEventListener('pointermove',e=>{const p=renderer.hitTest(e.clientX,e.clientY);$('world-coordinates').textContent=`X: ${p.x} / Y: ${p.y}`;if(pointerDown&&selectedTool!=='select')paintAt(e.clientX,e.clientY);});window.addEventListener('pointerup',()=>{pointerDown=false;lastPaint='';});

// Structures.
document.querySelectorAll('[data-wall]').forEach(b=>b.addEventListener('click',()=>{pendingWall=b.dataset.wall;selectedTool='wall';updateToolButtons();toast(`${b.querySelector('b').textContent} ausgewählt – im Feld zeichnen.`);}));$('clear-walls').addEventListener('click',()=>{world.clearBarriers();renderer.draw();toast('Alle Barrieren entfernt.');});

// Environment controls.
const envFields=[['temperature','temperature-value',' °C','temperature'],['light','light-value','%','light'],['water','water-value','%','water'],['nutrient','nutrient-value','%','nutrient'],['toxicity','toxicity-value','%','toxicity']];for(const [id,out,suffix,key] of envFields){$(id).value=world.global[key];$(out).textContent=world.global[key]+suffix;$(id).addEventListener('input',e=>{world.setEnvironment(key,e.target.value);$(out).textContent=e.target.value+suffix;});}$('environment-reset').addEventListener('click',()=>{Object.assign(world.global,{temperature:22,light:75,water:70,nutrient:65,toxicity:0});for(const [id,out,suffix,key] of envFields){$(id).value=world.global[key];$(out).textContent=world.global[key]+suffix;}toast('Umwelt auf Standardwerte gesetzt.');});$('climate-event').addEventListener('click',()=>{world.global.toxicity=Math.min(100,world.global.toxicity+35);world.global.temperature+=12; $('toxicity').value=world.global.toxicity;$('toxicity-value').textContent=world.global.toxicity+'%';$('temperature').value=world.global.temperature;$('temperature-value').textContent=world.global.temperature+' °C';toast('Umweltstress ausgelöst: Temperatur und Toxizität erhöht.');});

// Evolution controls.
$('mutation-rate').addEventListener('input',e=>{world.mutationRate=Number(e.target.value)/1000;$('mutation-value').textContent=(Number(e.target.value)/10).toFixed(1)+'%';});$('mutation-strength').addEventListener('input',e=>{world.mutationStrength=Number(e.target.value)/100;$('mutation-strength-value').textContent=e.target.value+'%';});
$('simulation-mode').addEventListener('change',e=>{setRunning(false);if(e.target.value==='automaton'){world.seedAutomaton(.28);$('automaton-rule-controls').hidden=false;selectedTool='draw';$('automaton-preset').value=world.automatonRules.preset||'conway';$('automaton-birth').value=world.automatonRules.birth.join('');$('automaton-survive').value=world.automatonRules.survive.join('');}else{world.seedWorld();$('automaton-rule-controls').hidden=true;selectedTool='select';}updateToolButtons();selectedOrganism=null;renderSelected();updateUI();});const automatonPresets={conway:{birth:'3',survive:'23'},highlife:{birth:'36',survive:'23'},seeds:{birth:'2',survive:''},daynight:{birth:'3678',survive:'34678'},anneal:{birth:'4678',survive:'35678'},brian:{birth:'2',survive:''},custom:null};$('automaton-preset').addEventListener('change',e=>{const p=automatonPresets[e.target.value];if(p){$('automaton-birth').value=p.birth;$('automaton-survive').value=p.survive;}});$('apply-automaton-rules').addEventListener('click',()=>{const parse=id=>[...new Set($(id).value.replace(/[^0-8]/g,'').split('').filter(Boolean).map(Number))];const preset=$('automaton-preset').value;world.automatonRules={birth:parse('automaton-birth'),survive:parse('automaton-survive'),preset};toast(preset==='brian'?'Brian’s Brain angewendet.':`Regel B${world.automatonRules.birth.join('')} / S${world.automatonRules.survive.join('')} angewendet.`);});

// Laboratory.
$('sample-random').addEventListener('click',()=>{const s=lab.addRandomSample();if(!s){toast('Keine Organismen für eine Probe vorhanden.');return;}renderSamples();renderLabSelected();});$('duplicate-sample').addEventListener('click',()=>{if(!lab.duplicate()){toast('Keine Probe ausgewählt.');return;}renderSamples();renderLabSelected();});
$('lab-temp').addEventListener('input',e=>{$('lab-temp-value').textContent=e.target.value+' °C';lab.conditions.temperature=Number(e.target.value);});$('lab-food').addEventListener('input',e=>{$('lab-food-value').textContent=e.target.value+'%';lab.conditions.food=Number(e.target.value);});$('lab-mutation').addEventListener('input',e=>{$('lab-mutation-value').textContent=(Number(e.target.value)/10).toFixed(1)+'%';lab.conditions.mutation=Number(e.target.value);});
$('lab-mutate').addEventListener('click',()=>{const result=lab.mutateSelected(.2);if(!result){toast('Bitte zuerst eine Probe auswählen.');return;}renderLabSelected();toast(`Mutation: ${geneLabel(result.key)} verändert.`);});$('lab-run').addEventListener('click',()=>{const result=lab.runCulture(25);if(!result){toast('Bitte zuerst eine Probe auswählen.');return;}$('lab-result').innerHTML=`<strong>Versuch abgeschlossen · ${result.result==='viable'?'Population lebensfähig':'Population ausgestorben'}</strong><br>Generationen: ${result.generation} · Population: ${result.population.length} · Geburten: ${result.births} · Todesfälle: ${result.deaths} · Mutationen: ${result.mutations}`;$('save-sample').disabled=false;renderLabSelected();});$('return-organism').addEventListener('click',()=>{const n=lab.returnToWorld('individual');updateUI();toast(n?`${n} Versuchsergebnis in die Welt zurückgeführt.`:'Kein freier Platz in der Welt.');});$('return-population').addEventListener('click',()=>{const n=lab.returnToWorld('population');updateUI();toast(n?`${n} Organismen in die Welt zurückgeführt.`:'Kein freier Platz in der Welt.');});$('save-sample').addEventListener('click',()=>{const r=lab.saveResult();if(r){persist();toast('Laborergebnis dokumentiert.');}});

// Experiments and file import.
$('save-experiment').addEventListener('click',saveSnapshot);$('import-button').addEventListener('click',()=>$('import-file').click());$('import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.format==='playrig-emergence-export'){world.restore(data.world);syncPopulationLimit();lab.restore(data.lab||{});snapshots=data.snapshots||[];}else if(data.id&&data.world){loadSnapshot(data);}else throw new Error('Das JSON enthält keinen unterstützten Emergence-Export.');updateUI();renderSamples();renderLabSelected();renderExperiments();persist();toast('JSON erfolgreich importiert.');}catch(err){toast(`Importfehler: ${err.message}`);}e.target.value='';});$('export-experiments').addEventListener('click',()=>downloadJson('emergence-experiments.json',{format:'playrig-emergence-export',version:2,world:world.serialize(),lab:lab.serialize(),snapshots}));

// Window tabs.
document.querySelectorAll('[data-tabs]').forEach(group=>group.querySelectorAll('[data-tab]').forEach(tab=>tab.addEventListener('click',()=>{group.querySelectorAll('[data-tab]').forEach(t=>t.classList.toggle('selected',t===tab));const win=group.closest('.floating-window');win.querySelectorAll('[data-panel]').forEach(p=>p.classList.toggle('active',p.dataset.panel===tab.dataset.tab));})));

// Animation loop.
let lastUiUpdate = 0, lastRenderTime = 0;
function frame(time){if(!lastFrame)lastFrame=time;const dt=Math.min(.1,(time-lastFrame)/1000);lastFrame=time;let changed=false;if(running){accumulator+=dt*speed;let steps=0;while(accumulator>=1&&steps<12){world.step();accumulator-=1;steps++;changed=true;}if(steps===12&&accumulator>=1)accumulator=Math.min(accumulator,1);}if(changed&&time-lastRenderTime>=33){renderer.draw();lastRenderTime=time;}if(running&&time-lastUiUpdate>=500){updateUI();lastUiUpdate=time;}requestAnimationFrame(frame);}

loadLocal();$('simulation-mode').value=world.mode;$('population-limit').max=world.cellCount;$('population-limit').value=Math.min(world.maxPopulation,world.cellCount);$('population-limit-value').textContent=world.maxPopulation.toLocaleString('de-DE');if(world.mode==='automaton'){$('automaton-rule-controls').hidden=false;$('automaton-preset').value=world.automatonRules.preset||'conway';$('automaton-birth').value=world.automatonRules.birth.join('');$('automaton-survive').value=world.automatonRules.survive.join('');}renderSelected();renderSamples();renderLabSelected();renderExperiments();updateUI();setRunning(false);requestAnimationFrame(frame);
// Optional PlayRig bridge integration: the rig remains fully usable when the shared bridge is absent.
try { window.PlayRig?.register?.({ id: 'emergence-laboratory', version: '2.1.0', capabilities: ['world-simulation','evolution','specimen-lab','json-export'] }); } catch (error) { console.debug('PlayRig bridge unavailable:', error); }
