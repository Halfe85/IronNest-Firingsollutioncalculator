import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GIBRALTAR_MISSION,gridInputToPoint,gridInputFromText,solvePlotGraph,firingFromPlot,type IntelNode} from './graph-math.ts';
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
  const chosen=GIBRALTAR_MISSION.map(n=>n.id==='dock'?{...n,chosenCandidate:0}:n);
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
