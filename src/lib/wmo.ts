/** WMO weather interpretation codes as used by Open-Meteo. */
const CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

export const wmoText = (code: number) => CODES[code] ?? `Code ${code}`;
export const isThunder = (code: number) => code >= 95;

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const POINTS8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const compass16 = (deg: number) => POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
export const compass8 = (deg: number) => POINTS8[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** Wind is stored and shown in metres per second. One decimal keeps 5.8 distinct from 6.4. */
export const fmtWind = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(1));

export const kmhToMs = (n: number) => Math.round((n / 3.6) * 10) / 10;

/** Short descriptive wind condition (Beaufort-based wording, m/s). */
export function windCondition(ms: number) {
  if (ms < 0.6) return 'Calm';
  if (ms < 3.3) return 'Light breeze';
  if (ms < 8.1) return 'Moderate breeze';
  if (ms < 10.8) return 'Fresh breeze';
  if (ms < 13.9) return 'Strong breeze';
  if (ms < 17.2) return 'Near gale';
  if (ms < 20.8) return 'Gale';
  if (ms < 24.7) return 'Strong gale';
  return 'Storm';
}

export const f1 = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? '—' : v.toFixed(d));
export const fVis = (m: number | null | undefined) =>
  m === null || m === undefined ? '—' : m >= 10000 ? `${(m / 1000).toFixed(0)} km` : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
