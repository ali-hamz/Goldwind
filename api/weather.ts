/**
 * GET /api/weather?lat=..&lon=..&tz=..
 *
 * Free, key-less weather proxy (Vercel Edge Function).
 *  1. Open-Meteo forecast + CAMS air quality (commercial endpoint if OPEN_METEO_API_KEY is set).
 *  2. Fallback: MET Norway Locationforecast 2.0 (free, global, no key), converted to the
 *     Open-Meteo response shape so the frontend needs only one parser.
 *  3. Last resort: the last good response held in this instance's memory (<= 24 h old).
 *
 * The Vercel CDN caches each response for 15 min, so all viewers together trigger roughly
 * one upstream request per 15 minutes per location – no per-browser rate limiting.
 */
export const config = { runtime: 'edge' };

const UA = 'EGC-Weather-Monitoring/1.0 (Ezdihar Al-Garraf HSE; github.com/talal-ai/ecg-weather-forcast)';

const HOURLY = 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,cloud_cover,pressure_msl,cape';
const CURRENT = 'temperature_2m,apparent_temperature,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,cloud_cover,precipitation,weather_code,is_day,cape';
const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,precipitation_sum,precipitation_probability_max,sunrise,sunset';

type Json = Record<string, any>;
interface Payload {
  provider: 'open-meteo' | 'met-norway';
  source: string;
  historyAvailable: boolean;
  forecast: Json;
  air: Json | null;
  servedAt: number;
  stale?: boolean;
}

const memory = new Map<string, Payload>();

async function getJson(url: string, timeoutMs = 9000): Promise<Json> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.error) throw new Error(body?.reason ?? `HTTP ${res.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------ Open-Meteo ------------------------------ */

async function openMeteo(lat: number, lon: number, tz: string, key?: string) {
  const base = key ? 'https://customer-api.open-meteo.com/v1/forecast' : 'https://api.open-meteo.com/v1/forecast';
  const p = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: tz,
    timeformat: 'unixtime',
    wind_speed_unit: 'kmh',
    past_days: '7',
    forecast_days: '8',
    current: CURRENT,
    hourly: HOURLY,
    daily: DAILY,
  });
  if (key) p.set('apikey', key);
  return getJson(`${base}?${p}`);
}

async function airQuality(lat: number, lon: number, tz: string, key?: string) {
  const base = key ? 'https://customer-air-quality-api.open-meteo.com/v1/air-quality' : 'https://air-quality-api.open-meteo.com/v1/air-quality';
  const p = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: tz,
    timeformat: 'unixtime',
    past_days: '7',
    forecast_days: '5',
    current: 'dust,pm10',
    hourly: 'dust,pm10',
  });
  if (key) p.set('apikey', key);
  return getJson(`${base}?${p}`).catch(() => null);
}

/* ------------------------------ MET Norway ------------------------------ */

const KMH = 3.6;

function tzOffsetSec(tz: string, unix: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(unix * 1000)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) / 1000;
  return asUtc - unix;
}

const localDate = (unix: number, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(unix * 1000);

export function symbolToWmo(symbol: string | undefined): number {
  if (!symbol) return 3;
  const s = symbol.split('_')[0];
  if (s.includes('thunder')) return 95;
  const map: Record<string, number> = {
    clearsky: 0,
    fair: 1,
    partlycloudy: 2,
    cloudy: 3,
    fog: 45,
    lightrain: 61,
    rain: 63,
    heavyrain: 65,
    lightrainshowers: 80,
    rainshowers: 81,
    heavyrainshowers: 82,
    lightsleet: 66,
    sleet: 66,
    heavysleet: 67,
    lightsleetshowers: 66,
    sleetshowers: 66,
    heavysleetshowers: 67,
    lightsnow: 71,
    snow: 73,
    heavysnow: 75,
    lightsnowshowers: 85,
    snowshowers: 85,
    heavysnowshowers: 86,
  };
  return map[s] ?? 3;
}

/** Australian BoM apparent temperature (shade), as used by most providers. */
function apparent(t: number, rh: number, wsMs: number) {
  const e = (rh / 100) * 6.105 * Math.exp((17.27 * t) / (237.7 + t));
  return t + 0.33 * e - 0.7 * wsMs - 4.0;
}

/** Sunrise / sunset (unix s) for the local day starting at `midnight`, standard sunrise equation. */
export function sunTimes(midnight: number, lat: number, lon: number): [number, number] {
  const rad = Math.PI / 180;
  const J = (midnight + 12 * 3600) / 86400 + 2440587.5;
  const n = Math.ceil(J - 2451545.0 + 0.0008);
  const Js = n - lon / 360;
  const M = (357.5291 + 0.98560028 * Js) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const Jt = 2451545.0 + Js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const sinD = Math.sin(L * rad) * Math.sin(23.4397 * rad);
  const cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinD) / (Math.cos(lat * rad) * cosD);
  const w = Math.acos(Math.max(-1, Math.min(1, cosW))) / rad;
  const toUnix = (jd: number) => Math.round((jd - 2440587.5) * 86400);
  return [toUnix(Jt - w / 360), toUnix(Jt + w / 360)];
}

/** Convert a MET Norway "complete" response into the Open-Meteo forecast response shape. */
export function metToOpenMeteo(met: Json, lat: number, lon: number, tz: string, now = Math.floor(Date.now() / 1000)): Json {
  const ts: Json[] = met?.properties?.timeseries ?? [];
  if (!ts.length) throw new Error('MET Norway: empty timeseries');
  const H: Record<string, (number | null)[]> = Object.fromEntries(HOURLY.split(',').map((k) => [k, [] as (number | null)[]]));
  const time: number[] = [];

  for (const e of ts) {
    const t = Math.floor(Date.parse(e.time) / 1000);
    const d = e.data?.instant?.details ?? {};
    const n1 = e.data?.next_1_hours;
    const n6 = e.data?.next_6_hours;
    const next = n1 ?? n6;
    const temp = d.air_temperature ?? null;
    const rh = d.relative_humidity ?? null;
    const ws = d.wind_speed ?? null;
    time.push(t);
    H.temperature_2m.push(temp);
    H.relative_humidity_2m.push(rh);
    H.apparent_temperature.push(temp !== null && rh !== null && ws !== null ? +apparent(temp, rh, ws).toFixed(1) : temp);
    H.wind_speed_10m.push(ws !== null ? +(ws * KMH).toFixed(1) : null);
    // Gust is not published for every step; fall back to sustained speed rather than inventing a value.
    H.wind_gusts_10m.push(d.wind_speed_of_gust != null ? +(d.wind_speed_of_gust * KMH).toFixed(1) : ws !== null ? +(ws * KMH).toFixed(1) : null);
    H.wind_direction_10m.push(d.wind_from_direction ?? null);
    H.pressure_msl.push(d.air_pressure_at_sea_level ?? null);
    H.cloud_cover.push(d.cloud_area_fraction ?? null);
    H.precipitation.push(next?.details?.precipitation_amount ?? 0);
    H.precipitation_probability.push(next?.details?.probability_of_precipitation ?? null);
    H.weather_code.push(symbolToWmo(next?.summary?.symbol_code));
    H.visibility.push(null); // MET Norway does not publish visibility
    H.cape.push(null);
  }

  // Current = latest step not in the future (MET starts at the current hour).
  let ci = 0;
  for (let i = 0; i < time.length; i++) if (time[i] <= now) ci = i;
  const offset = tzOffsetSec(tz, now);

  // Daily aggregation in site-local days.
  const days = new Map<string, number[]>();
  time.forEach((t, i) => {
    const k = localDate(t, tz);
    if (!days.has(k)) days.set(k, []);
    days.get(k)!.push(i);
  });
  const D: Record<string, number[]> = Object.fromEntries(DAILY.split(',').map((k) => [k, [] as number[]]));
  const dTime: number[] = [];
  for (const [k, idx] of days) {
    if (idx.length < 2) continue; // incomplete trailing day
    const [y, m, dd] = k.split('-').map(Number);
    const midnight = Date.UTC(y, m - 1, dd) / 1000 - offset;
    const vals = (key: string) => idx.map((i) => H[key][i]).filter((v): v is number => v !== null);
    const temps = vals('temperature_2m');
    for (const i of idx) {
      const n6 = ts[i].data?.next_6_hours?.details;
      if (n6?.air_temperature_max != null) temps.push(n6.air_temperature_max);
      if (n6?.air_temperature_min != null) temps.push(n6.air_temperature_min);
    }
    const dirs = idx.filter((i) => H.wind_direction_10m[i] !== null && H.wind_speed_10m[i] !== null);
    const vx = dirs.reduce((a, i) => a + (H.wind_speed_10m[i] as number) * Math.sin(((H.wind_direction_10m[i] as number) * Math.PI) / 180), 0);
    const vy = dirs.reduce((a, i) => a + (H.wind_speed_10m[i] as number) * Math.cos(((H.wind_direction_10m[i] as number) * Math.PI) / 180), 0);
    const [rise, set] = sunTimes(midnight, lat, lon);
    dTime.push(midnight);
    D.weather_code.push(Math.max(...vals('weather_code')));
    D.temperature_2m_max.push(Math.max(...temps));
    D.temperature_2m_min.push(Math.min(...temps));
    D.wind_speed_10m_max.push(Math.max(...vals('wind_speed_10m')));
    D.wind_gusts_10m_max.push(Math.max(...vals('wind_gusts_10m')));
    D.wind_direction_10m_dominant.push(Math.round(((Math.atan2(vx, vy) * 180) / Math.PI + 360) % 360));
    D.precipitation_sum.push(+vals('precipitation').reduce((a, b) => a + b, 0).toFixed(1));
    D.precipitation_probability_max.push(vals('precipitation_probability').length ? Math.max(...vals('precipitation_probability')) : 0);
    D.sunrise.push(rise);
    D.sunset.push(set);
  }

  const today = D.sunrise[0] !== undefined ? dTime.findIndex((t) => t <= now && now < t + 86400) : -1;
  const isDay = today >= 0 ? now >= D.sunrise[today] && now < D.sunset[today] : true;
  const coords = met?.geometry?.coordinates ?? [lon, lat, 0];

  return {
    latitude: coords[1],
    longitude: coords[0],
    elevation: coords[2] ?? 0,
    timezone: tz,
    utc_offset_seconds: offset,
    current: {
      time: time[ci],
      temperature_2m: H.temperature_2m[ci],
      apparent_temperature: H.apparent_temperature[ci],
      relative_humidity_2m: H.relative_humidity_2m[ci],
      pressure_msl: H.pressure_msl[ci],
      wind_speed_10m: H.wind_speed_10m[ci],
      wind_gusts_10m: H.wind_gusts_10m[ci],
      wind_direction_10m: H.wind_direction_10m[ci],
      visibility: null,
      cloud_cover: H.cloud_cover[ci],
      precipitation: H.precipitation[ci],
      weather_code: H.weather_code[ci],
      is_day: isDay ? 1 : 0,
      cape: null,
    },
    hourly: { time, ...H },
    daily: { time: dTime, ...D },
  };
}

async function metNorway(lat: number, lon: number, tz: string) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
  return metToOpenMeteo(await getJson(url), lat, lon, tz);
}

/* -------------------------------- handler -------------------------------- */

function respond(body: unknown, status: number, cacheable: boolean) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': cacheable ? 'public, max-age=60, s-maxage=900, stale-while-revalidate=3600, stale-if-error=86400' : 'no-store',
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get('lat'));
  const lon = Number(q.get('lon'));
  const tz = q.get('tz') || 'Asia/Riyadh';
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return respond({ error: 'Invalid lat/lon' }, 400, false);
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
  } catch {
    return respond({ error: 'Invalid timezone' }, 400, false);
  }
  const key = (globalThis as any).process?.env?.OPEN_METEO_API_KEY as string | undefined;
  const memKey = `${lat.toFixed(4)},${lon.toFixed(4)},${tz}`;
  const errors: string[] = [];

  const air = airQuality(lat, lon, tz, key);
  try {
    const forecast = await openMeteo(lat, lon, tz, key);
    const payload: Payload = {
      provider: 'open-meteo',
      source: key ? 'Open-Meteo (commercial) + CAMS air quality' : 'Open-Meteo + CAMS air quality',
      historyAvailable: true,
      forecast,
      air: await air,
      servedAt: Date.now(),
    };
    memory.set(memKey, payload);
    return respond(payload, 200, true);
  } catch (e) {
    errors.push(`Open-Meteo: ${e instanceof Error ? e.message : e}`);
  }

  try {
    const forecast = await metNorway(lat, lon, tz);
    const payload: Payload = {
      provider: 'met-norway',
      source: 'MET Norway Locationforecast (fallback) + CAMS air quality',
      historyAvailable: false,
      forecast,
      air: await air,
      servedAt: Date.now(),
    };
    memory.set(memKey, payload);
    return respond(payload, 200, true);
  } catch (e) {
    errors.push(`MET Norway: ${e instanceof Error ? e.message : e}`);
  }

  const last = memory.get(memKey);
  if (last && Date.now() - last.servedAt < 86400 * 1000) return respond({ ...last, stale: true }, 200, false);
  return respond({ error: errors.join(' | ') }, 502, false);
}
