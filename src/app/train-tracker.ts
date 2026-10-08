import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, computed, effect, signal } from '@angular/core';
import { COLUMNS, ROWS, parseGrid, onMap } from './map-math';
import { calculateFireTime, elevationAt, estimatedFlightSeconds, selectCharge } from './firing';
import {
  clockSeconds, trainPositionAt, validateSchedule, waypointSpeeds,
  type TrainSchedule, type TrainStop
} from './train-math';

const STORAGE_KEY='iron-nest-train-v1';
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
  @Output() useSolution=new EventEmitter<{bearing:number;distanceKm:number;target:string;impactClock:string;flightSeconds:string}>();
  readonly columns=COLUMNS;
  readonly rows=ROWS;
  readonly nestGrid=signal('C3 1:8');
  readonly stationGrid=signal('J6 0:4');
  readonly railBearing=signal('90');
  readonly approachSide=signal<'bearing'|'opposite'>('bearing');
  readonly stops=signal<TrainStop[]>(DEFAULT_STOPS.map(s=>({...s})));
  readonly impactMode=signal('1');
  readonly customImpactClock=signal('10:11:50');
  readonly flightSeconds=signal('');
  readonly targetLabel=signal('Enemy troop train');
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
        targetLabel:this.targetLabel()
      }));}catch{ /* storage disabled */ }
    });
  }
  private restore():void{
    try{
      const state=JSON.parse(localStorage.getItem(STORAGE_KEY)??'null') as
        Partial<{nestGrid:string;stationGrid:string;railBearing:string;
          approachSide:'bearing'|'opposite';stops:TrainStop[];
          impactMode:string;customImpactClock:string;flightSeconds:string;
          targetLabel:string;}>|null;
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
    this.nestGrid.set('C3 1:8');
    this.stationGrid.set('J6 0:4');
    this.railBearing.set('90');
    this.approachSide.set('bearing');
    this.stops.set(DEFAULT_STOPS.map(s=>({...s})));
    this.impactMode.set('1');
    this.customImpactClock.set('10:11:50');
    this.flightSeconds.set('');
    this.targetLabel.set('Enemy troop train');
    this.notice.set('Valle de Mula train mission restored.');
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
      flightSeconds:this.flightSeconds().trim()
    });
  }
}
