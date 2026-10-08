import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseGrid,formatGrid} from './map-math';
import {projectImpact,correctFromImpact} from './impact-correction';

test('Calculate projects east and north by the game bearing convention',()=>{
  const nest=parseGrid('C2 5:6')!;
  const east=projectImpact(nest,90,3)!;
  assert.equal(formatGrid(east),'F2 5:6');
  const north=projectImpact(nest,0,2)!;
  assert.equal(formatGrid(north),'C4 5:6');
  assert.equal(projectImpact(nest,270,5),null); // would leave A-T map
});
test('reported impact beyond target creates smaller-range firing solution',()=>{
  const nest=parseGrid('C2 5:6')!;
  const target=projectImpact(nest,90,3)!;
  const corrected=correctFromImpact(nest,target,target,'G2 5:6',1)!;
  assert.ok(corrected);
  assert.equal(corrected.aimGrid,'E2 5:6');
  assert.equal(corrected.targetGrid,'F2 5:6');
  assert.equal(corrected.newBearing,90);
  assert.equal(corrected.charges,1);
  assert.equal(corrected.elevation,24);
});
test('lateral impact error corrects bearing, not just range',()=>{
  const nest=parseGrid('C2 5:6')!;
  const target=parseGrid('F2 5:6')!;
  const corrected=correctFromImpact(nest,target,target,'F3 5:6',1)!;
  assert.equal(corrected.aimGrid,'F1 5:6');
  assert.ok(corrected.newBearing>90);
});
test('successive shots use previous corrected aiming point, keep same target',()=>{
  const nest=parseGrid('C2 5:6')!,target=parseGrid('F2 5:6')!;
  const first=correctFromImpact(nest,target,target,'G2 5:6',1)!;
  const second=correctFromImpact(nest,target,first.aimPoint,'F2 5:6',1)!;
  assert.equal(second.targetGrid,'F2 5:6');
  assert.equal(second.aimGrid,'E2 5:6');
});
test('outside map and invalid feedback are rejected',()=>{
  const nest=parseGrid('A1 0:0')!,target=parseGrid('A1 1:0')!;
  assert.equal(correctFromImpact(nest,target,target,'T10 9:9',1),null);
  assert.equal(correctFromImpact(nest,target,target,'Z4 0:0',1),null);
});
