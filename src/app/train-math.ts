import { bearingDegrees, distanceKm, formatGrid, onMap, parseGrid, type Point } from './map-math';
import {resolveWaypointPositions,type RoutedStop} from './waypoint-geometry';

/**
 * Fictional IRON NEST train-mission timing model.
 * Train speed is interpolated from the player's reported game schedule;
 * never infer real projectile physics from these values.
 */
export interface TrainStop {
  name: string;
  kmFromStation: number;
  time: string;
  /** Optional waypoint-specific coordinate source. Missing means legacy route bearing. */
  id?:string;
  method?:'route'|'manual'|'observed'|'relative';
  grid?:string;
  relativeTo?:string;
  relativeBearing?:number;
  relativeKm?:number;
}
export interface TrainSchedule {
  nestGrid: string;
  stationGrid: string;
  railBearing: number;
  approachSide: 'bearing' | 'opposite';
  stops: TrainStop[];
}
export interface TrainPosition {
  position: Point;
  grid: string | null;
  kmFromStation: number;
  bearingFromNest: number;
  rangeKm: number;
  speedKmh: number;
  relativeSeconds: number;
}
export type TrainCalculation =
  { ok: true; result: TrainPosition; speedKmh: number; totalSeconds: number } |
  { ok: false; error: string };

export function clockSeconds(time: string): number | null {
  const match=/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
  if (!match) return null;
  const [h,m,s]=[Number(match[1]),Number(match[2]),Number(match[3]??0)];
  if (h>23||m>59||s>59) return null;
  return h*3600+m*60+s;
}
export function displayClock(seconds: number): string {
  const s=((Math.floor(seconds)%86400)+86400)%86400;
  const pad=(n:number)=>String(n).padStart(2,'0');
  return pad(Math.floor(s/3600))+':'+pad(Math.floor(s%3600/60))+':'+pad(s%60);
}
interface UnwrappedStop extends TrainStop { seconds: number; }
export function validateSchedule(stops: readonly TrainStop[]): {steps: UnwrappedStop[]; error: string|null} {
  if(stops.length<2)return {steps:[],error:'Enter at least a first waypoint and station arrival.'};
  const steps:UnwrappedStop[]=[];
  let dayOffset=0;
  for(let i=0;i<stops.length;i++){
    const stop=stops[i];
    const secs=clockSeconds(stop.time);
    if(secs===null||!Number.isFinite(stop.kmFromStation)||stop.kmFromStation<0)
      return {steps:[],error:'Check waypoint times (HH:mm:ss) and nonnegative distances.'};
    let absolute=secs+dayOffset;
    if(i>0){
      if(absolute<=steps[i-1].seconds){
        dayOffset+=86400;
        absolute+=86400;
      }
      if(absolute<=steps[i-1].seconds||absolute-steps[i-1].seconds>43200)
        return {steps:[],error:'Waypoint times must increase without an unrealistic gap.'};
      if(stop.kmFromStation>=stops[i-1].kmFromStation)
        return {steps:[],error:'Waypoint distances must decrease toward the station.'};
    }
    steps.push({...stop,seconds:absolute});
  }
  if(Math.abs(steps[steps.length-1].kmFromStation)>1e-9)
    return {steps:[],error:'The final waypoint must be the station at 0 km.'};
  return {steps,error:null};
}
/** Interpolate between observations; never extrapolate beyond the recorded timetable. */
export function trainPositionAt(
  config:TrainSchedule,
  impactClock:string
):TrainCalculation {
  const nest=parseGrid(config.nestGrid);
  if(!nest)return {ok:false,error:'Enter a valid Iron Nest grid.'};
  const route=resolveWaypointPositions(config);
  const invalid=route.errors.find(e=>e!==null);
  if(invalid)return {ok:false,error:invalid};
  if(route.points.some(p=>p===null))
    return {ok:false,error:'Every waypoint needs a valid grid or route reference.'};
  const schedule=validateSchedule(config.stops);
  if(schedule.error)return {ok:false,error:schedule.error};
  const steps=schedule.steps;
  const inputTime=clockSeconds(impactClock);
  if(inputTime===null)return {ok:false,error:'Enter a valid impact time (HH:mm:ss).'};
  const beginning=steps[0].seconds;
  const ending=steps[steps.length-1].seconds;
  let impact=inputTime;
  while(impact<beginning)impact+=86400;
  if(impact>ending || impact<beginning)
    return {ok:false,error:'Impact time is outside the train approach window.'};
  let previous=steps[0],next=steps[1];
  for(let i=0;i<steps.length-1;i++){
    if(impact<=steps[i+1].seconds){previous=steps[i];next=steps[i+1];break;}
  }
  const span=next.seconds-previous.seconds;
  const fraction=(impact-previous.seconds)/span;
  const km=previous.kmFromStation+(next.kmFromStation-previous.kmFromStation)*fraction;
  const startPoint=route.points[steps.indexOf(previous)]!;
  const endPoint=route.points[steps.indexOf(next)]!;
  // Follow the segment between the TWO reported waypoint coordinates.
  // This supports bends, manual positions and observed moving targets.
  const point:Point={
    x:startPoint.x+(endPoint.x-startPoint.x)*fraction,
    y:startPoint.y+(endPoint.y-startPoint.y)*fraction
  };
  const totalSeconds=ending-beginning;
  const speedKmh=(steps[0].kmFromStation-steps[steps.length-1].kmFromStation)*3600/totalSeconds;
  const segmentSpeed=(previous.kmFromStation-next.kmFromStation)*3600/span;
  return {ok:true,result:{
    position:point,grid:onMap(point)?formatGrid(point):null,kmFromStation:km,
    bearingFromNest:bearingDegrees(nest,point),
    rangeKm:distanceKm(nest,point),
    speedKmh:segmentSpeed,
    relativeSeconds:impact-beginning
  },speedKmh,totalSeconds};
}
export function waypointSpeeds(stops:readonly TrainStop[]): number[]|null {
  const validated=validateSchedule(stops);
  if(validated.error)return null;
  return validated.steps.slice(1).map((v,i)=>
    (validated.steps[i].kmFromStation-v.kmFromStation)*3600/(v.seconds-validated.steps[i].seconds)
  );
}
