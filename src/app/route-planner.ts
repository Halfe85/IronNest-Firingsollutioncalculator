import {CommonModule} from '@angular/common';
import {Component, EventEmitter, Input, Output, computed, effect, signal} from '@angular/core';
import {GridSelectComponent} from './grid-select';
import {EMPTY_GRID,gridInputFromText,gridInputLabel,type GridInput} from './graph-math';
import {formatGrid,parseGrid} from './map-math';
import {clockSeconds,type TrainStop} from './train-math';
import {fillWaypointTimes} from './route-timing';
import {sessionDb} from './session-db';
import {
  importLegacyRoutes,resolvedArrival,routeGeometry,routeOverlay,validTacticalRoute,
  type TacticalRoute,type TacticalRouteOrigin,type TacticalRouteOverlay
} from './tactical-routes';

function createId():string{
  return typeof crypto!=='undefined'&&'randomUUID' in crypto?
    crypto.randomUUID():'route-'+Date.now().toString(36)+Math.random().toString(36).slice(2);
}
@Component({
  selector:'app-route-planner',standalone:true,
  imports:[CommonModule,GridSelectComponent],
  templateUrl:'./route-planner.html',styleUrl:'./route-planner.css'
})
export class RoutePlannerComponent {
  readonly originsState=signal<TacticalRouteOrigin[]>([]);
  private readonly nestState=signal('');
  @Input() set origins(items:readonly TacticalRouteOrigin[]){
    this.originsState.set(items.map(o=>({...o})));
  }
  @Input() set nestGrid(value:string|null){this.nestState.set(value??'');}
  @Output() overlayChange=new EventEmitter<TacticalRouteOverlay>();

  readonly emptyGrid=EMPTY_GRID;
  readonly gridInputFromText=gridInputFromText;
  readonly hydrated=signal(false);
  readonly routes=signal<TacticalRoute[]>([]);
  readonly screen=signal<'select'|'config'|'waypoints'|'editor'|null>(null);
  readonly selectedId=signal<string|null>(null);
  readonly routeDraft=signal<TacticalRoute|null>(null);
  readonly stopDraft=signal<TrainStop|null>(null);
  readonly error=signal('');
  readonly currentRoute=computed(()=>this.routes().find(r=>r.id===this.selectedId())??null);
  readonly geometry=computed(()=>{
    const route=this.currentRoute();
    return route?routeGeometry(route,this.originsState(),this.nestState()):null;
  });
  readonly routeEntries=computed(()=>this.currentRoute()?.stops.map((stop,i)=>({
    stop,index:i,grid:this.geometry()?.grids[i]??null,
    error:this.geometry()?.errors[i]??null
  }))??[]);
  readonly arrivalGrid=computed(()=>this.routeDraft()?
    resolvedArrival(this.routeDraft()!,this.originsState()):'');
  readonly canSaveConfig=computed(()=>{
    const draft=this.routeDraft();
    return !!draft?.name.trim()&&!!parseGrid(resolvedArrival(draft,this.originsState()));
  });
  readonly stopGrid=computed(()=>gridInputFromText(this.stopDraft()?.grid??'')??EMPTY_GRID);
  readonly editingArrival=computed(()=>{
    const route=this.currentRoute(),stop=this.stopDraft();
    return !!route&&!!stop&&route.stops[route.stops.length-1].id===stop.id;
  });
  readonly canDeleteStop=computed(()=>{
    const route=this.currentRoute(),stop=this.stopDraft();
    if(!route||!stop||route.stops.length<=2)return false;
    const index=route.stops.findIndex(s=>s.id===stop.id);
    return index>=0&&index<route.stops.length-1;
  });
  readonly sourceOptions=computed(()=>{
    const route=this.currentRoute();
    if(!route)return [];
    const result=[{id:'arrival',name:'Arrival reference'}];
    for(const source of this.originsState())
      result.push({id:'ref:'+source.id,name:source.name});
    const foundIndex=route.stops.findIndex(s=>s.id===this.stopDraft()?.id);
    // A new waypoint is inserted immediately before arrival: earlier stops
    // must already be available as origins in its editor.
    const currentIndex=foundIndex<0?route.stops.length-1:foundIndex;
    for(let i=0;i<currentIndex;i++){
      const point=this.geometry()?.points[i];
      if(point)result.push({id:route.stops[i].id??'',name:route.stops[i].name});
    }
    for(const ref of route.references??[])
      result.push({id:'ref:'+ref.id,name:ref.name+' (imported)'});
    return result;
  });
  constructor(){
    void this.restore();
    effect(()=>{
      if(!this.hydrated())return;
      void sessionDb.write('routes',this.routes());
      this.overlayChange.emit(routeOverlay(this.routes(),this.originsState(),this.nestState()));
    });
  }
  private async restore():Promise<void>{
    try{
      const saved=await sessionDb.read<unknown>('routes');
      if(Array.isArray(saved)){
        this.routes.set(saved.filter(validTacticalRoute).slice(0,25));
      }else{
        const legacy=await sessionDb.read<unknown>('waypoint');
        this.routes.set(importLegacyRoutes(legacy));
      }
    }finally{this.hydrated.set(true);}
  }
  ngOnDestroy():void{
    if(this.hydrated())void sessionDb.write('routes',this.routes());
  }
  openSelection():void{this.error.set('');this.screen.set('select');}
  close():void{
    this.error.set('');
    this.routeDraft.set(null);this.stopDraft.set(null);
    this.screen.set(null);
  }
  back():void{
    this.error.set('');
    if(this.screen()==='editor')this.screen.set('waypoints');
    else if(this.screen()==='waypoints')this.screen.set('select');
    else if(this.screen()==='config'){
      this.routeDraft.set(null);
      this.screen.set(this.currentRoute()?'waypoints':'select');
    }else this.close();
  }
  newRoute():void{
    if(this.routes().length>=25){this.error.set('Maximum 25 routes.');return;}
    const route:TacticalRoute={
      id:createId(),name:'New route',
      stationGrid:'',stationReferenceId:null,railBearing:'',
      approachSide:'bearing',routeSpeed:'',targetLabel:'Moving target',
      stops:[
        {id:createId(),name:'Waypoint A',kmFromStation:5,time:'',method:'route'},
        {id:createId(),name:'Arrival',kmFromStation:0,time:'',method:'route'}
      ]
    };
    this.selectedId.set(route.id);
    this.routeDraft.set(route);
    this.error.set('');
    this.screen.set('config');
  }
  selectRoute(id:string):void{
    if(!this.routes().some(r=>r.id===id))return;
    this.selectedId.set(id);
    this.error.set('');
    this.screen.set('waypoints');
  }
  editRoute():void{
    const selected=this.currentRoute();
    if(!selected)return;
    this.routeDraft.set({...selected,stops:selected.stops.map(s=>({...s}))});
    this.error.set('');
    this.screen.set('config');
  }
  setRouteName(name:string):void{this.routeDraft.update(r=>r?{...r,name:name.slice(0,60)}:r);}
  setRouteTarget(name:string):void{this.routeDraft.update(r=>r?{...r,targetLabel:name.slice(0,50)}:r);}
  setRouteBearing(value:string):void{this.routeDraft.update(r=>r?{...r,railBearing:value}:r);}
  setRouteDirection(value:string):void{
    if(value!=='bearing'&&value!=='opposite')return;
    this.routeDraft.update(r=>r?{...r,approachSide:value}:r);
  }
  setArrivalSource(id:string):void{
    if(id!=='manual'&&!this.originsState().some(o=>o.id===id))return;
    this.routeDraft.update(r=>r?{...r,stationReferenceId:id==='manual'?null:id}:r);
  }
  setArrivalGrid(value:GridInput):void{
    this.routeDraft.update(r=>r?{...r,stationGrid:gridInputLabel(value),
      stationReferenceId:null}:r);
  }
  saveRoute():void{
    const draft=this.routeDraft();
    if(!draft||!this.canSaveConfig()){
      this.error.set('Set a route name and a valid arrival grid or saved Tactical Map reference.');
      return;
    }
    const saved={...draft,name:draft.name.trim(),stops:draft.stops.map(s=>({...s}))};
    this.routes.update(routes=>{
      if(routes.some(r=>r.id===saved.id))
        return routes.map(r=>r.id===saved.id?saved:r);
      return [...routes,saved];
    });
    this.selectedId.set(saved.id);
    this.routeDraft.set(null);
    this.error.set('');
    this.screen.set('waypoints');
  }
  openStop(id:string):void{
    const point=this.currentRoute()?.stops.find(s=>s.id===id);
    if(!point)return;
    this.stopDraft.set({...point});
    this.error.set('');
    this.screen.set('editor');
  }
  openFromMap(markerId:string):void{
    const index=markerId.indexOf(':');
    if(index<0)return;
    const routeId=markerId.slice(0,index),stopId=markerId.slice(index+1);
    this.selectRoute(routeId);
    this.openStop(stopId);
  }
  newStop():void{
    const route=this.currentRoute();
    if(!route||route.stops.length>=12)return;
    const before=route.stops[route.stops.length-2];
    const distance=(before?.kmFromStation??5)/2;
    this.stopDraft.set({
      id:createId(),name:'Waypoint '+route.stops.length,kmFromStation:
      Math.max(.01,Number(distance.toFixed(3))),
      time:'',method:'manual',grid:''
    });
    this.error.set('');
    this.screen.set('editor');
  }
  setStopText(field:'name'|'time'|'grid',value:string):void{
    this.stopDraft.update(s=>s?{...s,[field]:value}:s);
  }
  setStopNumber(field:'kmFromStation'|'routeBearing'|'routeDistanceKm'|
    'relativeBearing'|'relativeKm',value:string):void{
    const number=value.trim()===''?NaN:Number(value.replace(',','.'));
    this.stopDraft.update(s=>s?{...s,[field]:number}:s);
  }
  setStopOption(field:'method'|'routeReferenceId'|'routeDirection'|
    'relativeTo'|'relativeDirection',value:string):void{
    if(field==='method'&&!['route','manual','observed','relative'].includes(value))return;
    this.stopDraft.update(s=>s?{...s,[field]:value}:s);
  }
  setStopGrid(grid:GridInput):void{
    this.setStopText('grid',gridInputLabel(grid));
  }
  saveStop():void{
    const stop=this.stopDraft(),route=this.currentRoute();
    if(!stop||!route)return;
    const index=route.stops.findIndex(s=>s.id===stop.id);
    const arrival=index===route.stops.length-1;
    if(!stop.name.trim()||!Number.isFinite(stop.kmFromStation)||
      stop.kmFromStation<0||(stop.time.trim()!==''&&clockSeconds(stop.time)===null)){
      this.error.set('Provide a name, distance (km), and optional valid game time HH:MM:SS.');
      return;
    }
    if(!arrival&&(stop.method==='manual'||stop.method==='observed')&&!parseGrid(stop.grid??'')){
      this.error.set('Choose the waypoint grid before saving.');
      return;
    }
    const next=index>=0?route.stops.map(s=>s.id===stop.id?{...stop}:s):
      [...route.stops.slice(0,-1),{...stop},route.stops[route.stops.length-1]];
    if(next.some((s,i)=>i>0&&s.kmFromStation>=next[i-1].kmFromStation)){
      this.error.set('Waypoint distances must decrease toward arrival (0 km).');
      return;
    }
    this.routes.update(routes=>routes.map(r=>r.id===route.id?{...r,stops:next}:r));
    this.stopDraft.set(null);this.error.set('');
    this.screen.set('waypoints');
  }
  deleteStop():void{
    const stop=this.stopDraft(),route=this.currentRoute();
    if(!route||!stop||route.stops.length<=2)return;
    const idx=route.stops.findIndex(s=>s.id===stop.id);
    if(idx<0||idx===route.stops.length-1)return;
    if(!window.confirm('Delete this waypoint from the route?'))return;
    this.routes.update(routes=>routes.map(r=>r.id===route.id?
      {...r,stops:r.stops.filter(s=>s.id!==stop.id)}:r));
    this.stopDraft.set(null);this.screen.set('waypoints');
  }
  setSpeed(value:string):void{
    const id=this.selectedId();
    this.routes.update(routes=>routes.map(r=>r.id===id?{...r,routeSpeed:value}:r));
  }
  fillTimes():void{
    const route=this.currentRoute();
    if(!route)return;
    const result=fillWaypointTimes(route.stops,Number(route.routeSpeed.replace(',','.')));
    if(result.error){this.error.set(result.error);return;}
    this.routes.update(routes=>routes.map(r=>r.id===route.id?{...r,stops:result.stops}:r));
    this.error.set('');
  }
  deleteRoute():void{
    const route=this.currentRoute();
    if(!route||!window.confirm('Delete '+route.name+' and its waypoints?'))return;
    this.routes.update(routes=>routes.filter(r=>r.id!==route.id));
    this.screen.set('select');this.selectedId.set(null);
  }
  clearRoutes():void{
    this.routes.set([]);
    this.close();
  }
  statusText(index:number):string{
    const geom=this.geometry();
    if(!geom)return 'UNRESOLVED';
    return geom.grids[index]??geom.errors[index]??'UNRESOLVED';
  }
  getStopBearing():string{
    const value=this.stopDraft()?.routeBearing;
    return value===undefined||value===null||!Number.isFinite(value)?'':String(value);
  }
  getStopDistance():string{
    const stop=this.stopDraft();
    if(!stop)return '';
    const value=stop.routeReferenceId&&stop.routeReferenceId!=='arrival'?
      stop.routeDistanceKm:stop.routeDistanceKm??stop.kmFromStation;
    return value===undefined||value===null||!Number.isFinite(value)?'':String(value);
  }
  getRelativeNumber(key:'relativeBearing'|'relativeKm'):string{
    const value=this.stopDraft()?.[key];
    return value===undefined||!Number.isFinite(value)?'':String(value);
  }
}
