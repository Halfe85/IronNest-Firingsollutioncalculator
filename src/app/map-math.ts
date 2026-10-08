/** IRON NEST map: columns A–T left to right; rows 1–10 bottom to top.
 * Each major grid square is 1 km and contains 10×10 100 m subcells.
 * Coordinates are treated as points at each subcell's lower-left offset.
 * Game paper map measurements and marker-centering may introduce error.
 */
export interface Point { x: number; y: number; }
export type ObserverId = 'spotter1' | 'spotter2' | 'spotter3';
export type ObservationKind = 'range' | 'bearing' | 'sector' | 'none';
export interface Observation {
  observer: ObserverId;
  kind: ObservationKind;
  value: string;
}
export interface MapPositions { nest: string; spotter1: string; spotter2: string; spotter3: string; }
export type CompassDirection =
  'N'|'NNE'|'NE'|'ENE'|'E'|'ESE'|'SE'|'SSE'|
  'S'|'SSW'|'SW'|'WSW'|'W'|'WNW'|'NW'|'NNW';
export const DIRECTIONS: readonly CompassDirection[] =
  ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
export const COLUMNS = 'ABCDEFGHIJKLMNOPQRST'.split('');
export const ROWS = Array.from({length:10},(_,i)=>10-i);
export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 10;
const EPS = 1e-9;
const RANGE_TOLERANCE_KM = 0.06;
const BEARING_TOLERANCE_DEG = 0.75;

export function parseGrid(text: string): Point | null {
  const match = /^\s*([A-T])\s*(10|[1-9])\s+([0-9])\s*:\s*([0-9])\s*$/i.exec(text);
  if (!match) return null;
  return {
    x: match[1].toUpperCase().charCodeAt(0) - 65 + Number(match[3]) / 10,
    y: Number(match[2]) - 1 + Number(match[4]) / 10
  };
}
export function formatGrid(point: Point): string | null {
  if (!onMap(point)) return null;
  // Round to the nearest 100m cell. Carry rounding across a cell boundary.
  const x = Math.min(199, Math.max(0, Math.round(point.x * 10)));
  const y = Math.min(99, Math.max(0, Math.round(point.y * 10)));
  return `${COLUMNS[Math.floor(x/10)]}${Math.floor(y/10)+1} ${x%10}:${y%10}`;
}
export function onMap(p: Point): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.x >= -EPS && p.x < MAP_WIDTH && p.y >= -EPS && p.y < MAP_HEIGHT;
}
export function distanceKm(a: Point, b: Point): number {
  return Math.hypot(b.x-a.x,b.y-a.y);
}
export function normalizeBearing(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}
export function bearingDegrees(from: Point, to: Point): number {
  return normalizeBearing(Math.atan2(to.x - from.x, to.y - from.y) * 180 / Math.PI);
}
export function compassCenter(direction: string): number | null {
  const key = direction.trim().toUpperCase();
  const index = DIRECTIONS.indexOf(key as CompassDirection);
  return index === -1 ? null : index * 22.5;
}
export function compassFromBearing(degrees: number): CompassDirection {
  return DIRECTIONS[Math.round(normalizeBearing(degrees) / 22.5) % 16];
}
export function angularDifference(a: number,b: number): number {
  return Math.abs(((a-b+540)%360)-180);
}
function cross(a: Point,b: Point): number { return a.x*b.y-a.y*b.x; }
function subtract(a: Point,b: Point): Point {return {x:a.x-b.x,y:a.y-b.y};}
function addScaled(a: Point,d: Point,t: number): Point {return {x:a.x+d.x*t,y:a.y+d.y*t};}
function direction(degrees: number): Point {
  const rad = degrees*Math.PI/180;
  return {x:Math.sin(rad),y:Math.cos(rad)};
}
type Constraint = { observer: ObserverId; kind: 'range'|'bearing'|'sector'; value: number; from: Point };
export interface PlotCandidate {
  position: Point;
  grid: string;
  rangeKm: number;
  bearing: number;
  sector: CompassDirection;
  observationsMatched: number;
}
export interface PlotResult {
  candidates: PlotCandidate[];
  error: string | null;
  validObservations: number;
}

/** Pair of forward azimuth rays. */
export function intersectRays(a: Point, aa: number, b: Point, bb: number): Point[] {
  const u=direction(aa),v=direction(bb), diff=subtract(b,a);
  const det=cross(u,v);
  if (Math.abs(det)<EPS) return [];
  const t=cross(diff,v)/det;
  const s=cross(diff,u)/det;
  return t >= -EPS && s >= -EPS ? [addScaled(a,u,t)] : [];
}
/** Forward bearing ray crossing a range circle: can yield zero, one or two points. */
export function intersectRayCircle(origin: Point, bearing: number, center: Point, radius: number): Point[] {
  if (!(radius>0) || !Number.isFinite(radius)) return [];
  const dir=direction(bearing), rel=subtract(origin,center);
  const projection=rel.x*dir.x+rel.y*dir.y;
  const c=rel.x*rel.x+rel.y*rel.y-radius*radius;
  const discriminant=projection*projection-c;
  if (discriminant < -EPS) return [];
  const root=Math.sqrt(Math.max(0,discriminant));
  return [-projection-root,-projection+root]
    .filter((t,i,values)=>t>=-EPS && (i===0 || Math.abs(t-values[0])>EPS))
    .map(t=>addScaled(origin,dir,t));
}
/** Two exact range circles: can yield zero, one or two points. */
export function intersectCircles(a: Point, ar: number, b: Point, br: number): Point[] {
  const d=distanceKm(a,b);
  if (d<EPS || ar<=0 || br<=0 || d>ar+br+EPS || d<Math.abs(ar-br)-EPS) return [];
  const base=(ar*ar-br*br+d*d)/(2*d);
  const h2=ar*ar-base*base;
  if (h2 < -EPS) return [];
  const ux=(b.x-a.x)/d,uy=(b.y-a.y)/d;
  const center={x:a.x+ux*base,y:a.y+uy*base};
  const height=Math.sqrt(Math.max(0,h2));
  if (height<EPS) return [center];
  return [
    {x:center.x-uy*height,y:center.y+ux*height},
    {x:center.x+uy*height,y:center.y-ux*height}
  ];
}
/** Find all geometrically exact pair intersections and reject candidates failing other spotter reports.
 * Compass reports are sectors (±11.25°), not infinitely accurate point azimuths.
 * Numerical range and bearing reports get small rounding tolerances.
 */
export function triangulate(positions: MapPositions, reports: readonly Observation[]): PlotResult {
  const origins: Partial<Record<ObserverId,Point>> = {
    spotter1:parseGrid(positions.spotter1)??undefined,
    spotter2:parseGrid(positions.spotter2)??undefined,
    spotter3:parseGrid(positions.spotter3)??undefined
  };
  const nest=parseGrid(positions.nest);
  if (!nest || !origins.spotter1 || !origins.spotter2 || !origins.spotter3) {
    return {candidates:[],error:'Check grid coordinates. Example: S9 0:5. Columns A–T, rows 1–10, subcells 0–9.',validObservations:0};
  }
  const constraints:Constraint[]=[];
  for (const report of reports) {
    if (report.kind==='none') continue;
    const from=origins[report.observer];
    if (!from) return {candidates:[],error:'An observation has an unknown spotter.',validObservations:0};
    let value: number;
    if (report.kind==='sector') {
      const center=compassCenter(report.value);
      if (center===null) return {candidates:[],error:'Unknown compass direction. Use N, NNE, NE … SSW etc.',validObservations:0};
      value=center;
    } else {
      if (!report.value.trim()) return {candidates:[],error:'Enter every selected observation value.',validObservations:0};
      value=Number(report.value.trim().replace(',','.'));
      if (!Number.isFinite(value) || (report.kind==='range' && value<=0) ||
        (report.kind==='bearing' && (value<0 || value>360))) {
        return {candidates:[],error:'Distance must be positive; bearing must be from 0° to 360°.',validObservations:0};
      }
    }
    constraints.push({observer:report.observer,from,kind:report.kind,value});
  }
  const numeric=constraints.filter(c=>c.kind!=='sector');
  if (numeric.length<2) {
    return {candidates:[],error:'Need at least two numeric reports (bearing/range) to locate a unique point. Compass sectors narrow the result.',validObservations:constraints.length};
  }
  const raw:Point[]=[];
  for (let i=0;i<numeric.length;i++) for (let j=i+1;j<numeric.length;j++) {
    const a=numeric[i],b=numeric[j];
    if(a.kind==='bearing'&&b.kind==='bearing') raw.push(...intersectRays(a.from,a.value,b.from,b.value));
    else if(a.kind==='bearing'&&b.kind==='range') raw.push(...intersectRayCircle(a.from,a.value,b.from,b.value));
    else if(a.kind==='range'&&b.kind==='bearing') raw.push(...intersectRayCircle(b.from,b.value,a.from,a.value));
    else raw.push(...intersectCircles(a.from,a.value,b.from,b.value));
  }
  const unique:Point[]=[];
  for (const point of raw) {
    if (onMap(point) && !unique.some(old=>distanceKm(old,point)<0.015)) unique.push(point);
  }
  const matches=(point:Point, c:Constraint):boolean=>{
    const bearing=bearingDegrees(c.from,point);
    if(c.kind==='range')return Math.abs(distanceKm(c.from,point)-c.value)<=RANGE_TOLERANCE_KM;
    if(c.kind==='bearing')return angularDifference(bearing,c.value)<=BEARING_TOLERANCE_DEG;
    return angularDifference(bearing,c.value)<=11.25+EPS;
  };
  const candidates=unique.filter(p=>constraints.every(c=>matches(p,c)))
    .map(p=>({
      position:p, grid:formatGrid(p)!,
      rangeKm:distanceKm(nest,p), bearing:bearingDegrees(nest,p),
      sector:compassFromBearing(bearingDegrees(nest,p)),
      observationsMatched:constraints.length
    }))
    .sort((a,b)=>a.rangeKm-b.rangeKm);
  return {
    candidates,
    error:candidates.length?null:'No map intersection matches all reports. Check spotter positions, distance, compass direction and bearing.',
    validObservations:constraints.length
  };
}
