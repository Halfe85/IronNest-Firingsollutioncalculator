import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, effect, signal } from '@angular/core';
import { COLUMNS, ROWS, parseGrid } from './map-math';
import {SHELLS} from './firing';
import {fillWaypointTimes} from './route-timing';
import {type Cannon,cannonOrUnassigned,normalizeShell} from './shot-options';
import { calculateFireTime, elevationAt, estimatedFlightSeconds, selectCharge } from './firing';
import {
  clockSeconds, trainPositionAt, validateSchedule, waypointSpeeds,
  type TrainSchedule, type TrainStop
} from './train-math';

const STORAGE_KEY='iron-nest-train-v2';
const LEGACY_KEY='iron-nest-train-v1';
export interface RouteReference { id:string;name:string;grid:string; }
export interface MovingFireRequest {
  bearing:number;distanceKm:number;target:string;impactClock:string;
  flightSeconds:string;grid:string|null;shell:string;cannon:Cannon;
}
interface SavedRoute {
  id:string;name:string;nestGrid:string;stationGrid:string;
  railBearing:string;approachSide:'bearing'|'opposite';
  stops:TrainStop[];targetLabel:string;shell:string;cannon:Cannon;routeSpeed?:string;
}
const DEFAULT_STOPS:TrainStop[]=[
  {name:'Waypoint A',kmFromStation:6,time:'10:06:50'},
  {name:'Waypoint B',kmFromStation:4,time:'10:10:10'},
  {name:'Waypoint C',kmFromStation:2,time:'10:13:30'},
  {name:'MainStation',kmFromStation:0,time:'10:16:50'}
];
const MAP_LEFT=54,MAP_TOP=37,CELL=46;

@Component({
  selector:'app-train-tracker',
  standalone:true,
  imports:[CommonModule],
  templateUrl:'./train-tracker.html',
  styleUrl:'./train-tracker.css'
})
export class TrainTrackerComponent {
  @Input() availableReferences:readonly RouteReference[]=[];
  @Input() currentNestGrid:string|null=null;
  @Output() useSolution=new EventEmitter<MovingFireRequest>();
  readonly columns=COLUMNS;
  readonly rows=ROWS;
  readonly nestGrid=signal('C2 5:6');
  readonly stationGrid=signal('J6 0:4');
  readonly railBearing=signal('90');
  readonly approachSide=signal<'bearing'|'opposite'>('bearing');
  readonly stops=signal<TrainStop[]>(DEFAULT_STOPS.map(s=>({...s})));
  readonly impactMode=signal('1');
  readonly customImpactClock=signal('10:11:50');
  readonly flightSeconds=signal('');
  readonly targetLabel=signal('Enemy troop train');
  readonly routeName=signal('Valle de Mula');
  readonly routeSpeed=signal('36');
  readonly routeTemplate=signal<'rail'|'landing'|'custom'>('rail');
  readonly selectedSource=signal('');
  readonly routeMapOpen=signal(false);
  readonly shellOptions=SHELLS;
  readonly shell=signal('HCHE');
  readonly cannon=signal<Cannon>('left');
  readonly savedRoutes=signal<SavedRoute[]>([]);
  readonly referenceLabel=computed(()=>this.availableReferences.find(r=>r.id===this.selectedSource())?.name??'Custom map reference');
  readonly notice=signal('');
  readonly config=computed<TrainSchedule>(()=>({
    nestGrid:this.nestGrid(),
    stationGrid:this.stationGrid(),
    railBearing:Number(this.railBearing().trim().replace(',','.')),
    approachSide:this.approachSide(),
    stops:this.stops()
  }));
  readonly checked=computed(()=>validateSchedule(this.stops()));
  readonly segmentSpeeds=computed(()=>waypointSpeeds(this.stops()));
  readonly selectedImpact=computed(()=>{
    const mode=this.impactMode();
    if(mode==='custom')return this.customImpactClock();
    const index=Number(mode);
    return this.stops()[index]?.time??'';
  });
  readonly calculated=computed(()=>trainPositionAt(this.config(),this.selectedImpact()));
  readonly firing=computed(()=>{
    const answer=this.calculated();
    if(!answer.ok)return null;
    const charge=selectCharge(answer.result.rangeKm,'manual',
      Math.ceil(answer.result.rangeKm/5),45,[]);
    if(charge===null)return null;
    return {charge,elevation:elevationAt(answer.result.rangeKm,charge)!};
  });
  readonly estimatedFlight = computed<number | null>(() => {
    const calc=this.calculated();
    const fire=this.firing();
    return calc.ok && fire ? estimatedFlightSeconds(calc.result.rangeKm,fire.charge):null;
  });
  readonly flightIsMeasured = computed(()=>this.flightSeconds().trim()!=='');
  readonly effectiveFlight = computed<number | null>(() => {
    if(!this.flightIsMeasured())return this.estimatedFlight();
    const manual=Number(this.flightSeconds().trim().replace(',','.'));
    return Number.isFinite(manual)&&manual>=0&&manual<=3600?manual:null;
  });
  readonly launchTime=computed(()=>{
    const flight=this.effectiveFlight();
    return flight===null?null:calculateFireTime(this.selectedImpact(),flight);
  });
  readonly clockError=computed(()=>{
    if(!this.flightIsMeasured())return '';
    return this.launchTime()?'':'Flight time must be 0–3600 seconds, and impact time must be valid.';
  });
  readonly mapStops=computed(()=>this.stops().map(s=>{
    const configuration={...this.config()};
    const outcome=trainPositionAt(configuration,s.time);
    return {name:s.name,report:outcome.ok?outcome.result:null};
  }));
  readonly nestPosition=computed(()=>parseGrid(this.nestGrid()));
  readonly stationPosition=computed(()=>parseGrid(this.stationGrid()));
  readonly routeEnd=computed(()=>{
    const points=this.mapStops().map(r=>r.report).filter(p=>!!p);
    return points[0]?.position??null;
  });
  constructor(){
    this.restore();
    effect(()=>{
      try{localStorage.setItem(STORAGE_KEY,JSON.stringify({
        nestGrid:this.nestGrid(),stationGrid:this.stationGrid(),
        railBearing:this.railBearing(),approachSide:this.approachSide(),
        stops:this.stops(),impactMode:this.impactMode(),
        customImpactClock:this.customImpactClock(),flightSeconds:this.flightSeconds(),
        targetLabel:this.targetLabel(),routeName:this.routeName(),routeSpeed:this.routeSpeed(),
        routeTemplate:this.routeTemplate(),selectedSource:this.selectedSource(),
        shell:this.shell(),cannon:this.cannon(),savedRoutes:this.savedRoutes()
      }));}catch{ /* storage disabled */ }
    });
  }
  private restore():void{
    try{
      const state=JSON.parse(localStorage.getItem(STORAGE_KEY)??localStorage.getItem(LEGACY_KEY)??'null') as
        Partial<{nestGrid:string;stationGrid:string;railBearing:string;
          approachSide:'bearing'|'opposite';stops:TrainStop[];
          impactMode:string;customImpactClock:string;flightSeconds:string;
          targetLabel:string;routeName:string;routeSpeed:string;routeTemplate:'rail'|'landing'|'custom';
          selectedSource:string;shell:string;cannon:Cannon;savedRoutes:SavedRoute[];}>|null;
      if(!state)return;
      if(typeof state.nestGrid==='string')this.nestGrid.set(state.nestGrid);
      if(typeof state.stationGrid==='string')this.stationGrid.set(state.stationGrid);
      if(typeof state.railBearing==='string')this.railBearing.set(state.railBearing);
      if(state.approachSide==='bearing'||state.approachSide==='opposite')
        this.approachSide.set(state.approachSide);
      if(Array.isArray(state.stops)&&state.stops.length>=2&&state.stops.length<=12&&
        state.stops.every(s=>s&&typeof s.name==='string'&&
          typeof s.time==='string'&&typeof s.kmFromStation==='number'))
        this.stops.set(state.stops);
      if(typeof state.impactMode==='string')this.impactMode.set(state.impactMode);
      if(typeof state.customImpactClock==='string')this.customImpactClock.set(state.customImpactClock);
      if(typeof state.flightSeconds==='string')this.flightSeconds.set(state.flightSeconds);
      if(typeof state.targetLabel==='string')this.targetLabel.set(state.targetLabel.slice(0,50));
      if(typeof state.routeName==='string')this.routeName.set(state.routeName.slice(0,60));
      if(typeof state.routeSpeed==='string')this.routeSpeed.set(state.routeSpeed);
      if(['rail','landing','custom'].includes(state.routeTemplate??''))
        this.routeTemplate.set(state.routeTemplate!);
      if(typeof state.selectedSource==='string')this.selectedSource.set(state.selectedSource);
      if(typeof state.shell==='string')this.shell.set(normalizeShell(state.shell));
      if(state.cannon==='left'||state.cannon==='right')this.cannon.set(state.cannon);
      if(Array.isArray(state.savedRoutes))this.savedRoutes.set(state.savedRoutes.filter(r=>
        r&&typeof r.id==='string'&&typeof r.name==='string'&&
        typeof r.nestGrid==='string'&&typeof r.stationGrid==='string'&&
        Array.isArray(r.stops)&&r.stops.length>=2&&r.stops.length<=12
      ).slice(0,25));
    }catch{ /* bad state ignored */ }
  }
  x(x:number):number{return MAP_LEFT+x*CELL;}
  y(y:number):number{return MAP_TOP+(10-y)*CELL;}
  setStopTime(index:number,value:string):void{
    this.stops.update(items=>items.map((s,i)=>i===index?{...s,time:value}:s));
  }
  setStopDistance(index:number,value:string):void{
    const n=Number(value.trim().replace(',','.'));
    this.stops.update(items=>items.map((s,i)=>i===index?{...s,kmFromStation:value.trim()===''?NaN:n}:s));
  }
  setStopName(index:number,value:string):void{
    this.stops.update(items=>items.map((s,i)=>i===index?{...s,name:value.slice(0,30)}:s));
  }
  resetExample():void{
    this.nestGrid.set('C2 5:6');
    this.stationGrid.set('J6 0:4');
    this.railBearing.set('90');
    this.approachSide.set('bearing');
    this.stops.set(DEFAULT_STOPS.map(s=>({...s})));
    this.impactMode.set('1');
    this.customImpactClock.set('10:11:50');
    this.flightSeconds.set('');
    this.targetLabel.set('Enemy troop train');
    this.routeName.set('Valle de Mula');
    this.routeSpeed.set('36');
    this.routeTemplate.set('rail');
    this.shell.set('HCHE');
    this.cannon.set('left');
    this.selectedSource.set('');
    this.notice.set('Valle de Mula train mission restored.');
  }
  setShell(value:string):void{if(SHELLS.some(s=>s===value))this.shell.set(value);}
  setCannon(value:string):void{const c=cannonOrUnassigned(value);if(c)this.cannon.set(c);}
  importReference(id:string):void{
    this.selectedSource.set(id);
    const from=this.availableReferences.find(r=>r.id===id);
    if(!from)return;
    this.stationGrid.set(from.grid);
    if(this.currentNestGrid)this.nestGrid.set(this.currentNestGrid);
    this.notice.set('Reference '+from.name+' copied from Normal Plotting.');
  }
  useCurrentNest():void{
    if(!this.currentNestGrid)return;
    this.nestGrid.set(this.currentNestGrid);
    this.notice.set('Iron Nest position synced from Normal Plotting.');
  }
  openRouteMap():void{this.routeMapOpen.set(true);}
  closeRouteMap():void{this.routeMapOpen.set(false);}
  newRoute():void{
    this.routeName.set('New route');this.routeSpeed.set('');this.routeTemplate.set('custom');
    this.stationGrid.set('');this.railBearing.set('0');this.approachSide.set('bearing');
    this.stops.set([{name:'Waypoint A',kmFromStation:5,time:''},
      {name:'Arrival reference',kmFromStation:0,time:''}]);
    this.targetLabel.set('Moving target');this.selectedSource.set('');
    this.impactMode.set('custom');this.customImpactClock.set('');
    this.flightSeconds.set('');
    if(this.currentNestGrid)this.nestGrid.set(this.currentNestGrid);
    this.notice.set('Create waypoints with distances and game times.');
  }
  loadLandingTemplate():void{
    this.newRoute();
    this.routeName.set('High Tide • landing craft');
    this.routeTemplate.set('landing');
    this.routeSpeed.set('36');
    this.railBearing.set('0');
    this.stops.set([
      {name:'5 km from landing',kmFromStation:5,time:''},
      {name:'3 km from landing',kmFromStation:3,time:''},
      {name:'1 km from landing',kmFromStation:1,time:''},
      {name:'Landing',kmFromStation:0,time:''}
    ]);
    this.targetLabel.set('Landing craft');
    this.notice.set('High Tide: 36 km/h player-reported speed, southbound travel. Fill in the actual coordinates and clock times for this craft. Bearing FROM the landing reference to the approach line is 000°.');
  }
  selectTemplate(value:string):void{
    if(value==='rail')this.resetExample();
    else if(value==='landing')this.loadLandingTemplate();
    else this.newRoute();
  }
  saveRoute():void{
    const id=typeof crypto!=='undefined'&&'randomUUID' in crypto?
      crypto.randomUUID():String(Date.now());
    const route:SavedRoute={
      id,name:this.routeName().trim().slice(0,60)||'Route',
      nestGrid:this.nestGrid(),stationGrid:this.stationGrid(),
      railBearing:this.railBearing(),approachSide:this.approachSide(),
      stops:this.stops().map(s=>({...s})),targetLabel:this.targetLabel(),
      shell:this.shell(),cannon:this.cannon()
    };
    this.savedRoutes.update(items=>[route,...items].slice(0,25));
    this.notice.set('Saved route on this device.');
  }
  restoreRoute(id:string):void{
    const r=this.savedRoutes().find(v=>v.id===id);if(!r)return;
    this.routeName.set(r.name);this.nestGrid.set(r.nestGrid);
    this.stationGrid.set(r.stationGrid);this.railBearing.set(r.railBearing);
    this.approachSide.set(r.approachSide);this.stops.set(r.stops.map(s=>({...s})));
    this.targetLabel.set(r.targetLabel);this.shell.set(normalizeShell(r.shell));
    this.cannon.set(cannonOrUnassigned(r.cannon)??'left');
    this.routeSpeed.set(r.routeSpeed??'');
    this.impactMode.set('custom');this.selectedSource.set('');
    this.notice.set('Route restored: '+r.name);
  }
  deleteRoute(id:string):void{this.savedRoutes.update(items=>items.filter(v=>v.id!==id));}
  calculateWaypointTimes():void {
    const speed=Number(this.routeSpeed().trim().replace(',','.'));
    const plan=fillWaypointTimes(this.stops(),speed);
    if(plan.error){this.notice.set(plan.error);return;}
    this.stops.set(plan.stops);
    this.impactMode.set(String(this.stops().length-1));
    this.notice.set('Missing waypoint clocks filled from the reported game time and constant speed.');
  }
  addWaypoint():void{
    const s=this.stops();
    if(s.length>=12){this.notice.set('Maximum 11 approach waypoints and one station.');return;}
    const last=s[s.length-2];
    const arrival=s[s.length-1];
    const gap=(last.kmFromStation-arrival.kmFromStation)/2;
    const t1=clockSeconds(last.time),t2=clockSeconds(arrival.time);
    const nextTime=t1!==null&&t2!==null?this.clock(Math.round((t1+t2+(t2<t1?86400:0))/2)):'';
    this.stops.update(items=>[...items.slice(0,-1),{
      name:'Waypoint '+(items.length),kmFromStation:arrival.kmFromStation+gap,time:nextTime
    },items[items.length-1]]);
    this.impactMode.set('custom');
  }
  removeWaypoint(index:number):void{
    if(index===this.stops().length-1||this.stops().length<=2)return;
    this.stops.update(items=>items.filter((_,i)=>i!==index));
    this.impactMode.set('custom');
  }
  private clock(seconds:number):string{
    const s=((seconds%86400)+86400)%86400;
    const p=(n:number)=>String(n).padStart(2,'0');
    return p(Math.floor(s/3600))+':'+p(Math.floor(s%3600/60))+':'+p(s%60);
  }
  transfer():void{
    const calc=this.calculated();
    if(!calc.ok||!this.firing())return;
    this.useSolution.emit({
      bearing:Math.round(calc.result.bearingFromNest*100)/100,
      distanceKm:Math.round(calc.result.rangeKm*10000)/10000,
      target:this.targetLabel().trim()||'Train interception',
      impactClock:this.selectedImpact(),
      flightSeconds:this.flightSeconds().trim(),
      grid:calc.result.grid,shell:this.shell(),cannon:this.cannon()
    });
  }
}
