import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateFireTime, elevationAt, firingSolution, selectCharge, validCharges } from './firing.ts';

test('community firing formula: previous HCHE examples', () => {
  assert.ok(Math.abs(elevationAt(4.88, 1)! - 58.56) < 1e-10);
  assert.ok(Math.abs(elevationAt(4.88, 2)! - 29.28) < 1e-10);
  assert.ok(Math.abs(elevationAt(6.57, 2)! - 39.42) < 1e-10);
  assert.equal(selectCharge(4.88, 'low-angle', 1, 45, []), 2);
  assert.equal(selectCharge(6.57, 'low-angle', 1, 45, []), 2);
});
test('charge ladder and hard boundaries', () => {
  assert.deepEqual(validCharges(0), []);
  assert.deepEqual(validCharges(5), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(validCharges(5.01), [2, 3, 4, 5, 6]);
  assert.equal(elevationAt(30, 6), 60);
  assert.equal(elevationAt(30.01, 6), null);
  assert.equal(elevationAt(10, 1), null);
  assert.equal(elevationAt(-1, 6), null);
  assert.equal(elevationAt(NaN, 6), null);
  assert.equal(elevationAt(8, 2.5), null);
  assert.equal(selectCharge(31, 'economy', 2, 45, []), null);
});
test('charge selection options', () => {
  assert.equal(selectCharge(6.57, 'manual', 1, 45, []), null);
  assert.equal(selectCharge(6.57, 'manual', 3, 45, []), 3);
  assert.equal(selectCharge(6.57, 'economy', 1, 45, []), 2);
  assert.equal(selectCharge(6.57, 'history', 1, 45, [25, 28]), 3);
  assert.equal(selectCharge(6.57, 'history', 1, 45, []), 2);
  assert.equal(selectCharge(25, 'low-angle', 1, 10, []), 6);
});
test('valid bearing, invalid bearing', () => {
  assert.equal(firingSolution({ distanceKm: 6.57, bearing: 90, charge: 2 })?.elevation.toFixed(2), '39.42');
  assert.equal(firingSolution({ distanceKm: 1, bearing: -1, charge: 1 }), null);
  assert.equal(firingSolution({ distanceKm: 1, bearing: 361, charge: 1 }), null);
  assert.equal(firingSolution({ distanceKm: 1, bearing: 360, charge: 1 })?.bearing, 360);
});
test('manual time on target crosses midnight correctly', () => {
  assert.deepEqual(calculateFireTime('00:00:00', 12.4), { display: '23:59:47.6', previousDay: true });
  assert.deepEqual(calculateFireTime('12:00', 12.4), { display: '11:59:47.6', previousDay: false });
  assert.equal(calculateFireTime('25:00', 5), null);
  assert.equal(calculateFireTime('12:00', -1), null);
  assert.equal(calculateFireTime('12:00', NaN), null);
});
