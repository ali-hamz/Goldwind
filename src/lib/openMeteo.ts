import type { Settings } from './settings';

/**
 * Open-Meteo client (https://open-meteo.com).
 *
 * All values are numerical-weather-model estimates for the configured grid
 * point, NOT measurements from instruments at the site.
 */

export interface CurrentConditions {
  time: number; // unix seconds
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  pressure: number; // hPa, mean sea level
  windSpeed: number; // m/s
  windGust: number; // m/s
  windDirection: number; // deg
  visibility: number | null; // m
  cloudCover: number; // %
  precipitation: number; // mm (preceding 15 min / hour, model)
  weatherCode: number;
  isDay: boolean;
  cape: number | null;
  dust: number | null;
}

export interface HourPoint {
  time: number;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipProbability: number | null;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  visibility: number | null;
  cloudCover: number;
  pressure: number;
  cape: number | null;
  dust: number | null;
}

export interface DayPoint {
  time: number;
  date: string; // YYYY-MM-DD (site local)
  weatherCode: number;
  tMax: number;
  tMin: number;
  windMax: number;
  gustMax: number;
  windDirDominant: number;
  precipSum: number;
  precipProbMax: number | null;
  humidityMean: number | null;
  sunrise: number;
  sunset: number;
}

export interface WeatherData {
  fetchedAt: number; // ms
  source: string;
  endpoint: 'free' | 'customer';
  provider: 'open-meteo' | 'met-norway';
  /** false when the provider has no past hours (MET Norway); past data is then kept from earlier fetches. */
  historyAvailable: boolean;
  timezone: string;
  latitude: number;
  longitude: number;
  elevation: number;
  current: CurrentConditions;
  hourly: HourPoint[]; // past 7 days + forecast
  daily: DayPoint[]; // past 7 days + forecast
  airQualityAvailable: boolean;
}

const HOURLY = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'visibility',
  'cloud_cover',
  'pressure_msl',
  'cape',
];

const CURRENT = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'pressure_msl',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'visibility',
  'cloud_cover',
  'precipitation',
  'weather_code',
  'is_day',
  'cape',
];

const DAILY = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
  'precipitation_sum',
  'precipitation_probability_max',
  'sunrise',
  'sunset',
];

function forecastUrl(s: Settings) {
  const base = s.apiKey ? 'https://customer-api.open-meteo.com/v1/forecast' : 'https://api.open-meteo.com/v1/forecast';
  const p = new URLSearchParams({
    latitude: String(s.latitude),
    longitude: String(s.longitude),
    timezone: s.timezone,
    timeformat: 'unixtime',
    wind_speed_unit: 'ms',
    past_days: '7',
    forecast_days: '8',
    current: CURRENT.join(','),
    hourly: HOURLY.join(','),
    daily: DAILY.join(','),
  });
  if (s.apiKey) p.set('apikey', s.apiKey);
  return `${base}?${p}`;
}

function airQualityUrl(s: Settings) {
  const base = s.apiKey
    ? 'https://customer-air-quality-api.open-meteo.com/v1/air-quality'
    : 'https://air-quality-api.open-meteo.com/v1/air-quality';
  const p = new URLSearchParams({
    latitude: String(s.latitude),
    longitude: String(s.longitude),
    timezone: s.timezone,
    timeformat: 'unixtime',
    past_days: '7',
    forecast_days: '5',
    current: 'dust,pm10',
    hourly: 'dust,pm10',
  });
  if (s.apiKey) p.set('apikey', s.apiKey);
  return `${base}?${p}`;
}

async function getJson(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.error) {
    throw new Error(body?.reason ? `Open-Meteo: ${body.reason}` : `HTTP ${res.status}`);
  }
  return body;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const n0 = (v: unknown) => num(v) ?? 0;

interface RawWeather {
  forecast: any;
  air: any;
  source: string;
  provider: 'open-meteo' | 'met-norway';
  historyAvailable: boolean;
}

class ProxyUnavailable extends Error {}

/** Serverless proxy (/api/weather): CDN-cached, with MET Norway fallback. */
async function viaProxy(s: Settings, signal?: AbortSignal): Promise<RawWeather> {
  const q = new URLSearchParams({ lat: s.latitude.toFixed(4), lon: s.longitude.toFixed(4), tz: s.timezone });
  const res = await fetch(`/api/weather?${q}`, { signal });
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) throw new ProxyUnavailable('proxy not deployed');
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(body.error ?? `Proxy HTTP ${res.status}`);
  return body;
}

/** Direct browser → Open-Meteo call (local development, or when a browser-side key is configured). */
async function direct(s: Settings, signal?: AbortSignal): Promise<RawWeather> {
  const [forecast, air] = await Promise.all([getJson(forecastUrl(s), signal), getJson(airQualityUrl(s), signal).catch(() => null)]);
  return {
    forecast,
    air,
    provider: 'open-meteo',
    historyAvailable: true,
    source: s.apiKey ? 'Open-Meteo (commercial) + CAMS air quality' : 'Open-Meteo + CAMS air quality',
  };
}

export async function fetchWeather(s: Settings, signal?: AbortSignal): Promise<WeatherData> {
  let raw: RawWeather;
  if (s.apiKey) raw = await direct(s, signal);
  else {
    try {
      raw = await viaProxy(s, signal);
    } catch (proxyErr) {
      try {
        raw = await direct(s, signal);
      } catch (directErr) {
        if (proxyErr instanceof ProxyUnavailable) throw directErr;
        throw new Error(`${(proxyErr as Error).message} | direct: ${(directErr as Error).message}`);
      }
    }
  }
  return normalize(raw, s);
}

function normalize(raw: RawWeather, s: Settings): WeatherData {
  const fc = raw.forecast;
  const aq = raw.air;
  const dustByTime = new Map<number, number>();
  if (aq?.hourly?.time) {
    aq.hourly.time.forEach((t: number, i: number) => {
      const d = num(aq.hourly.dust?.[i]);
      if (d !== null) dustByTime.set(t, d);
    });
  }

  const h = fc.hourly;
  const hourly: HourPoint[] = h.time.map((t: number, i: number) => ({
    time: t,
    temperature: n0(h.temperature_2m[i]),
    apparentTemperature: n0(h.apparent_temperature[i]),
    humidity: n0(h.relative_humidity_2m[i]),
    precipProbability: num(h.precipitation_probability?.[i]),
    precipitation: n0(h.precipitation[i]),
    weatherCode: n0(h.weather_code[i]),
    windSpeed: n0(h.wind_speed_10m[i]),
    windGust: n0(h.wind_gusts_10m[i]),
    windDirection: n0(h.wind_direction_10m[i]),
    visibility: num(h.visibility?.[i]),
    cloudCover: n0(h.cloud_cover[i]),
    pressure: n0(h.pressure_msl[i]),
    cape: num(h.cape?.[i]),
    dust: dustByTime.get(t) ?? null,
  }));

  const d = fc.daily;
  const daily: DayPoint[] = d.time.map((t: number, i: number) => {
    const dayHours = hourly.filter((x) => x.time >= t && x.time < t + 86400);
    return {
      time: t,
      date: localDate(t, s.timezone),
      weatherCode: n0(d.weather_code[i]),
      tMax: n0(d.temperature_2m_max[i]),
      tMin: n0(d.temperature_2m_min[i]),
      windMax: n0(d.wind_speed_10m_max[i]),
      gustMax: n0(d.wind_gusts_10m_max[i]),
      windDirDominant: n0(d.wind_direction_10m_dominant[i]),
      precipSum: n0(d.precipitation_sum[i]),
      precipProbMax: num(d.precipitation_probability_max?.[i]),
      humidityMean: dayHours.length ? dayHours.reduce((a, b) => a + b.humidity, 0) / dayHours.length : null,
      sunrise: n0(d.sunrise[i]),
      sunset: n0(d.sunset[i]),
    };
  });

  const c = fc.current;
  const current: CurrentConditions = {
    time: c.time,
    temperature: n0(c.temperature_2m),
    apparentTemperature: n0(c.apparent_temperature),
    humidity: n0(c.relative_humidity_2m),
    pressure: n0(c.pressure_msl),
    windSpeed: n0(c.wind_speed_10m),
    windGust: n0(c.wind_gusts_10m),
    windDirection: n0(c.wind_direction_10m),
    visibility: num(c.visibility),
    cloudCover: n0(c.cloud_cover),
    precipitation: n0(c.precipitation),
    weatherCode: n0(c.weather_code),
    isDay: c.is_day === 1,
    cape: num(c.cape),
    dust: num(aq?.current?.dust),
  };

  return {
    fetchedAt: Date.now(),
    source: raw.source,
    endpoint: s.apiKey ? 'customer' : 'free',
    provider: raw.provider,
    historyAvailable: raw.historyAvailable,
    timezone: fc.timezone ?? s.timezone,
    latitude: fc.latitude,
    longitude: fc.longitude,
    elevation: n0(fc.elevation),
    current,
    hourly,
    daily,
    airQualityAvailable: dustByTime.size > 0,
  };
}

/* ---------- time helpers (always rendered in site timezone) ---------- */

export function localDate(unix: number, tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(unix * 1000);
}

export function fmtTime(unix: number, tz: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(unix * 1000);
}

export function fmtDateTime(unix: number, tz: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(unix * 1000);
}

export function fmtDay(unix: number, tz: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: '2-digit', month: 'short' }).format(unix * 1000);
}

export function fmtFullDate(unix: number, tz: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(unix * 1000);
}

/** "HH:MM" of the current moment in the site timezone. */
export function siteClock(tz: string, d = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

/* ---------- slicing helpers ---------- */

export const nowSec = () => Math.floor(Date.now() / 1000);

export function pastHours(w: WeatherData, hours: number, now = nowSec()) {
  return w.hourly.filter((x) => x.time <= now && x.time > now - hours * 3600);
}

export function nextHours(w: WeatherData, hours: number, now = nowSec()) {
  const start = now - 3600; // include the hour in progress
  return w.hourly.filter((x) => x.time > start && x.time <= now + hours * 3600);
}

export function todayIndex(w: WeatherData, now = nowSec()) {
  const today = localDate(now, w.timezone);
  const i = w.daily.findIndex((d) => d.date === today);
  return i < 0 ? 0 : i;
}

export function forecastDays(w: WeatherData, n = 7, now = nowSec()) {
  const i = todayIndex(w, now);
  return w.daily.slice(i, i + n);
}

export function pastDays(w: WeatherData, n = 7, now = nowSec()) {
  const i = todayIndex(w, now);
  return w.daily.slice(Math.max(0, i - n), i);
}

/** Day or night for the hour starting at `t`, using the model's sunrise/sunset for that date. */
export function isDayAt(days: DayPoint[], t: number, tz: string) {
  const mid = t + 1800;
  const d = days.find((x) => mid >= x.time && mid < x.time + 86400);
  if (d && d.sunrise && d.sunset) return mid >= d.sunrise && mid < d.sunset;
  const h = Number(fmtTime(t, tz).slice(0, 2));
  return h >= 6 && h < 18;
}
