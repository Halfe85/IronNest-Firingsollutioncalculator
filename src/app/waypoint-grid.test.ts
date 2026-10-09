import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gridInputFromText,gridInputLabel,gridInputToPoint,EMPTY_GRID} from './graph-math.ts';
import {trainPositionAt,type TrainSchedule} from './train-math.ts';

test('Waypoint uses exactly the same four-field coordinates as Observation',()=>{
  const observationGrid={letter:'C',column:2,x:5,y:6};
  const stored=gridInputLabel(observationGrid);
  assert.equal(stored,'C2 5:6');
  assert.deepEqual(gridInputFromText(stored),observationGrid);
  assert.deepEqual(gridInputToPoint(gridInputFromText(stored)!),{x:2.5,y:1.6});
  const manualReference={letter:'J',column:6,x:0,y:4};
  assert.equal(gridInputLabel(manualReference),'J6 0:4');
  assert.deepEqual(gridInputFromText(''),null);
  assert.equal(gridInputLabel(EMPTY_GRID),'A1 0:0');
});

test('Changing shared Iron Nest position updates the waypoint fire solution',()=>{
  const base:TrainSchedule={
    nestGrid:'C2 5:6',stationGrid:'J6 0:4',railBearing:90,
    approachSide:'bearing',
    stops:[
      {name:'Waypoint B',kmFromStation:4,time:'10:10:10'},
      {name:'Arrival',kmFromStation:0,time:'10:16:50'}
    ]
  };
  const one=trainPositionAt(base,'10:10:10');
  const next=trainPositionAt({...base,nestGrid:gridInputLabel({
    letter:'D',column:2,x:5,y:6
  })},'10:10:10');
  assert.equal(one.ok,true);
  assert.equal(next.ok,true);
  if(one.ok&&next.ok){
    assert.equal(one.result.grid,next.result.grid);
    assert.notEqual(one.result.rangeKm,next.result.rangeKm);
    assert.notEqual(one.result.bearingFromNest,next.result.bearingFromNest);
  }
});

test('Waypoint reference grid keeps the hundred-metre x/y subdivisions',()=>{
  const p={letter:'J',column:6,x:0,y:4};
  const roundTrip=gridInputFromText(gridInputLabel(p));
  assert.deepEqual(roundTrip,p);
});
