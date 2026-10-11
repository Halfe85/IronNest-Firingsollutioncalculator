import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy,
  Output, ViewChild, computed, signal
} from '@angular/core';
import {type Point} from './map-math';
import {
  homeCamera, initialCamera, panCamera, viewFor, zoomCamera,
  type Camera, type ViewSize
} from './plot-navigation';

export interface MapPointMarker {id:string;name:string;role:string;p:Point;grid:string|null;}
export interface MapObservationMarker {id:string;type:'range'|'bearing'|'sector';source:Point;value:number;}

let mapInstance=0;
@Component({
  selector:'app-plot-map',standalone:true,
  templateUrl:'./plot-map.html',styleUrl:'./plot-map.css'
})
export class PlotMapComponent implements AfterViewInit, OnDestroy {
  @Input() markers:readonly MapPointMarker[]=[];
  @Input() observations:readonly MapObservationMarker[]=[];
  @Input() highlightId:string|null=null;
  /** Large observation map: gestures and controls on; miniature previews: off. */
  @Input() navigation=false;
  @Output() markerSelect=new EventEmitter<string>();
  @ViewChild('mapFrame') private frame?:ElementRef<HTMLDivElement>;

  readonly clipId='plot-map-clip-'+(++mapInstance);
  readonly columns='ABCDEFGHIJKLMNOPQRST'.split('');
  readonly rows=Array.from({length:10},(_,i)=>10-i);
  readonly viewportWidth=signal(960);
  readonly viewportHeight=signal(515);
  readonly camera=signal<Camera>({...homeCamera});
  readonly zoomPercent=computed(()=>Math.round(this.camera().zoom*100));
  readonly viewBox=computed(()=>{
    const v=viewFor(this.camera(),this.size());
    return [v.x,v.y,v.width,v.height].map(n=>n.toFixed(3)).join(' ');
  });

  private resizeObserver:ResizeObserver|null=null;
  private hasMeasured=false;
  private pointers=new Map<number,{x:number;y:number}>();
  private lastGestureAt=0;
  private movedSinceDown=false;

  ngAfterViewInit():void{
    this.measure();
    if(typeof ResizeObserver!=='undefined'&&this.frame){
      this.resizeObserver=new ResizeObserver(()=>this.measure());
      this.resizeObserver.observe(this.frame.nativeElement);
    }
  }
  ngOnDestroy():void{
    this.resizeObserver?.disconnect();
    this.pointers.clear();
  }
  private measure():void{
    const rect=this.frame?.nativeElement.getBoundingClientRect();
    if(!rect||rect.width<10||rect.height<10)return;
    const size={width:rect.width,height:rect.height};
    this.viewportWidth.set(size.width);
    this.viewportHeight.set(size.height);
    if(!this.hasMeasured){
      this.hasMeasured=true;
      if(this.navigation)this.camera.set(initialCamera(size));
    }
  }
  private size():ViewSize{return {width:this.viewportWidth(),height:this.viewportHeight()};}
  fitMap():void{this.camera.set({...homeCamera});}
  zoomStep(factor:number):void{
    const s=this.size();
    this.camera.update(camera=>zoomCamera(camera,s,factor,s.width/2,s.height/2));
  }
  focusNest():void{
    const nest=this.markers.find(m=>m.role==='nest');
    if(!nest)return;
    const s=this.size();
    this.camera.set({x:this.x(nest.p.x),y:this.y(nest.p.y),
      zoom:s.width<700?3.4:Math.max(2.2,this.camera().zoom)});
  }
  onWheel(event:WheelEvent):void{
    if(!this.navigation)return;
    event.preventDefault();
    const rect=this.frame?.nativeElement.getBoundingClientRect();
    if(!rect)return;
    this.camera.update(camera=>zoomCamera(camera,this.size(),
      event.deltaY<0?1.2:1/1.2,event.clientX-rect.left,event.clientY-rect.top));
  }
  onPointerDown(event:PointerEvent):void{
    if(!this.navigation || (event.pointerType==='mouse'&&event.button!==0))return;
    event.preventDefault();
    this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(this.pointers.size===1)this.movedSinceDown=false;
    const el=event.currentTarget;
    if(el instanceof SVGSVGElement)try{el.setPointerCapture(event.pointerId);}catch{}
  }
  onPointerMove(event:PointerEvent):void{
    if(!this.navigation||!this.pointers.has(event.pointerId))return;
    const points=[...this.pointers.values()];
    const previous=this.pointers.get(event.pointerId)!;
    const dx=event.clientX-previous.x,dy=event.clientY-previous.y;
    this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(Math.abs(dx)+Math.abs(dy)<.1)return;
    event.preventDefault();
    const s=this.size();
    if(points.length>=2){
      const oldA=points[0],oldB=points[1];
      const next=[...this.pointers.values()];
      const newA=next[0],newB=next[1];
      const oldDistance=Math.hypot(oldA.x-oldB.x,oldA.y-oldB.y);
      const newDistance=Math.hypot(newA.x-newB.x,newA.y-newB.y);
      const oldMidX=(oldA.x+oldB.x)/2,oldMidY=(oldA.y+oldB.y)/2;
      const nextMidX=(newA.x+newB.x)/2,nextMidY=(newA.y+newB.y)/2;
      const rect=this.frame?.nativeElement.getBoundingClientRect();
      if(rect&&oldDistance>1){
        this.camera.update(camera=>{
          const zoomed=zoomCamera(camera,s,newDistance/oldDistance,
            nextMidX-rect.left,nextMidY-rect.top);
          return panCamera(zoomed,s,nextMidX-oldMidX,nextMidY-oldMidY);
        });
      }
    }else{
      this.camera.update(camera=>panCamera(camera,s,dx,dy));
    }
    this.movedSinceDown=true;
    this.lastGestureAt=Date.now();
  }
  onPointerUp(event:PointerEvent):void{
    if(!this.pointers.has(event.pointerId))return;
    this.pointers.delete(event.pointerId);
    const el=event.currentTarget;
    if(el instanceof SVGSVGElement&&el.hasPointerCapture(event.pointerId))
      el.releasePointerCapture(event.pointerId);
    if(this.movedSinceDown)this.lastGestureAt=Date.now();
  }
  selectMarker(id:string):void{
    if(Date.now()-this.lastGestureAt<300)return; // Never select while panning.
    if(!id.includes('-option-'))this.markerSelect.emit(id);
  }
  x(x:number):number{return 45+x*44;}
  y(y:number):number{return 30+(10-y)*44;}
  rayX(o:MapObservationMarker):number{
    return this.x(o.source.x+Math.sin(o.value*Math.PI/180)*40);
  }
  rayY(o:MapObservationMarker):number{
    return this.y(o.source.y+Math.cos(o.value*Math.PI/180)*40);
  }
  sectorPath(o:MapObservationMarker):string {
    const a=(o.value-11.25)*Math.PI/180,b=(o.value+11.25)*Math.PI/180;
    const r=40*44,cx=this.x(o.source.x),cy=this.y(o.source.y);
    const x1=cx+Math.sin(a)*r,y1=cy-Math.cos(a)*r;
    const x2=cx+Math.sin(b)*r,y2=cy-Math.cos(b)*r;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
  }
}
