import {
  bearingDegrees, compassCenter, angularDifference, distanceKm, formatGrid,
  intersectCircles, intersectRayCircle, intersectRays, onMap,
  parseGrid, type Point
} from './map-math';

export type NodeRole = 'nest'|'spotter'|'reference'|'target';
export type IntelType = 'bearing'|'range'|'sector';
export interface GridInput {
  letter:string; column:number; x:number; y:number;
}
export interface IntelReport {
  id:string;
  sourceId:string;
  type:IntelType;
  value:string;
}
/** Immutable report update keeps selected dropdown values in the graph state. */
export function updateIntelReport(
  report:IntelReport,key:'sourceId'|'type'|'value',value:string
):IntelReport{
  if(key==='sourceId')return {...report,sourceId:value};
  if(key==='value')return {...report,value};
  if(value!=='bearing'&&value!=='range'&&value!=='sector')return report;
  if(value===report.type)return report;
  return {...report,type:value,
    // A compass select must never visually show 'N' while retaining a
    // previous numeric bearing in state (and vice versa).
    value:value==='sector'?'N':report.type==='sector'?'':report.value};
}
export interface IntelNode {
  id:string;
  name:string;
  role:NodeRole;
  grid?:GridInput;
  reports:IntelReport[];
  chosenCandidate?:number|null;
}
export type PlotStatus = 'located'|'ambiguous'|'missing'|'conflict'|'blocked';
export interface PlotNode {
  node:IntelNode;
  status:PlotStatus;
  candidates:Point[];
  position:Point|null;
  message:string;
}
export interface PlotGraph {
  results:PlotNode[];
  get:(id:string)=>PlotNode|undefined;
}

export const GRID_LETTERS='ABCDEFGHIJKLMNOPQRST'.split('');
export const GRID_COLUMNS=Array.from({length:10},(_,i)=>i+1);
export const GRID_SUBDIVISIONS=Array.from({length:10},(_,i)=>i);
export const EMPTY_GRID:GridInput={letter:'A',column:1,x:0,y:0};

export function gridInputToPoint(grid:GridInput):Point|null{
  if(!GRID_LETTERS.includes(grid.letter.toUpperCase())||
    !Number.isInteger(grid.column)||grid.column<1||grid.column>10||
    !Number.isInteger(grid.x)||grid.x<0||grid.x>9||
    !Number.isInteger(grid.y)||grid.y<0||grid.y>9) return null;
  return parseGrid(grid.letter.toUpperCase()+grid.column+' '+grid.x+':'+grid.y);
}
export function gridInputLabel(grid:GridInput):string{
  return grid.letter+grid.column+' '+grid.x+':'+grid.y;
}
export function gridInputFromText(text:string):GridInput|null{
  const match=/^\s*([A-T])\s*(10|[1-9])\s+([0-9]):([0-9])\s*$/i.exec(text);
  return match?{letter:match[1].toUpperCase(),column:Number(match[2]),x:Number(match[3]),y:Number(match[4])}:null;
}
export const GIBRALTAR_MISSION:IntelNode[]=[
  {id:'nest',role:'nest',name:'Iron Nest',grid:gridInputFromText('A2 2:3')!,reports:[]},
  {id:'s1',role:'spotter',name:'Spotter #1',grid:gridInputFromText('B8 6:1')!,reports:[]},
  {id:'s2',role:'spotter',name:'Spotter #2',grid:gridInputFromText('E4 7:7')!,reports:[]},
  {id:'mole',role:'reference',name:'The Mole',reports:[
    {id:'m1',sourceId:'s2',type:'bearing',value:'51'},
    {id:'m2',sourceId:'s1',type:'bearing',value:'88'}
  ]},
  {id:'dock',role:'reference',name:"Dockmaster's House",reports:[
    {id:'d1',sourceId:'mole',type:'range',value:'5.73'},
    {id:'d2',sourceId:'s1',type:'bearing',value:'84'}
  ]},
  {id:'cruiser',role:'target',name:'HMS Rockingham',reports:[
    {id:'c1',sourceId:'dock',type:'range',value:'10.00'},
    {id:'c2',sourceId:'s2',type:'bearing',value:'27'}
  ]}
];

type Observation={type:IntelType;origin:Point;value:number};
const EPS=.015;
function readObservation(report:IntelReport, origin:Point):Observation|null{
  if(report.value.trim()==='')return null;
  if(report.type==='sector'){
    const deg=compassCenter(report.value);
    return deg===null?null:{type:report.type,origin,value:deg};
  }
  const value=Number(report.value.replace(',','.'));
  if(!Number.isFinite(value)||report.type==='range'&&value<=0||
    report.type==='bearing'&&(value<0||value>360)) return null;
  return {type:report.type,origin,value};
}
function pairIntersections(a:Observation,b:Observation):Point[]{
  if(a.type==='bearing'&&b.type==='bearing')
    return intersectRays(a.origin,a.value,b.origin,b.value);
  if(a.type==='bearing'&&b.type==='range')
    return intersectRayCircle(a.origin,a.value,b.origin,b.value);
  if(a.type==='range'&&b.type==='bearing')
    return intersectRayCircle(b.origin,b.value,a.origin,a.value);
  if(a.type==='range'&&b.type==='range')
    return intersectCircles(a.origin,a.value,b.origin,b.value);
  return [];
}
function satisfies(point:Point,observation:Observation):boolean{
  if(observation.type==='range')
    return Math.abs(distanceKm(observation.origin,point)-observation.value)<=.06;
  const error=angularDifference(bearingDegrees(observation.origin,point),observation.value);
  if(observation.type==='sector')return error<=11.25+1e-8;
  return error<=.5+1e-8;
}
/** Solve reference targets in dependency order; ambiguous references must be explicitly chosen. */
export function solvePlotGraph(nodes:readonly IntelNode[]):PlotGraph{
  const computed=new Map<string,PlotNode>();
  for(const node of nodes){
    if(node.role==='spotter'||node.role==='nest'){
      const point=node.grid?gridInputToPoint(node.grid):null;
      computed.set(node.id,{
        node,status:point?'located':'missing',
        candidates:point?[point]:[],position:point,
        message:point?'Known map coordinate':'Enter valid grid coordinates'
      });
    }
  }
  for(let pass=0;pass<nodes.length;pass++){
    let progressed=false;
    for(const node of nodes){
      if(computed.has(node.id))continue;
      const reports=node.reports??[];
      const refs=reports.map(r=>computed.get(r.sourceId));
      if(refs.some(r=>!r||!r.position))continue;
      const observations=reports.map((r,i)=>readObservation(r,refs[i]!.position!));
      if(observations.some(o=>o===null)){
        computed.set(node.id,{node,status:'missing',candidates:[],position:null,message:'Missing or invalid intelligence'});
        progressed=true;continue;
      }
      const obs=observations as Observation[];
      const numeric=obs.filter(o=>o.type!=='sector');
      if(numeric.length<2){
        computed.set(node.id,{node,status:'missing',candidates:[],position:null,message:'Add at least two bearings or distances'});
        progressed=true;continue;
      }
      const candidates:Point[]=[];
      for(let i=0;i<numeric.length;i++)for(let j=i+1;j<numeric.length;j++){
        for(const point of pairIntersections(numeric[i],numeric[j])){
          if(onMap(point)&&obs.every(o=>satisfies(point,o))&&!candidates.some(c=>distanceKm(c,point)<EPS))
            candidates.push(point);
        }
      }
      candidates.sort((a,b)=>a.x-b.x||a.y-b.y);
      const chosen=node.chosenCandidate;
      const chosenValid=typeof chosen==='number'&&Number.isInteger(chosen)&&chosen>=0&&chosen<candidates.length;
      const position=candidates.length===1?candidates[0]:chosenValid?candidates[chosen!]:null;
      const status:PlotStatus=candidates.length===0?'conflict':position?'located':'ambiguous';
      computed.set(node.id,{node,status,candidates,position,
        message:status==='conflict'?'No valid intersection; verify reports and map orientation':
          status==='ambiguous'?'Multiple possible positions: choose one to continue':
          'Target coordinates resolved'});
      progressed=true;
    }
    if(!progressed)break;
  }
  const results=nodes.map(node=>computed.get(node.id)??{
    node,status:'blocked' as PlotStatus,candidates:[],position:null,
    message:'Waiting for a uniquely solved reference point; check for circular dependencies'
  });
  return {results,get:(id)=>results.find(r=>r.node.id===id)};
}
export function firingFromPlot(nest:Point,target:Point){
  const rangeKm=distanceKm(nest,target);
  return {rangeKm,bearing:bearingDegrees(nest,target),grid:formatGrid(target)};
}
