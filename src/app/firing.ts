/**
 * IRON NEST: Heavy Turret Simulator community-reported IN-GAME rule.
 * This deliberately is NOT a real ballistics model. Calibrate against game updates.
 */
export const CHARGES = [1, 2, 3, 4, 5, 6] as const;
export const SHELLS = [
  'HE', 'HCHE', 'AP', 'APHE', 'SMK', 'STAR', 'DRIL', 'CLMN',
  'CYAN', 'EQKE', 'FLCH', 'INCN', 'LE', 'PHGN', 'PLCM',
  'PRPG', 'TEAR', 'THRM', 'WP', 'ATMC'
] as const;
// EMPT is an internal unused shell definition, not a purchasable round.
export type ChargeMode = 'manual' | 'low-angle' | 'economy' | 'history';
export interface FiringSolution {
  distanceKm: number;
  bearing: number;
  charge: number;
  elevation: number;
  maxRangeKm: number;
}
export interface FiringInput {
  distanceKm: number;
  bearing: number;
  charge: number;
}
export interface FireTime { display: string; previousDay: boolean; }

/** 60 degrees at 5 km per charge, up to 6 charges / 30 km. */
export function elevationAt(distanceKm: number, charges: number): number | null {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 ||
      !Number.isInteger(charges) || charges < 1 || charges > 6 ||
      distanceKm > charges * 5) return null;
  const result = distanceKm * 12 / charges;
  return result >= 0 && result <= 60 + 1e-9 ? Math.min(60, result) : null;
}


/**
 * Experimental community-derived in-game flight model (version 1.0 fan reference).
 * Charge-based speed in km/s; the projectile launch delay is NOT included.
 * Reference: https://ironnestwiki.com/calculator
 * This estimate must be checked against observed in-game shot timing.
 */
export function estimatedShellSpeedKms(charges: number): number | null {
  if (!Number.isInteger(charges) || charges < 1 || charges > 6) return null;
  const u = (charges - 1) / 5;
  const smoother = 3 * u * u - 2 * u * u * u;
  return 0.7 * (0.3 + 0.7 * smoother);
}
export function estimatedFlightSeconds(distanceKm: number, charges: number): number | null {
  if (elevationAt(distanceKm, charges) === null) return null;
  const velocity = estimatedShellSpeedKms(charges);
  return velocity === null ? null : distanceKm / velocity;
}

export function validCharges(distanceKm: number): number[] {
  return CHARGES.filter(charge => elevationAt(distanceKm, charge) !== null);
}

export function firingSolution({ distanceKm, bearing, charge }: FiringInput): FiringSolution | null {
  if (!Number.isFinite(bearing) || bearing < 0 || bearing > 360) return null;
  const elevation = elevationAt(distanceKm, charge);
  if (elevation === null) return null;
  return { distanceKm, bearing, charge, elevation, maxRangeKm: charge * 5 };
}

/**
 * Manual means use the user's charge. Other modes select only reachable charges.
 * Low-angle: minimum charge meeting max angle (or flattest available).
 * Economy: minimum charge giving 30-50 degrees (or minimum reachable).
 * History: charge closest to previous mean elevation (or minimum reachable).
 */
export function selectCharge(
  distanceKm: number,
  mode: ChargeMode,
  manualCharge: number,
  maxAngle: number,
  historicalAngles: readonly number[]
): number | null {
  const valid = validCharges(distanceKm);
  if (!valid.length) return null;
  if (mode === 'manual') return valid.includes(manualCharge) ? manualCharge : null;
  if (mode === 'low-angle') {
    const cap = Number.isFinite(maxAngle) ? Math.max(1, Math.min(60, maxAngle)) : 45;
    return valid.find(charge => (elevationAt(distanceKm, charge) ?? Infinity) <= cap) ?? valid[valid.length - 1];
  }
  if (mode === 'economy') {
    return valid.find(charge => {
      const angle = elevationAt(distanceKm, charge)!;
      return angle >= 30 && angle <= 50;
    }) ?? valid[0];
  }
  const sample = historicalAngles.filter(a => Number.isFinite(a) && a >= 0 && a <= 60);
  if (!sample.length) return valid[0];
  const mean = sample.reduce((sum, a) => sum + a, 0) / sample.length;
  return valid.reduce((best, next) =>
    Math.abs(elevationAt(distanceKm, next)! - mean) <
    Math.abs(elevationAt(distanceKm, best)! - mean) ? next : best);
}

/**
 * Target time is a 24h clock (HH:mm or HH:mm:ss).
 * Flight time must be supplied from observation or the experimental charge-speed model;
 * the elevation formula alone cannot infer flight time.
 * Retains tenths of a second.
 */
export function calculateFireTime(targetTime: string, flightSeconds: number): FireTime | null {
  if (!Number.isFinite(flightSeconds) || flightSeconds < 0 || flightSeconds > 3600) return null;
  const matched = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(targetTime);
  if (!matched) return null;
  const h = Number(matched[1]), m = Number(matched[2]), s = Number(matched[3] ?? 0);
  if (h > 23 || m > 59 || s > 59) return null;
  const tenths = (h * 3600 + m * 60 + s) * 10 - Math.round(flightSeconds * 10);
  const day = 24 * 3600 * 10;
  const normalized = ((tenths % day) + day) % day;
  const hh = Math.floor(normalized / 36000);
  const mm = Math.floor(normalized % 36000 / 600);
  const ss = Math.floor(normalized % 600 / 10);
  const tenth = normalized % 10;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { display: `${pad(hh)}:${pad(mm)}:${pad(ss)}.${tenth}`, previousDay: tenths < 0 };
}
