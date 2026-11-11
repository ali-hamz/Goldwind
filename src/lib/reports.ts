import type { Settings } from './settings';
import { forecastDays, localDate, nowSec, todayIndex, type WeatherData } from './openMeteo';
import { evaluateAlerts, LEVEL_NAME, overallLevel, CATEGORY_LABEL } from './alerts';
import { compass16, fmtWind, wmoText } from './wmo';

export type ReportStatus = 'pending_review' | 'approved' | 'rejected';

export interface ReportRecord {
  id: string;
  date: string; // site-local YYYY-MM-DD
  createdAt: number; // ms
  trigger: 'scheduled' | 'manual';
  status: ReportStatus;
  reviewer?: string;
  reviewedAt?: number;
  comment?: string;
  snapshot: WeatherData; // trimmed data the report was built from (re-downloads are identical)
  settings: Settings;
}

const KEY = 'egc-weather.reports.v1';
const MAX_REPORTS = 20;

export function loadReports(): ReportRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveReports(list: ReportRecord[]) {
  let l = list.slice(0, MAX_REPORTS);
  // Shrink history if the browser quota is reached.
  while (l.length) {
    try {
      localStorage.setItem(KEY, JSON.stringify(l));
      return;
    } catch {
      l = l.slice(0, l.length - 1);
    }
  }
}

/** Keep only what the PDF needs, to stay within browser storage limits. */
function trim(w: WeatherData): WeatherData {
  const now = nowSec();
  return {
    ...w,
    hourly: w.hourly.filter((h) => h.time > now - 25 * 3600 && h.time <= now + 49 * 3600),
    daily: w.daily.slice(Math.max(0, todayIndex(w) - 1)),
  };
}

export function createReport(w: WeatherData, s: Settings, trigger: 'scheduled' | 'manual'): ReportRecord {
  const rec: ReportRecord = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    date: localDate(nowSec(), s.timezone),
    createdAt: Date.now(),
    trigger,
    status: 'pending_review',
    snapshot: trim(w),
    settings: { ...s, apiKey: '' },
  };
  saveReports([rec, ...loadReports()]);
  return rec;
}

export function updateReport(id: string, patch: Partial<ReportRecord>) {
  const list = loadReports().map((r) => (r.id === id ? { ...r, ...patch } : r));
  saveReports(list);
  return list;
}

export function deleteReport(id: string) {
  const list = loadReports().filter((r) => r.id !== id);
  saveReports(list);
  return list;
}

/** A report belongs to a site by its saved site id, or by coordinates for older reports. */
export function reportMatchesSite(r: ReportRecord, s: Settings) {
  if (r.settings.siteId && s.siteId) return r.settings.siteId === s.siteId;
  return Math.abs(r.snapshot.latitude - s.latitude) < 0.0001 && Math.abs(r.snapshot.longitude - s.longitude) < 0.0001;
}

export const hasReportForDate = (date: string, s?: Settings) => loadReports().some((r) => r.date === date && (!s || reportMatchesSite(r, s)));

/** One-paragraph forecast summary used in the dashboard and PDF. */
export function forecastSummary(w: WeatherData, s: Settings, now = nowSec()): string {
  const today = forecastDays(w, 1, now)[0];
  const tomorrow = forecastDays(w, 2, now)[1];
  const alerts = evaluateAlerts(w, s, now);
  const overall = overallLevel(alerts);
  const concerns = alerts.filter((a) => a.available && a.level > 0).map((a) => `${CATEGORY_LABEL[a.category].toLowerCase()} (${LEVEL_NAME[a.level]})`);
  const parts: string[] = [];
  if (today) {
    parts.push(
      `Today: ${wmoText(today.weatherCode).toLowerCase()}, maximum ${today.tMax.toFixed(0)} °C and minimum ${today.tMin.toFixed(0)} °C. ` +
        `Winds predominantly ${compass16(today.windDirDominant)} up to ${fmtWind(today.windMax)} m/s, gusting ${fmtWind(today.gustMax)} m/s. ` +
        `Rain probability ${today.precipProbMax ?? 0}% with ${today.precipSum.toFixed(1)} mm expected.`,
    );
  }
  if (tomorrow) {
    parts.push(`Tomorrow: ${wmoText(tomorrow.weatherCode).toLowerCase()}, ${tomorrow.tMax.toFixed(0)} / ${tomorrow.tMin.toFixed(0)} °C, gusts to ${fmtWind(tomorrow.gustMax)} m/s.`);
  }
  parts.push(
    `Overall weather alert level for the next 24 hours: ${LEVEL_NAME[overall]}` + (concerns.length ? ` – ${concerns.join(', ')}.` : ' – no thresholds exceeded.'),
  );
  return parts.join(' ');
}
