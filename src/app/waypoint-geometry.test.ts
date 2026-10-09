import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolveWaypointPositions,type RoutedStop} from './waypoint-geometry.ts';
import {trainPositionAt,type TrainSchedule} from './train-math.ts';

const base:TrainSchedule={
  nestGrid:'C2 5:6',stationGrid:'J6 0:4',railBearing:90,approachSide:'bearing',
  stops:[
    {id:'a',name:'A',kmFromStation:6,time:'10:06:50'},
    {id:'b',name:'B',kmFromStation:4,time:'10:10:10'},
    {id:'c',name:'C',kmFromStation:2,time:'10:13:30'},
    {id:'arrive',name:'Station',kmFromStation:0,time:'10:16:50'}
  ]
};
test('old straight-line mission grids and existing clock interpolation are unchanged',()=>{
  const resolved=resolveWaypointPositions(base);
  assert.deepEqual(resolved.grids,['P6 0:4','N6 0:4','L6 0:4','J6 0:4']);
  const report=trainPositionAt(base,'10:11:50');
  assert.equal(report.ok,true);
  if(report.ok)assert.equal(report.result.grid,'M6 0:4');
});
test('manually entered and observed positions create a polyline, not a straight rail projection',()=>{
  const route:TrainSchedule={...base,stops:[
    {...base.stops[0],method:'manual',grid:'P7 0:4'},
    {...base.stops[1],method:'observed',grid:'N7 0:4'},
    {...base.stops[2],method:'manual',grid:'L6 0:4'},
    base.stops[3]
  ] as RoutedStop[]};
  assert.deepEqual(resolveWaypointPositions(route).grids,
    ['P7 0:4','N7 0:4','L6 0:4','J6 0:4']);
  const r=trainPositionAt(route,'10:11:50');
  assert.equal(r.ok,true);
  if(r.ok)assert.equal(r.result.grid,'M6 0:9');
});
test('relative positions use another waypoint ID and can represent a turn',()=>{
  const route:TrainSchedule={...base,stops:[
    {...base.stops[0],method:'relative',relativeTo:'b',relativeBearing:0,relativeKm:2},
    {...base.stops[1],method:'manual',grid:'N6 0:4'},
    base.stops[2],base.stops[3]
  ] as RoutedStop[]};
  assert.equal(resolveWaypointPositions(route).grids[0],'N8 0:4');
});
test('cyclic and missing references fail safely without invented markers',()=>{
  const route:TrainSchedule={...base,stops:[
    {...base.stops[0],method:'relative',relativeTo:'b',relativeBearing:90,relativeKm:2},
    {...base.stops[1],method:'relative',relativeTo:'a',relativeBearing:270,relativeKm:2},
    base.stops[2],base.stops[3]
  ] as RoutedStop[]};
  const r=resolveWaypointPositions(route);
  assert.equal(r.points[0],null);
  assert.equal(r.points[1],null);
  assert.equal(trainPositionAt(route,'10:10:10').ok,false);
});
test('manual and observed grids work without a global route bearing',()=>{
  const route:TrainSchedule={...base,railBearing:NaN,stops:[
    {...base.stops[0],method:'manual',grid:'P6 0:4'},
    {...base.stops[1],method:'observed',grid:'N6 0:4'},
    {...base.stops[2],method:'manual',grid:'L6 0:4'},
    base.stops[3]
  ] as RoutedStop[]};
  assert.equal(trainPositionAt(route,'10:10:10').ok,true);
});
test('out-of-map manual grid invalidates interpolation without losing saved input',()=>{
  const route:TrainSchedule={...base,stops:[
    {...base.stops[0],method:'manual',grid:'Z6 0:4'},
    base.stops[1],base.stops[2],base.stops[3]
  ] as RoutedStop[]};
  assert.equal(resolveWaypointPositions(route).grids[0],null);
  assert.equal(trainPositionAt(route,'10:06:50').ok,false);
});
