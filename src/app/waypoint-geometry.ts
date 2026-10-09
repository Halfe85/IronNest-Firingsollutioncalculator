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
export function offsetPoint(origin:Point,bearing:number,km:number):Point|null{
  if(!validBearing(bearing)||!Number.isFinite(km)||km<0)return null;
  const r=bearing*Math.PI/180;
  const p={x:origin.x+Math.sin(r)*km,y:origin.y+Math.cos(r)*km};
  return onMap(p)?p:null;
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
  const railBearing=schedule.approachSide==='opposite'
    ?(schedule.railBearing+180)%360:schedule.railBearing;
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
      const ref=stop.relativeTo??'arrival';
      let origin:Point|null=null;
      if(ref==='arrival'){
        origin=arrival;
      }else{
        const dep=map.get(ref);
        if(dep===undefined)errors[index]='Reference waypoint not found';
        else if(dep===index)errors[index]='A waypoint cannot reference itself';
        else origin=locate(dep);
      }
      if(origin){
        p=offsetPoint(origin,stop.relativeBearing??NaN,stop.relativeKm??NaN);
        if(!p)errors[index]='Check relative bearing / distance / map boundaries';
      }else if(!errors[index]){
        errors[index]='Referenced point has no valid position';
      }
    }else{
      if(!arrival)errors[index]='Set the arrival / reference grid';
      else if(!validBearing(schedule.railBearing))
        errors[index]='Set the route bearing (0–360°)';
      else{
        p=offsetPoint(arrival,railBearing,stop.kmFromStation);
        if(!p)errors[index]='Derived position is outside the map or distance is invalid';
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
