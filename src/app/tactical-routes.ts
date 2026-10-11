import {formatGrid,parseGrid,type Point} from './map-math';
import {resolveWaypointPositions} from './waypoint-geometry';
import {trainPositionAt,type TrainSchedule,type TrainStop,type NamedRouteReference} from './train-math';

export interface TacticalRoute {
  id:string;
  name:string;
  stationGrid:string;
  /** Direct id of an Iron Nest / spotter / resolved reference from the Tactical Map. */
  stationReferenceId:string|null;
  railBearing:string;
  approachSide:'bearing'|'opposite';
  stops:TrainStop[];
  routeSpeed:string;
  targetLabel:string;
  /** Imported legacy references remain available, but new routes use map references. */
  references?:NamedRouteReference[];
}
export interface TacticalRouteOrigin {id:string;name:string;grid:string}
export interface RouteMapSegment {id:string;routeId:string;from:Point;to:Point}
export interface RouteMapMarker {
  id:string;routeId:string;stopId:string;
  name:string;p:Point;grid:string|null;arrival:boolean;
}
export interface TacticalRouteOverlay {
  segments:RouteMapSegment[];
  markers:RouteMapMarker[];
}
export function resolvedArrival(route:TacticalRoute,origins:readonly TacticalRouteOrigin[]):string {
  if(!route.stationReferenceId)return route.stationGrid;
  return origins.find(o=>o.id===route.stationReferenceId)?.grid??'';
}
export function routeSchedule(route:TacticalRoute,
  origins:readonly TacticalRouteOrigin[],nestGrid:string):TrainSchedule {
  const references:NamedRouteReference[]=[
    ...(route.references??[]),
    ...origins.map(o=>({id:o.id,name:o.name,grid:o.grid}))
  ];
  return {
    nestGrid,stationGrid:resolvedArrival(route,origins),
    railBearing:route.railBearing.trim()?Number(route.railBearing.replace(',','.')):NaN,
    approachSide:route.approachSide,
    references,stops:route.stops
  };
}
export function routeGeometry(route:TacticalRoute,origins:readonly TacticalRouteOrigin[],nestGrid:string){
  return resolveWaypointPositions(routeSchedule(route,origins,nestGrid));
}
/** Reuse the existing no-extrapolation timing model for route-based target prediction. */
export function predictRouteAt(route:TacticalRoute,origins:readonly TacticalRouteOrigin[],
  nestGrid:string,impactClock:string){
  return trainPositionAt(routeSchedule(route,origins,nestGrid),impactClock);
}
export function routeOverlay(routes:readonly TacticalRoute[],
  origins:readonly TacticalRouteOrigin[],nestGrid:string):TacticalRouteOverlay {
  const markers:RouteMapMarker[]=[];
  const segments:RouteMapSegment[]=[];
  for(const route of routes){
    const positions=routeGeometry(route,origins,nestGrid);
    for(let i=0;i<route.stops.length;i++){
      const point=positions.points[i],stop=route.stops[i];
      if(point){
        markers.push({id:route.id+':'+stop.id,routeId:route.id,
          stopId:stop.id??'',name:stop.name,p:point,grid:formatGrid(point),
          arrival:i===route.stops.length-1});
      }
      if(i>0 && positions.points[i-1] && point){
        segments.push({id:route.id+':'+i,routeId:route.id,
          from:positions.points[i-1]!,to:point});
      }
    }
  }
  return {segments,markers};
}
export function validTacticalRoute(candidate:unknown):candidate is TacticalRoute {
  if(!candidate||typeof candidate!=='object')return false;
  const r=candidate as Partial<TacticalRoute>;
  return typeof r.id==='string'&&!!r.id&&typeof r.name==='string'&&
    typeof r.stationGrid==='string'&&
    (r.stationReferenceId===null||typeof r.stationReferenceId==='string')&&
    typeof r.railBearing==='string'&&
    (r.approachSide==='bearing'||r.approachSide==='opposite')&&
    Array.isArray(r.stops)&&r.stops.length>=2&&r.stops.length<=12&&
    r.stops.every(s=>s&&typeof s.name==='string'&&typeof s.time==='string'&&
      typeof s.kmFromStation==='number');
}
export function importLegacyRoutes(state:unknown):TacticalRoute[]{
  if(!state||typeof state!=='object')return [];
  const legacy=state as Record<string,unknown>;
  const presets=Array.isArray(legacy['savedRoutes'])?legacy['savedRoutes']:[];
  const candidates:unknown[]=[...presets];
  // Import the current unsaved route only when it has meaningful positions/times.
  if(Array.isArray(legacy['stops'])&&legacy['stops'].some((s:unknown)=>{
    if(!s||typeof s!=='object')return false;
    const v=s as Record<string,unknown>;
    return !!v['time']||!!v['grid'];
  }))candidates.push({...legacy,id:'legacy-current-route'});
  const seen=new Set<string>(),result:TacticalRoute[]=[];
  for(const value of candidates){
    if(!value||typeof value!=='object')continue;
    const item=value as Record<string,unknown>;
    const id=String(item['id']??'');
    const stops=item['stops'];
    if(!id||seen.has(id)||!Array.isArray(stops)||stops.length<2||stops.length>12||
      !stops.every((s:unknown)=>s&&typeof s==='object'&&
        typeof (s as TrainStop).name==='string'&&
        typeof (s as TrainStop).kmFromStation==='number'&&
        typeof (s as TrainStop).time==='string'))continue;
    seen.add(id);
    const referenceList=Array.isArray(item['references'])?
      (item['references'] as NamedRouteReference[]).filter(r=>
        r&&typeof r.id==='string'&&typeof r.name==='string'&&typeof r.grid==='string'):[];
    const route:TacticalRoute={
      id,name:typeof item['name']==='string'?item['name']:
        typeof item['routeName']==='string'?item['routeName']:'Imported route',
      stationGrid:typeof item['stationGrid']==='string'?item['stationGrid']:'',
      stationReferenceId:null,
      railBearing:typeof item['railBearing']==='string'?item['railBearing']:'',
      approachSide:item['approachSide']==='opposite'?'opposite':'bearing',
      stops:stops.map((s:TrainStop,i:number)=>({
        ...s,id:s.id||id+'-stop-'+i
      })),
      routeSpeed:typeof item['routeSpeed']==='string'?item['routeSpeed']:'',
      targetLabel:typeof item['targetLabel']==='string'?item['targetLabel']:'Moving target',
      references:referenceList
    };
    if(validTacticalRoute(route))result.push(route);
  }
  return result.slice(0,25);
}
