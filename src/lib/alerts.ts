import type { Settings, Threshold } from './settings';
import { nextHours, nowSec, type HourPoint, type WeatherData } from './openMeteo';

export type Level = 0 | 1 | 2 | 3;
export const LEVEL_NAME = ['GREEN', 'YELLOW', 'ORANGE', 'RED'] as const;
export const LEVEL_TEXT = ['Normal', 'Be aware', 'Be prepared', 'Take action'] as const;

export type AlertCategory = 'wind' | 'heat' | 'dust' | 'visibility' | 'rain' | 'thunder' | 'lightning';

export const CATEGORY_LABEL: Record<AlertCategory, string> = {
  wind: 'High wind speed',
  heat: 'Extreme heat',
  dust: 'Dust storm',
  visibility: 'Reduced visibility',
  rain: 'Heavy rainfall',
  thunder: 'Thunderstorm',
  lightning: 'Lightning risk',
};

export interface Alert {
  category: AlertCategory;
  label: string;
  nowLevel: Level;
  forecastLevel: Level; // worst level in the next 24 h
  level: Level; // max(now, forecast)
  nowValue: string;
  peakValue: string;
  peakTime: number | null;
  basis: string;
  available: boolean;
}

export function levelFor(value: number | null, t: Threshold): Level {
  if (!t.enabled || value === null) return 0;
  if (t.direction === 'above') {
    if (value >= t.red) return 3;
    if (value >= t.orange) return 2;
    if (value >= t.yellow) return 1;
  } else {
    if (value <= t.red) return 3;
    if (value <= t.orange) return 2;
    if (value <= t.yellow) return 1;
  }
  return 0;
}

const thunderLevel = (code: number): Level => (code === 96 || code === 99 ? 3 : code === 95 ? 2 : 0);
const maxL = (...l: Level[]) => Math.max(0, ...l) as Level;

function peak(hours: HourPoint[], score: (h: HourPoint) => Level, value: (h: HourPoint) => number | null, worst: 'max' | 'min' = 'max') {
  let best: HourPoint | null = null;
  let bestLevel: Level = 0;
  let bestVal: number | null = null;
  for (const h of hours) {
    const l = score(h);
    const v = value(h);
    if (v === null) continue;
    const better = worst === 'max' ? bestVal === null || v > bestVal : bestVal === null || v < bestVal;
    if (l > bestLevel || (l === bestLevel && better)) {
      best = h;
      bestLevel = l;
      bestVal = v;
    }
  }
  return { level: bestLevel, hour: best, value: bestVal };
}

const fmt = (v: number | null, unit: string, d = 0) => (v === null ? 'n/a' : `${v.toFixed(d)} ${unit}`);

export function evaluateAlerts(w: WeatherData, s: Settings, now = nowSec()): Alert[] {
  const T = s.thresholds;
  const c = w.current;
  const next = nextHours(w, 24, now);
  const out: Alert[] = [];

  const push = (a: Omit<Alert, 'level' | 'label'>) =>
    out.push({ ...a, label: CATEGORY_LABEL[a.category], level: maxL(a.nowLevel, a.forecastLevel) });

  // Wind: worst of sustained speed and gust
  const windScore = (speed: number, gust: number) => maxL(levelFor(speed, T.windSpeed), levelFor(gust, T.windGust));
  const pw = peak(next, (h) => windScore(h.windSpeed, h.windGust), (h) => h.windGust);
  push({
    category: 'wind',
    nowLevel: windScore(c.windSpeed, c.windGust),
    forecastLevel: pw.level,
    nowValue: `${c.windSpeed.toFixed(0)} km/h (gust ${c.windGust.toFixed(0)})`,
    peakValue: pw.hour ? `${pw.hour.windSpeed.toFixed(0)} km/h (gust ${pw.hour.windGust.toFixed(0)})` : 'n/a',
    peakTime: pw.hour?.time ?? null,
    basis: `Speed ≥ ${T.windSpeed.yellow}/${T.windSpeed.orange}/${T.windSpeed.red} km/h or gust ≥ ${T.windGust.yellow}/${T.windGust.orange}/${T.windGust.red} km/h`,
    available: T.windSpeed.enabled || T.windGust.enabled,
  });

  // Heat: air temperature (WBGT is not available from the API)
  const ph = peak(next, (h) => levelFor(h.temperature, T.heat), (h) => h.temperature);
  push({
    category: 'heat',
    nowLevel: levelFor(c.temperature, T.heat),
    forecastLevel: ph.level,
    nowValue: `${c.temperature.toFixed(1)} °C (feels ${c.apparentTemperature.toFixed(0)})`,
    peakValue: fmt(ph.value, '°C', 1),
    peakTime: ph.hour?.time ?? null,
    basis: `Air temperature ≥ ${T.heat.yellow}/${T.heat.orange}/${T.heat.red} °C`,
    available: T.heat.enabled,
  });

  // Dust: CAMS surface dust concentration
  const pd = peak(next, (h) => levelFor(h.dust, T.dust), (h) => h.dust);
  push({
    category: 'dust',
    nowLevel: levelFor(c.dust, T.dust),
    forecastLevel: pd.level,
    nowValue: fmt(c.dust, 'µg/m³'),
    peakValue: fmt(pd.value, 'µg/m³'),
    peakTime: pd.hour?.time ?? null,
    basis: `CAMS dust ≥ ${T.dust.yellow}/${T.dust.orange}/${T.dust.red} µg/m³`,
    available: T.dust.enabled && w.airQualityAvailable,
  });

  // Visibility
  const pv = peak(next, (h) => levelFor(h.visibility, T.visibility), (h) => h.visibility, 'min');
  push({
    category: 'visibility',
    nowLevel: levelFor(c.visibility, T.visibility),
    forecastLevel: pv.level,
    nowValue: fmt(c.visibility, 'm'),
    peakValue: fmt(pv.value, 'm'),
    peakTime: pv.hour?.time ?? null,
    basis: `Visibility ≤ ${T.visibility.yellow}/${T.visibility.orange}/${T.visibility.red} m`,
    available: T.visibility.enabled && c.visibility !== null,
  });

  // Rain
  const pr = peak(next, (h) => levelFor(h.precipitation, T.rain), (h) => h.precipitation);
  push({
    category: 'rain',
    nowLevel: levelFor(c.precipitation, T.rain),
    forecastLevel: pr.level,
    nowValue: fmt(c.precipitation, 'mm', 1),
    peakValue: fmt(pr.value, 'mm/h', 1),
    peakTime: pr.hour?.time ?? null,
    basis: `Hourly rain ≥ ${T.rain.yellow}/${T.rain.orange}/${T.rain.red} mm/h`,
    available: T.rain.enabled,
  });

  // Thunderstorm: model weather code
  const pt = peak(next, (h) => thunderLevel(h.weatherCode), (h) => h.weatherCode);
  push({
    category: 'thunder',
    nowLevel: thunderLevel(c.weatherCode),
    forecastLevel: pt.level,
    nowValue: thunderLevel(c.weatherCode) ? 'Thunderstorm indicated' : 'None indicated',
    peakValue: pt.level ? 'Thunderstorm indicated' : 'None indicated',
    peakTime: pt.level ? pt.hour?.time ?? null : null,
    basis: 'Model weather code 95 → ORANGE, 96/99 (with hail) → RED',
    available: true,
  });

  // Lightning: indicative only. Thunder code → thunder level (raised by CAPE);
  // CAPE alone is capped at YELLOW because instability without a storm signal is not lightning.
  const lightning = (code: number, cape: number | null): Level => {
    const cl = levelFor(cape, T.cape);
    return thunderLevel(code) ? maxL(thunderLevel(code), cl) : (Math.min(cl, 1) as Level);
  };
  const pl = peak(next, (h) => lightning(h.weatherCode, h.cape), (h) => h.cape);
  push({
    category: 'lightning',
    nowLevel: lightning(c.weatherCode, c.cape),
    forecastLevel: pl.level,
    nowValue: fmt(c.cape, 'J/kg CAPE'),
    peakValue: fmt(pl.value, 'J/kg CAPE'),
    peakTime: pl.level ? pl.hour?.time ?? null : null,
    basis: 'Indicative only (no lightning detection network). Thunderstorm code + CAPE; CAPE alone max YELLOW',
    available: T.cape.enabled,
  });

  return out;
}

export const overallLevel = (alerts: Alert[]): Level => maxL(...alerts.filter((a) => a.available).map((a) => a.level));
