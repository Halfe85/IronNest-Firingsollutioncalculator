import {
  bearingDegrees, distanceKm, formatGrid, onMap, parseGrid, type Point
} from './map-math';
import {elevationAt} from './firing';

/** Game-map azimuth: 0 north, 90 east; cell unit is 1 km. */
export function projectImpact(nest:Point,bearing:number,rangeKm:number):Point|null{
  if(!onMap(nest)||!Number.isFinite(bearing)||bearing<0||bearing>360||
    !Number.isFinite(rangeKm)||rangeKm<=0)return null;
  const rad=bearing*Math.PI/180;
  const point={x:nest.x+Math.sin(rad)*rangeKm,y:nest.y+Math.cos(rad)*rangeKm};
  return onMap(point)?point:null;
}
export interface CorrectedImpact {
  aimPoint:Point;
  aimGrid:string;
  targetGrid:string;
  impactGrid:string;
  errorKm:number;
  newBearing:number;
  newDistanceKm:number;
  charges:number;
  elevation:number;
}
/** First-order in-game correction; assumes the shot's observed displacement
 * can be canceled by translating the aim point by the opposite vector.
 * The target stays fixed; consecutive corrections use the preceding aimpoint.
 * This is a game convenience, not a calibrated physical model.
 */
export function correctFromImpact(
  nest:Point,
  intendedTarget:Point,
  previousAim:Point,
  observedImpactGrid:string,
  previousCharges:number
):CorrectedImpact|null {
  const hit=parseGrid(observedImpactGrid);
  if(!hit||!onMap(nest)||!onMap(intendedTarget)||!onMap(previousAim))return null;
  const aimPoint={
    x:previousAim.x+(intendedTarget.x-hit.x),
    y:previousAim.y+(intendedTarget.y-hit.y)
  };
  if(!onMap(aimPoint))return null;
  const newDistanceKm=distanceKm(nest,aimPoint);
  if(newDistanceKm<=0||newDistanceKm>30)return null;
  const charges=elevationAt(newDistanceKm,previousCharges)!==null
    ?previousCharges:Math.ceil(newDistanceKm/5);
  const elevation=elevationAt(newDistanceKm,charges);
  if(elevation===null)return null;
  const aimGrid=formatGrid(aimPoint);
  const targetGrid=formatGrid(intendedTarget);
  if(!aimGrid||!targetGrid)return null;
  return {aimPoint,aimGrid,targetGrid,impactGrid:observedImpactGrid,
    errorKm:distanceKm(intendedTarget,hit),
    newBearing:bearingDegrees(nest,aimPoint),newDistanceKm,
    charges,elevation};
}
