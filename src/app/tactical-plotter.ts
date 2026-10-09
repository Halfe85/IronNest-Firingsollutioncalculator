import {CommonModule} from '@angular/common';
import {Component, EventEmitter, HostListener, Output, computed, effect, signal} from '@angular/core';
import {formatGrid,compassCenter} from './map-math';
import {TrainTrackerComponent,type MovingFireRequest} from './train-tracker';
import {PlotMapComponent,type MapObservationMarker} from './plot-map';
import {
  gridInputLabel, solvePlotGraph, firingFromPlot, updateIntelReport,
  type GridInput, type IntelNode, type NodeRole
} from './graph-math';
import {GridSelectComponent} from './grid-select';
import {SHELLS} from './firing';
import {cannonOrUnassigned, normalizeShell, type Cannon} from './shot-options';
import {sessionDb} from './session-db';

export interface PlotFireRequest {label:string; bearing:number;distanceKm:number;grid:string; nestGrid:string; shell:string; cannon:Cannon;}
function clone(src:readonly IntelNode[]):IntelNode[]{
  return src.map(n=>({...n,grid:n.grid?{...n.grid}:undefined,
    reports:n.reports.map(r=>({...r}))}));
}
function uid():string{
  return typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():
    Date.now().toString(36)+Math.random().toString(36).slice(2);
}
@Component({
  selector:'app-tactical-plotter',standalone:true,imports:[CommonModule,GridSelectComponent,TrainTrackerComponent,PlotMapComponent],
  templateUrl:'./tactical-plotter.html',styleUrl:'./tactical-plotter.css'
})
export class TacticalPlotterComponent{
  @Output() fireSolution=new EventEmitter<PlotFireRequest>();
  @Output() clearFiringSolutions=new EventEmitter<void>();
  readonly hydrated=signal(false);
  readonly nodes=signal<IntelNode[]>([{
    id:'nest',name:'Iron Nest',role:'nest',grid:{letter:'A',column:1,x:0,y:0},reports:[]
  }]);
  readonly modal=signal<'map'|'node'|null>(null);
  readonly activeId=signal<string|null>(null);
  readonly status=signal('');
  readonly plottingMode=signal<'normal'|'waypoint'>('normal');
  readonly observationMapVisible=signal(false);
  readonly shellOptions=SHELLS;
  readonly targetLoadouts=signal<Record<string,{shell:string;cannon:Cannon}>>({});
  readonly currentLoadout=computed(()=>{
    const id=this.activeId()??'';
    return this.targetLoadouts()[id]??{shell:'HCHE',cannon:'left' as Cannon};
  });
  readonly solution=computed(()=>solvePlotGraph(this.nodes()));
  readonly nest=computed(()=>this.nodes().find(n=>n.role==='nest'));
  readonly spotters=computed(()=>this.nodes().filter(n=>n.role==='spotter'));
  readonly references=computed(()=>this.nodes().filter(n=>n.role==='reference'));
  readonly targets=computed(()=>this.nodes().filter(n=>n.role==='target'));
  readonly active=computed(()=>this.nodes().find(n=>n.id===this.activeId()));
  readonly activeResult=computed(()=>this.solution().get(this.activeId()??''));
  readonly originOptions=computed(()=>this.nodes().filter(n=>n.id!==this.activeId()));
  readonly mapMarkers=computed(()=>this.solution().results.flatMap(result=>{
    if(result.position)return [{
      id:result.node.id,name:result.node.name,role:result.node.role,
      p:result.position,grid:formatGrid(result.position)
    }];
    if(result.node.id===this.activeId())return result.candidates.map((p,i)=>({
      id:result.node.id+'-option-'+i,name:result.node.name+' #'+(i+1),
      role:result.node.role,p,grid:formatGrid(p)
    }));
    return [];
  }));
  readonly formatGrid=formatGrid;
  readonly nestGridText=computed(()=>this.solution().get('nest')?.position
    ?formatGrid(this.solution().get('nest')!.position!):null);
  readonly activeObservations=computed<MapObservationMarker[]>(()=>{
    const node=this.active();
    if(!node)return [];
    return node.reports.flatMap(report=>{
      const origin=this.solution().get(report.sourceId)?.position;
      if(!origin)return [];
      let value:number;
      if(report.type==='sector'){
        const bearing=compassCenter(report.value);
        if(bearing===null)return [];
        value=bearing;
      }else{
        if(!report.value.trim())return [];
        value=Number(report.value.replace(',','.'));
        if(!Number.isFinite(value)||report.type==='bearing'&&(value<0||value>360)||
          report.type==='range'&&value<=0)return [];
      }
      return [{id:report.id,source:origin,type:report.type,value}];
    });
  });
  constructor(){
    void this.restore();
    effect(()=>{
      if(!this.hydrated())return;
      void sessionDb.write('plotter',{
        nodes:this.nodes(),targetLoadouts:this.targetLoadouts(),
        plottingMode:this.plottingMode()
      });
    });
  }
  private async restore():Promise<void>{
    try{
      const data=await sessionDb.read<{
        nodes?:IntelNode[];targetLoadouts?:Record<string,{shell?:unknown;cannon?:unknown}>;
        plottingMode?:'normal'|'waypoint';
      }>('plotter');
      if(!data)return;
      if(data.plottingMode==='waypoint')this.plottingMode.set('waypoint');
      if(Array.isArray(data.nodes)&&data.nodes.length>0&&data.nodes.length<=70&&
        data.nodes.every(n=>n&&typeof n.id==='string'&&
          typeof n.name==='string'&&['nest','spotter','reference','target'].includes(n.role)&&
          Array.isArray(n.reports)&&n.reports.length<=20))this.nodes.set(clone(data.nodes));
      if(data.targetLoadouts&&typeof data.targetLoadouts==='object'){
        const known=new Set(this.nodes().map(n=>n.id));
        const cleaned:Record<string,{shell:string;cannon:Cannon}>={};
        for(const [id,item] of Object.entries(data.targetLoadouts)){
          if(known.has(id)&&item&&typeof item==='object')
            cleaned[id]={shell:normalizeShell(item.shell),
              cannon:cannonOrUnassigned(item.cannon)??'left'};
        }
        this.targetLoadouts.set(cleaned);
      }
    }finally{this.hydrated.set(true);}
  }
  ngOnDestroy():void{
    // Flush the last modal edit before Angular destroys this tab's component.
    if(this.hydrated())void sessionDb.write('plotter',{
      nodes:this.nodes(),targetLoadouts:this.targetLoadouts(),
      plottingMode:this.plottingMode()
    });
  }
  @HostListener('document:keydown.escape')
  closeModal():void{
    this.modal.set(null);this.activeId.set(null);this.observationMapVisible.set(false);
  }
  setMode(mode:'normal'|'waypoint'):void{this.plottingMode.set(mode);this.closeModal();}
  showMapFromObservations():void{this.modal.set('map');}
  backFromMap():void{if(this.activeId())this.modal.set('node');else this.closeModal();}
  useMovingSolution(route:MovingFireRequest):void{
    this.fireSolution.emit({label:route.target,bearing:route.bearing,
      distanceKm:route.distanceKm,grid:route.grid??'',
      nestGrid:route.nestGrid,shell:route.shell,cannon:route.cannon});
  }
  setNestGrid(grid:GridInput):void{this.changeNode('nest',n=>({...n,grid}));}
  setActiveGrid(grid:GridInput):void{
    const id=this.activeId();if(id)this.changeNode(id,n=>({...n,grid}));
  }
  changeNode(id:string,update:(n:IntelNode)=>IntelNode):void{
    this.nodes.update(nodes=>nodes.map(n=>n.id===id?update(n):n));
    this.status.set('');
  }
  renameNode(value:string):void{
    const id=this.activeId();if(id)this.changeNode(id,n=>({...n,name:value.slice(0,48)}));
  }
  newMission():void{
    if(!window.confirm('Start a new mission and replace the current locally saved plot?'))return;
    this.clearFiringSolutions.emit();
    void sessionDb.clear('waypoint');
    this.plottingMode.set('normal');
    this.targetLoadouts.set({});
    this.nodes.set([{id:'nest',name:'Iron Nest',role:'nest',
      grid:{letter:'A',column:1,x:0,y:0},reports:[]}]);
    this.status.set('Set Iron Nest grid, add spotters and then reference points or targets.');
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
  setTargetShell(value:string):void {
    const id=this.activeId();
    if(!id||!SHELLS.some(s=>s===value))return;
    this.targetLoadouts.update(all=>({...all,[id]:{
      ...this.currentLoadout(),shell:value
    }}));
  }
  setTargetCannon(value:string):void {
    const id=this.activeId(),side=cannonOrUnassigned(value);
    if(!id||!side)return;
    this.targetLoadouts.update(all=>({...all,[id]:{
      ...this.currentLoadout(),cannon:side
    }}));
  }
  deleteActive():void{
    const id=this.activeId();
    if(!id||id==='nest')return;
    if(!window.confirm('Delete this point? Dependent points will become unresolved.'))return;
    this.nodes.update(nodes=>nodes.filter(n=>n.id!==id));
    this.closeModal();
  }
  openNode(id:string):void{this.activeId.set(id);this.observationMapVisible.set(false);this.modal.set('node');}
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
    this.observationMapVisible.set(true);
  }
  originAvailable(id:string):boolean{
    return this.originOptions().some(origin=>origin.id===id);
  }
  modifyReport(id:string,key:'sourceId'|'type'|'value',value:string):void{
    const active=this.active();if(!active)return;
    this.changeNode(active.id,n=>({...n,reports:n.reports.map(r=>
      r.id===id?updateIntelReport(r,key,value):r),chosenCandidate:null}));
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
  getActiveFire():{bearing:number;rangeKm:number;grid:string|null}|null{
    const point=this.activeResult()?.position;
    const nest=this.solution().get('nest')?.position;
    return point&&nest?firingFromPlot(nest,point):null;
  }
  emitFire():void{
    const point=this.activeResult();const fire=this.getActiveFire();
    if(!point||!fire||!fire.grid)return;
    this.fireSolution.emit({
      label:point.node.name,bearing:fire.bearing,distanceKm:fire.rangeKm,grid:fire.grid,
      nestGrid:this.nestGridText()??'',shell:this.currentLoadout().shell,cannon:this.currentLoadout().cannon
    });
    this.closeModal();
  }
  mapX(x:number):number{return 45+x*44;}
  mapY(y:number):number{return 30+(10-y)*44;}
}
