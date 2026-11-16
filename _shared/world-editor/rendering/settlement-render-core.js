/**
 * PlayRig Settlement Render Core v1.0.0
 * Renderer-independent geometry analysis and camera transforms.
 * Coordinates are settlement-local source pixels (X right, Y down).
 */
export const SETTLEMENT_RENDER_API_VERSION = "1.0.0";

const finite = value => Number.isFinite(Number(value));
const point = p => p && finite(p.x) && finite(p.y);

export function analyzeSettlementScene(project) {
  const terrain = project?.terrain || {};
  const cells = Array.isArray(terrain.cells) ? terrain.cells : [];
  const valid = [], invalid = [], vertices = [];
  let waterCells = 0, landCells = 0, duplicateVertices = 0, nonFiniteVertices = 0;
  for (const cell of cells) {
    const polygon = Array.isArray(cell.polygon) ? cell.polygon : [];
    let bad = polygon.length < 3 || polygon.some(p => !point(p));
    const seen = new Set();
    for (const p of polygon) {
      if (!point(p)) { nonFiniteVertices++; continue; }
      const key = Number(p.x).toFixed(4) + "," + Number(p.y).toFixed(4);
      if (seen.has(key)) duplicateVertices++;
      seen.add(key); vertices.push({x:Number(p.x),y:Number(p.y)});
    }
    if (bad) invalid.push({id:cell.id,reason:polygon.length<3?"less-than-3-vertices":"non-finite-coordinate"});
    else { valid.push(cell); cell.isWater ? waterCells++ : landCells++; }
  }
  const bounds = boundsOf(vertices);
  const riverPoints = (terrain.rivers || []).flatMap(r => Array.isArray(r.points) ? r.points.filter(point).map(p=>({x:Number(p.x),y:Number(p.y)})) : []);
  const allPoints = vertices.concat(riverPoints);
  const sceneBounds = boundsOf(allPoints);
  const width = bounds ? bounds.maxX - bounds.minX : 0;
  const height = bounds ? bounds.maxY - bounds.minY : 0;
  return {
    version: SETTLEMENT_RENDER_API_VERSION,
    counts:{cells:cells.length,validCells:valid.length,invalidCells:invalid.length,vertices:vertices.length,
      waterCells,landCells,rivers:(terrain.rivers||[]).length,riverVertices:riverPoints.length,
      duplicateVertices,nonFiniteVertices},
    terrainBounds:bounds,sceneBounds,
    dimensions:{width,height,aspectRatio:height>0?width/height:null},
    warnings:[
      ...(cells.length===0?["Keine Terrainzellen im Settlement-Projekt vorhanden."]:[]),
      ...(invalid.length? [invalid.length+" ungültige Zellpolygone erkannt."]:[]),
      ...(duplicateVertices? [duplicateVertices+" doppelte Polygonpunkte erkannt."]:[]),
      ...(bounds && (width===0||height===0)?["Terrain besitzt keine zweidimensionale Ausdehnung."]:[]),
      ...(!bounds?["Keine gültigen Polygonkoordinaten gefunden."]:[])
    ],
    invalidSamples:invalid.slice(0,30)
  };
}

export function boundsOf(points) {
  if (!points?.length) return null;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,count=0;
  for (const p of points) {
    if (!point(p)) continue;
    const x=Number(p.x),y=Number(p.y);
    minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);count++;
  }
  return count?{minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY,centerX:(minX+maxX)/2,centerY:(minY+maxY)/2,pointCount:count}:null;
}

/** Camera uses actual scene bounds, not an assumed settlement radius. */
export function createSettlementCamera() {
  return {baseScale:1,zoom:1,panX:0,panY:0,width:0,height:0,bounds:null};
}

export function fitSettlementCamera(camera, bounds, width, height, padding=48) {
  camera.width=Math.max(0,width);camera.height=Math.max(0,height);camera.bounds=bounds;
  if (!bounds || width<2 || height<2 || bounds.width<=0 || bounds.height<=0) {
    camera.baseScale=1;camera.panX=0;camera.panY=0;camera.zoom=1;return camera;
  }
  const usableWidth=Math.max(1,width-padding*2),usableHeight=Math.max(1,height-padding*2);
  camera.baseScale=Math.min(usableWidth/bounds.width,usableHeight/bounds.height);
  camera.zoom=1;
  camera.panX=0;camera.panY=0;
  return camera;
}

export function worldToScreen(camera,p) {
  const scale=camera.baseScale*camera.zoom;
  return {x:camera.width/2+camera.panX+(p.x-(camera.bounds?.centerX||0))*scale,
          y:camera.height/2+camera.panY+(p.y-(camera.bounds?.centerY||0))*scale};
}

export function screenToWorld(camera,x,y) {
  const scale=camera.baseScale*camera.zoom;
  if (!scale) return {x:0,y:0};
  return {x:(x-camera.width/2-camera.panX)/scale+(camera.bounds?.centerX||0),
          y:(y-camera.height/2-camera.panY)/scale+(camera.bounds?.centerY||0)};
}

export function zoomCameraAt(camera,x,y,factor,min=.15,max=12) {
  const anchor=screenToWorld(camera,x,y);
  camera.zoom=Math.max(min,Math.min(max,camera.zoom*factor));
  const scale=camera.baseScale*camera.zoom;
  camera.panX=x-camera.width/2-(anchor.x-(camera.bounds?.centerX||0))*scale;
  camera.panY=y-camera.height/2-(anchor.y-(camera.bounds?.centerY||0))*scale;
  return camera;
}

export function buildSettlementRenderDiagnostics(project,canvas,viewport,camera,scene) {
  const rect=el=>{const r=el?.getBoundingClientRect?.();return r?{x:+r.x.toFixed(2),y:+r.y.toFixed(2),width:+r.width.toFixed(2),height:+r.height.toFixed(2)}:null;};
  const style=el=>{if(!el)return null;const s=getComputedStyle(el);return{display:s.display,visibility:s.visibility,position:s.position,overflow:s.overflow};};
  return {
    generatedAt:new Date().toISOString(),apiVersion:SETTLEMENT_RENDER_API_VERSION,
    project:project?{id:project.id,name:project.name,origin:project.origin,coordinateSystem:project.terrain?.coordinateSystem}:null,
    geometry:scene,
    viewport:{rect:rect(viewport),style:style(viewport)},
    canvas:{rect:rect(canvas),style:style(canvas),hidden:canvas?.hidden,backingWidth:canvas?.width,backingHeight:canvas?.height,
      devicePixelRatio:window.devicePixelRatio||1},
    camera:{...camera},
    browser:{innerWidth:window.innerWidth,innerHeight:window.innerHeight,userAgent:navigator.userAgent}
  };
}
