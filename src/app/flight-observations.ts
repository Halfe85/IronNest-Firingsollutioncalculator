/**
 * Community field calibration data for the fictional IRON NEST game.
 * Store observed shots exactly as reported; never silently adjust aim angles
 * or fit a flight-time prediction from a single data point.
 */
export interface FlightObservation {
  id: string;
  bearingDeg: number;
  rangeKm: number;
  elevationDeg: number;
  charges: number;
  shellType: string | null;
  firedAtSecond: number;
  impactedAtSecond: number;
  flightTimeSeconds: number;
  notes?: string;
}
export const FLIGHT_OBSERVATIONS: readonly FlightObservation[] = [{
  id: '2026-10-08-flight-001',
  bearingDeg: 85.6,
  rangeKm: 8.94,
  elevationDeg: 53.4,
  charges: 2,
  shellType: null, // Not stated in field report.
  firedAtSecond: 0,
  impactedAtSecond: 34,
  flightTimeSeconds: 34,
  notes: 'Player observed impact at second 34 after firing at second 00. ' +
    'Measured elevation differs from range × 12 / charges; do not change it.'
}];
