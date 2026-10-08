import {CommonModule} from '@angular/common';
import {Component, HostListener, computed, effect, signal} from '@angular/core';
import {TacticalPlotterComponent, type PlotFireRequest} from './tactical-plotter';
import {GridSelectComponent} from './grid-select';
import {EMPTY_GRID,gridInputFromText,gridInputLabel,gridInputToPoint,type GridInput} from './graph-math';
import {bearingDegrees,distanceKm,formatGrid,onMap,parseGrid,type Point} from './map-math';
import {projectImpact,correctFromImpact} from './impact-correction';
import {CHARGES,SHELLS,elevationAt} from './firing';
import {cannonOrUnassigned, normalizeShell, type Cannon} from './shot-options';

type Tab='calc'|'plot'|'shots';
type ShotState='pending'|'hit'|'miss';
type GridCorrectionMode='target'|'impact';
interface ShotRevision {
  oldBearing:number;oldDistanceKm:number;oldCharges:number;oldElevation:number;
  reportedGrid:string;kind:GridCorrectionMode;changedAt:string;
}
interface ShotCard{
  id:string;label:string;createdAt:string;shell:string; bearing:number;
  distanceKm:number;charges:number;elevation:number;
  cannon:Cannon|null;
  /** Map origin and precise target / current aiming point in kilometres. */
  nestPosition?:Point|null;
  targetPosition?:Point|null;
  aimPosition?:Point|null;
  revisions?:ShotRevision[];
  lastReport?:{grid:string;kind:GridCorrectionMode}|null;
  state:ShotState;missKm:number|null;
}
const STORE='iron-nest-shots-v2';
const OLD_STORE='iron-nest-fcc-v1';
function uid():string {
  return typeof crypto!=='undefined'&&'randomUUID' in crypto?
    crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
}
@Component({
  selector:'app-root',standalone:true,
  imports:[CommonModule,TacticalPlotterComponent,GridSelectComponent],
  templateUrl:'./app.html',styleUrl:'./app.css'
})
export class AppComponent {
  readonly gridInputLabel=gridInputLabel;
  readonly charges=CHARGES;
  readonly shells=SHELLS;
  readonly tab=signal<Tab>('calc');
  readonly label=signal('Target');
  readonly bearing=signal('90');
  readonly distance=signal('6.57');
  readonly shell=signal('HCHE');
  readonly cannon=signal<Cannon>('left');
  readonly chargeMode=signal(0);
  readonly nestGrid=signal<GridInput>({...EMPTY_GRID});
  readonly nestConfirmed=signal(false);
  readonly inputNest=computed(()=>this.nestConfirmed()?gridInputToPoint(this.nestGrid()):null);
  readonly predictedTarget=computed(()=>{
    const nest=this.inputNest();
    return nest?projectImpact(nest,this.manualBearing(),this.manualDistance()):null;
  });
  readonly predictedGrid=computed(()=>this.predictedTarget()
    ?formatGrid(this.predictedTarget()!):null);
  readonly shots=signal<ShotCard[]>([]);
  readonly activeShotId=signal<string|null>(null);
  readonly modal=signal<'about'|'miss'|null>(null);
  readonly reportGrid=signal<GridInput>({...EMPTY_GRID});
  readonly reportMode=signal<GridCorrectionMode>('target');
  readonly reportNestGrid=signal<GridInput>({...EMPTY_GRID});
  readonly reportNestConfirmed=signal(false);
  readonly reportPreview=computed(()=>{
    const shot=this.missShot();
    const nest=shot?.nestPosition??(this.reportNestConfirmed()?gridInputToPoint(this.reportNestGrid()):null);
    const observed=gridInputToPoint(this.reportGrid());
    if(!shot||!nest||!observed)return null;
    const originalTarget=shot.targetPosition??projectImpact(nest,shot.bearing,shot.distanceKm);
    const oldAim=shot.aimPosition??originalTarget;
    if(!originalTarget||!oldAim)return null;
    if(this.reportMode()==='target'){
      const dist=distanceKm(nest,observed);
      if(dist<=0||dist>30)return null;
      const charges=elevationAt(dist,shot.charges)!==null
        ?shot.charges:Math.ceil(dist/5);
      const angle=elevationAt(dist,charges);
      if(angle===null)return null;
      return {
        bearing:bearingDegrees(nest,observed),distanceKm:dist,charges,elevation:angle,
        grid:formatGrid(observed),targetPosition:observed,aimPosition:observed,
        errorKm:distanceKm(originalTarget,observed)
      };
    }
    const correction=correctFromImpact(nest,originalTarget,oldAim,
      gridInputLabel(this.reportGrid()),shot.charges);
    return correction?{
      bearing:correction.newBearing,distanceKm:correction.newDistanceKm,
      charges:correction.charges,elevation:correction.elevation,
      grid:correction.aimGrid,targetPosition:originalTarget,
      aimPosition:correction.aimPoint,errorKm:correction.errorKm
    }:null;
  });
  readonly selectedMissShot=signal<string|null>(null);
  readonly error=signal('');
  readonly manualDistance=computed(()=>{
    const txt=this.distance().trim().replace(',','.');
    return txt===''?NaN:Number(txt);
  });
  readonly manualBearing=computed(()=>{
    const txt=this.bearing().trim().replace(',','.');
    return txt===''?NaN:Number(txt);
  });
  readonly currentCharges=computed(()=>{
    const d=this.manualDistance();
    if(!Number.isFinite(d)||d<=0||d>30)return null;
    const charges=this.chargeMode()||Math.ceil(d/5);
    return elevationAt(d,charges)!==null?charges:null;
  });
  readonly elevation=computed(()=>{
    const charges=this.currentCharges();
    const b=this.manualBearing();
    return charges===null||!Number.isFinite(b)||b<0||b>360?
      null:elevationAt(this.manualDistance(),charges);
  });
  readonly activeShot=computed(()=>this.shots().find(s=>s.id===this.activeShotId())??null);
  readonly bottomSolution=computed(()=>{
    if(this.tab()==='calc'&&this.elevation()!==null)
      return {charge:this.currentCharges()!,elevation:this.elevation()!};
    const shot=this.activeShot();
    return shot?{charge:shot.charges,elevation:shot.elevation}:null;
  });
  readonly missShot=computed(()=>this.shots().find(s=>s.id===this.selectedMissShot())??null);
  readonly correctedAngle=computed(()=>this.reportPreview()?.elevation??null);
  gridOf(point:Point|null|undefined):string|null{
    return point?formatGrid(point):null;
  }
  setNestGrid(value:GridInput):void{
    this.nestGrid.set(value);this.nestConfirmed.set(true);
  }
  confirmNest():void{this.nestConfirmed.set(true);}
  setReportGrid(value:GridInput):void{this.reportGrid.set(value);}
  setReportNest(value:GridInput):void{
    this.reportNestGrid.set(value);this.reportNestConfirmed.set(true);
  }
  constructor(){
    this.restore();
    effect(()=>{try{localStorage.setItem(STORE,JSON.stringify({
      shots:this.shots(),activeShotId:this.activeShotId(),nestGrid:this.nestGrid(),nestConfirmed:this.nestConfirmed()
    }));}catch{/* storage unavailable */}});
  }
  private restore():void{
    try{
      const raw=localStorage.getItem(STORE);
      if(raw){
        const data=JSON.parse(raw) as {shots?:ShotCard[];activeShotId?:string;nestGrid?:GridInput;nestConfirmed?:boolean};
        if(data.nestGrid&&gridInputToPoint(data.nestGrid))this.nestGrid.set(data.nestGrid);
        if(data.nestConfirmed===true)this.nestConfirmed.set(true);
        if(Array.isArray(data.shots)){
          this.shots.set(data.shots.filter(s=>s&&typeof s.id==='string'&&
            Number.isFinite(s.distanceKm)&&Number.isFinite(s.elevation)&&
            ['pending','hit','miss'].includes(s.state)).slice(0,200).map(s=>({
              ...s, shell:normalizeShell(s.shell),
              // Existing shots were created before cannon assignment existed.
              cannon:cannonOrUnassigned(s.cannon)
              ,
              // Historical shots may not have location tracking metadata.
              nestPosition:s.nestPosition&&onMap(s.nestPosition)?s.nestPosition:null,
              targetPosition:s.targetPosition&&onMap(s.targetPosition)?s.targetPosition:null,
              aimPosition:s.aimPosition&&onMap(s.aimPosition)?s.aimPosition:null,
              revisions:Array.isArray(s.revisions)?s.revisions.slice(-30):[],
              lastReport:s.lastReport??null
            })));
        }
        if(typeof data.activeShotId==='string')this.activeShotId.set(data.activeShotId);
        return;
      }
      const old=JSON.parse(localStorage.getItem(OLD_STORE)??'null') as
        {shots?:Array<{id:string;target:string;createdAt:string;shell:string;
          bearing:number;distanceKm:number;charge:number;elevation:number}>}|null;
      if(old&&Array.isArray(old.shots))this.shots.set(old.shots.slice(0,200).map(s=>({
        id:s.id,label:s.target,createdAt:s.createdAt,shell:s.shell,
        bearing:s.bearing,distanceKm:s.distanceKm,charges:s.charge,
        elevation:s.elevation,cannon:null,state:'pending',missKm:null
      })));
    }catch{/* corrupted data */ }
  }
  @HostListener('document:keydown.escape')
  closeModal():void{this.modal.set(null);this.selectedMissShot.set(null);}
  selectTab(tab:Tab):void{this.tab.set(tab);this.error.set('');}
  setChargeMode(value:string):void{this.chargeMode.set(Number(value));}
  setCannon(value:string):void {
    const side=cannonOrUnassigned(value);
    if(side)this.cannon.set(side);
  }
  setShotCannon(id:string,value:string):void {
    const side=cannonOrUnassigned(value);
    if(!side)return;
    this.shots.update(rows=>rows.map(shot=>shot.id===id?{...shot,cannon:side}:shot));
  }
  private makeShot(input:{label:string;bearing:number;distanceKm:number;charges:number;
    shell?:string;cannon?:Cannon|null;nestPosition?:Point|null;targetPosition?:Point|null}):void{
    const angle=elevationAt(input.distanceKm,input.charges);
    if(angle===null||!Number.isFinite(input.bearing)||input.bearing<0||input.bearing>360){
      this.error.set('Invalid firing solution: check range, bearing and powder.');return;
    }
    const origin=input.nestPosition??null;
    const intended=input.targetPosition??(origin?
      projectImpact(origin,input.bearing,input.distanceKm):null);
    if(!origin||!intended){
      this.error.set('Confirm the Iron Nest grid and a target position inside the map.');return;
    }
    const shot:ShotCard={
      id:uid(),label:input.label.trim().slice(0,60)||'Target',createdAt:new Date().toISOString(),
      shell:normalizeShell(input.shell??this.shell()),bearing:input.bearing,distanceKm:input.distanceKm,
      charges:input.charges,elevation:angle,cannon:input.cannon===undefined?this.cannon():input.cannon,
      nestPosition:origin,targetPosition:intended,aimPosition:intended,revisions:[],lastReport:null,
      state:'pending',missKm:null
    };
    this.shots.update(rows=>[shot,...rows].slice(0,200));
    this.activeShotId.set(shot.id);this.tab.set('shots');this.error.set('');
  }
  addManual():void{
    const charge=this.currentCharges();
    if(charge===null||this.elevation()===null||!this.predictedTarget()||!this.inputNest()){
      this.error.set('Enter a valid bearing and distance (up to 30 km).');return;
    }
    this.makeShot({label:this.label(),bearing:this.manualBearing(),
      distanceKm:this.manualDistance(),charges:charge,shell:this.shell(),cannon:this.cannon(),
      nestPosition:this.inputNest(),targetPosition:this.predictedTarget()});
  }
  addFromPlot(data:PlotFireRequest):void{
    const charge=Math.ceil(data.distanceKm/5);
    const origin=data.nestGrid?parseGrid(data.nestGrid):null;
    const target=data.grid?parseGrid(data.grid):null;
    this.makeShot({...data,charges:charge,shell:data.shell,cannon:data.cannon,
      nestPosition:origin,targetPosition:target});
  }
  markHit(id:string):void{
    this.shots.update(rows=>rows.map(s=>s.id===id?{...s,state:'hit',missKm:null}:s));
    this.activeShotId.set(id);
  }
  openMiss(id:string):void{
    const shot=this.shots().find(s=>s.id===id);
    if(!shot)return;
    this.selectedMissShot.set(id);this.activeShotId.set(id);
    this.reportMode.set('target');
    const current=shot.targetPosition??(shot.nestPosition?
      projectImpact(shot.nestPosition,shot.bearing,shot.distanceKm):null);
    const grid=current?formatGrid(current):null;
    this.reportGrid.set(gridInputFromText(grid??'')??{...EMPTY_GRID});
    this.reportNestGrid.set({...this.nestGrid()});
    this.reportNestConfirmed.set(Boolean(shot.nestPosition)||this.nestConfirmed());
    this.error.set('');this.modal.set('miss');
  }
  setReportMode(mode:string):void{
    if(mode==='target'||mode==='impact')this.reportMode.set(mode);
  }
  saveMiss():void{
    const original=this.missShot(),preview=this.reportPreview();
    if(!original||!preview){this.error.set('Check the Iron Nest and reported grid.');return;}
    const origin=original.nestPosition??(this.reportNestConfirmed()?
      gridInputToPoint(this.reportNestGrid()):null);
    if(!origin){this.error.set('Enter the Iron Nest position for this older shot.');return;}
    const revision:ShotRevision={
      oldBearing:original.bearing,oldDistanceKm:original.distanceKm,
      oldCharges:original.charges,oldElevation:original.elevation,
      reportedGrid:gridInputLabel(this.reportGrid()),kind:this.reportMode(),
      changedAt:new Date().toISOString()
    };
    this.shots.update(rows=>rows.map(s=>s.id===original.id?{
      ...s,bearing:preview.bearing,distanceKm:preview.distanceKm,
      charges:preview.charges,elevation:preview.elevation,
      nestPosition:origin,targetPosition:preview.targetPosition,
      aimPosition:preview.aimPosition,
      lastReport:{grid:gridInputLabel(this.reportGrid()),kind:this.reportMode()},
      revisions:[...(s.revisions??[]),revision].slice(-30),
      state:'pending' as ShotState,missKm:null
    }:s));
    this.error.set('');this.closeModal();
  }
  suggestedAngle(shot:ShotCard):number|null{
    return shot.elevation;
  }
  retry(shot:ShotCard):void{
    if(!shot.nestPosition||!shot.aimPosition)return;
    this.makeShot({label:shot.label+' (retry)',bearing:shot.bearing,
      distanceKm:shot.distanceKm,charges:shot.charges,
      shell:shot.shell,cannon:shot.cannon,
      nestPosition:shot.nestPosition,targetPosition:shot.aimPosition});
  }
  removeShot(id:string):void{
    this.shots.update(rows=>rows.filter(s=>s.id!==id));
    if(this.activeShotId()===id)this.activeShotId.set(this.shots()[0]?.id??null);
  }
  resetReport(shot:ShotCard):void{
    this.shots.update(rows=>rows.map(s=>s.id===shot.id?{...s,state:'pending',missKm:null}:s));
  }
  openAbout():void{this.modal.set('about');}
}
