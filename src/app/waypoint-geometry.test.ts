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

// Two independently configured bearings and direction switches on one route.
test('different waypoints can have different direction from reference',()=>{
  const route:TrainSchedule={...base,stops:[
    {...base.stops[0],routeBearing:90,routeDirection:'bearing'},
    {...base.stops[1],routeBearing:90,routeDirection:'opposite'},
    {...base.stops[2],routeBearing:0,routeDirection:'bearing'},
    base.stops[3]
  ]};
  const r=resolveWaypointPositions(route);
  assert.deepEqual(r.grids,['P6 0:4','F6 0:4','J8 0:4','J6 0:4']);
  assert.equal(trainPositionAt(route,'10:10:10').ok,true);
});
test('per-waypoint bearing overrides global bearing and legacy waypoints inherit global direction',()=>{
  const route:TrainSchedule={...base,approachSide:'opposite',stops:[
    {...base.stops[0],routeBearing:90,routeDirection:'bearing'},
    base.stops[1],base.stops[2],base.stops[3]
  ]};
  assert.deepEqual(resolveWaypointPositions(route).grids,
    ['P6 0:4','F6 0:4','H6 0:4','J6 0:4']);
});
test('relative waypoint direction can be inverted without changing its reference',()=>{
  const route:TrainSchedule={...base,stops:[
    {...base.stops[0],method:'relative',relativeTo:'b',relativeBearing:0,
      relativeDirection:'opposite',relativeKm:2},
    {...base.stops[1],method:'manual',grid:'N6 0:4'},
    base.stops[2],base.stops[3]
  ]};
  assert.equal(resolveWaypointPositions(route).grids[0],'N4 0:4');
});

test('calculated waypoint can measure bearing from a different waypoint',()=>{
  const route:TrainSchedule={...base,stops:[
    {...base.stops[0],routeReferenceId:'b',routeBearing:0,
      routeDirection:'bearing',routeDistanceKm:2},
    {...base.stops[1],method:'manual',grid:'N6 0:4'},
    base.stops[2],base.stops[3]
  ]};
  const fixed=resolveWaypointPositions(route);
  assert.equal(fixed.errors[0],null);
  assert.equal(fixed.grids[0],'N8 0:4');
  assert.equal(fixed.grids[1],'N6 0:4');
  assert.equal(trainPositionAt(route,'10:10:10').ok,true);
});
test('calculated waypoint can use a named observer or reference point',()=>{
  const route:TrainSchedule={
    ...base,
    references:[{id:'spotter-1',name:'Spotter #1',grid:'D4 5:5'},
      {id:'ref-a',name:'Reference A',grid:'M5 0:4'}],
    stops:[
      {...base.stops[0],routeReferenceId:'ref:spotter-1',
        routeBearing:90,routeDirection:'bearing',routeDistanceKm:3},
      {...base.stops[1],routeReferenceId:'ref:ref-a',
        routeBearing:180,routeDirection:'bearing',routeDistanceKm:2},
      base.stops[2],base.stops[3]
    ]
  };
  const resolved=resolveWaypointPositions(route);
  assert.deepEqual(resolved.grids.slice(0,2),['G4 5:5','M3 0:4']);
});
test('missing named reference and missing geometric distance never silently use distance to arrival',()=>{
  const route:TrainSchedule={...base,stops:[
    {...base.stops[0],routeReferenceId:'ref:absent',
      routeBearing:90,routeDistanceKm:3},
    {...base.stops[1],routeReferenceId:'c',routeBearing:0,
      routeDistanceKm:null},
    base.stops[2],base.stops[3]
  ]};
  const r=resolveWaypointPositions(route);
  assert.equal(r.points[0],null);
  assert.match(r.errors[0]??'',/not found/i);
  assert.equal(r.points[1],null);
  assert.match(r.errors[1]??'',/distance/i);
});
test('calculated waypoints referencing each other are rejected as cycles',()=>{
  const route:TrainSchedule={...base,stops:[
    {...base.stops[0],routeReferenceId:'b',routeBearing:0,routeDistanceKm:2},
    {...base.stops[1],routeReferenceId:'a',routeBearing:180,routeDistanceKm:2},
    base.stops[2],base.stops[3]
  ]};
  const r=resolveWaypointPositions(route);
  assert.equal(r.points[0],null);
  assert.equal(r.points[1],null);
  assert.equal(trainPositionAt(route,'10:10:10').ok,false);
});
test('old routes without reference ID remain measured from arrival reference',()=>{
  const r=resolveWaypointPositions(base);
  assert.deepEqual(r.grids,['P6 0:4','N6 0:4','L6 0:4','J6 0:4']);
});
