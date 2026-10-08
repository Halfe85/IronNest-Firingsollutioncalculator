import assert from 'node:assert/strict';
import test from 'node:test';
import { FLIGHT_OBSERVATIONS } from './flight-observations.ts';
import { calculateFireTime, elevationAt } from './firing.ts';

test('first observed shell flight lasts 34 seconds', () => {
  const report = FLIGHT_OBSERVATIONS[0];
  assert.equal(report.bearingDeg, 85.6);
  assert.equal(report.rangeKm, 8.94);
  assert.equal(report.charges, 2);
  assert.equal(report.elevationDeg, 53.4);
  assert.equal(report.impactedAtSecond - report.firedAtSecond, 34);
  assert.equal(report.flightTimeSeconds, 34);
  assert.equal(report.shellType, null);
});
test('do not overwrite measured angle with community range formula', () => {
  const report = FLIGHT_OBSERVATIONS[0];
  assert.equal(elevationAt(report.rangeKm, report.charges)?.toFixed(2), '53.64');
  assert.equal(report.elevationDeg.toFixed(2), '53.40');
});
test('time-on-target subtraction can use measured duration at the same firing conditions', () => {
  assert.deepEqual(calculateFireTime('10:10:10', 34),
    { display: '10:09:36.0', previousDay: false });
});
