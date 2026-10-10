import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseGrid,formatGrid,compassCenter} from './map-math';
import {projectImpact,correctFromImpact,targetFromImpact,initialFiringGrid} from './impact-correction';

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

test('16-point compass from the shell impact repositions target and changes firing angle',()=>{
  const nest=parseGrid('C2 5:6')!;
  const impact=parseGrid('F2 5:6')!;
  const heading=compassCenter('NE')!;
  const result=targetFromImpact(nest,impact,heading,Math.sqrt(2),1)!;
  assert.equal(result.grid,'G3 5:6');
  assert.ok(result.bearing>70&&result.bearing<80);
  assert.equal(result.charges,1);
  assert.equal(compassCenter('unknown'),null);
});

test('category 3 begins at the first firing solution grid, not a later corrected aim',()=>{
  const nest=parseGrid('C2 5:6')!;
  const first=parseGrid('F2 5:6')!;
  const corrected=parseGrid('G3 5:6')!;
  assert.equal(initialFiringGrid({
    initialFiringGrid:'F2 5:6',nestPosition:nest,
    targetPosition:corrected,aimPosition:corrected,
    bearing:70,distanceKm:6.1,
    revisions:[{oldBearing:90,oldDistanceKm:3}]
  }),'F2 5:6');
  assert.equal(formatGrid(first),'F2 5:6');
});
test('legacy corrected cards reconstruct initial shot grid from earliest revision',()=>{
  const nest=parseGrid('C2 5:6')!;
  assert.equal(initialFiringGrid({
    nestPosition:nest,aimPosition:parseGrid('G3 5:6')!,
    targetPosition:parseGrid('G3 5:6')!,
    bearing:70,distanceKm:6.1,
    revisions:[
      {oldBearing:90,oldDistanceKm:3},
      {oldBearing:80,oldDistanceKm:4}
    ]
  }),'F2 5:6');
});
test('uncorrected legacy shots use stored aiming point, and missing positions remain unconfirmed',()=>{
  assert.equal(initialFiringGrid({
    nestPosition:parseGrid('C2 5:6')!,aimPosition:parseGrid('F2 5:6')!,
    bearing:90,distanceKm:3
  }),'F2 5:6');
  assert.equal(initialFiringGrid({bearing:90,distanceKm:3}),null);
});
