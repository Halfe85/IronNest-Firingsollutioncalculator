import {CommonModule} from '@angular/common';
import {Component, EventEmitter, HostListener, Output, computed, effect, signal} from '@angular/core';
import {formatGrid} from './map-math';
import {
  GIBRALTAR_MISSION, gridInputLabel, solvePlotGraph, firingFromPlot,
  type GridInput, type IntelNode, type NodeRole
} from './graph-math';
import {GridSelectComponent} from './grid-select';

export interface PlotFireRequest {label:string; bearing:number;distanceKm:number;grid:string;}
const STORAGE='iron-nest-plot-graph-v1';
function clone(src:readonly IntelNode[]):IntelNode[]{
  return src.map(n=>({...n,grid:n.grid?{...n.grid}:undefined,
    reports:n.reports.map(r=>({...r}))}));
}
function uid():string{
  return typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():
    Date.now().toString(36)+Math.random().toString(36).slice(2);
}
@Component({
  selector:'app-tactical-plotter',standalone:true,imports:[CommonModule,GridSelectComponent],
  templateUrl:'./tactical-plotter.html',styleUrl:'./tactical-plotter.css'
})
export class TacticalPlotterComponent{
  @Output() fireSolution=new EventEmitter<PlotFireRequest>();
  readonly name=signal('Gibraltar • Heavy Cruiser');
  readonly nodes=signal<IntelNode[]>(clone(GIBRALTAR_MISSION));
  readonly modal=signal<'map'|'node'|null>(null);
  readonly activeId=signal<string|null>(null);
  readonly status=signal('');
  readonly solution=computed(()=>solvePlotGraph(this.nodes()));
  readonly nest=computed(()=>this.nodes().find(n=>n.role==='nest'));
  readonly spotters=computed(()=>this.nodes().filter(n=>n.role==='spotter'));
  readonly references=computed(()=>this.nodes().filter(n=>n.role==='reference'));
  readonly targets=computed(()=>this.nodes().filter(n=>n.role==='target'));
  readonly active=computed(()=>this.nodes().find(n=>n.id===this.activeId()));
  readonly activeResult=computed(()=>this.solution().get(this.activeId()??''));
  readonly originOptions=computed(()=>this.nodes().filter(n=>n.id!==this.activeId()));
  readonly mapMarkers=computed(()=>this.solution().results.flatMap(result=>
    result.position?[{id:result.node.id,name:result.node.name,role:result.node.role,
      p:result.position,grid:formatGrid(result.position)}]:[]));
  readonly formatGrid=formatGrid;
  readonly mapColumns='ABCDEFGHIJKLMNOPQRST'.split('');
  readonly mapRows=Array.from({length:10},(_,i)=>10-i);
  constructor(){
    try{
      const data=JSON.parse(localStorage.getItem(STORAGE)??'null') as
        {name?:unknown;nodes?:unknown}|null;
      if(data&&typeof data.name==='string')this.name.set(data.name.slice(0,80));
      if(data&&Array.isArray(data.nodes)&&data.nodes.length>0&&data.nodes.length<=70&&
        data.nodes.every((n:IntelNode)=>n&&typeof n.id==='string'&&
        typeof n.name==='string'&&['nest','spotter','reference','target'].includes(n.role)&&
        Array.isArray(n.reports)&&n.reports.length<=20))this.nodes.set(clone(data.nodes));
    }catch { /* missing or corrupted local data */ }
    effect(()=>{try{localStorage.setItem(STORAGE,
      JSON.stringify({name:this.name(),nodes:this.nodes()}));}catch{/* storage blocked */}});
  }
  @HostListener('document:keydown.escape')
  closeModal():void{this.modal.set(null);this.activeId.set(null);}
  setNestGrid(grid:GridInput):void{this.changeNode('nest',n=>({...n,grid}));}
  setActiveGrid(grid:GridInput):void{
    const id=this.activeId();if(id)this.changeNode(id,n=>({...n,grid}));
  }
  changeNode(id:string,update:(n:IntelNode)=>IntelNode):void{
    this.nodes.update(nodes=>nodes.map(n=>n.id===id?update(n):n));
    this.status.set('');
  }
  setName(value:string):void{this.name.set(value.slice(0,80));}
  renameNode(value:string):void{
    const id=this.activeId();if(id)this.changeNode(id,n=>({...n,name:value.slice(0,48)}));
  }
  newMission():void{
    if(!window.confirm('Start a new mission and replace the current locally saved plot?'))return;
    this.name.set('New mission');
    this.nodes.set([{id:'nest',name:'Iron Nest',role:'nest',
      grid:{letter:'A',column:1,x:0,y:0},reports:[]}]);
    this.status.set('Set Iron Nest grid, add spotters and then reference points or targets.');
    this.closeModal();
  }
  loadExample():void{
    if(!window.confirm('Load Gibraltar example and replace the current plot?'))return;
    this.name.set('Gibraltar • Heavy Cruiser');
    this.nodes.set(clone(GIBRALTAR_MISSION));
    this.status.set('Gibraltar example loaded. Resolve references before the cruiser.');
    this.closeModal();
  }
  addNode(role:Exclude<NodeRole,'nest'>):void{
    const count=this.nodes().filter(n=>n.role===role).length+1;
    const id=role+'-'+uid();
    const newNode:IntelNode={
      id,role,name:role==='spotter'?'Spotter #'+count:
        role==='reference'?'Reference #'+count:'Target #'+count,
      ...(role==='spotter'?{grid:{letter:'A',column:1,x:0,y:0} as GridInput}:{}),
      reports:[]
    };
    this.nodes.update(nodes=>[...nodes,newNode]);
    this.openNode(id);
  }
  deleteActive():void{
    const id=this.activeId();
    if(!id||id==='nest')return;
    if(!window.confirm('Delete this point? Dependent points will become unresolved.'))return;
    this.nodes.update(nodes=>nodes.filter(n=>n.id!==id));
    this.closeModal();
  }
  openNode(id:string):void{this.activeId.set(id);this.modal.set('node');}
  openMap():void{this.modal.set('map');this.activeId.set(null);}
  addReport():void{
    const active=this.active();
    if(!active||active.role==='spotter'||active.role==='nest')return;
    if(active.reports.length>=12){this.status.set('Maximum 12 reports per point.');return;}
    const source=this.nodes().find(n=>n.id!==active.id);
    if(!source)return;
    this.changeNode(active.id,n=>({...n,reports:[...n.reports,{
      id:uid(),sourceId:source.id,type:'bearing',value:''
    }]}));
  }
  modifyReport(id:string,key:'sourceId'|'type'|'value',value:string):void{
    const active=this.active();if(!active)return;
    this.changeNode(active.id,n=>({...n,reports:n.reports.map(r=>
      r.id===id?{...r,[key]:value}:r),chosenCandidate:null}));
  }
  removeReport(id:string):void{
    const active=this.active();if(!active)return;
    this.changeNode(active.id,n=>({...n,reports:n.reports.filter(r=>r.id!==id),chosenCandidate:null}));
  }
  confirmCandidate(index:number):void{
    const active=this.active();if(active)this.changeNode(active.id,n=>({...n,chosenCandidate:index}));
  }
  clearCandidate():void{
    const active=this.active();if(active)this.changeNode(active.id,n=>({...n,chosenCandidate:null}));
  }
  gridLabel(node:IntelNode):string{return node.grid?gridInputLabel(node.grid):'—';}
  plotLabel(id:string):string{
    const r=this.solution().get(id);
    if(!r)return 'Unresolved';
    return r.position?formatGrid(r.position)??'Outside map':
      r.status==='ambiguous'?r.candidates.length+' possible':
      r.status==='blocked'?'Waiting for reference':
      r.status==='conflict'?'Check reports':'Needs intel';
  }
  getActiveFire():{bearing:number;distanceKm:number;grid:string|null}|null{
    const point=this.activeResult()?.position;
    const nest=this.solution().get('nest')?.position;
    return point&&nest?firingFromPlot(nest,point):null;
  }
  emitFire():void{
    const point=this.activeResult();const fire=this.getActiveFire();
    if(!point||!fire||!fire.grid)return;
    this.fireSolution.emit({
      label:point.node.name,bearing:fire.bearing,distanceKm:fire.rangeKm,grid:fire.grid
    });
    this.closeModal();
  }
  mapX(x:number):number{return 45+x*44;}
  mapY(y:number):number{return 30+(10-y)*44;}
}
