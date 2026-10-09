import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, effect, signal } from '@angular/core';
import { COLUMNS, ROWS, parseGrid, formatGrid } from './map-math';
import {methodOf,resolveWaypointPositions,type WaypointMethod,type RoutedStop} from './waypoint-geometry';
import {EMPTY_GRID,gridInputFromText,gridInputLabel,type GridInput} from './graph-math';
import {GridSelectComponent} from './grid-select';
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
export interface MovingFireRequest {
  bearing:number;distanceKm:number;target:string;impactClock:string;
  flightSeconds:string;grid:string|null;nestGrid:string;shell:string;cannon:Cannon;
}
interface SavedRoute {
  id:string;name:string;nestGrid:string;stationGrid:string;
  railBearing:string;approachSide:'bearing'|'opposite';
  stops:TrainStop[];targetLabel:string;shell:string;cannon:Cannon;routeSpeed?:string;
}
const EMPTY_STOPS:TrainStop[]=[
  {id:'start',name:'Waypoint A',kmFromStation:5,time:'',method:'route'},
  {id:'arrival',name:'Arrival',kmFromStation:0,time:'',method:'route'}
];
const MAP_LEFT=54,MAP_TOP=37,CELL=46;

@Component({
  selector:'app-train-tracker',
  standalone:true,
  imports:[CommonModule,GridSelectComponent],
  templateUrl:'./train-tracker.html',
  styleUrl:'./train-tracker.css'
})
export class TrainTrackerComponent {
  private observationNestGrid:string|null=null;
  @Input() set currentNestGrid(value:string|null){
    // Observation owns Iron Nest's coordinate. Synchronize automatically when it changes.
    this.observationNestGrid=value&&gridInputFromText(value)?value:null;
    if(this.observationNestGrid)this.nestGrid.set(this.observationNestGrid);
  }
  get currentNestGrid():string|null{return this.observationNestGrid;}
  @Output() nestGridChange=new EventEmitter<GridInput>();
  @Output() useSolution=new EventEmitter<MovingFireRequest>();
  readonly columns=COLUMNS;
  readonly rows=ROWS;
  readonly nestGrid=signal('');
  readonly stationGrid=signal('');
  readonly nestGridSelection=computed<GridInput>(()=>
    gridInputFromText(this.nestGrid())??{...EMPTY_GRID});
  readonly referenceGridSelection=computed<GridInput>(()=>
    gridInputFromText(this.stationGrid())??{...EMPTY_GRID});
  readonly railBearing=signal('');
  readonly approachSide=signal<'bearing'|'opposite'>('bearing');
  readonly stops=signal<TrainStop[]>(EMPTY_STOPS.map(s=>({...s})));
  readonly impactMode=signal('custom');
  readonly customImpactClock=signal('');
  readonly flightSeconds=signal('');
  readonly targetLabel=signal('Moving target');
  readonly routeName=signal('Route');
  readonly routeSpeed=signal('');
  readonly routeMapOpen=signal(false);
  readonly editingStopId=signal<string|null>('start');
  readonly activeWaypointIndex=computed(()=>
    this.stops().findIndex(s=>s.id===this.editingStopId()));
  readonly activeWaypoint=computed<RoutedStop|null>(()=>this.stops()[this.activeWaypointIndex()]??null);
  readonly activeMethod=computed<WaypointMethod>(()=>
    this.activeWaypoint()?methodOf(this.activeWaypoint()!):'route');
  readonly activeGridSelection=computed<GridInput>(()=>
    gridInputFromText(this.activeWaypoint()?.grid??'')??{...EMPTY_GRID});
  readonly waypointGeometry=computed(()=>resolveWaypointPositions(this.config()));
  readonly waypointEntries=computed(()=>this.stops().map((stop,i)=>({
    stop,index:i,grid:this.waypointGeometry().grids[i],
    error:this.waypointGeometry().errors[i],
    method:methodOf(stop)
  })));
  readonly routeSegments=computed(()=>{
    const ps=this.waypointGeometry().points;
    return ps.slice(0,-1).flatMap((p,i)=>p&&ps[i+1]?[{from:p,to:ps[i+1]!}]:[]);
  });
  readonly relativeSources=computed(()=>
    this.stops().slice(0,-1).filter(s=>s.id!==this.editingStopId()));
  readonly activeIsArrival=computed(()=>
    this.activeWaypointIndex()===this.stops().length-1);
  readonly shellOptions=SHELLS;
  readonly shell=signal('HCHE');
  readonly cannon=signal<Cannon>('left');
  readonly savedRoutes=signal<SavedRoute[]>([]);
  readonly notice=signal('');
  readonly config=computed<TrainSchedule>(()=>({
    nestGrid:this.nestGrid(),
    stationGrid:this.stationGrid(),
    railBearing:this.railBearing().trim()===''?NaN:Number(this.railBearing().trim().replace(',','.')),
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
  readonly mapStops=computed(()=>this.stops().map((stop,i)=>{
    const position=this.waypointGeometry().points[i];
    return {name:stop.name,position,grid:this.waypointGeometry().grids[i],
      method:methodOf(stop)};
  }));
  readonly nestPosition=computed(()=>parseGrid(this.nestGrid()));
  readonly stationPosition=computed(()=>parseGrid(this.stationGrid()));
  private id(prefix='wp'):string {
    return prefix+'-'+(typeof crypto!=='undefined'&&'randomUUID' in crypto?
      crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2));
  }
  private normalizeStops(stops:readonly TrainStop[]):RoutedStop[]{
    return stops.map((item,i)=>{
      const wp=item as RoutedStop;
      return {...wp,id:typeof wp.id==='string'&&wp.id?wp.id:'legacy-'+i,
        method:methodOf(wp)};
    });
  }
  constructor(){
    this.restore();
    effect(()=>{
      try{localStorage.setItem(STORAGE_KEY,JSON.stringify({
        nestGrid:this.nestGrid(),stationGrid:this.stationGrid(),
        railBearing:this.railBearing(),approachSide:this.approachSide(),
        stops:this.stops(),impactMode:this.impactMode(),
        customImpactClock:this.customImpactClock(),flightSeconds:this.flightSeconds(),
        targetLabel:this.targetLabel(),routeName:this.routeName(),routeSpeed:this.routeSpeed(),
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
          targetLabel:string;routeName:string;routeSpeed:string;
          shell:string;cannon:Cannon;savedRoutes:SavedRoute[];}>|null;
      if(!state)return;
      // Legacy route storage is a fallback only when no Observation coordinate
      // has been provided by the parent.
      if(typeof state.nestGrid==='string'&&!this.observationNestGrid)
        this.nestGrid.set(state.nestGrid);
      if(typeof state.stationGrid==='string')this.stationGrid.set(state.stationGrid);
      if(typeof state.railBearing==='string')this.railBearing.set(state.railBearing);
      if(state.approachSide==='bearing'||state.approachSide==='opposite')
        this.approachSide.set(state.approachSide);
      if(Array.isArray(state.stops)&&state.stops.length>=2&&state.stops.length<=12&&
        state.stops.every(s=>s&&typeof s.name==='string'&&
          typeof s.time==='string'&&typeof s.kmFromStation==='number'))
        this.stops.set(this.normalizeStops(state.stops));
      const current=this.stops()[0]?.id??null;
      this.editingStopId.set(current);
      if(typeof state.impactMode==='string')this.impactMode.set(state.impactMode);
      if(typeof state.customImpactClock==='string')this.customImpactClock.set(state.customImpactClock);
      if(typeof state.flightSeconds==='string')this.flightSeconds.set(state.flightSeconds);
      if(typeof state.targetLabel==='string')this.targetLabel.set(state.targetLabel.slice(0,50));
      if(typeof state.routeName==='string')this.routeName.set(state.routeName.slice(0,60));
      if(typeof state.routeSpeed==='string')this.routeSpeed.set(state.routeSpeed);
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
  editWaypoint(id:string):void {
    if(this.stops().some(s=>s.id===id))this.editingStopId.set(id);
  }
  setWaypointMethod(method:string):void {
    if(!['route','manual','observed','relative'].includes(method))return;
    const i=this.activeWaypointIndex();
    if(i<0||this.activeIsArrival())return;
    this.stops.update(stops=>stops.map((s,index)=>index===i?{
      ...s,method:method as WaypointMethod,
      ...(method==='manual'||method==='observed'?{grid:s.grid??''}:{})
    }:s));
  }
  setActiveWaypointGrid(grid:GridInput):void {
    const i=this.activeWaypointIndex();
    if(i<0||this.activeIsArrival())return;
    this.stops.update(stops=>stops.map((s,index)=>index===i?
      {...s,grid:gridInputLabel(grid)}:s));
  }
  confirmActiveWaypointGrid():void{
    const active=this.activeWaypoint();
    if(active&&!active.grid&&!this.activeIsArrival())
      this.setActiveWaypointGrid(this.activeGridSelection());
  }
  setRelativeSource(id:string):void{
    const i=this.activeWaypointIndex();
    if(i<0||this.activeIsArrival())return;
    this.stops.update(stops=>stops.map((s,index)=>index===i?
      {...s,relativeTo:id}:s));
  }
  setRouteBearing(value:string):void{
    const index=this.activeWaypointIndex();
    if(index<0||this.activeIsArrival())return;
    const input=value.trim().replace(',','.');
    const bearing=input===''?null:Number(input);
    this.stops.update(items=>items.map((stop,i)=>i===index?
      {...stop,routeBearing:bearing}:stop));
  }
  setRouteDirection(value:string):void{
    if(value!=='bearing'&&value!=='opposite')return;
    const index=this.activeWaypointIndex();
    if(index<0||this.activeIsArrival())return;
    this.stops.update(items=>items.map((stop,i)=>i===index?
      {...stop,routeDirection:value}:stop));
  }
  setRelativeDirection(value:string):void{
    if(value!=='bearing'&&value!=='opposite')return;
    const index=this.activeWaypointIndex();
    if(index<0||this.activeIsArrival())return;
    this.stops.update(items=>items.map((stop,i)=>i===index?
      {...stop,relativeDirection:value}:stop));
  }
  setRelativeNumber(field:'relativeBearing'|'relativeKm',text:string):void{
    const i=this.activeWaypointIndex(),trim=text.trim().replace(',','.');
    if(i<0||this.activeIsArrival())return;
    const value=trim===''?NaN:Number(trim);
    this.stops.update(stops=>stops.map((s,index)=>index===i?
      {...s,[field]:value}:s));
  }
  setShell(value:string):void{if(SHELLS.some(s=>s===value))this.shell.set(value);}
  setCannon(value:string):void{const c=cannonOrUnassigned(value);if(c)this.cannon.set(c);}
  setWaypointNest(grid:GridInput):void{
    const text=gridInputLabel(grid);
    this.nestGrid.set(text);
    this.nestGridChange.emit({...grid});
    this.notice.set('Iron Nest grid updated in Observation and Waypoint.');
  }
  setWaypointReference(grid:GridInput):void{
    this.stationGrid.set(gridInputLabel(grid));
  }
  confirmWaypointReference():void{
    if(!this.stationGrid())this.stationGrid.set(gridInputLabel(this.referenceGridSelection()));
  }
  openRouteMap():void{this.routeMapOpen.set(true);}
  closeRouteMap():void{this.routeMapOpen.set(false);}
  newRoute():void{
    this.routeName.set('New route');this.routeSpeed.set('');
    this.stationGrid.set('');this.railBearing.set('');this.approachSide.set('bearing');
    const start:TrainStop={id:this.id(),name:'Waypoint A',kmFromStation:5,time:'',method:'route'};
    this.stops.set([start,
      {id:this.id('arrival'),name:'Arrival reference',kmFromStation:0,time:'',method:'route'}]);
    this.editingStopId.set(start.id!);
    this.targetLabel.set('Moving target');
    this.impactMode.set('custom');this.customImpactClock.set('');
    this.flightSeconds.set('');
    if(this.currentNestGrid)this.nestGrid.set(this.currentNestGrid);
    this.notice.set('Create waypoints with distances and game times.');
  }
  saveRoute():void{
    const id=typeof crypto!=='undefined'&&'randomUUID' in crypto?
      crypto.randomUUID():String(Date.now());
    const route:SavedRoute={
      id,name:this.routeName().trim().slice(0,60)||'Route',
      nestGrid:this.nestGrid(),stationGrid:this.stationGrid(),
      railBearing:this.railBearing(),approachSide:this.approachSide(),
      stops:this.stops().map(s=>({...s})),targetLabel:this.targetLabel(),
      shell:this.shell(),cannon:this.cannon(),routeSpeed:this.routeSpeed()
    };
    this.savedRoutes.update(items=>[route,...items].slice(0,25));
    this.notice.set('Saved route on this device.');
  }
  restoreRoute(id:string):void{
    const r=this.savedRoutes().find(v=>v.id===id);if(!r)return;
    this.routeName.set(r.name);
    this.nestGrid.set(this.currentNestGrid??r.nestGrid);
    this.stationGrid.set(r.stationGrid);this.railBearing.set(r.railBearing);
    this.approachSide.set(r.approachSide);
    this.stops.set(this.normalizeStops(r.stops));
    this.editingStopId.set(this.stops()[0]?.id??null);
    this.targetLabel.set(r.targetLabel);this.shell.set(normalizeShell(r.shell));
    this.cannon.set(cannonOrUnassigned(r.cannon)??'left');
    this.routeSpeed.set(r.routeSpeed??'');
    this.impactMode.set('custom');
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
    const waypoint:TrainStop={
      id:this.id(),name:'Waypoint '+s.length,
      kmFromStation:arrival.kmFromStation+gap,time:nextTime,method:'route'
    };
    this.stops.update(items=>[...items.slice(0,-1),waypoint,items[items.length-1]]);
    this.editingStopId.set(waypoint.id!);
    this.impactMode.set('custom');
  }
  removeWaypoint(index:number):void{
    if(index===this.stops().length-1||this.stops().length<=2)return;
    const deleted=this.stops()[index]?.id;
    this.stops.update(items=>items.filter((_,i)=>i!==index));
    if(this.editingStopId()===deleted)this.editingStopId.set(this.stops()[0]?.id??null);
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
      grid:calc.result.grid,nestGrid:this.nestGrid(),shell:this.shell(),cannon:this.cannon()
    });
  }
}
