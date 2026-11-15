import { importAzgaarFull, createWorldRenderer, getWorldSummary, WORLD_CORE_API_VERSION } from "../../../../_shared/world-editor/core/world-core.js";
import { createSettlementProject, commitHistory, snapshotProject, undoProject, validateSettlement, serializeSettlement } from "../../../../_shared/world-editor/core/settlement-core.js";
import { generateSettlement } from "../../../../_shared/world-editor/core/settlement-generator.js";

const $ = selector => document.querySelector(selector);
const canvas = $("#world-canvas");
const settlementCanvas = $("#settlement-canvas");
let world=null, renderer=null, project=null, selectedObject=null, activeTool="select", editorView=null, toastTimer=null;
const fmt=value=>new Intl.NumberFormat("de-DE").format(value||0);
const escapeHTML=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const uid=prefix=>prefix+"-"+Math.random().toString(36).slice(2,9);
function lastSavedKey(){try{return localStorage.getItem("playrig.settlement.last");}catch{return null;}}

function notify(message,error=false){
  const el=$("#toast");el.textContent=message;el.style.borderColor=error?"#9c4c4c":"";el.classList.add("visible");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("visible"),3200);
}
function setWorkspaceView(view){
  const allowed=["world","settlement","editor","data"];
  if(!allowed.includes(view))return;
  document.querySelectorAll(".workspace-tab").forEach(button=>{
    const active=button.dataset.view===view;
    button.classList.toggle("active",active);
    button.setAttribute("aria-pressed",String(active));
  });
  document.querySelectorAll("[data-view-panel]").forEach(section=>{
    section.hidden=section.dataset.viewPanel!==view;
  });
  document.querySelector(".workspace")?.setAttribute("data-active-view",view);
}
function setupWorkspaceNavigation(){
  document.querySelectorAll(".workspace-tab").forEach(button=>
    button.addEventListener("click",()=>setWorkspaceView(button.dataset.view))
  );
  document.querySelectorAll(".panel-section").forEach((section,index)=>{
    const heading=section.querySelector(".section-heading");
    if(!heading||section.dataset.collapsible==="false")return;
    const content=document.createElement("div");
    content.className="section-content";
    let node=heading.nextSibling;
    while(node){const next=node.nextSibling;content.append(node);node=next;}
    section.append(content);
    const toggle=document.createElement("button");
    toggle.type="button";
    toggle.className="section-collapse";
    toggle.setAttribute("aria-label","Bereich ein- oder ausklappen");
    toggle.setAttribute("aria-expanded","true");
    toggle.innerHTML='<span aria-hidden="true">⌄</span>';
    heading.append(toggle);
    heading.classList.add("section-toggle");
    toggle.addEventListener("click",event=>{
      event.stopPropagation();
      const collapsed=section.classList.toggle("collapsed");
      toggle.setAttribute("aria-expanded",String(!collapsed));
    });
    // Keep the most relevant work areas open; secondary reference panels start compact.
    if(["World Modules","Source Metadata"].includes(heading.querySelector("h2")?.textContent.trim())){
      section.classList.add("collapsed");
      toggle.setAttribute("aria-expanded","false");
    }
  });
  setWorkspaceView("world");
}
function setLoaded(loaded){
  $("#export-project").disabled=!loaded;$("#reset-view").disabled=!loaded;$("#load-settlement").disabled=!loaded||!lastSavedKey();
  $("#world-status").classList.toggle("ready",loaded);
  $("#world-status").innerHTML=loaded?"<i></i> World Core aktiv":"<i></i> Kein World-Projekt geladen";
  $("#empty-state").hidden=loaded;$("#canvas-legend").hidden=!loaded;
  $("#settlement-select").disabled=!loaded;$("#create-settlement").disabled=!loaded;
}
function updateOverview(){
  const s=getWorldSummary(world);$("#map-title").textContent=world.name;$("#overview-name").textContent=world.name;
  $("#overview-seed").textContent="Seed: "+(world.source.seed||"unbekannt");
  $("#world-stats").innerHTML=[[s.cells,"Zellen"],[s.vertices,"Vertices"],[s.settlements,"Siedlungen"],[s.states+s.provinces,"Regionen"]]
    .map(v=>"<div><strong>"+fmt(v[0])+"</strong><small>"+v[1]+"</small></div>").join("");
  $("#source-adapter").textContent=world.source.adapter;$("#source-version").textContent=world.source.applicationVersion;
  $("#source-date").textContent=world.source.exportedAt?new Date(world.source.exportedAt).toLocaleString("de-DE"):"—";
  const geo=world.coordinateSystem.geographic;
  $("#source-coords").textContent=geo?geo.lonW+"° … "+geo.lonE+"° / "+geo.latS+"° … "+geo.latN+"°":"Quellpixel";
}
function showCell(cell){
  $("#inspector-empty").hidden=true;$("#inspector-content").hidden=false;$("#cell-id").textContent=cell.id;
  $("#cell-readout").textContent="Cell "+cell.id+" · "+cell.biomeName;
  $("#coordinate-readout").textContent="X: "+cell.center.x.toFixed(1)+" · Y: "+cell.center.y.toFixed(1);
  const details=[["Biome",cell.biomeName],["Höhe",cell.height.toFixed(2)+" m (Quellwert)"],["Fläche",cell.area.toFixed(2)],
    ["Terrain",cell.isWater?"Wasser":"Land"],["State ID",cell.stateId||"—"],["Province ID",cell.provinceId||"—"],
    ["Culture ID",cell.cultureId||"—"],["Religion ID",cell.religionId||"—"],["Settlement ID",cell.burgId||"—"],
    ["River ID",cell.riverId||"—"],["Population",cell.population.toFixed(3)],["Nachbarn",cell.neighbors.length]];
  $("#cell-details").innerHTML=details.map(v=>"<dt>"+escapeHTML(v[0])+"</dt><dd>"+escapeHTML(v[1])+"</dd>").join("");
}
function populateSettlements(){
  const burgs=world.settlements.filter(b=>b&&b.i&&Number.isFinite(Number(b.x))&&Number.isFinite(Number(b.y)));
  const select=$("#settlement-select");select.innerHTML='<option value="">Stadt auswählen ('+burgs.length+')</option>';
  const groups={capital:"Hauptstädte",city:"Städte",town:"Ortschaften",village:"Dörfer",fort:"Festungen"};
  const ordered=burgs.slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"de"));
  for(const group of ["capital","city","town","village","fort"]){
    const items=ordered.filter(b=>(b.group||"town")===group);if(!items.length)continue;
    const optgroup=document.createElement("optgroup");optgroup.label=groups[group];
    for(const burg of items){const option=document.createElement("option");option.value=String(burg.i);option.textContent=(burg.name||"Unbenannt")+" · "+burg.group+" · "+fmt(burg.population)+"k";optgroup.append(option);}
    select.append(optgroup);
  }
  select.disabled=false;
}
async function loadFile(file){
  if(!file)return;if(!file.name.toLowerCase().endsWith(".json")){notify("Bitte einen Azgaar Full JSON Export auswählen.",true);return;}
  try{
    notify("Weltkarte wird geprüft und importiert …");
    const imported=importAzgaarFull(JSON.parse(await file.text()));
    renderer?.destroy();world=imported;project=null;renderer=createWorldRenderer(canvas,world);setWorkspaceView("world");
    canvas.hidden=false;settlementCanvas.hidden=true;setLoaded(true);updateOverview();populateSettlements();
    $("#inspector-empty").hidden=false;$("#inspector-content").hidden=true;$("#cell-readout").textContent="Keine Zelle ausgewählt";
    notify(world.name+" importiert · "+fmt(world.terrain.cells.length)+" Zellen · "+fmt(world.settlements.length-1)+" Siedlungen");
  }catch(error){console.error(error);notify("Import fehlgeschlagen: "+error.message,true);}
}
function updateProjectStatus(){
  if(!project)return;
  $("#settlement-status").textContent=project.name+" · "+project.metadata.status;
  $("#settlement-counts").textContent=project.buildings.length+" Gebäude · "+project.roads.length+" Straßen · "+project.districts.length+" Bezirke";
  $("#generate-settlement").disabled=false;$("#save-settlement").disabled=false;$("#load-settlement").disabled=false;$("#undo-settlement").disabled=project.history.entries.length===0;$("#export-settlement").disabled=false;
}
function createProject(){
  const burg=world.settlements.find(b=>b&&String(b.i)===$("#settlement-select").value);
  if(!burg){notify("Bitte zuerst eine Stadt auswählen.",true);return;}
  const radius=Number($("#settlement-radius").value),density=Number($("#settlement-density").value)/100;
  project=createSettlementProject(world,burg,{radius,density,form:$("#settlement-form").value,profile:$("#settlement-profile").value});
  project.settings.roadDensity=.58;
  project.terrain.sourceCellIds=world.terrain.cells.filter(c=>Math.hypot(c.center.x-burg.x,c.center.y-burg.y)<=radius*1.35).map(c=>c.id);
  renderer?.destroy();canvas.hidden=true;settlementCanvas.hidden=false;$("#map-title").textContent=project.name+" · Settlement Editor";
  editorView=createSettlementRenderer(settlementCanvas,project);setWorkspaceView("settlement");updateProjectStatus();updateSettlementInspector(null);
  notify("Settlement-Projekt für "+burg.name+" angelegt. Jetzt generieren oder manuell bearbeiten.");
}
function createSettlementRenderer(target,data){
  const ctx=target.getContext("2d");
  const view={scale:1,zoom:1,panX:0,panY:0,width:0,height:0,drag:null,pan:null,selected:null};
  const radius=Math.max(90,Number(data.settings.radius)||180);
  const terrain=data.terrain||{cells:[],rivers:[]};

  function resize(){
    const rect=target.getBoundingClientRect();
    if(rect.width<2||rect.height<2)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const pixelWidth=Math.max(1,Math.round(rect.width*dpr));
    const pixelHeight=Math.max(1,Math.round(rect.height*dpr));
    if(target.width!==pixelWidth)target.width=pixelWidth;
    if(target.height!==pixelHeight)target.height=pixelHeight;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    view.width=rect.width;view.height=rect.height;
    // Fit the complete extracted terrain patch, not just the settlement boundary.
    view.scale=Math.min(rect.width,rect.height)/(radius*3.5);
    view.panX=0;view.panY=0;view.zoom=1;
    draw();
  }
  function screen(p){
    const scale=view.scale*view.zoom;
    return{x:view.width/2+view.panX+p.x*scale,y:view.height/2+view.panY+p.y*scale};
  }
  function worldAt(x,y){
    const scale=view.scale*view.zoom;
    return{x:(x-view.width/2-view.panX)/scale,y:(y-view.height/2-view.panY)/scale};
  }
  function drawPath(points,close=false){
    if(!points?.length)return;
    ctx.beginPath();
    points.forEach((p,i)=>{const q=screen(p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});
    if(close)ctx.closePath();
  }
  function terrainColor(cell){
    if(cell.isWater)return cell.height<0?"#244d68":"#326783";
    if(cell.biomeColor)return cell.biomeColor;
    const h=Math.max(0,Math.min(100,Number(cell.height)||0));
    const v=Math.round(66+h*1.05);
    return "rgb("+Math.round(v*.72)+","+Math.round(v*.91)+","+Math.round(v*.69)+")";
  }
  function drawTerrain(){
    if(!terrain.cells?.length)return;
    for(const cell of terrain.cells){
      if(!cell.polygon||cell.polygon.length<3)continue;
      drawPath(cell.polygon,true);
      ctx.fillStyle=terrainColor(cell);
      ctx.fill();
      ctx.strokeStyle=cell.isWater?"rgba(139,201,222,.13)":"rgba(9,23,26,.22)";
      ctx.lineWidth=.65;
      ctx.stroke();
    }
    // River centerlines use the same local coordinate system as terrain cells.
    for(const river of terrain.rivers||[]){
      if(river.points?.length<2)continue;
      drawPath(river.points);
      ctx.strokeStyle="rgba(115,203,235,.96)";
      ctx.lineWidth=Math.max(1.3,Math.min(7,(Number(river.width)||1)*3))*view.zoom;
      ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();
    }
  }
  function draw(){
    if(view.width<2||view.height<2)return;
    ctx.clearRect(0,0,view.width,view.height);
    ctx.fillStyle="#0b1720";ctx.fillRect(0,0,view.width,view.height);
    ctx.save();
    // Subtle grid in settlement-local coordinates.
    const grid=data.settings.gridSize*view.scale*view.zoom;
    if(data.settings.showGrid&&grid>7){
      const origin=screen({x:0,y:0});
      ctx.strokeStyle="rgba(120,163,174,.12)";ctx.lineWidth=1;
      for(let x=((origin.x%grid)+grid)%grid;x<view.width;x+=grid){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,view.height);ctx.stroke();}
      for(let y=((origin.y%grid)+grid)%grid;y<view.height;y+=grid){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(view.width,y);ctx.stroke();}
    }
    // The actual imported Azgaar cells are the base layer of the settlement view.
    drawTerrain();

    // Project planning layers are drawn above the original terrain.
    for(const district of data.districts||[]){
      drawPath(district.points,true);ctx.fillStyle=(district.color||"#7b9c8a")+"35";ctx.fill();
      ctx.strokeStyle=district.color||"#7b9c8a";ctx.lineWidth=1.2;ctx.stroke();
    }
    if(data.settings.showPlots)for(const plot of data.plots||[]){
      const p=screen(plot);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(plot.rotation||0);
      ctx.fillStyle="rgba(173,190,187,.08)";ctx.strokeStyle="rgba(144,173,174,.35)";
      ctx.lineWidth=1;ctx.fillRect(-plot.width*view.scale*view.zoom/2,-plot.height*view.scale*view.zoom/2,plot.width*view.scale*view.zoom,plot.height*view.scale*view.zoom);
      ctx.strokeRect(-plot.width*view.scale*view.zoom/2,-plot.height*view.scale*view.zoom/2,plot.width*view.scale*view.zoom,plot.height*view.scale*view.zoom);ctx.restore();
    }
    for(const road of data.roads||[]){
      drawPath(road.points);ctx.strokeStyle=road.type==="main"?"#e2c58e":road.type==="secondary"?"#b8b39b":"#87999a";
      ctx.lineWidth=Math.max(1.2,(Number(road.width)||2)*view.scale*view.zoom);ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();
    }
    for(const location of data.locations||[]){
      const p=screen(location);ctx.beginPath();ctx.arc(p.x,p.y,Math.max(4,(location.radius||12)*view.scale*view.zoom*.25),0,Math.PI*2);
      ctx.fillStyle=location.kind==="central-plaza"?"#e4bd68":"#a58bd1";ctx.fill();ctx.strokeStyle="#f0e4c7";ctx.stroke();
    }
    for(const building of data.buildings||[]){
      const p=screen(building),scale=view.scale*view.zoom;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(building.rotation||0);
      ctx.fillStyle=building.type==="manor"?"#b58c69":building.type==="smithy"?"#9d7560":"#8b9e9c";
      ctx.strokeStyle=building.id===view.selected?"#70e6f2":"#1a252a";ctx.lineWidth=building.id===view.selected?2:1;
      ctx.fillRect(-building.width*scale/2,-building.height*scale/2,building.width*scale,building.height*scale);
      ctx.strokeRect(-building.width*scale/2,-building.height*scale/2,building.width*scale,building.height*scale);ctx.restore();
    }
    if(data.settings.showEnvironment)for(const prop of data.environment||[]){
      const p=screen(prop);ctx.beginPath();ctx.arc(p.x,p.y,Math.max(2,4*(prop.scale||1)*view.scale*view.zoom),0,Math.PI*2);
      ctx.fillStyle=prop.type==="tree"?"#568968":"#769b72";ctx.fill();
    }

    // Settlement boundary and source city marker.
    drawPath(data.boundary.points,true);ctx.fillStyle="rgba(51,91,85,.035)";ctx.fill();
    ctx.strokeStyle="#83d2b6";ctx.lineWidth=2;ctx.setLineDash([8,5]);ctx.stroke();ctx.setLineDash([]);
    const origin=screen({x:0,y:0});
    ctx.beginPath();ctx.arc(origin.x,origin.y,5,0,Math.PI*2);ctx.fillStyle="#ffd477";ctx.fill();
    ctx.strokeStyle="#fff1bd";ctx.lineWidth=1.5;ctx.stroke();
    ctx.beginPath();ctx.moveTo(origin.x-11,origin.y);ctx.lineTo(origin.x+11,origin.y);ctx.moveTo(origin.x,origin.y-11);ctx.lineTo(origin.x,origin.y+11);ctx.stroke();

    ctx.fillStyle="#f0e7d2";ctx.font="600 12px ui-monospace";ctx.textAlign="center";
    ctx.fillText(data.name,origin.x,origin.y-radius*view.scale*view.zoom-13);
    ctx.fillStyle="#a8c1c8";ctx.font="10px ui-monospace";
    ctx.fillText("ORIGINAL TERRAIN · "+(terrain.stats?.cellCount||0)+" CELLS",view.width/2,view.height-14);
    ctx.restore();
  }
  function hitTest(p){
    for(let i=(data.buildings||[]).length-1;i>=0;i--){const b=data.buildings[i];if(Math.abs(p.x-b.x)<=b.width*.65&&Math.abs(p.y-b.y)<=b.height*.65)return b;}
    for(const collection of ["locations","roads","districts","environment"]){
      const items=data[collection]||[];
      for(let i=items.length-1;i>=0;i--){const item=items[i];const x=Number(item.x)||0,y=Number(item.y)||0;if(Math.hypot(p.x-x,p.y-y)<14/view.zoom)return item;}
    }
    return null;
  }

  target.addEventListener("pointerdown",event=>{
    const rect=target.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    if(event.button===1||event.button===2||event.shiftKey){
      view.pan={x,y,lastX:x,lastY:y};target.setPointerCapture(event.pointerId);event.preventDefault();return;
    }
    const p=worldAt(x,y);
    if(activeTool==="select"){
      const hit=hitTest(p);view.selected=hit?.id||null;selectedObject=hit;updateSettlementInspector(hit);
      view.drag=hit&&Number.isFinite(Number(hit.x))&&Number.isFinite(Number(hit.y))?{object:hit,last:p,before:snapshotProject(project),moved:false}:null;
      if(view.drag)target.setPointerCapture(event.pointerId);
      draw();return;
    }
    const before=snapshotProject(project);let item=null;
    if(activeTool==="building")item={name:"New Building",type:"house",x:p.x,y:p.y,width:14,height:12,rotation:0,floors:1,architecture:"vernacular",palette:"regional"};
    if(activeTool==="road")item={name:"New Lane",type:"local",width:3,points:[{x:p.x-18,y:p.y-18},{x:p.x+18,y:p.y+18}]};
    if(activeTool==="tree")item={type:"tree",x:p.x,y:p.y,scale:1,rotation:0};
    if(activeTool==="plaza")item={name:"New Plaza",kind:"public-square",x:p.x,y:p.y,radius:20,importance:50};
    if(activeTool==="erase"){
      const hit=hitTest(p);
      if(hit){for(const key of ["buildings","roads","locations","districts","environment","plots"])project[key]=project[key].filter(object=>object.id!==hit.id);commitHistory(project,"Objekt löschen",before);$("#undo-settlement").disabled=false;}
      draw();updateProjectStatus();return;
    }
    if(item){
      const collection={building:"buildings",road:"roads",tree:"environment",plaza:"locations"}[activeTool];
      item.id=uid(collection.slice(0,3));item.status="modified";item.locked=false;project[collection].push(item);
      commitHistory(project,"Manuell: "+activeTool,before);$("#undo-settlement").disabled=false;
      selectedObject=item;view.selected=item.id;updateSettlementInspector(item);updateProjectStatus();draw();
    }
  });
  target.addEventListener("pointermove",event=>{
    if(view.pan){
      const rect=target.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      view.pan.x+=x-view.pan.lastX;view.pan.y+=y-view.pan.lastY;view.pan.lastX=x;view.pan.lastY=y;draw();return;
    }
    if(!view.drag)return;
    const rect=target.getBoundingClientRect(),p=worldAt(event.clientX-rect.left,event.clientY-rect.top);
    const dx=p.x-view.drag.last.x,dy=p.y-view.drag.last.y;
    if(Math.abs(dx)+Math.abs(dy)>.1)view.drag.moved=true;
    view.drag.object.x+=dx;view.drag.object.y+=dy;view.drag.object.status="modified";view.drag.last=p;draw();
  });
  target.addEventListener("pointerup",()=>{
    if(view.pan){view.pan=null;return;}
    if(!view.drag)return;
    if(view.drag.moved){commitHistory(project,"Objekt verschieben",view.drag.before);$("#undo-settlement").disabled=false;updateProjectStatus();updateSettlementInspector(view.drag.object);}
    view.drag=null;
  });
  target.addEventListener("pointercancel",()=>{view.pan=null;view.drag=null;});
  target.addEventListener("wheel",event=>{
    event.preventDefault();const rect=target.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    const before=worldAt(x,y);view.zoom=Math.max(.35,Math.min(8,view.zoom*(event.deltaY<0?1.12:.89)));
    const scale=view.scale*view.zoom;view.panX=x-view.width/2-before.x*scale;view.panY=y-view.height/2-before.y*scale;draw();
  },{passive:false});
  target.addEventListener("contextmenu",event=>event.preventDefault());

  const observer=new ResizeObserver(resize);observer.observe(target);
  window.addEventListener("resize",resize,{passive:true});requestAnimationFrame(resize);resize();
  return{draw,resize,reset:resize,destroy(){observer.disconnect();window.removeEventListener("resize",resize);}};
}
function updateSettlementInspector(item){
  $("#inspector-empty").hidden=!!item||!!project;$("#inspector-content").hidden=!item;
  if(!project){$("#inspector-empty").hidden=false;$("#inspector-content").hidden=true;return;}
  if(!item){$("#inspector-empty").hidden=false;$("#inspector-empty").textContent="Settlement aktiv. Wähle ein Gebäude oder Objekt im Editor aus.";$("#inspector-content").hidden=true;return;}
  $("#inspector-empty").hidden=true;$("#inspector-content").hidden=false;
  $("#cell-id").textContent=item.id;$("#cell-readout").textContent=item.name||item.type||item.kind||"Settlement-Objekt";
  const rows=[["Typ",item.type||item.kind||"—"],["Name",item.name||"—"],["X",Number(item.x||0).toFixed(1)],["Y",Number(item.y||0).toFixed(1)],["Status",item.status||"modified"],["Gesperrt",item.locked?"Ja":"Nein"],["District",item.districtId||"—"]];
  $("#cell-details").innerHTML=rows.map(v=>"<dt>"+escapeHTML(v[0])+"</dt><dd>"+escapeHTML(v[1])+"</dd>").join("");
}
function generate(){
  if(!project)return;const before=snapshotProject(project);const result=generateSettlement(project);
  commitHistory(project,"Siedlung generieren",before);$("#undo-settlement").disabled=false;project.metadata.status="generated";
  const issues=validateSettlement(project);updateProjectStatus();editorView?.draw();updateSettlementInspector(null);
  setWorkspaceView("editor");notify("Generierung abgeschlossen: "+result.after.buildings+" Gebäude, "+result.after.roads+" Straßen, "+issues.length+" Hinweise.");
}
function saveLocal(){
  if(!project)return;
  try{
    const key="playrig.settlement."+project.id;
    localStorage.setItem(key,JSON.stringify(serializeSettlement(project)));
    localStorage.setItem("playrig.settlement.last",key);
    $("#load-settlement").disabled=false;
    notify("Settlement lokal gespeichert.");
  }catch(error){notify("Lokales Speichern fehlgeschlagen: "+error.message,true);}
}
function loadLocal(){
  try{
    const key=lastSavedKey();
    if(!key){notify("Noch kein lokal gespeichertes Settlement gefunden.",true);return;}
    const saved=JSON.parse(localStorage.getItem(key)||"null");
    if(!saved?.settlement)throw new Error("Ungültiges Settlement-Projekt.");
    if(world&&saved.settlement.world.id!==world.id)throw new Error("Das gespeicherte Projekt gehört zu einer anderen Welt. Bitte zuerst die passende Welt importieren.");
    project=saved.settlement;
    renderer?.destroy();canvas.hidden=true;settlementCanvas.hidden=false;
    $("#map-title").textContent=project.name+" · Settlement Editor";
    editorView=createSettlementRenderer(settlementCanvas,project);
    setWorkspaceView("settlement");updateProjectStatus();updateSettlementInspector(null);
    $("#undo-settlement").disabled=!project.history?.entries?.length;
    notify(project.name+" geladen.");
  }catch(error){notify("Projekt konnte nicht geladen werden: "+error.message,true);}
}
function exportProject(){
  if(!project)return;const blob=new Blob([JSON.stringify(serializeSettlement(project),null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=(project.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")||"settlement")+"-playrig.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify("Settlement-Projekt exportiert.");
}
$("#world-file").addEventListener("change",e=>loadFile(e.target.files?.[0]));
const dropzone=$("#dropzone");dropzone.addEventListener("dragover",e=>{e.preventDefault();dropzone.classList.add("dragover");});
dropzone.addEventListener("dragleave",()=>dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop",e=>{e.preventDefault();dropzone.classList.remove("dragover");loadFile(e.dataTransfer.files?.[0]);});
$("#render-mode").addEventListener("change",e=>renderer?.setMode(e.target.value));
[["#layer-settlements","showSettlements"],["#layer-rivers","showRivers"],["#layer-routes","showRoutes"],["#layer-borders","showBorders"]]
 .forEach(([selector,layer])=>$(selector).addEventListener("change",e=>renderer?.setLayer(layer,e.target.checked)));
canvas.addEventListener("worldcellselect",e=>showCell(e.detail));
$("#reset-view").addEventListener("click",()=>renderer?.reset());
$("#settlement-radius").addEventListener("input",e=>$("#radius-value").textContent=e.target.value);
$("#settlement-density").addEventListener("input",e=>$("#density-value").textContent=e.target.value+"%");
$("#create-settlement").addEventListener("click",createProject);
$("#generate-settlement").addEventListener("click",generate);
$("#save-settlement").addEventListener("click",saveLocal);
$("#load-settlement").addEventListener("click",loadLocal);
$("#undo-settlement").addEventListener("click",()=>{if(project&&undoProject(project)){editorView?.draw();updateProjectStatus();updateSettlementInspector(null);$("#undo-settlement").disabled=!project.history.entries.length;notify("Letzte Änderung rückgängig gemacht.");}});
$("#export-settlement").addEventListener("click",exportProject);
document.querySelectorAll("[data-tool]").forEach(button=>button.addEventListener("click",()=>{
  activeTool=button.dataset.tool;document.querySelectorAll("[data-tool]").forEach(b=>b.classList.toggle("active",b===button));
}));
$("#export-project").addEventListener("click",()=>{
  if(!world)return;const blob=new Blob([JSON.stringify({format:"playrig-world-project",version:"1.0.0",world})],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=(world.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")||"world")+"-playrig-project.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify("World-Projekt inklusive Originalquelle exportiert.");
});
$("#return-hub").addEventListener("click",()=>window.PlayRig?.navigate?window.PlayRig.navigate("/"):(window.location.href="/"));
window.addEventListener("beforeunload",()=>renderer?.destroy());
setupWorkspaceNavigation();
setLoaded(false);
console.info("PlayRig World Core "+WORLD_CORE_API_VERSION+" · Settlement Core initialized.");
