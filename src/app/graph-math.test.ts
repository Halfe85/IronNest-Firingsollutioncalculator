import {formatGrid} from './map-math.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GIBRALTAR_MISSION,gridInputToPoint,gridInputFromText,solvePlotGraph,firingFromPlot,updateIntelReport,approximateRayCircle,type IntelNode} from './graph-math.ts';
test('four dropdown grid fields preserve the specified 100m grid coordinates',()=>{
  const p=gridInputFromText('A2 2:3')!;
  assert.deepEqual(p,{letter:'A',column:2,x:2,y:3});
  assert.deepEqual(gridInputToPoint(p),{x:.2,y:1.3});
  assert.equal(gridInputFromText('Z2 2:3'),null);
  assert.equal(gridInputToPoint({...p,x:10}),null);
});
test('Gibraltar reference chain solves Mole, then pauses for ambiguous Dockmaster',()=>{
  const result=solvePlotGraph(GIBRALTAR_MISSION);
  const mole=result.get('mole')!;
  const dock=result.get('dock')!;
  const cruiser=result.get('cruiser')!;
  assert.equal(mole.status,'located');
  assert.equal(mole.candidates.length,1);
  assert.ok(Math.abs(mole.position!.x-9.22758)<.0001);
  assert.equal(dock.status,'ambiguous');
  assert.equal(dock.candidates.length,2);
  assert.equal(cruiser.status,'blocked');
});
test('user selecting a Dockmaster candidate unlocks Rockingham downstream',()=>{
  const chosen=GIBRALTAR_MISSION.map(n=>n.id==='dock'?{...n,chosenCandidate:1}:n);
  const solved=solvePlotGraph(chosen);
  assert.equal(solved.get('dock')?.status,'located');
  const ship=solved.get('cruiser');
  assert.equal(ship?.status,'located');
  assert.equal(ship?.candidates.length,1);
  assert.ok(ship!.position!.x>5&&ship!.position!.x<6);
  const nest=solved.get('nest')!.position!;
  const fire=firingFromPlot(nest,ship!.position!);
  assert.ok(fire.rangeKm>0&&fire.bearing>=0&&fire.bearing<360);
});
test('bad intel and self-cycle cannot invent an aimpoint',()=>{
  const n:IntelNode[]=[
    {id:'nest',role:'nest',name:'Iron Nest',grid:gridInputFromText('A1 0:0')!,reports:[]},
    {id:'a',role:'reference',name:'A',reports:[
      {id:'1',sourceId:'a',type:'bearing',value:'90'},
      {id:'2',sourceId:'nest',type:'range',value:'2'}
    ]}
  ];
  assert.equal(solvePlotGraph(n).get('a')?.status,'blocked');
  const noReports=[n[0],{...n[1],reports:[]}];
  assert.equal(solvePlotGraph(noReports).get('a')?.status,'missing');
});

test('selected observation FROM, TYPE and compass direction survive serialized restore',()=>{
  const created={id:'report-test',sourceId:'nest',type:'bearing' as const,value:'85'};
  const from=updateIntelReport(created,'sourceId','s2');
  const kind=updateIntelReport(from,'type','sector');
  const direction=updateIntelReport(kind,'value','WSW');
  assert.deepEqual(direction,{id:'report-test',sourceId:'s2',type:'sector',value:'WSW'});
  const saved=JSON.stringify({nodes:[{id:'target',name:'Target',role:'target',
    reports:[direction]}]});
  const restored=JSON.parse(saved).nodes[0].reports[0];
  assert.deepEqual(restored,direction);
  assert.equal(updateIntelReport(restored,'type','range').value,'');
});
test('changing observation source does not reset the selected type or input',()=>{
  const input={id:'r1',sourceId:'nest',type:'range' as const,value:'5.73'};
  const result=updateIntelReport(input,'sourceId','spotter-2');
  assert.equal(result.type,'range');
  assert.equal(result.value,'5.73');
  assert.equal(result.sourceId,'spotter-2');
});

test('near-tangent bearing and range can resolve as visibly approximate',()=>{
  const point=approximateRayCircle(
    {x:15.34691149960833,y:8.004206837213644},201,
    {x:4.5,y:5.5},9.17
  );
  assert.equal(point.length,1);
  assert.ok(point[0].x>13.1&&point[0].x<13.2);
  assert.ok(Math.abs(Math.hypot(point[0].x-4.5,point[0].y-5.5)-9.17)<.06);
  assert.deepEqual(approximateRayCircle({x:0,y:0},90,{x:0,y:5},2),[]);
});
test('four-stage plot solves Target2 approximately and marks dependent Target3',()=>{
  const nodes:IntelNode[]=[
    {id:'nest',role:'nest',name:'Iron Nest',
      grid:gridInputFromText('B3 4:1')!,reports:[]},
    {id:'s1',role:'spotter',name:'Spotter 1',
      grid:gridInputFromText('E6 5:5')!,reports:[]},
    {id:'s2',role:'spotter',name:'Spotter 2',
      grid:gridInputFromText('D6 1:0')!,reports:[]},
    {id:'s3',role:'spotter',name:'Spotter 3',
      grid:gridInputFromText('B2 7:9')!,reports:[]},
    {id:'alpha',role:'reference',name:'Alpha',reports:[
      {id:'a1',sourceId:'s1',type:'bearing',value:'077'},
      {id:'a2',sourceId:'s2',type:'range',value:'12.61'}
    ]},
    {id:'t1',role:'target',name:'Target 1',reports:[
      {id:'t1a',sourceId:'alpha',type:'bearing',value:'179'},
      {id:'t1b',sourceId:'s3',type:'bearing',value:'090'}
    ]},
    {id:'t2',role:'target',name:'Target 2',reports:[
      {id:'t2a',sourceId:'alpha',type:'bearing',value:'201'},
      {id:'t2b',sourceId:'s1',type:'range',value:'9.17'}
    ]},
    {id:'t3',role:'target',name:'Target 3',reports:[
      {id:'t3a',sourceId:'t2',type:'bearing',value:'029'},
      {id:'t3b',sourceId:'t2',type:'range',value:'5.87'}
    ]}
  ];
  const result=solvePlotGraph(nodes);
  assert.equal(formatGrid(result.get('alpha')!.position!),'P9 3:0');
  assert.equal(formatGrid(result.get('t1')!.position!),'P2 5:9');
  assert.equal(Boolean(result.get('t1')!.approximate),false);
  assert.equal(formatGrid(result.get('t2')!.position!),'N3 1:2');
  assert.equal(result.get('t2')!.approximate,true);
  assert.match(result.get('t2')!.message,/Approximate position/);
  assert.equal(formatGrid(result.get('t3')!.position!),'Q8 0:3');
  assert.equal(result.get('t3')!.approximate,true);
  assert.match(result.get('t3')!.message,/approximate reference/i);
});
