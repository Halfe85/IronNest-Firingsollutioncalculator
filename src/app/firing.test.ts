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

test('user-provided October 8 field examples match calculated elevation', () => {
  // The bearings are azimuths and do not alter elevation in this game formula.
  const first = firingSolution({ distanceKm: 14.94, bearing: 66.5, charge: 3 });
  const second = firingSolution({ distanceKm: 10.83, bearing: 68.8, charge: 3 });
  assert.equal(first?.elevation.toFixed(2), '59.76');
  assert.equal(second?.elevation.toFixed(2), '43.32');
  assert.equal(first?.bearing, 66.5);
  assert.equal(second?.bearing, 68.8);
  assert.equal(first?.charge, 3);
  assert.equal(second?.charge, 3);
});

test('seven additional user-reported firing observations, including one discrepancy', () => {
  const observations = [
    { bearing: 251.1, distanceKm: 6.21, reportedElevation: 37.26, computedElevation: 37.26 },
    // Reported 55.92° differs from 9.22 km at 2 charges (55.32°).
    // 55.92° would correspond to 9.32 km. Preserve the report for field verification.
    { bearing: 264.6, distanceKm: 9.22, reportedElevation: 55.92, computedElevation: 55.32 },
    { bearing: 251.6, distanceKm: 5.85, reportedElevation: 35.10, computedElevation: 35.10 },
    { bearing: 217.5, distanceKm: 7.57, reportedElevation: 45.42, computedElevation: 45.42 },
    { bearing: 217.9, distanceKm: 7.20, reportedElevation: 43.20, computedElevation: 43.20 },
    { bearing: 212.7, distanceKm: 8.88, reportedElevation: 53.28, computedElevation: 53.28 },
    { bearing: 212.8, distanceKm: 8.90, reportedElevation: 53.40, computedElevation: 53.40 }
  ];
  for (const sample of observations) {
    const solution = firingSolution({
      bearing: sample.bearing,
      distanceKm: sample.distanceKm,
      charge: 2
    });
    assert.equal(solution?.elevation.toFixed(2), sample.computedElevation.toFixed(2));
    assert.equal(solution?.bearing, sample.bearing);
    assert.equal(solution?.charge, 2);
  }
  const discrepancies = observations.filter(s => Math.abs(s.reportedElevation - s.computedElevation) > 0.005);
  assert.equal(discrepancies.length, 1);
  assert.equal(discrepancies[0].bearing, 264.6);
  assert.ok(Math.abs(discrepancies[0].reportedElevation - discrepancies[0].computedElevation - 0.6) < 1e-9);
});
