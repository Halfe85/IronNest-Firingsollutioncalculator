import {CommonModule} from '@angular/common';
import {Component, EventEmitter, HostListener, Output, computed, effect, signal} from '@angular/core';
import {formatGrid,compassCenter} from './map-math';
import {TrainTrackerComponent,type MovingFireRequest} from './train-tracker';
import {PlotMapComponent,type MapObservationMarker} from './plot-map';
import {
  gridInputLabel, solvePlotGraph, firingFromPlot, updateIntelReport,
  gridInputToPoint, EMPTY_GRID, type GridInput, type IntelNode, type IntelReport, type NodeRole
} from './graph-math';
import {GridSelectComponent} from './grid-select';
import {SHELLS} from './firing';
import {cannonOrUnassigned, normalizeShell, type Cannon} from './shot-options';
import {sessionDb} from './session-db';

export interface PlotFireRequest {label:string; bearing:number;distanceKm:number;grid:string; nestGrid:string; shell:string; cannon:Cannon; stayOnPlot?:boolean;}
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
    id:'nest',name:'Iron Nest',role:'nest',reports:[]
  }]);
  readonly modal=signal<'map'|'node'|'add'|null>(null);
  readonly filterOpen=signal(false);
  readonly hiddenReportIds=signal<string[]>([]);
  readonly draftRole=signal<Exclude<NodeRole,'nest'>>('spotter');
  readonly draftMethod=signal<'coordinates'|'reports'>('coordinates');
  readonly draftName=signal('');
  readonly draftGrid=signal<GridInput|null>(null);
  readonly draftNest=signal<GridInput|null>(null);
  readonly draftReports=signal<IntelReport[]>([]);
  readonly draftCandidate=signal<number|null>(null);
  readonly draftShell=signal('HCHE');
  readonly draftCannon=signal<Cannon>('left');
  readonly draftError=signal('');
  readonly emptyGrid=EMPTY_GRID;
  readonly compassOptions=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
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
  readonly nestConfirmed=computed(()=>!!this.nest()?.grid &&
    !!gridInputToPoint(this.nest()!.grid!));
  readonly availableOrigins=computed(()=>{
    const draftNest=this.draftNest();
    return this.nodes().filter(n=>n.role==='nest'
      ? !!gridInputToPoint(draftNest??n.grid??EMPTY_GRID) && !!(draftNest||n.grid)
      : !!this.solution().get(n.id)?.position);
  });
  readonly draftSolved=computed(()=>{
    if(this.draftRole()==='spotter'||this.draftMethod()==='coordinates')return null;
    const reports=this.draftReports();
    const nestGrid=this.draftNest()??this.nest()?.grid;
    const working=this.nodes().map(n=>n.role==='nest'&&nestGrid?{...n,grid:nestGrid}:n);
    const proposed:IntelNode={id:'__new_point__',name:'Draft',role:this.draftRole(),
      reports,chosenCandidate:this.draftCandidate()};
    return solvePlotGraph([...working,proposed]).get('__new_point__')??null;
  });
  readonly draftPosition=computed(()=>{
    if(this.draftRole()==='spotter'||this.draftMethod()==='coordinates')
      return this.draftGrid()?gridInputToPoint(this.draftGrid()!):null;
    return this.draftSolved()?.position??null;
  });
  readonly draftReportsValid=computed(()=>{
    const sources=new Set(this.availableOrigins().map(n=>n.id));
    return this.draftReports().length>0&&this.draftReports().every(report=>{
      if(!sources.has(report.sourceId))return false;
      if(report.type==='sector')return compassCenter(report.value)!==null;
      const n=Number(report.value.trim().replace(',','.'));
      return report.value.trim()!==''&&Number.isFinite(n)&&
        (report.type==='bearing'?(n>=0&&n<=360):n>0&&n<=40);
    });
  });
  readonly canAddDraft=computed(()=>{
    const nest=this.draftNest()??this.nest()?.grid;
    if(!nest||!gridInputToPoint(nest))return false;
    if(this.draftRole()==='reference'&&!this.draftName().trim())return false;
    if(this.draftRole()==='spotter'||this.draftMethod()==='coordinates')
      return !!this.draftPosition();
    if(!this.draftReportsValid())return false;
    if(this.draftRole()==='target')return !!this.draftPosition();
    return true;
  });
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
  readonly reportRows=computed(()=>this.nodes().flatMap(node=>
    node.reports.map(report=>({
      id:report.id,
      label:node.name+' · '+(this.nodes().find(n=>n.id===report.sourceId)?.name??'Unknown')+
        ' · '+(report.type==='range'?report.value+' km':
          report.type==='bearing'?report.value+'°':report.value),
      role:node.role
    }))
  ));
  readonly allObservations=computed<MapObservationMarker[]>(()=>{
    const solved=this.solution();
    return this.nodes().flatMap(node=>node.reports.flatMap(report=>{
      const source=solved.get(report.sourceId)?.position;
      if(!source)return [];
      let value:number;
      if(report.type==='sector'){
        const compass=compassCenter(report.value);
        if(compass===null)return [];
        value=compass;
      }else{
        if(!report.value.trim())return [];
        value=Number(report.value.replace(',','.'));
        if(!Number.isFinite(value)||
          (report.type==='bearing'&&(value<0||value>360))||
          (report.type==='range'&&value<=0))return [];
      }
      return [{id:report.id,source,type:report.type,value}];
    }));
  });
  readonly visibleObservations=computed(()=>{
    const excluded=new Set(this.hiddenReportIds());
    return this.allObservations().filter(report=>!excluded.has(report.id));
  });
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
        plottingMode:this.plottingMode(),hiddenReportIds:this.hiddenReportIds()
      });
    });
  }
  private async restore():Promise<void>{
    try{
      const data=await sessionDb.read<{
        nodes?:IntelNode[];targetLoadouts?:Record<string,{shell?:unknown;cannon?:unknown}>;
        plottingMode?:'normal'|'waypoint';hiddenReportIds?:string[];
      }>('plotter');
      if(!data)return;
      if(data.plottingMode==='waypoint')this.plottingMode.set('waypoint');
      if(Array.isArray(data.hiddenReportIds))
        this.hiddenReportIds.set(data.hiddenReportIds.filter((id):id is string=>typeof id==='string'));
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
      plottingMode:this.plottingMode(),hiddenReportIds:this.hiddenReportIds()
    });
  }
  @HostListener('document:keydown.escape')
  closeModal():void{
    this.modal.set(null);this.activeId.set(null);this.observationMapVisible.set(false);
    this.draftError.set('');
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
    this.nodes.set([{id:'nest',name:'Iron Nest',role:'nest',reports:[]}]);
    this.hiddenReportIds.set([]);this.filterOpen.set(false);
    this.status.set('Set Iron Nest grid, add spotters and then reference points or targets.');
    this.closeModal();
  }

  openAddReference():void{
    this.closeModal();
    this.filterOpen.set(false);
    this.draftRole.set('spotter');
    this.draftMethod.set('coordinates');
    this.draftName.set('');
    this.draftGrid.set(null);
    this.draftNest.set(this.nest()?.grid??null);
    this.draftReports.set([]);
    this.draftCandidate.set(null);
    this.draftShell.set('HCHE');
    this.draftCannon.set('left');
    this.modal.set('add');
  }
  changeDraftRole(value:string):void{
    if(value!=='spotter'&&value!=='reference'&&value!=='target')return;
    this.draftRole.set(value);
    this.draftMethod.set('coordinates');
    this.draftName.set('');
    this.draftGrid.set(null);
    this.draftReports.set([]);
    this.draftCandidate.set(null);
    this.draftError.set('');
  }
  changeDraftMethod(value:string):void{
    if(value!=='coordinates'&&value!=='reports')return;
    if(this.draftRole()==='spotter'&&value==='reports')return;
    this.draftMethod.set(value);
    this.draftGrid.set(null);
    this.draftReports.set([]);
    this.draftCandidate.set(null);
    this.draftError.set('');
  }
  updateDraftName(value:string):void{this.draftName.set(value.slice(0,48));}
  addDraftReport():void{
    if(this.draftReports().length>=12)return;
    const source=this.availableOrigins()[0];
    if(!source){this.draftError.set('Set Iron Nest coordinates or add a spotter first.');return;}
    this.draftReports.update(reports=>[...reports,{
      id:uid(),sourceId:source.id,type:'bearing',value:''
    }]);
    this.draftCandidate.set(null);
    this.draftError.set('');
  }
  updateDraftReport(id:string,key:'sourceId'|'type'|'value',value:string):void{
    this.draftReports.update(reports=>reports.map(r=>
      r.id===id?updateIntelReport(r,key,value):r));
    this.draftCandidate.set(null);
    this.draftError.set('');
  }
  removeDraftReport(id:string):void{
    this.draftReports.update(reports=>reports.filter(r=>r.id!==id));
    this.draftCandidate.set(null);
  }
  toggleReportVisibility(id:string):void{
    this.hiddenReportIds.update(ids=>ids.includes(id)?ids.filter(v=>v!==id):[...ids,id]);
  }
  setAllReportsVisible(visible:boolean):void{
    this.hiddenReportIds.set(visible?[]:this.reportRows().map(r=>r.id));
  }
  addReference():void{
    if(!this.canAddDraft()){
      this.draftError.set('Set Iron Nest and enter valid coordinates or reports. Targets must have a resolved position.');
      return;
    }
    const role=this.draftRole();
    const index=this.nodes().filter(n=>n.role===role).length+1;
    const padded=String(index).padStart(2,'0');
    const suffix=this.draftName().trim();
    const name=role==='spotter'?'Spotter #'+padded:
      role==='reference'?'Reference - '+suffix:
      'Target #'+padded+(suffix?' - '+suffix:'');
    const coordinateMode=role==='spotter'||this.draftMethod()==='coordinates';
    const node:IntelNode={
      id:role+'-'+uid(),role,name,
      ...(coordinateMode?{grid:{...this.draftGrid()!}}:{}),
      reports:coordinateMode?[]:this.draftReports().map(r=>({...r})),
      ...(!coordinateMode&&this.draftCandidate()!==null?{chosenCandidate:this.draftCandidate()}: {})
    };
    const nestGrid=this.draftNest()??this.nest()?.grid;
    if(!this.nestConfirmed()&&nestGrid)this.setNestGrid({...nestGrid});
    this.nodes.update(nodes=>[...nodes,node]);
    if(role==='target'){
      const nestPos=nestGrid?gridInputToPoint(nestGrid):null;
      const point=this.solution().get(node.id)?.position;
      const fire=nestPos&&point?firingFromPlot(nestPos,point):null;
      if(fire&&fire.grid&&fire.rangeKm>0&&fire.rangeKm<=30){
        this.fireSolution.emit({label:node.name,bearing:fire.bearing,
          distanceKm:fire.rangeKm,grid:fire.grid,
          nestGrid:formatGrid(nestPos)??'',shell:this.draftShell(),
          cannon:this.draftCannon(),stayOnPlot:true});
        this.status.set(name+' added and firing solution created.');
      }else{
        // Never persist a target without its promised firing solution.
        this.nodes.update(nodes=>nodes.filter(n=>n.id!==node.id));
        this.draftError.set('Unable to create firing solution. Check range (0–30 km) and reports.');
        return;
      }
    }else this.status.set(name+' added to map.');
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
    return r.position?(r.approximate?'≈ ':'')+(formatGrid(r.position)??'Outside map'):
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
