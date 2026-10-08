import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, computed, effect, signal } from '@angular/core';
import {
  COLUMNS, DIRECTIONS, ROWS, bearingDegrees, compassCenter, distanceKm,
  formatGrid, parseGrid, triangulate, type MapPositions, type Observation,
  type ObservationKind, type ObserverId, type PlotCandidate, type Point
} from './map-math';
import { elevationAt, selectCharge } from './firing';

type ObservationRow = Observation & {id:number};
type PositionKey = keyof MapPositions;
interface SavedTarget {id:string;name:string;grid:string;x:number;y:number;createdAt:string;}
const STORAGE_KEY='iron-nest-map-v2';
const LEGACY_KEY='iron-nest-map-v1';
interface MissionTarget {id:number;name:string;reports:ObservationRow[];}
interface SavedMission {id:string;name:string;createdAt:string;positions:MapPositions;targets:MissionTarget[];}
const ARTILLERY_POSITIONS:MapPositions={nest:'I6 5:3',spotter1:'I10 5:8',spotter2:'M7 1:5',spotter3:'L1 7:7'};
const ARTILLERY_TARGETS:MissionTarget[]=[
  {id:1,name:'Artillery #1',reports:[
    {id:1,observer:'spotter1',kind:'bearing',value:'233'},
    {id:2,observer:'spotter2',kind:'bearing',value:'104'}]},
  {id:2,name:'Artillery #2',reports:[
    {id:1,observer:'spotter1',kind:'bearing',value:'187'},
    {id:2,observer:'spotter3',kind:'bearing',value:'50'}]},
  {id:3,name:'Artillery #3',reports:[
    {id:1,observer:'spotter3',kind:'range',value:'6.21'},
    {id:2,observer:'spotter1',kind:'range',value:'5.77'}]}
];

const DEFAULT_POSITIONS:MapPositions={
  nest:'S9 0:5',spotter1:'P7 1:3',spotter2:'O8 2:5',spotter3:'N7 9:6'
};
const DEFAULT_REPORTS:ObservationRow[]=[
  {id:1,observer:'spotter1',kind:'sector',value:'SSW'},
  {id:2,observer:'spotter2',kind:'range',value:'6.57'},
  {id:3,observer:'spotter3',kind:'bearing',value:'187'}
];
const MAP_LEFT=54,MAP_TOP=37,CELL=46;
@Component({
  selector:'app-map-plotter',
  standalone:true,
  imports:[CommonModule],
  templateUrl:'./map-plotter.html',
  styleUrl:'./map-plotter.css'
})
export class MapPlotterComponent {
  @Output() useSolution=new EventEmitter<{bearing:number;distanceKm:number;target:string}>();
  readonly columns=COLUMNS;
  readonly rows=ROWS;
  readonly directions=DIRECTIONS;
  readonly positionKeys:PositionKey[]=['nest','spotter1','spotter2','spotter3'];
  readonly positionNames:Record<PositionKey,string>={
    nest:'IRON NEST',spotter1:'SPOTTER #1',spotter2:'SPOTTER #2',spotter3:'SPOTTER #3'
  };
  readonly observerOptions:ObserverId[]=['spotter1','spotter2','spotter3'];
  readonly kinds:ObservationKind[]=['bearing','range','sector'];
  readonly positions=signal<MapPositions>({...DEFAULT_POSITIONS});
  readonly missionName=signal('Triangulation demo');
  readonly targets=signal<MissionTarget[]>([{
    id:1,name:'Target 1',reports:DEFAULT_REPORTS.map(v=>({...v}))
  }]);
  readonly activeTargetId=signal(1);
  readonly reports=computed(()=>this.targets().find(t=>t.id===this.activeTargetId())?.reports??[]);
  readonly targetName=computed(()=>this.targets().find(t=>t.id===this.activeTargetId())?.name??'');
  readonly savedMissions=signal<SavedMission[]>([]);
  readonly targetPlots=computed(()=>this.targets().map(target=>({
    id:target.id,name:target.name,
    candidates:triangulate(this.positions(),target.reports).candidates
  })));
  readonly selectedIndex=signal(0);
  readonly savedTargets=signal<SavedTarget[]>([]);
  readonly cursorGrid=signal<string|null>(null);
  readonly notice=signal('');
  readonly showFineGrid=signal(false);
  readonly markers=computed(()=>this.positionKeys.map(key=>({
    key,label:this.positionNames[key],pos:parseGrid(this.positions()[key]),color:key==='nest'?'#efba6b':'#86b6dc'
  })));
  readonly result=computed(()=>triangulate(this.positions(),this.reports()));
  readonly candidate=computed<PlotCandidate|null>(()=>this.result().candidates[this.selectedIndex()]??this.result().candidates[0]??null);
  readonly firing=computed(()=>{
    const p=this.candidate();if(!p)return null;
    const charge=selectCharge(p.rangeKm,'manual',Math.ceil(p.rangeKm/5),45,[]);
    return charge===null?null:{charge,elevation:elevationAt(p.rangeKm,charge)!};
  });
  readonly lines=computed(()=>this.reports().map(r=>{
    const pos=parseGrid(this.positions()[r.observer]);
    const n=Number(r.value.trim().replace(',','.'));
    const deg=r.kind==='bearing'&&Number.isFinite(n)&&n>=0&&n<=360?n:null;
    const radius=r.kind==='range'&&Number.isFinite(n)&&n>0?n:null;
    const sector=r.kind==='sector'?compassCenter(r.value):null;
    return {id:r.id,origin:pos,kind:r.kind,degrees:deg,radius,sector,
      x2:pos&&deg!==null?this.x(pos.x+Math.sin(deg*Math.PI/180)*40):0,
      y2:pos&&deg!==null?this.y(pos.y+Math.cos(deg*Math.PI/180)*40):0,
      wedge:pos&&sector!==null?this.sectorPath(pos,sector):''};
  }));
  constructor(){
    this.restoreMission();
    effect(()=>{
      const state={
        missionName:this.missionName(),
        positions:this.positions(),
        targets:this.targets(),
        activeTargetId:this.activeTargetId(),
        savedMissions:this.savedMissions(),
        savedTargets:this.savedTargets()
      };
      try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
      catch{ /* browser storage may be unavailable */ }
    });
  }
  private restoreMission():void{
    try{
      const newState=localStorage.getItem(STORAGE_KEY);
      const legacy=localStorage.getItem(LEGACY_KEY);
      const data=JSON.parse(newState??legacy??'null') as {
        missionName?:string;positions?:MapPositions;reports?:ObservationRow[];
        targetName?:string;targets?:MissionTarget[];activeTargetId?:number;
        savedMissions?:SavedMission[];savedTargets?:SavedTarget[];
      } | null;
      if(!data || typeof data!=='object')return;
      if(data.positions&&this.positionKeys.every(k=>typeof data.positions?.[k]==='string'))
        this.positions.set(data.positions);
      if(typeof data.missionName==='string')this.missionName.set(data.missionName.slice(0,60));
      const validReports=(rows:unknown):rows is ObservationRow[]=>Array.isArray(rows)&&rows.length<=12&&rows.every(r=>
        r!==null&&typeof r==='object'&&Number.isInteger(r.id)&&
        this.observerOptions.includes(r.observer)&&
        ['range','bearing','sector','none'].includes(r.kind)&&typeof r.value==='string');
      const validTargets=(targets:unknown):targets is MissionTarget[]=>Array.isArray(targets)&&
        targets.length>0&&targets.length<=25&&targets.every(t=>t&&typeof t==='object'&&
        Number.isInteger(t.id)&&typeof t.name==='string'&&validReports(t.reports));
      if(validTargets(data.targets)){
        this.targets.set(data.targets.map(t=>({
          id:t.id,name:t.name.slice(0,40),reports:t.reports.map(r=>({...r}))
        })));
        if(this.targets().some(t=>t.id===data.activeTargetId))
          this.activeTargetId.set(data.activeTargetId!);
      }else if(validReports(data.reports)){
        this.targets.set([{
          id:1,name:typeof data.targetName==='string'?data.targetName.slice(0,40):'Target 1',
          reports:data.reports.map(r=>({...r}))
        }]);
      }
      if(Array.isArray(data.savedMissions)){
        this.savedMissions.set(data.savedMissions.filter(m=>m && typeof m.id==='string'&&
          typeof m.name==='string'&&m.positions&&this.positionKeys.every(k=>typeof m.positions[k]==='string')&&
          validTargets(m.targets)).slice(0,25));
      }
      if(Array.isArray(data.savedTargets)){
        this.savedTargets.set(data.savedTargets.filter(t=>t&&typeof t.id==='string'&&
          typeof t.name==='string'&&typeof t.grid==='string'&&
          typeof t.x==='number'&&Number.isFinite(t.x)&&typeof t.y==='number'&&Number.isFinite(t.y)).slice(0,50));
      }
    }catch{ /* corrupt or blocked local storage: start from sample */ }
  }
  private changeReports(updater:(rows:ObservationRow[])=>ObservationRow[]):void{
    const id=this.activeTargetId();
    this.targets.update(targets=>targets.map(t=>t.id===id?
      {...t,reports:updater(t.reports)}:t));
  }
  renameTarget(value:string):void{
    const id=this.activeTargetId();
    this.targets.update(items=>items.map(t=>t.id===id?{...t,name:value.slice(0,40)}:t));
  }
  setMissionName(value:string):void{this.missionName.set(value.slice(0,60));}
  selectTarget(id:number):void{
    if(!this.targets().some(t=>t.id===id))return;
    this.activeTargetId.set(id);this.selectedIndex.set(0);this.notice.set('');
  }
  addTarget():void{
    if(this.targets().length>=25){this.notice.set('Maximum 25 targets per mission.');return;}
    const id=this.targets().reduce((max,t)=>Math.max(max,t.id),0)+1;
    this.targets.update(items=>[...items,{id,name:'Target '+id,reports:[]}]);
    this.selectTarget(id);
  }
  removeTarget():void{
    if(this.targets().length===1){this.notice.set('A mission must have at least one target.');return;}
    const keep=this.targets().filter(t=>t.id!==this.activeTargetId());
    this.targets.set(keep);this.activeTargetId.set(keep[0].id);
    this.selectedIndex.set(0);this.notice.set('Target removed from mission.');
  }
  newMission():void{
    if(!window.confirm('Start a new playthrough? The current mission remains in browser autosave only until replaced. Use SAVE MISSION first if you want to keep it.'))return;
    this.missionName.set('New playthrough');
    this.positions.set({nest:'',spotter1:'',spotter2:'',spotter3:''});
    this.targets.set([{id:1,name:'Target 1',reports:[]}]);
    this.activeTargetId.set(1);this.selectedIndex.set(0);
    this.savedTargets.set([]);this.notice.set('New empty playthrough created.');
  }
  loadArtilleryExample():void{
    this.missionName.set('Artillery — counter-battery sample');
    this.positions.set({...ARTILLERY_POSITIONS});
    this.targets.set(ARTILLERY_TARGETS.map(t=>({...t,reports:t.reports.map(r=>({...r}))})));
    this.activeTargetId.set(1);this.selectedIndex.set(0);
    this.savedTargets.set([]);
    this.notice.set('Artillery intelligence loaded. Bearing inconsistencies are intentionally shown as unresolved.');
  }
  saveMission():void{
    const id=typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():String(Date.now());
    const entry:SavedMission={
      id,createdAt:new Date().toISOString(),
      name:this.missionName().trim()||'Untitled mission',
      positions:{...this.positions()},
      targets:this.targets().map(t=>({...t,reports:t.reports.map(r=>({...r}))}))
    };
    this.savedMissions.update(items=>[entry,...items].slice(0,25));
    this.notice.set('Mission snapshot saved on this device.');
  }
  loadMission(id:string):void{
    const m=this.savedMissions().find(s=>s.id===id);
    if(!m)return;
    this.missionName.set(m.name);
    this.positions.set({...m.positions});
    this.targets.set(m.targets.map(t=>({...t,reports:t.reports.map(r=>({...r}))})));
    this.activeTargetId.set(m.targets[0].id);this.selectedIndex.set(0);
    this.savedTargets.set([]);this.notice.set('Mission snapshot loaded.');
  }
  deleteMission(id:string):void{
    this.savedMissions.update(items=>items.filter(s=>s.id!==id));
  }
  x(x:number):number{return MAP_LEFT+x*CELL;}
  y(y:number):number{return MAP_TOP+(10-y)*CELL;}
  posLabel(key:PositionKey):string{return this.positions()[key];}
  setPosition(key:PositionKey,value:string):void{
    this.positions.update(p=>({...p,[key]:value}));
    this.selectedIndex.set(0);this.notice.set('');
  }
  updateReport(id:number,key:'observer'|'kind'|'value',value:string):void{
    this.changeReports(rows=>rows.map(row=>{
      if(row.id!==id)return row;
      if(key==='observer' && !this.observerOptions.includes(value as ObserverId))return row;
      if(key==='kind' && !['range','bearing','sector','none'].includes(value))return row;
      return {...row,[key]:value, ...(key==='kind'?{value:value==='sector'?'SSW':''}:{})};
    }));
    this.selectedIndex.set(0);this.notice.set('');
  }
  addReport():void{
    const rows=this.reports();
    if(rows.length>=12){this.notice.set('Maximum 12 observations per target.');return;}
    const id=rows.reduce((max,row)=>Math.max(row.id,max),0)+1;
    this.changeReports(all=>[...all,{id,observer:'spotter1',kind:'bearing',value:''}]);
  }
  removeReport(id:number):void{
    this.changeReports(all=>all.filter(row=>row.id!==id));
    this.selectedIndex.set(0);
  }
  resetExample():void{
    this.missionName.set('Triangulation demo');
    this.positions.set({...DEFAULT_POSITIONS});
    this.targets.set([{id:1,name:'Target 1',reports:DEFAULT_REPORTS.map(v=>({...v}))}]);
    this.activeTargetId.set(1);this.selectedIndex.set(0);
    this.savedTargets.set([]);
    this.notice.set('Original triangulation example restored.');
  }
  chooseCandidate(index:number):void{this.selectedIndex.set(index);this.notice.set('');}
  applySolution():void{
    const candidate=this.candidate();
    if(!candidate)return;
    this.useSolution.emit({
      bearing:Math.round(candidate.bearing*100)/100,
      distanceKm:Math.round(candidate.rangeKm*10000)/10000,
      target:this.targetName().trim()||'Target'
    });
  }
  saveTarget():void{
    const p=this.candidate();
    if(!p)return;
    const now=new Date().toISOString();
    const t:SavedTarget={
      id:typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():String(Date.now()),
      name:this.targetName().trim().slice(0,40)||'Target',grid:p.grid,
      x:p.position.x,y:p.position.y,createdAt:now
    };
    this.savedTargets.update(rows=>[t,...rows].slice(0,50));
    this.notice.set(t.name+' plotted and saved on this device.');
  }
  removeSaved(id:string):void{
    this.savedTargets.update(rows=>rows.filter(t=>t.id!==id));
  }
  sectorPath(p:Point,center:number):string{
    const rad1=(center-11.25)*Math.PI/180,rad2=(center+11.25)*Math.PI/180;
    const r=40*CELL;
    const cx=this.x(p.x),cy=this.y(p.y);
    const x1=cx+r*Math.sin(rad1),y1=cy-r*Math.cos(rad1);
    const x2=cx+r*Math.sin(rad2),y2=cy-r*Math.cos(rad2);
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
  }
  inspectMap(event:MouseEvent):void{
    const svg=event.currentTarget as SVGSVGElement;
    const rect=svg.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const point={
      x:((event.clientX-rect.left)/rect.width*1020-MAP_LEFT)/CELL,
      y:10-((event.clientY-rect.top)/rect.height*545-MAP_TOP)/CELL
    };
    this.cursorGrid.set(formatGrid(point));
  }
}
