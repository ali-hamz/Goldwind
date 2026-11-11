import type { WeatherData } from './openMeteo';
import { SITES, type SiteId } from './settings';

/**
 * Browser-side persistence (no server). Two stores:
 *  1. The last successful API response – lets the dashboard render immediately
 *     after a reload and keep showing data (marked stale) during an API outage.
 *  2. A log of timestamped readings captured at every refresh (kept 30 days).
 *
 * Longer-term, organisation-wide history comes directly from Open-Meteo
 * (`past_days=7`), so history is never empty on a new device.
 */

const LAST = 'egc-weather.last.v1';
const LAST_BY_SITE = 'egc-weather.last.v2';
const LOG = 'egc-weather.log.v1';
const KEEP_MS = 30 * 86400 * 1000;

export interface Reading {
  t: number; // ms, time captured
  modelTime: number; // unix s, model valid time
  temperature: number;
  humidity: number;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  pressure: number;
  visibility: number | null;
  precipitation: number;
  dust: number | null;
  /** Missing on readings saved before the site switcher; those belong to Al-Ahmer west. */
  siteId?: SiteId;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode – ignore */
  }
}

const ahmer = SITES[0];

function near(a: number, b: number) {
  return Math.abs(a - b) < 0.0001;
}

/** Last successful response for one site. The old single cache is kept for Al-Ahmer west. */
export function loadLast(siteId: SiteId): WeatherData | null {
  const map = read<Partial<Record<SiteId, WeatherData>>>(LAST_BY_SITE, {});
  if (map[siteId]) return map[siteId] ?? null;
  if (siteId !== ahmer.id) return null;
  const old = read<WeatherData | null>(LAST, null);
  return old && near(old.latitude, ahmer.latitude) && near(old.longitude, ahmer.longitude) ? old : null;
}

export function saveLast(w: WeatherData, siteId: SiteId) {
  const map = read<Partial<Record<SiteId, WeatherData>>>(LAST_BY_SITE, {});
  map[siteId] = w;
  write(LAST_BY_SITE, map);
}

export const loadLog = () => read<Reading[]>(LOG, []);

export function appendReading(w: WeatherData, siteId: SiteId) {
  const c = w.current;
  const log = loadLog().filter((r) => r.t > Date.now() - KEEP_MS);
  const sameSite = log.filter((r) => (r.siteId ?? ahmer.id) === siteId);
  if (sameSite.length && sameSite[sameSite.length - 1].modelTime === c.time) return log;
  log.push({
    t: w.fetchedAt,
    modelTime: c.time,
    temperature: c.temperature,
    humidity: c.humidity,
    windSpeed: c.windSpeed,
    windGust: c.windGust,
    windDirection: c.windDirection,
    pressure: c.pressure,
    visibility: c.visibility,
    precipitation: c.precipitation,
    dust: c.dust,
    siteId,
  });
  write(LOG, log);
  return log;
}

export function clearLog() {
  write(LOG, []);
}
