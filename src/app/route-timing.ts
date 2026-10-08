import {clockSeconds,displayClock,type TrainStop} from './train-math';

/** Determine missing waypoint times from a reported game-clock anchor and constant speed.
 * Distances are measured backwards from the 0 km arrival reference.
 * Never invent an absolute game-clock anchor.
 */
export function fillWaypointTimes(
  stops:readonly TrainStop[],
  speedKmh:number
):{stops:TrainStop[];error:string|null} {
  if(!Number.isFinite(speedKmh)||speedKmh<=0||speedKmh>1000)
    return {stops:stops.map(s=>({...s})),error:'Enter a valid positive speed in km/h.'};
  if(stops.length<2)return {stops:[],error:'At least two waypoints are required.'};
  if(stops.some((s,i)=>!Number.isFinite(s.kmFromStation)||s.kmFromStation<0||
    (i>0&&s.kmFromStation>=stops[i-1].kmFromStation)))
    return {stops:stops.map(s=>({...s})),error:'Distances must decrease toward the reference.'};
  if(stops[stops.length-1].kmFromStation!==0)
    return {stops:stops.map(s=>({...s})),error:'The last waypoint must be 0 km from the reference.'};

  const known=stops.map((s,i)=>({index:i,time:s.time.trim(),seconds:clockSeconds(s.time)}))
    .filter(x=>x.time!=='');
  if(!known.length)return {stops:stops.map(s=>({...s})),
    error:'Enter at least one real game-clock time (e.g. the arrival ETA) before generating others.'};
  if(known.some(x=>x.seconds===null))
    return {stops:stops.map(s=>({...s})),error:'A provided game-clock time is invalid.'};

  // Prefer the closest-to-arrival time as the reference, otherwise any reported waypoint.
  const anchor=known[known.length-1];
  const anchorDistance=stops[anchor.index].kmFromStation;
  const predicted=(distance:number):number=>
    anchor.seconds!-(distance-anchorDistance)*3600/speedKmh;
  const difference=(a:number,b:number):number=>
    Math.abs(((a-b+43200)%86400+86400)%86400-43200);
  // A given time must not be overwritten just because the route-speed hypothesis
  // conflicts with it; leave the operator's measured values untouched.
  for(const input of known){
    const expected=predicted(stops[input.index].kmFromStation);
    if(difference(input.seconds!,expected)>2)
      return {stops:stops.map(s=>({...s})),
        error:'Existing waypoint times disagree with the chosen constant speed by more than 2 seconds. Check the reports or use variable-speed timing.'};
  }
  return {
    stops:stops.map(s=>s.time.trim()?{...s}:{...s,time:displayClock(Math.round(predicted(s.kmFromStation)))}),
    error:null
  };
}
