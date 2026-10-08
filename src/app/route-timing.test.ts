import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fillWaypointTimes} from './route-timing.ts';

test('High Tide: with arrival report and 36 km/h calculate three approach markers',()=>{
  const result=fillWaypointTimes([
    {name:'5km',kmFromStation:5,time:''},
    {name:'3km',kmFromStation:3,time:''},
    {name:'1km',kmFromStation:1,time:''},
    {name:'Landing',kmFromStation:0,time:'10:08:20'}
  ],36);
  assert.equal(result.error,null);
  assert.deepEqual(result.stops.map(s=>s.time),['10:00:00','10:03:20','10:06:40','10:08:20']);
});
test('no estimated clock without at least one actual game-time report',()=>{
  const result=fillWaypointTimes([
    {name:'first',kmFromStation:5,time:''},
    {name:'arrival',kmFromStation:0,time:''}
  ],36);
  assert.ok(result.error);
  assert.equal(result.stops[0].time,'');
});
test('a contradictory existing time must not be silently overwritten',()=>{
  const values=[
    {name:'start',kmFromStation:5,time:'10:00:05'},
    {name:'arrival',kmFromStation:0,time:'10:08:20'}
  ];
  const result=fillWaypointTimes(values,36);
  assert.ok(result.error);
  assert.deepEqual(result.stops,values);
});
test('crossing midnight uses game clock with wrap',()=>{
  const result=fillWaypointTimes([
    {name:'start',kmFromStation:2,time:''},
    {name:'end',kmFromStation:0,time:'00:02:00'}
  ],30);
  assert.equal(result.error,null);
  assert.equal(result.stops[0].time,'23:58:00');
});
test('non-monotonic distance and nonphysical speed stay invalid',()=>{
  const data=[
    {name:'start',kmFromStation:2,time:''},
    {name:'arrival',kmFromStation:0,time:'10:00:00'}
  ];
  assert.ok(fillWaypointTimes(data,0).error);
  assert.ok(fillWaypointTimes([data[1],data[0]],36).error);
});
