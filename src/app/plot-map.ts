import {Component, Input} from '@angular/core';
import {type Point} from './map-math';
export interface MapPointMarker {id:string; name:string; role:string; p:Point; grid:string|null;}
export interface MapObservationMarker {id:string;type:'range'|'bearing'|'sector';source:Point;value:number;}
@Component({
  selector:'app-plot-map',standalone:true,
  templateUrl:'./plot-map.html',styleUrl:'./plot-map.css'
})
export class PlotMapComponent {
  @Input() markers:readonly MapPointMarker[]=[];
  @Input() observations:readonly MapObservationMarker[]=[];
  @Input() highlightId:string|null=null;
  readonly columns='ABCDEFGHIJKLMNOPQRST'.split('');
  readonly rows=Array.from({length:10},(_,i)=>10-i);
  x(x:number):number{return 45+x*44;}
  y(y:number):number{return 30+(10-y)*44;}
  rayX(o:MapObservationMarker):number {
    return this.x(o.source.x+Math.sin(o.value*Math.PI/180)*40);
  }
  rayY(o:MapObservationMarker):number {
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
