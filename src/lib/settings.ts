/**
 * Site configuration and alert thresholds.
 *
 * Defaults below are PLACEHOLDERS for initial set-up only. They are NOT
 * approved site or HSE limits. Replace them (here, or in
 * System Settings → Export/Import) with the values from the applicable site
 * procedures, client requirements and approved HSE limits.
 */

export type Direction = 'above' | 'below';

export interface Threshold {
  key: ThresholdKey;
  label: string;
  unit: string;
  /** "above": higher value = worse (wind, heat). "below": lower value = worse (visibility). */
  direction: Direction;
  yellow: number;
  orange: number;
  red: number;
  enabled: boolean;
}

export type ThresholdKey =
  | 'windSpeed'
  | 'windGust'
  | 'heat'
  | 'visibility'
  | 'dust'
  | 'rain'
  | 'cape';

export interface Schedule {
  fetchTime: string; // HH:MM, site time
  prepareTime: string;
  reportTime: string;
}

export interface Settings {
  companyName: string;
  clientName: string;
  siteName: string;
  /** Compact label for the sidebar, radar pin, and PDF header. */
  shortName: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  timezone: string;
  refreshMinutes: number;
  /** Optional Open-Meteo commercial API key. See README: a key in a static site is visible to users. */
  apiKey: string;
  preparedBy: string;
  reviewedBy: string;
  schedule: Schedule;
  thresholds: Record<ThresholdKey, Threshold>;
  thresholdsApprovedRef: string; // free text: procedure / document reference
}

export const DEFAULT_SETTINGS: Settings = {
  companyName: 'Goldwind',
  clientName: '',
  siteName: 'Starah Independent PowerPlant-2GW Onshore Wind Project',
  shortName: 'Starah IPP 2GW',
  locationLabel: 'Al Aflaj, Riyadh Region',
  latitude: 22.465242,
  longitude: 46.040207,
  timezone: 'Asia/Riyadh',
  refreshMinutes: 15,
  apiKey: '',
  preparedBy: 'HSE Department',
  reviewedBy: 'HSE Manager',
  schedule: { fetchTime: '05:30', prepareTime: '05:45', reportTime: '06:00' },
  thresholdsApprovedRef: '',
  thresholds: {
    windSpeed: { key: 'windSpeed', label: 'Sustained wind speed', unit: 'km/h', direction: 'above', yellow: 30, orange: 40, red: 50, enabled: true },
    windGust: { key: 'windGust', label: 'Wind gust', unit: 'km/h', direction: 'above', yellow: 40, orange: 55, red: 70, enabled: true },
    heat: { key: 'heat', label: 'Air temperature (heat)', unit: '°C', direction: 'above', yellow: 40, orange: 46, red: 50, enabled: true },
    visibility: { key: 'visibility', label: 'Visibility', unit: 'm', direction: 'below', yellow: 5000, orange: 2000, red: 1000, enabled: true },
    dust: { key: 'dust', label: 'Surface dust concentration', unit: 'µg/m³', direction: 'above', yellow: 250, orange: 600, red: 1200, enabled: true },
    rain: { key: 'rain', label: 'Hourly rainfall', unit: 'mm/h', direction: 'above', yellow: 2.5, orange: 7.6, red: 15, enabled: true },
    cape: { key: 'cape', label: 'Convective potential (CAPE) – lightning indicator', unit: 'J/kg', direction: 'above', yellow: 800, orange: 1500, red: 2500, enabled: true },
  },
};

const KEY = 'egc-weather.settings.v2';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    return mergeSettings(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

/** Merge a (possibly partial / older) settings object over the defaults. */
export function mergeSettings(input: Partial<Settings>): Settings {
  const d = structuredClone(DEFAULT_SETTINGS);
  const thresholds = { ...d.thresholds };
  for (const k of Object.keys(thresholds) as ThresholdKey[]) {
    const t = input.thresholds?.[k];
    if (t) thresholds[k] = { ...thresholds[k], ...pickNumbers(t) };
  }
  return {
    ...d,
    ...input,
    shortName: input.shortName?.trim() ? input.shortName : d.shortName,
    schedule: { ...d.schedule, ...(input.schedule ?? {}) },
    thresholds,
  };
}

function pickNumbers(t: Partial<Threshold>): Partial<Threshold> {
  const out: Partial<Threshold> = {};
  for (const f of ['yellow', 'orange', 'red'] as const) {
    if (typeof t[f] === 'number' && Number.isFinite(t[f])) out[f] = t[f];
  }
  if (typeof t.enabled === 'boolean') out.enabled = t.enabled;
  return out;
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable – settings stay in memory for this session */
  }
}
