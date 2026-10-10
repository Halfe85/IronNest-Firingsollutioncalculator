/** Geometry for a floating expanded shot card. Coordinates are CSS viewport pixels. */
export interface FloatRect{left:number;top:number;width:number;height:number}
export interface FloatPlacement{
  left:number;top:number;width:number;height:number;
  fromX:number;fromY:number;scaleX:number;scaleY:number;
}
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
export function shotFloatPlacement(
  origin:FloatRect,viewport:FloatRect,container:FloatRect,mobile:boolean
):FloatPlacement{
  const gutter=mobile?10:12;
  const rect=mobile?viewport:{
    left:Math.max(viewport.left,container.left),
    top:Math.max(viewport.top,container.top),
    width:Math.max(1,Math.min(viewport.left+viewport.width,
      container.left+container.width)-Math.max(viewport.left,container.left)),
    height:Math.max(1,Math.min(viewport.top+viewport.height,
      container.top+container.height)-Math.max(viewport.top,container.top))
  };
  const width=Math.min(Math.max(1,rect.width-2*gutter),mobile?540:425);
  const height=Math.min(Math.max(1,rect.height-2*gutter),mobile?900:440);
  // An expanded tile moves 40% toward the content center, but never outside
  // the visible scroll viewport. No neighbouring card changes dimensions.
  const bias=mobile?1:0.40;
  const aimX=(origin.left+origin.width/2)*(1-bias)+
    (rect.left+rect.width/2)*bias-width/2;
  const aimY=(origin.top+origin.height/2)*(1-bias)+
    (rect.top+rect.height/2)*bias-height/2;
  const left=clamp(aimX,rect.left+gutter,rect.left+rect.width-gutter-width);
  const top=clamp(aimY,rect.top+gutter,rect.top+rect.height-gutter-height);
  return {left,top,width,height,fromX:origin.left-left,fromY:origin.top-top,
    scaleX:origin.width/width,scaleY:origin.height/height};
}
