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
const STORAGE_KEY='iron-nest-map-v1';
const DEFAULT_POSITIONS:MapPositions={
  nest:'S9 0:5',spotter1:'P7 1:3',spotter2:'O8 2:5',spotter3:'N7 9:6'
};
const DEFAULT_REPORTS:ObservationRow[]=[
  {id:1,observer:'spotter1',kind:'sector',value:'SSW'},
  {id:2,observer:'spotter2',kind:'range',value:'6.57'},
  {id:3,observer:'spotter3',kind:'bearing',value:'187'}
];
const SPOTTER_LABELS:Record<ObserverId,string>={
  spotter1:'Spotter #1',spotter2:'Spotter #2',spotter3:'Spotter #3'
};
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
  readonly reports=signal<ObservationRow[]>(DEFAULT_REPORTS.map(v=>({...v})));
  readonly targetName=signal('Target 1');
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
    const charge=selectCharge(p.rangeKm,'low-angle',1,45,[]);
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
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw){
        const saved=JSON.parse(raw) as {
          positions?:MapPositions;reports?:ObservationRow[];
          targetName?:string;savedTargets?:SavedTarget[];
        };
        if(saved.positions&&this.positionKeys.every(k=>typeof saved.positions?.[k]==='string'))
          this.positions.set(saved.positions);
        if(Array.isArray(saved.reports)&&saved.reports.length<=25&&saved.reports.every(r=>
          Number.isInteger(r.id)&&this.observerOptions.includes(r.observer)&&
          ['range','bearing','sector','none'].includes(r.kind)&&typeof r.value==='string'))
          this.reports.set(saved.reports);
        if(typeof saved.targetName==='string')this.targetName.set(saved.targetName.slice(0,40));
        if(Array.isArray(saved.savedTargets)) this.savedTargets.set(
          saved.savedTargets.filter(t=>t && typeof t.id==='string' &&
          typeof t.x==='number' &&typeof t.y==='number'&&typeof t.name==='string' &&
          Number.isFinite(t.x)&&Number.isFinite(t.y)&&typeof t.grid==='string')
          .slice(0,50));
      }
    }catch { /* browser storage can be unavailable */ }
    effect(()=>{
      const state={positions:this.positions(),reports:this.reports(),
        targetName:this.targetName(),savedTargets:this.savedTargets()};
      try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{ /* private mode */ }
    });
  }
  x(x:number):number{return MAP_LEFT+x*CELL;}
  y(y:number):number{return MAP_TOP+(10-y)*CELL;}
  posLabel(key:PositionKey):string{return this.positions()[key];}
  setPosition(key:PositionKey,value:string):void{
    this.positions.update(p=>({...p,[key]:value}));
    this.selectedIndex.set(0);this.notice.set('');
  }
  updateReport(id:number,key:'observer'|'kind'|'value',value:string):void{
    this.reports.update(rows=>rows.map(row=>{
      if(row.id!==id)return row;
      if(key==='observer' && !this.observerOptions.includes(value as ObserverId))return row;
      if(key==='kind' && !['range','bearing','sector','none'].includes(value))return row;
      return {...row,[key]:value, ...(key==='kind'?{value:value==='sector'?'SSW':''}:{})};
    }));
    this.selectedIndex.set(0);this.notice.set('');
  }
  addReport():void{
    const rows=this.reports();
    if(rows.length>=12){this.notice.set('Maximum 12 observation rows.');return;}
    const id=rows.reduce((max,row)=>Math.max(row.id,max),0)+1;
    this.reports.update(all=>[...all,{id,observer:'spotter1',kind:'bearing',value:''}]);
  }
  removeReport(id:number):void{
    this.reports.update(all=>all.filter(row=>row.id!==id));
    this.selectedIndex.set(0);
  }
  resetExample():void{
    this.positions.set({...DEFAULT_POSITIONS});
    this.reports.set(DEFAULT_REPORTS.map(v=>({...v})));
    this.targetName.set('Target 1');this.selectedIndex.set(0);
    this.notice.set('Example positions and reports restored.');
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
