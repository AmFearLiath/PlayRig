/**
 * PlayRig Settlement Generator v0.2.0
 * Deterministic, seed-based 2D settlement layout pipeline.
 * Generated objects remain editable and carry provenance metadata.
 */
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
function randomFromSeed(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0),16777619);
  return () => {
    h += 0x6D2B79F5;
    let t=h;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return (((t^(t>>>14))>>>0)/4294967296);
  };
}
const uid = (prefix, n) => prefix + "-" + String(n).padStart(4,"0");
const point = (x,y) => ({x,y});
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

function insideCircle(x,y,r) { return x*x+y*y <= r*r; }
function districtColor(type) {
  return ({
    residential:"#526e79",commercial:"#9b8054",artisan:"#8b6752",
    noble:"#806c9c",religious:"#8d8d72",military:"#795d5d",
    administrative:"#557b8a",harbor:"#4e7d89",arcane:"#705b91",
    agricultural:"#657d55"
  })[type] || "#596b73";
}

function makeDistricts(project, rand) {
  const types=["residential","commercial","artisan","noble","religious","military","administrative","agricultural","arcane","harbor"];
  const count=project.settings.districtCount;
  const radius=project.settings.radius;
  const districts=[];
  for(let i=0;i<count;i++){
    const angle=(i/count)*Math.PI*2 + (rand()-.5)*.22;
    const inner=radius*(i===0?.08:.25+rand()*.1);
    const outer=radius*(.48+rand()*.42);
    const type=i===0?"commercial":types[(i+Math.floor(rand()*types.length))%types.length];
    const start=angle-Math.PI/count*.82, end=angle+Math.PI/count*.82;
    const points=[point(Math.cos(start)*inner,Math.sin(start)*inner)];
    for(let s=0;s<=10;s++){const a=start+(end-start)*s/10;points.push(point(Math.cos(a)*outer,Math.sin(a)*outer));}
    points.push(point(Math.cos(end)*inner,Math.sin(end)*inner));
    districts.push({id:uid("district",i+1),name:type[0].toUpperCase()+type.slice(1)+" Quarter",type,color:districtColor(type),points,priority:i===0?100:50+Math.round(rand()*40),density:clamp(project.settings.density+(rand()-.5)*.25,.15,.95),status:"generated",locked:false});
  }
  return districts;
}

function makeRoads(project, rand) {
  const r=project.settings.radius, roads=[];
  const ringCount=project.settings.form==="linear"?1:2;
  let index=0;
  // Main radial arteries connect the civic center to the outer settlement.
  const spokes=project.settings.form==="grid"?8:Math.max(6,Math.round(6+project.settings.roadDensity*8));
  for(let i=0;i<spokes;i++){
    const a=i/spokes*Math.PI*2+(rand()-.5)*.08;
    const bend=(rand()-.5)*r*.07;
    roads.push({id:uid("road",++index),name:"Main Road "+(i+1),type:"main",width:10,points:[point(0,0),point(Math.cos(a)*r*.32+bend,Math.sin(a)*r*.32),point(Math.cos(a)*r*.68-bend,Math.sin(a)*r*.68),point(Math.cos(a)*r*.96,Math.sin(a)*r*.96)],status:"generated",locked:false});
  }
  for(let ring=0;ring<ringCount;ring++){
    const rr=r*(ring===0?.38:.72),points=[];
    for(let i=0;i<=72;i++){const a=i/72*Math.PI*2;points.push(point(Math.cos(a)*rr,Math.sin(a)*rr));}
    roads.push({id:uid("road",++index),name:ring===0?"Inner Ring":"Outer Ring",type:"secondary",width:ring===0?7:5,points,status:"generated",locked:false});
  }
  const localCount=Math.round(18+project.settings.roadDensity*30);
  for(let i=0;i<localCount;i++){
    const a=rand()*Math.PI*2,rr=r*(.22+rand()*.68);
    if(!insideCircle(Math.cos(a)*rr,Math.sin(a)*rr,r*.94))continue;
    const tangent=a+Math.PI/2, length=r*(.08+rand()*.13);
    const x=Math.cos(a)*rr,y=Math.sin(a)*rr;
    roads.push({id:uid("road",++index),name:"Lane "+index,type:"local",width:2.5+rand()*1.5,points:[point(x-Math.cos(tangent)*length/2,y-Math.sin(tangent)*length/2),point(x+Math.cos(tangent)*length/2,y+Math.sin(tangent)*length/2)],status:"generated",locked:false});
  }
  return roads;
}

function nearestDistrict(districts,x,y) {
  let best=null,score=Infinity;
  for(const d of districts){
    const center=d.points.reduce((a,p)=>({x:a.x+p.x/d.points.length,y:a.y+p.y/d.points.length}),{x:0,y:0});
    const s=distance({x,y},center);
    if(s<score){score=s;best=d;}
  }
  return best;
}

function makePlotsAndBuildings(project, rand, districts) {
  const r=project.settings.radius, density=project.settings.density;
  const plots=[],buildings=[],environment=[];
  const step=clamp(23-density*7,12,24);
  let plotIndex=0, buildingIndex=0, propIndex=0;
  for(let y=-r*.88;y<=r*.88;y+=step){
    for(let x=-r*.88;x<=r*.88;x+=step){
      const px=x+(rand()-.5)*step*.42, py=y+(rand()-.5)*step*.42;
      if(!insideCircle(px,py,r*.9)||Math.hypot(px,py)<r*.12)continue;
      if(rand()>.48+density*.46)continue;
      const district=nearestDistrict(districts,px,py);
      const w=step*(.68+rand()*.3),h=step*(.62+rand()*.34);
      const plot={id:uid("plot",++plotIndex),x:px,y:py,width:w,height:h,rotation:(rand()-.5)*.16,districtId:district.id,status:"generated",locked:false};
      plots.push(plot);
      const type=district.type==="commercial"?(rand()>.55?"shop":"tavern"):district.type==="religious"?"shrine":district.type==="military"?"barracks":district.type==="artisan"?(rand()>.5?"workshop":"smithy"):district.type==="noble"?"manor":district.type==="administrative"?"guildhall":"house";
      buildings.push({id:uid("building",++buildingIndex),name:type[0].toUpperCase()+type.slice(1)+" "+buildingIndex,type,x:px,y:py,width:w*.68,height:h*.7,rotation:plot.rotation,floors:type==="manor"?2:1+Math.floor(rand()*2),districtId:district.id,plotId:plot.id,architecture:"vernacular",palette:"regional",status:"generated",locked:false});
      if(rand()<.32){environment.push({id:uid("prop",++propIndex),type:rand()>.55?"tree":"shrub",x:px+(rand()-.5)*w*1.4,y:py+(rand()-.5)*h*1.4,scale:.7+rand()*.8,rotation:rand()*Math.PI*2,status:"generated",locked:false});}
    }
  }
  return {plots,buildings,environment};
}

function makeLocations(project,rand) {
  const r=project.settings.radius;
  const locations=[
    {id:"location-central-plaza",name:"Market Square",kind:"central-plaza",x:0,y:0,radius:r*.1,importance:100,status:"generated",locked:false},
    {id:"location-landmark",name:project.settings.profile==="fortress"?"Keep":"Town Hall",kind:"landmark",x:r*.18,y:-r*.12,radius:r*.07,importance:90,status:"generated",locked:false}
  ];
  if(project.settings.profile==="harbor"||project.world.sourceSettlementName){locations.push({id:"location-gate",name:"Main Gate",kind:"gate",x:0,y:r*.84,radius:r*.045,importance:65,status:"generated",locked:false});}
  return locations;
}

export function generateSettlement(project, options={}) {
  const seed=String(options.seed ?? project.settings.seed);
  const rand=randomFromSeed(seed);
  const before={districts:project.districts.length,roads:project.roads.length,plots:project.plots.length,buildings:project.buildings.length,locations:project.locations.length,environment:project.environment.length};
  const keepLocked=(list)=>list.filter(item=>item.locked || item.status === "modified");
  const districts=keepLocked(project.districts),roads=keepLocked(project.roads),plots=keepLocked(project.plots),buildings=keepLocked(project.buildings),locations=keepLocked(project.locations),environment=keepLocked(project.environment);
  const nextDistricts=makeDistricts(project,rand);
  const nextRoads=makeRoads(project,rand);
  const next=makePlotsAndBuildings(project,rand,nextDistricts);
  const nextLocations=makeLocations(project,rand);
  project.districts=[...districts,...nextDistricts.filter(item=>!districts.some(old=>old.id===item.id))];
  project.roads=[...roads,...nextRoads.filter(item=>!roads.some(old=>old.id===item.id))];
  project.plots=[...plots,...next.plots.filter(item=>!plots.some(old=>old.id===item.id))];
  project.buildings=[...buildings,...next.buildings.filter(item=>!buildings.some(old=>old.id===item.id))];
  project.locations=[...locations,...nextLocations.filter(item=>!locations.some(old=>old.id===item.id))];
  project.environment=[...environment,...next.environment.filter(item=>!environment.some(old=>old.id===item.id))];
  project.settings.seed=seed;
  project.metadata.generatorVersion="1.0.0";
  project.metadata.lastGeneratedAt=new Date().toISOString();
  project.metadata.generationStats={districts:project.districts.length,roads:project.roads.length,plots:project.plots.length,buildings:project.buildings.length,locations:project.locations.length,environment:project.environment.length};
  return {seed,before,after:project.metadata.generationStats};
}

export function regenerateSettlementLayer(project, layer, options={}) {
  const collections=["districts","roads","plots","buildings","locations","environment"];
  if(!collections.includes(layer)) throw new Error("Unbekannte Settlement-Ebene: "+layer);
  const snapshot={};
  for(const key of collections) snapshot[key]=JSON.parse(JSON.stringify(project[key]||[]));
  const result=generateSettlement(project,options);
  // Only the requested layer is replaced. All other editor layers remain byte-for-byte
  // equivalent to their previous project state; modified/locked objects are retained
  // by generateSettlement inside the layer being regenerated.
  for(const key of collections) if(key!==layer) project[key]=snapshot[key];
  return {layer,regenerated:true,seed:result.seed,count:project[layer].length};
}
