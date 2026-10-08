import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bearingDegrees, compassCenter, compassFromBearing, distanceKm, formatGrid,
  intersectCircles, intersectRayCircle, intersectRays, parseGrid, triangulate
} from './map-math.ts';

const positions={nest:'S9 0:5',spotter1:'P7 1:3',spotter2:'O8 2:5',spotter3:'N7 9:6'} as const;
const observations=[
  {observer:'spotter2',kind:'range',value:'6.57'},
  {observer:'spotter3',kind:'bearing',value:'187'},
  {observer:'spotter1',kind:'sector',value:'SSW'}
] as const;
test('Iron Nest coordinates map from lower left and round trip',()=>{
  assert.deepEqual(parseGrid('S9 0:5'),{x:18,y:8.5});
  assert.deepEqual(parseGrid('P7 1:3'),{x:15.1,y:6.3});
  assert.deepEqual(parseGrid('O8 2:5'),{x:14.2,y:7.5});
  assert.deepEqual(parseGrid('N7 9:6'),{x:13.9,y:6.6});
  assert.deepEqual(parseGrid('A1 0:0'),{x:0,y:0});
  assert.equal(formatGrid({x:13.21297,y:1.00456}),'N2 2:0');
  assert.equal(parseGrid('U2 0:0'),null);
  assert.equal(parseGrid('A0 0:0'),null);
  assert.equal(parseGrid('B4 1:10'),null);
});
test('bearing is clockwise from north; compass sector SSW',()=>{
  const o={x:10,y:5};
  assert.equal(bearingDegrees(o,{x:10,y:8}),0);
  assert.equal(bearingDegrees(o,{x:12,y:5}),90);
  assert.equal(bearingDegrees(o,{x:10,y:2}),180);
  assert.equal(bearingDegrees(o,{x:8,y:5}),270);
  assert.equal(compassCenter('ssw'),202.5);
  assert.equal(compassFromBearing(199.61),'SSW');
});
test('target triangulates to N2 2:0 and gun values',()=>{
  const result=triangulate(positions,observations);
  assert.equal(result.error,null);
  assert.equal(result.candidates.length,1);
  const target=result.candidates[0];
  assert.equal(target.grid,'N2 2:0');
  assert.ok(Math.abs(target.position.x-13.212967)<0.00001);
  assert.ok(Math.abs(target.position.y-1.004566)<0.00001);
  assert.ok(Math.abs(target.bearing-212.564737)<0.00001);
  assert.ok(Math.abs(target.rangeKm-8.893662)<0.00001);
  assert.equal((target.rangeKm*6).toFixed(2),'53.36');
});
test('compass clue can reject the otherwise valid circle/ray point',()=>{
  const r=triangulate(positions,[observations[0],observations[1],{
    observer:'spotter1',kind:'sector',value:'NNE'
  }]);
  assert.equal(r.candidates.length,0);
  assert.ok(r.error);
});
test('ray-circle ignores negative distance and back-facing intersection',()=>{
  assert.equal(intersectRayCircle({x:1,y:1},180,{x:1,y:8},2).length,0);
  assert.equal(intersectRayCircle({x:2,y:2},0,{x:2,y:4},1).length,2);
});
test('two bearing rays intersect only when facing the same point',()=>{
  assert.equal(intersectRays({x:1,y:1},90,{x:3,y:0},0).length,1);
  assert.equal(intersectRays({x:1,y:1},270,{x:3,y:0},0).length,0);
});
test('two circles yield intersections and reject disjoint ones',()=>{
  assert.equal(intersectCircles({x:0,y:0},5,{x:6,y:0},5).length,2);
  assert.equal(intersectCircles({x:0,y:0},1,{x:6,y:0},1).length,0);
  assert.equal(intersectCircles({x:0,y:0},4,{x:0,y:0},4).length,0);
});
test('invalid and incomplete target reports stay unresolved',()=>{
  assert.ok(triangulate(positions,[observations[0]]).error);
  assert.ok(triangulate({...positions,nest:'bad'},observations).error);
  assert.ok(triangulate(positions,[{observer:'spotter3',kind:'bearing',value:'361'},observations[0]]).error);
  assert.ok(triangulate(positions,[{observer:'spotter2',kind:'range',value:'-1'},observations[1]]).error);
});

test('artillery mission can represent contradictory bearings and multiple target candidates',()=>{
  const artillery={nest:'I6 5:3',spotter1:'I10 5:8',spotter2:'M7 1:5',spotter3:'L1 7:7'};
  assert.deepEqual(parseGrid('I10 5:8'),{x:8.5,y:9.8});
  const target1=triangulate(artillery,[
    {observer:'spotter1',kind:'bearing',value:'233'},
    {observer:'spotter2',kind:'bearing',value:'104'}
  ]);
  const target2=triangulate(artillery,[
    {observer:'spotter1',kind:'bearing',value:'187'},
    {observer:'spotter3',kind:'bearing',value:'50'}
  ]);
  // With the current provisional map-axis interpretation, those forward
  // bearing rays do not intersect: never generate an invented firing solution.
  assert.equal(target1.candidates.length,0);
  assert.equal(target2.candidates.length,0);
  assert.ok(target1.error);
  assert.ok(target2.error);
  const target3=triangulate(artillery,[
    {observer:'spotter3',kind:'range',value:'6.21'},
    {observer:'spotter1',kind:'range',value:'5.77'}
  ]);
  assert.equal(target3.error,null);
  assert.deepEqual(target3.candidates.map(c=>c.grid).sort(),['G5 7:3','N7 4:7']);
  assert.equal(target3.candidates.length,2);
});
