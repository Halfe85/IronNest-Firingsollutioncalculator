/** Browser-independent tactical-map camera mathematics (SVG units). */
export interface Camera {x:number;y:number;zoom:number}
export interface ViewSize {width:number;height:number}
export interface ViewBox {x:number;y:number;width:number;height:number}
export const MAP_WIDTH=960;
export const MAP_HEIGHT=515;
export const MIN_ZOOM=1;
export const MAX_ZOOM=8;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
export const homeCamera:Camera={x:480,y:257.5,zoom:1};

export function viewFor(camera:Camera,size:ViewSize):ViewBox {
  const aspect=Math.max(.1,size.width)/Math.max(.1,size.height);
  // At zoom 1 the whole 960x515 map fits without distortion.
  const width=Math.max(MAP_WIDTH,MAP_HEIGHT*aspect)/camera.zoom;
  const height=width/aspect;
  return {x:camera.x-width/2,y:camera.y-height/2,width,height};
}
export function constrain(camera:Camera,size:ViewSize):Camera {
  const zoom=clamp(camera.zoom,MIN_ZOOM,MAX_ZOOM);
  const area=viewFor({...camera,zoom},size);
  // Keep the playable map filling the viewport when zoomed in.
  // If the entire map fits, keep its center stable instead of showing a blank side.
  const minX=45+area.width/2-10,maxX=925-area.width/2+10;
  const minY=30+area.height/2-10,maxY=470-area.height/2+10;
  return {
    x:area.width>=900?480:clamp(camera.x,minX,maxX),
    y:area.height>=460?257.5:clamp(camera.y,minY,maxY),
    zoom
  };
}
export function panCamera(camera:Camera,size:ViewSize,deltaX:number,deltaY:number):Camera {
  const v=viewFor(camera,size);
  return constrain({
    x:camera.x-deltaX*v.width/Math.max(1,size.width),
    y:camera.y-deltaY*v.height/Math.max(1,size.height),zoom:camera.zoom
  },size);
}
export function zoomCamera(camera:Camera,size:ViewSize,factor:number,pivotX:number,pivotY:number):Camera {
  const before=viewFor(camera,size);
  const zoom=clamp(camera.zoom*factor,MIN_ZOOM,MAX_ZOOM);
  const worldX=camera.x+(pivotX/Math.max(1,size.width)-.5)*before.width;
  const worldY=camera.y+(pivotY/Math.max(1,size.height)-.5)*before.height;
  const after=viewFor({...camera,zoom},size);
  return constrain({
    x:worldX-(pivotX/Math.max(1,size.width)-.5)*after.width,
    y:worldY-(pivotY/Math.max(1,size.height)-.5)*after.height,zoom
  },size);
}
export function initialCamera(size:ViewSize):Camera {
  // Start phones close enough to tap individual 100m cells.
  const compact=size.width<700;
  const zoom=compact ? (size.height>size.width?3.0:2.0)
    : size.height<400 ? 1.5 : 1;
  return {...homeCamera,zoom};
}
