import type { WeatherData } from './openMeteo';

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

export const loadLast = () => read<WeatherData | null>(LAST, null);
export const saveLast = (w: WeatherData) => write(LAST, w);

export const loadLog = () => read<Reading[]>(LOG, []);

export function appendReading(w: WeatherData) {
  const c = w.current;
  const log = loadLog().filter((r) => r.t > Date.now() - KEEP_MS);
  if (log.length && log[log.length - 1].modelTime === c.time) return log; // same model step
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
  });
  write(LOG, log);
  return log;
}

export function clearLog() {
  write(LOG, []);
}
