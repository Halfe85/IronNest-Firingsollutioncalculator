import {CommonModule} from '@angular/common';
import {Component, HostListener, computed, effect, signal} from '@angular/core';
import {TacticalPlotterComponent, type PlotFireRequest} from './tactical-plotter';
import {TrainTrackerComponent} from './train-tracker';
import {CHARGES,SHELLS,elevationAt} from './firing';
import {cannonOrUnassigned, normalizeShell, type Cannon} from './shot-options';

type Tab='calc'|'plot'|'shots'|'train';
type ShotState='pending'|'hit'|'miss';
interface ShotCard{
  id:string;label:string;createdAt:string;shell:string; bearing:number;
  distanceKm:number;charges:number;elevation:number;
  cannon:Cannon|null;
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
  imports:[CommonModule,TacticalPlotterComponent,TrainTrackerComponent],
  templateUrl:'./app.html',styleUrl:'./app.css'
})
export class AppComponent {
  readonly charges=CHARGES;
  readonly shells=SHELLS;
  readonly tab=signal<Tab>('calc');
  readonly label=signal('Target');
  readonly bearing=signal('90');
  readonly distance=signal('6.57');
  readonly shell=signal('HCHE');
  readonly cannon=signal<Cannon>('left');
  readonly chargeMode=signal(0);
  readonly shots=signal<ShotCard[]>([]);
  readonly activeShotId=signal<string|null>(null);
  readonly modal=signal<'about'|'miss'|null>(null);
  readonly missInput=signal('');
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
  readonly correctedAngle=computed(()=>{
    const shot=this.missShot();
    if(!shot)return null;
    const n=Number(this.missInput().trim().replace(',','.'));
    if(this.missInput().trim()===''||!Number.isFinite(n))return null;
    return elevationAt(shot.distanceKm-n,shot.charges);
  });
  constructor(){
    this.restore();
    effect(()=>{try{localStorage.setItem(STORE,JSON.stringify({
      shots:this.shots(),activeShotId:this.activeShotId()
    }));}catch{/* storage unavailable */}});
  }
  private restore():void{
    try{
      const raw=localStorage.getItem(STORE);
      if(raw){
        const data=JSON.parse(raw) as {shots?:ShotCard[];activeShotId?:string};
        if(Array.isArray(data.shots)){
          this.shots.set(data.shots.filter(s=>s&&typeof s.id==='string'&&
            Number.isFinite(s.distanceKm)&&Number.isFinite(s.elevation)&&
            ['pending','hit','miss'].includes(s.state)).slice(0,200).map(s=>({
              ...s, shell:normalizeShell(s.shell),
              // Existing shots were created before cannon assignment existed.
              cannon:cannonOrUnassigned(s.cannon)
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
  private makeShot(input:{label:string;bearing:number;distanceKm:number;charges:number;shell?:string;cannon?:Cannon|null}):void{
    const angle=elevationAt(input.distanceKm,input.charges);
    if(angle===null||!Number.isFinite(input.bearing)||input.bearing<0||input.bearing>360){
      this.error.set('Invalid firing solution: check range, bearing and powder.');return;
    }
    const shot:ShotCard={
      id:uid(),label:input.label.trim().slice(0,60)||'Target',createdAt:new Date().toISOString(),
      shell:normalizeShell(input.shell??this.shell()),bearing:input.bearing,distanceKm:input.distanceKm,
      charges:input.charges,elevation:angle,cannon:input.cannon===undefined?this.cannon():input.cannon,
      state:'pending',missKm:null
    };
    this.shots.update(rows=>[shot,...rows].slice(0,200));
    this.activeShotId.set(shot.id);this.tab.set('shots');this.error.set('');
  }
  addManual():void{
    const charge=this.currentCharges();
    if(charge===null||this.elevation()===null){
      this.error.set('Enter a valid bearing and distance (up to 30 km).');return;
    }
    this.makeShot({label:this.label(),bearing:this.manualBearing(),
      distanceKm:this.manualDistance(),charges:charge,shell:this.shell(),cannon:this.cannon()});
  }
  addFromPlot(data:PlotFireRequest):void{
    const charge=Math.ceil(data.distanceKm/5);
    this.makeShot({...data,charges:charge,shell:data.shell,cannon:data.cannon});
  }
  addFromTrain(data:{bearing:number;distanceKm:number;target:string;impactClock:string;flightSeconds:string}):void{
    const charge=Math.ceil(data.distanceKm/5);
    this.makeShot({label:data.target,bearing:data.bearing,distanceKm:data.distanceKm,charges:charge});
  }
  markHit(id:string):void{
    this.shots.update(rows=>rows.map(s=>s.id===id?{...s,state:'hit',missKm:null}:s));
    this.activeShotId.set(id);
  }
  openMiss(id:string):void{
    this.selectedMissShot.set(id);this.activeShotId.set(id);
    this.missInput.set('');this.error.set('');this.modal.set('miss');
  }
  saveMiss():void{
    const id=this.selectedMissShot();
    if(!id||!this.missInput().trim())return;
    const miss=Number(this.missInput().trim().replace(',','.'));
    const shot=this.missShot();
    if(!shot||!Number.isFinite(miss)||miss===0||!Number.isFinite(shot.distanceKm-miss)||
      shot.distanceKm-miss<=0){
      this.error.set('Enter a non-zero signed miss in kilometres. + beyond, − short.');return;
    }
    this.shots.update(rows=>rows.map(s=>s.id===id?
      {...s,state:'miss',missKm:miss}:s));
    this.error.set('');this.closeModal();
  }
  suggestedAngle(shot:ShotCard):number|null{
    return shot.missKm===null?null:elevationAt(shot.distanceKm-shot.missKm,shot.charges);
  }
  retry(shot:ShotCard):void{
    if(shot.missKm===null)return;
    const target=shot.distanceKm-shot.missKm;
    const charge=elevationAt(target,shot.charges)!==null?
      shot.charges:Math.ceil(target/5);
    this.makeShot({label:shot.label+' (corrected)',bearing:shot.bearing,
      distanceKm:target,charges:charge,shell:shot.shell,cannon:shot.cannon});
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
