/**
 * User-provided measurements from Iron Nest gameplay, 2026-10-08.
 * 'Game displayed flight' is a dashboard reading, not guaranteed identical
 * to stopwatch time measured from the moment the fire button is pressed.
 *
 * Do not infer shell type, simulation tick precision, or a launch delay.
 */
import { elevationAt, estimatedFlightSeconds } from './firing';

export interface FlightFieldSample {
  id: string;
  distanceKm: number;
  charges: number;
  bearingDeg: number | null;
  reportedElevationDeg: number;
  shell: string | null;
  displayedFlightSeconds: number;
  displayedFlightPrecision: 'seconds' | 'tenths';
  fireClock: string; // minutes:seconds on game's clock
  impactClockWindow: readonly [string, string];
  observedFlightWindowSeconds: readonly [number, number];
  note: string;
}

export const FLIGHT_FIELD_SAMPLES: readonly FlightFieldSample[] = [
  {
    id:'F01', distanceKm:8.94, charges:2, bearingDeg:85.6,
    reportedElevationDeg:53.34, shell:null,
    displayedFlightSeconds:34, displayedFlightPrecision:'seconds',
    fireClock:'00', impactClockWindow:['34','34'],
    observedFlightWindowSeconds:[34,34],
    note:'Earlier measurement. Elevation differs from the community rule by -0.30 degrees.'
  },
  {
    id:'F02', distanceKm:3.70, charges:1, bearingDeg:null,
    reportedElevationDeg:45, shell:null,
    displayedFlightSeconds:19, displayedFlightPrecision:'seconds',
    fireClock:'00', impactClockWindow:['18','19'],
    observedFlightWindowSeconds:[18,19],
    note:'Impact reported between :18 and :19; displayed flight time 19 seconds.'
  },
  {
    id:'F03', distanceKm:7.49, charges:2, bearingDeg:null,
    reportedElevationDeg:45, shell:null,
    displayedFlightSeconds:28.9, displayedFlightPrecision:'tenths',
    fireClock:'10', impactClockWindow:['40','41'],
    observedFlightWindowSeconds:[30,31],
    note:'Impact reported between :40 and :41 after firing at :10; difference from dashboard 1.1–2.1 seconds.'
  }
] as const;

export interface FlightComparison {
  modelSeconds: number;
  modelVsDisplayedSeconds: number;
  displayedVsStopwatchWindow: readonly [number,number];
  modelElevationDeg: number;
  reportedVsModelElevationDeg: number;
}
/** Comparison only: no automatic calibration to small or contradictory samples. */
export function compareFlightSample(s: FlightFieldSample): FlightComparison | null {
  const modelSeconds=estimatedFlightSeconds(s.distanceKm,s.charges);
  const modelElevationDeg=elevationAt(s.distanceKm,s.charges);
  if(modelSeconds===null||modelElevationDeg===null)return null;
  return {
    modelSeconds,
    modelVsDisplayedSeconds:modelSeconds-s.displayedFlightSeconds,
    displayedVsStopwatchWindow:[
      s.observedFlightWindowSeconds[0]-s.displayedFlightSeconds,
      s.observedFlightWindowSeconds[1]-s.displayedFlightSeconds
    ],
    modelElevationDeg,
    reportedVsModelElevationDeg:s.reportedElevationDeg-modelElevationDeg
  };
}

/**
 * Additional player-reported 2026-10-11 flight durations.
 *
 * Unlike F01–F03, no measured distance, shell, fire-clock or impact-clock
 * timestamps were supplied. Distance below is DERIVED from the fan elevation
 * model (degrees × charges / 12), not a separately observed range.
 * The reported flight duration may be a game display or a timed observation.
 */
export interface ElevationFlightSample {
  id:string;
  bearingDeg:number;
  reportedElevationDeg:number;
  charges:number;
  reportedFlightSeconds:number;
  shell:null;
  rangeSource:'derived-from-elevation';
}
export const ELEVATION_FLIGHT_SAMPLES:readonly ElevationFlightSample[]=[
  {
    id:'E01',bearingDeg:66.2,reportedElevationDeg:52.12,charges:3,
    reportedFlightSeconds:34,shell:null,rangeSource:'derived-from-elevation'
  },
  {
    id:'E02',bearingDeg:68.2,reportedElevationDeg:51.70,charges:3,
    reportedFlightSeconds:33.9,shell:null,rangeSource:'derived-from-elevation'
  },
  {
    id:'E03',bearingDeg:1.0,reportedElevationDeg:53.08,charges:1,
    reportedFlightSeconds:21,shell:null,rangeSource:'derived-from-elevation'
  }
];
export function compareElevationFlightSample(sample:ElevationFlightSample):{
  inferredRangeKm:number;
  modeledFlightSeconds:number;
  differenceSeconds:number;
}|null {
  // Use the existing community rule without changing the firing model.
  if(!Number.isInteger(sample.charges)||sample.charges<1||sample.charges>6||
     !Number.isFinite(sample.reportedElevationDeg)||
     sample.reportedElevationDeg<=0||sample.reportedElevationDeg>60)return null;
  const inferredRangeKm=sample.reportedElevationDeg*sample.charges/12;
  const modeledFlightSeconds=estimatedFlightSeconds(inferredRangeKm,sample.charges);
  return modeledFlightSeconds===null?null:{
    inferredRangeKm,modeledFlightSeconds,
    differenceSeconds:modeledFlightSeconds-sample.reportedFlightSeconds
  };
}
