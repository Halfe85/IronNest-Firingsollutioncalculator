/** Selected turret side; old shot records without an assignment are not silently assigned. */
export type Cannon = 'left' | 'right';
export function cannonOrUnassigned(input: unknown): Cannon | null {
  return input === 'left' || input === 'right' ? input : null;
}
export function normalizeShell(input: unknown, fallback = 'HCHE'): string {
  const permitted = [
    'HE','HCHE','AP','APHE','SMK','STAR','DRIL','CLMN','CYAN','EQKE',
    'FLCH','INCN','LE','PHGN','PLCM','PRPG','TEAR','THRM','WP','ATMC'
  ];
  return typeof input === 'string' && permitted.includes(input) ? input : fallback;
}
