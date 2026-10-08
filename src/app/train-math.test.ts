import assert from 'node:assert/strict';
import test from 'node:test';
import {clockSeconds,displayClock,trainPositionAt,validateSchedule,waypointSpeeds,type TrainSchedule} from './train-math.ts';

const mission:TrainSchedule={
  nestGrid:'C3 1:8',
  stationGrid:'J6 0:4',
  railBearing:90,
  approachSide:'bearing',
  stops:[
    {name:'Waypoint A',kmFromStation:6,time:'10:06:50'},
    {name:'Waypoint B',kmFromStation:4,time:'10:10:10'},
    {name:'Waypoint C',kmFromStation:2,time:'10:13:30'},
    {name:'MainStation',kmFromStation:0,time:'10:16:50'}
  ]
};
test('train mission waypoints imply a constant 36 km/h',()=>{
  assert.deepEqual(waypointSpeeds(mission.stops),[36,36,36]);
  const r=trainPositionAt(mission,'10:11:50');
  assert.equal(r.ok,true);
  if(!r.ok)return;
  assert.equal(r.totalSeconds,600);
  assert.equal(r.speedKmh,36);
  assert.ok(Math.abs(r.result.kmFromStation-3)<1e-10);
  assert.equal(r.result.grid,'M6 0:4');
  assert.equal(r.result.speedKmh,36);
});
test('station, waypoints and travel direction',()=>{
  const a=trainPositionAt(mission,'10:06:50');
  const b=trainPositionAt(mission,'10:10:10');
  const c=trainPositionAt(mission,'10:13:30');
  const station=trainPositionAt(mission,'10:16:50');
  assert.equal(a.ok&&a.result.grid,'P6 0:4');
  assert.equal(b.ok&&b.result.grid,'N6 0:4');
  assert.equal(c.ok&&c.result.grid,'L6 0:4');
  assert.equal(station.ok&&station.result.grid,'J6 0:4');
  const reverse=trainPositionAt({...mission,approachSide:'opposite'},'10:10:10');
  assert.equal(reverse.ok&&reverse.result.grid,'F6 0:4');
});
test('projectile time is not inferred from the train timeline',()=>{
  const r=trainPositionAt(mission,'10:10:10');
  assert.equal(r.ok,true);
  if(!r.ok)return;
  assert.ok(r.result.rangeKm>0);
  assert.ok(r.result.bearingFromNest>=0 && r.result.bearingFromNest<360);
});
test('reject missing/invalid mission timing rather than guessing',()=>{
  assert.equal(clockSeconds('10:16:50'),37010);
  assert.equal(clockSeconds('25:16:50'),null);
  assert.equal(displayClock(37010),'10:16:50');
  assert.equal(trainPositionAt(mission,'10:06:49').ok,false);
  assert.equal(trainPositionAt(mission,'10:16:51').ok,false);
  assert.equal(trainPositionAt({...mission,stationGrid:'Z6 0:4'},'10:10:10').ok,false);
  assert.ok(validateSchedule([{name:'A',kmFromStation:2,time:'10:01:00'},
    {name:'Station',kmFromStation:3,time:'10:02:00'}]).error);
});
test('midnight crossing is represented without a system clock',()=>{
  const schedule={...mission,stops:[
    {name:'A',kmFromStation:2,time:'23:58:00'},
    {name:'Station',kmFromStation:0,time:'00:02:00'}
  ]};
  const p=trainPositionAt(schedule,'00:00:00');
  assert.equal(p.ok,true);
  if(p.ok)assert.ok(Math.abs(p.result.kmFromStation-1)<1e-9);
});

test('new Valle de Mula playthrough keeps its C2 5:6 Iron Nest position',()=>{
  const current={...mission,nestGrid:'C2 5:6'};
  const outcome=trainPositionAt(current,'10:10:10');
  assert.equal(outcome.ok,true);
  if(!outcome.ok)return;
  assert.equal(outcome.result.grid,'N6 0:4');
  assert.ok(Math.abs(outcome.result.rangeKm-11.166)<0.02);
  assert.ok(outcome.result.bearingFromNest>60 && outcome.result.bearingFromNest<90);
});
test('High Tide route math can reuse a reference and speed while leaving actual mission ETA editable',()=>{
  // Fictional test reference, NOT a claimed High Tide mission coordinate or timestamp.
  const route={...mission,nestGrid:'C2 5:6',stationGrid:'J6 0:4',
    railBearing:0,approachSide:'bearing' as const,stops:[
      {name:'5km out',kmFromStation:5,time:'10:00:00'},
      {name:'Landing',kmFromStation:0,time:'10:08:20'}
    ]};
  assert.deepEqual(waypointSpeeds(route.stops),[36]);
  const outcome=trainPositionAt(route,'10:03:20');
  assert.equal(outcome.ok,true);
  if(!outcome.ok)return;
  assert.equal(outcome.result.grid,'J9 0:4');
  assert.ok(Math.abs(outcome.result.kmFromStation-3)<1e-8);
  assert.equal(trainPositionAt(route,'09:59:59').ok,false);
});
