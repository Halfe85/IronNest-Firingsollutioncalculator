import { CommonModule } from '@angular/common';
import { MapPlotterComponent } from './map-plotter';
import { TrainTrackerComponent } from './train-tracker';
import { Component, computed, effect, signal } from '@angular/core';
import {
  CHARGES, SHELLS, calculateFireTime, elevationAt, firingSolution, selectCharge,
  type ChargeMode, type FireTime
} from './firing';

type Tab = 'calculator' | 'map' | 'train' | 'log';
type Unit = 'km' | 'm';
type Gun = '1' | '2';

interface SavedShot {
  id: string;
  createdAt: string;
  target: string;
  shell: string;
  bearing: number;
  distanceKm: number;
  charge: number;
  elevation: number;
  fireAt: string | null;
}
interface LocalData { shots: SavedShot[]; queues: Record<Gun, string[]>; }
const STORAGE_KEY = 'iron-nest-fcc-v1';
const MODES: ReadonlyArray<{ id: ChargeMode; name: string; sub: string }> = [
  { id: 'low-angle', name: 'Low angle', sub: 'Under chosen angle' },
  { id: 'economy', name: 'Economy', sub: '30–50° if possible' },
  { id: 'history', name: 'Match history', sub: 'Match past shots' },
  { id: 'manual', name: 'Manual', sub: 'Choose charge' }
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MapPlotterComponent, TrainTrackerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent {
  readonly modes = MODES;
  readonly charges = CHARGES;
  readonly shells = SHELLS;
  readonly tab = signal<Tab>('calculator');
  readonly advanced = signal(false);
  readonly distance = signal('6.57');
  readonly unit = signal<Unit>('km');
  readonly bearing = signal('90');
  readonly shell = signal('HCHE');
  readonly target = signal('');
  readonly mode = signal<ChargeMode>('low-angle');
  readonly manualCharge = signal(2);
  readonly maxAngle = signal(45);
  readonly targetTime = signal('');
  readonly flightSeconds = signal('');
  readonly shots = signal<SavedShot[]>([]);
  readonly queues = signal<Record<Gun, string[]>>({ '1': [], '2': [] });
  readonly notice = signal('');

  readonly distanceKm = computed(() => {
    const raw = this.distance().trim().replace(',', '.');
    if (!raw) return NaN;
    const value = Number(raw);
    return this.unit() === 'm' ? value / 1000 : value;
  });
  readonly bearingNumber = computed(() => {
    const raw = this.bearing().trim().replace(',', '.');
    return raw === '' ? NaN : Number(raw);
  });
  readonly selectedCharge = computed(() => selectCharge(
    this.distanceKm(), this.mode(), this.manualCharge(), this.maxAngle(),
    this.shots().map(shot => shot.elevation)
  ));
  readonly solution = computed(() => {
    const charge = this.selectedCharge();
    return charge === null ? null : firingSolution({
      distanceKm: this.distanceKm(),
      bearing: this.bearingNumber(),
      charge
    });
  });
  readonly distanceValid = computed(() => Number.isFinite(this.distanceKm()) &&
    this.distanceKm() > 0 && this.distanceKm() <= 30);
  readonly solutionError = computed(() => {
    if (!Number.isFinite(this.distanceKm()) || this.distanceKm() <= 0) return 'Enter a distance greater than 0.';
    if (this.distanceKm() > 30) return 'Target is beyond the six-charge, 30 km limit.';
    if (!Number.isFinite(this.bearingNumber()) || this.bearingNumber() < 0 || this.bearingNumber() > 360)
      return 'Bearing must be between 0° and 360°.';
    if (this.mode() === 'manual' && this.selectedCharge() === null)
      return 'Selected charge cannot reach the target. Choose a higher charge.';
    return null;
  });
  readonly chargeRows = computed(() => CHARGES.map(charge => ({
    charge, elevation: elevationAt(this.distanceKm(), charge), range: charge * 5
  })));
  readonly fireTime = computed<FireTime | null>(() => {
    if (!this.targetTime().trim() || !this.flightSeconds().trim()) return null;
    return calculateFireTime(this.targetTime(), Number(this.flightSeconds().replace(',', '.')));
  });
  readonly lowAngleNote = computed(() => {
    const solution = this.solution();
    if (!solution) return '';
    if (this.mode() === 'low-angle' && solution.elevation > this.maxAngle())
      return 'No reachable charge meets the angle cap; showing the lowest available angle.';
    if (this.mode() === 'economy' && (solution.elevation < 30 || solution.elevation > 50))
      return 'No valid 30–50° solution; using the lowest reachable charge.';
    if (this.mode() === 'history' && this.shots().length === 0)
      return 'No shot history yet; using the lowest reachable charge.';
    return '';
  });
  readonly gun1 = computed(() => this.resolveQueue('1'));
  readonly gun2 = computed(() => this.resolveQueue('2'));

  constructor() {
    this.restore();
    effect(() => {
      const state: LocalData = { shots: this.shots(), queues: this.queues() };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
    });
  }
  private restore(): void {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (!parsed || typeof parsed !== 'object') return;
      const data = parsed as Partial<LocalData>;
      if (Array.isArray(data.shots)) {
        const shots = data.shots.filter((shot): shot is SavedShot =>
          !!shot && typeof shot.id === 'string' &&
          typeof shot.bearing === 'number' && typeof shot.elevation === 'number' &&
          typeof shot.distanceKm === 'number' && typeof shot.charge === 'number' &&
          typeof shot.shell === 'string' && typeof shot.createdAt === 'string' &&
          typeof shot.target === 'string' && (shot.fireAt === null || typeof shot.fireAt === 'string')
        ).slice(0, 100);
        this.shots.set(shots);
      }
      if (data.queues && typeof data.queues === 'object') {
        const known = new Set(this.shots().map(s => s.id));
        const first = Array.isArray(data.queues['1']) ? data.queues['1'].filter((v): v is string => typeof v === 'string' && known.has(v)).slice(0, 7) : [];
        const second = Array.isArray(data.queues['2']) ? data.queues['2'].filter((v): v is string => typeof v === 'string' && known.has(v) && !first.includes(v)).slice(0, 7) : [];
        this.queues.set({ '1': first, '2': second });
      }
    } catch { /* bad or blocked storage; start fresh */ }
  }
  private resolveQueue(gun: Gun): SavedShot[] {
    const byId = new Map(this.shots().map(shot => [shot.id, shot]));
    return this.queues()[gun].map(id => byId.get(id)).filter((shot): shot is SavedShot => !!shot);
  }
  setUnit(next: Unit): void {
    if (next === this.unit()) return;
    const n = this.distanceKm();
    this.unit.set(next);
    if (Number.isFinite(n)) this.distance.set(next === 'm' ? String(Number((n * 1000).toFixed(2))) : String(Number(n.toFixed(4))));
  }
  setMode(mode: ChargeMode): void { this.mode.set(mode); this.notice.set(''); }
  setCharge(charge: number): void {
    this.manualCharge.set(charge);
    this.mode.set('manual');
  }
  setMaxAngle(value: string): void {
    const n = Number(value);
    if (Number.isFinite(n)) this.maxAngle.set(Math.min(60, Math.max(1, n)));
  }
  setShell(value: string): void { if (this.shells.some(shell => shell === value)) this.shell.set(value); }
  setTab(tab: Tab): void { this.tab.set(tab); this.notice.set(''); }
  openMappedSolution(solution: {bearing:number;distanceKm:number;target:string}): void {
    this.bearing.set(solution.bearing.toFixed(2));
    this.unit.set('km');
    this.distance.set(solution.distanceKm.toFixed(4));
    this.target.set(solution.target);
    // Preserve the map's minimum-charge firing solution during handoff.
    this.manualCharge.set(Math.ceil(solution.distanceKm / 5));
    this.mode.set('manual');
    this.tab.set('calculator');
    this.notice.set('Map solution loaded. Choose your shell and log the shot when ready.');
  }

  firingCard(): string | null {
    const s = this.solution();
    if (!s) return null;
    return [
      'IRON NEST • FIRE CONTROL',
      `Target: ${this.target().trim() || 'Unmarked'}`,
      `Shell: ${this.shell()} | Bearing: ${s.bearing}°`,
      `Distance: ${s.distanceKm.toFixed(2)} km`,
      `Powder: ${s.charge} | Elevation: ${s.elevation.toFixed(2)}°`,
      ...(this.fireTime() ? [`Fire at: ${this.fireTime()!.display}${this.fireTime()!.previousDay ? ' (previous day)' : ''}`] : [])
    ].join('\n');
  }
  openTrainSolution(solution: {bearing:number;distanceKm:number;target:string;impactClock:string;flightSeconds:string}):void {
    this.bearing.set(solution.bearing.toFixed(2));
    this.unit.set('km');
    this.distance.set(solution.distanceKm.toFixed(4));
    this.target.set(solution.target);
    this.manualCharge.set(Math.ceil(solution.distanceKm/5));
    this.mode.set('manual');
    this.targetTime.set(solution.impactClock);
    this.flightSeconds.set(solution.flightSeconds);
    this.advanced.set(solution.flightSeconds.trim()!=='');
    this.tab.set('calculator');
    this.notice.set('Train impact point loaded. Timing requires measured projectile flight time.');
  }
  async copySolution(): Promise<void> {
    const card = this.firingCard();
    if (!card) return;
    try {
      await navigator.clipboard.writeText(card);
      this.notice.set('Firing card copied.');
    } catch { this.notice.set('Copy unavailable in this browser.'); }
  }
  logShot(): void {
    const s = this.solution();
    if (!s) return;
    const shot: SavedShot = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()) + String(Math.random()),
      createdAt: new Date().toISOString(),
      target: this.target().trim().slice(0, 40) || 'Unnamed target',
      shell: this.shell(),
      bearing: s.bearing,
      distanceKm: s.distanceKm,
      charge: s.charge,
      elevation: s.elevation,
      fireAt: this.fireTime()?.display ?? null
    };
    this.shots.update(shots => [shot, ...shots].slice(0, 100));
    const known = new Set(this.shots().map(item => item.id));
    this.queues.update(guns => ({
      '1': guns['1'].filter(id => known.has(id)),
      '2': guns['2'].filter(id => known.has(id))
    }));
    this.notice.set('Shot added to firing log.');
  }
  removeShot(id: string): void {
    this.shots.update(shots => shots.filter(shot => shot.id !== id));
    this.queues.update(guns => ({
      '1': guns['1'].filter(item => item !== id),
      '2': guns['2'].filter(item => item !== id)
    }));
  }
  clearShots(): void {
    if (!window.confirm('Clear the firing log and both gun queues?')) return;
    this.shots.set([]);
    this.queues.set({ '1': [], '2': [] });
    this.notice.set('Shot log cleared.');
  }
  assignToGun(id: string, gun: Gun): void {
    if (!this.shots().some(s => s.id === id)) return;
    const previous = this.queues();
    if (!previous[gun].includes(id) && previous[gun].length >= 7) {
      this.notice.set(`Gun ${gun} queue is full (7/7).`);
      return;
    }
    const next: Record<Gun, string[]> = {
      '1': previous['1'].filter(item => item !== id),
      '2': previous['2'].filter(item => item !== id)
    };
    next[gun] = [...next[gun], id];
    this.queues.set(next);
    this.notice.set(`Shot assigned to Gun ${gun}.`);
  }
  unassign(id: string, gun: Gun): void {
    this.queues.update(q => ({ ...q, [gun]: q[gun].filter(item => item !== id) }));
  }
  moveInQueue(gun: Gun, id: string, shift: number): void {
    const original = this.queues()[gun];
    const i = original.indexOf(id), nextIndex = i + shift;
    if (i === -1 || nextIndex < 0 || nextIndex >= original.length) return;
    const next = [...original];
    [next[i], next[nextIndex]] = [next[nextIndex], next[i]];
    this.queues.update(q => ({ ...q, [gun]: next }));
  }
  autoSort(): void {
    const first: string[] = [], second: string[] = [];
    for (const shot of this.shots().slice(0, 14)) {
      if (first.length <= second.length) first.push(shot.id);
      else second.push(shot.id);
    }
    this.queues.set({ '1': first, '2': second });
    this.notice.set('Latest 14 logged shots split across both guns.');
  }
}
