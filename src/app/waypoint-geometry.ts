import {bearingDegrees,distanceKm,formatGrid,onMap,parseGrid,type Point} from './map-math';
import type {TrainSchedule,TrainStop} from './train-math';

export type WaypointMethod='route'|'manual'|'observed'|'relative';
export type RoutedStop=TrainStop & {
  id?:string;
  method?:WaypointMethod;
  grid?:string; // actual grid for manual or observation
  relativeTo?:string; // "arrival" or another waypoint ID
  relativeBearing?:number;
  relativeKm?:number;
};
export interface WaypointResolution{
  points:(Point|null)[];
  errors:(string|null)[];
  grids:(string|null)[];
}
export function methodOf(s:RoutedStop):WaypointMethod{
  return s.method==='manual'||s.method==='observed'||s.method==='relative'?s.method:'route';
}
export function validBearing(deg:number):boolean {
  return Number.isFinite(deg)&&deg>=0&&deg<=360;
}
export function offsetPoint(origin:Point,bearing:number,km:number,allowOffMap=false):Point|null{
  if(!validBearing(bearing)||!Number.isFinite(km)||km<0)return null;
  const r=bearing*Math.PI/180;
  const p={x:origin.x+Math.sin(r)*km,y:origin.y+Math.cos(r)*km};
  return allowOffMap||onMap(p)?p:null;
}
/**
 * Geometry resolution is separate from the clock. Thus grid markers render even
 * before a player has entered the mission's game times. Relative references
 * are ID based and cycle-checked, so adding/removing a waypoint cannot silently
 * redirect an observation to the wrong waypoint.
 */
export function resolveWaypointPositions(schedule:TrainSchedule):WaypointResolution{
  const steps=schedule.stops as RoutedStop[];
  const n=steps.length;
  const points:Array<Point|null>=Array(n).fill(null);
  const errors:Array<string|null>=Array(n).fill(null);
  const status=Array(n).fill(0);
  const arrival=parseGrid(schedule.stationGrid);
  const map=new Map(steps.map((s,i)=>[s.id,i]));
  const namedReferences=new Map((schedule.references??[]).map(ref=>[ref.id,ref]));
  function getOrigin(sourceId:string,currentIndex:number):{point:Point|null;error:string|null} {
    if(sourceId==='arrival')return {
      point:arrival,error:arrival?null:'Set the arrival / reference grid'
    };
    if(sourceId.startsWith('ref:')){
      const named=namedReferences.get(sourceId.slice(4));
      if(!named)return {point:null,error:'Named reference point not found'};
      const point=parseGrid(named.grid);
      return {point,error:point?null:'Set a valid grid for '+named.name};
    }
    const other=map.get(sourceId);
    if(other===undefined)return {point:null,error:'Referenced waypoint not found'};
    if(other===currentIndex)return {point:null,error:'A waypoint cannot reference itself'};
    const point=locate(other);
    return {point,error:point?null:'Referenced waypoint has no valid position'};
  }
  function locate(index:number):Point|null {
    if(status[index]===2)return points[index];
    if(status[index]===1){errors[index]='Circular waypoint reference';return null;}
    status[index]=1;
    const stop=steps[index];const method=methodOf(stop);
    let p:Point|null=null;
    if(index===n-1){
      p=arrival;
      if(!p)errors[index]='Set the arrival / reference grid';
    }else if(method==='manual'||method==='observed'){
      p=parseGrid(stop.grid??'');
      if(!p)errors[index]='Select a grid for this waypoint';
    }else if(method==='relative'){
      const resolved=getOrigin(stop.relativeTo??'arrival',index);
      if(resolved.point){
        const bearing=stop.relativeBearing??NaN;
        const direction=stop.relativeDirection==='opposite'?'opposite':'bearing';
        p=offsetPoint(resolved.point,direction==='opposite'?(bearing+180)%360:bearing,
          stop.relativeKm??NaN);
        if(!p)errors[index]='Check relative bearing / distance / map boundaries';
      }else errors[index]=resolved.error??'Referenced point has no valid position';
    }else{
      // Legacy route data has no routeReferenceId and thus uses arrival.
      // Selecting another origin requires its OWN geometric offset.
      const source=stop.routeReferenceId??'arrival';
      const resolved=getOrigin(source,index);
      if(!resolved.point)errors[index]=resolved.error??'Reference point is unresolved';
      else{
        const bearing=stop.routeBearing===undefined? schedule.railBearing : (stop.routeBearing??NaN);
        const direction=stop.routeDirection??schedule.approachSide;
        const geometricKm=source==='arrival'
          ?(stop.routeDistanceKm??stop.kmFromStation)
          :stop.routeDistanceKm??NaN;
        if(!validBearing(bearing))errors[index]='Enter this waypoint\'s bearing (0–360°)';
        else if(direction!=='bearing'&&direction!=='opposite')
          errors[index]='Choose this waypoint\'s direction from reference';
        else if(!Number.isFinite(geometricKm)||geometricKm<0)
          errors[index]='Enter a distance from '+(source==='arrival'?'arrival': 'the selected origin');
        else{
          const heading=direction==='opposite'?(bearing+180)%360:bearing;
          // Calculated entry points may initially be outside the chart.
          p=offsetPoint(resolved.point,heading,geometricKm,true);
          if(!p)errors[index]='Invalid distance from selected origin';
        }
      }
    }
    if(status[index]===1){
      points[index]=p;status[index]=2;
      if(p)errors[index]=null;
    }
    return points[index];
  }
  for(let i=0;i<n;i++)locate(i);
  return {points,errors,grids:points.map(p=>p?formatGrid(p):null)};
}
export function routeBearing(from:Point,to:Point):number{
  return bearingDegrees(from,to);
}
export function segmentDistance(from:Point,to:Point):number{
  return distanceKm(from,to);
}
