import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fetchWeather, localDate, siteClock, type WeatherData } from './lib/openMeteo';
import { loadSettings, saveSettings, type Settings, type SiteId } from './lib/settings';
import { appendReading, loadLast, loadLog, saveLast, type Reading } from './lib/storage';
import { evaluateAlerts, overallLevel, type Alert, type Level } from './lib/alerts';
import { createReport, hasReportForDate, loadReports, type ReportRecord } from './lib/reports';

export type ConnStatus = 'loading' | 'online' | 'stale' | 'offline';

interface Ctx {
  settings: Settings;
  setSettings: (s: Settings) => void;
  data: WeatherData | null;
  status: ConnStatus;
  error: string | null;
  lastSuccess: number | null;
  nextUpdate: number | null;
  refreshing: boolean;
  /** True while the selected site has no weather on screen yet. */
  switching: boolean;
  refresh: () => Promise<WeatherData | null>;
  log: Reading[];
  alerts: Alert[];
  overall: Level;
  reports: ReportRecord[];
  setReports: (r: ReportRecord[]) => void;
}

const WeatherCtx = createContext<Ctx | null>(null);
const RETRY_MS = 60 * 1000;
const MAX_BACKOFF_MS = 15 * 60 * 1000;
const SCHED_KEY = 'egc-weather.schedule-state.v1';

interface SchedState {
  date: string;
  fetch?: boolean;
  prepare?: boolean;
  report?: boolean;
}

function loadSched(): SchedState {
  try {
    return JSON.parse(localStorage.getItem(SCHED_KEY) ?? '{}');
  } catch {
    return { date: '' };
  }
}
function saveSched(s: SchedState) {
  try {
    localStorage.setItem(SCHED_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function samePlace(cached: WeatherData, s: Settings) {
  return Math.abs(cached.latitude - s.latitude) < 0.0001 && Math.abs(cached.longitude - s.longitude) < 0.0001;
}

function cachedFor(s: Settings) {
  const cached = loadLast(s.siteId);
  return cached && samePlace(cached, s) ? cached : null;
}

export function WeatherProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [data, setData] = useState<WeatherData | null>(() => cachedFor(loadSettings()));
  const dataRef = useRef<WeatherData | null>(data);
  dataRef.current = data;
  const [switching, setSwitching] = useState(false);
  const [status, setStatus] = useState<ConnStatus>(data ? 'stale' : 'loading');
  const [error, setError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<number | null>(data?.fetchedAt ?? null);
  const [nextUpdate, setNextUpdate] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [log, setLog] = useState<Reading[]>(loadLog);
  const [reports, setReports] = useState<ReportRecord[]>(loadReports);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const inFlight = useRef<{ siteId: SiteId; promise: Promise<WeatherData | null> } | null>(null);

  const nextRef = useRef<number | null>(null);
  const failures = useRef(0);
  const scheduleNext = (at: number) => {
    nextRef.current = at;
    setNextUpdate(at);
  };

  /**
   * Single entry point for API calls. Failures back off exponentially
   * (1, 2, 4, 8 … max 15 min) so an outage or rate limit is never hammered.
   */
  const refresh = useCallback(async () => {
    const start = settingsRef.current;
    if (inFlight.current?.siteId === start.siteId) return inFlight.current.promise;
    const run = (async () => {
      const s = start;
      setRefreshing(true);
      try {
        let w = await fetchWeather(s);
        const prev = loadLast(s.siteId);
        if (!w.historyAvailable && prev && prev.latitude === w.latitude) {
          // Fallback provider has no past hours: keep earlier hours/days so history charts stay populated.
          const first = w.hourly[0]?.time ?? Infinity;
          const firstDay = w.daily[0]?.time ?? Infinity;
          w = {
            ...w,
            hourly: [...prev.hourly.filter((h) => h.time < first && h.time > first - 8 * 86400), ...w.hourly],
            daily: [...prev.daily.filter((d) => d.time < firstDay && d.time > firstDay - 8 * 86400), ...w.daily],
          };
        }
        if (settingsRef.current.siteId !== s.siteId) return w;
        failures.current = 0;
        setData(w);
        setSwitching(false);
        saveLast(w, s.siteId);
        setLog(appendReading(w, s.siteId));
        setLastSuccess(w.fetchedAt);
        setStatus('online');
        setError(null);
        scheduleNext(Date.now() + s.refreshMinutes * 60 * 1000);
        return w;
      } catch (e) {
        if (settingsRef.current.siteId !== s.siteId) return null;
        failures.current += 1;
        const backoff = Math.min(MAX_BACKOFF_MS, RETRY_MS * 2 ** (failures.current - 1));
        setError(e instanceof Error ? e.message : String(e));
        const shown = dataRef.current;
        const showingThisSite = !!shown && samePlace(shown, s);
        setSwitching(!showingThisSite);
        setStatus(showingThisSite || loadLast(s.siteId) ? 'stale' : 'offline');
        scheduleNext(Date.now() + backoff);
        return null;
      } finally {
        setRefreshing(false);
        if (inFlight.current?.siteId === s.siteId) inFlight.current = null;
      }
    })();
    inFlight.current = { siteId: start.siteId, promise: run };
    return run;
  }, []);

  const setSettings = useCallback(
    (s: Settings) => {
      const locationChanged =
        s.latitude !== settingsRef.current.latitude ||
        s.longitude !== settingsRef.current.longitude ||
        s.timezone !== settingsRef.current.timezone ||
        s.apiKey !== settingsRef.current.apiKey;
      settingsRef.current = s;
      setSettingsState(s);
      saveSettings(s);
      if (locationChanged) {
        const cached = cachedFor(s);
        if (cached) {
          setData(cached);
          setLastSuccess(cached.fetchedAt);
          setStatus('stale');
          setSwitching(false);
        } else if (dataRef.current) {
          setSwitching(true);
          setStatus('stale');
        } else {
          setData(null);
          setLastSuccess(null);
          setSwitching(true);
          setStatus('loading');
        }
        setError(null);
        failures.current = 0;
        void refresh();
      } else if (lastSuccess && failures.current === 0) scheduleNext(lastSuccess + s.refreshMinutes * 60 * 1000);
    },
    [refresh, lastSuccess],
  );

  // Initial load: reuse cached data if it is still fresh (avoids a request on every page reload).
  useEffect(() => {
    const cached = loadLast(settingsRef.current.siteId);
    const fresh =
      cached &&
      samePlace(cached, settingsRef.current) &&
      Date.now() - cached.fetchedAt < settingsRef.current.refreshMinutes * 60 * 1000;
    if (fresh && cached.latitude !== undefined) {
      setStatus('online');
      scheduleNext(cached.fetchedAt + settingsRef.current.refreshMinutes * 60 * 1000);
    } else void refresh();
  }, [refresh]);

  // Periodic refresh + daily schedule. The interval is created once; schedule steps never
  // call the API directly – they only bring the next update forward, so backoff is respected.
  useEffect(() => {
    let lastData: WeatherData | null = loadLast(settingsRef.current.siteId);
    const tick = async () => {
      const s = settingsRef.current;
      if (nextRef.current !== null && Date.now() >= nextRef.current) {
        const w = await refresh();
        if (w) lastData = w;
      }
      const current = loadLast(s.siteId);
      lastData = current && samePlace(current, s) ? current : lastData && samePlace(lastData, s) ? lastData : null;

      const today = localDate(Math.floor(Date.now() / 1000), s.timezone);
      const clock = siteClock(s.timezone);
      let st = loadSched();
      if (st.date !== today) st = { date: today };
      const ageMin = lastData ? (Date.now() - lastData.fetchedAt) / 60000 : Infinity;
      const pull = () => {
        // bring the next update forward unless we are backing off after failures
        if (failures.current === 0 && ageMin > 5) scheduleNext(Date.now());
      };

      if (!st.fetch && clock >= s.schedule.fetchTime) {
        st.fetch = true;
        saveSched(st);
        pull();
      }
      if (!st.prepare && clock >= s.schedule.prepareTime) {
        st.prepare = true;
        saveSched(st);
        pull();
      }
      if (!st.report && clock >= s.schedule.reportTime) {
        if (lastData && ageMin <= 60) {
          st.report = true;
          saveSched(st);
          if (!hasReportForDate(today, s)) {
            createReport(lastData, s, 'scheduled');
            setReports(loadReports());
          }
        } else pull(); // wait for fresh data; created on a later tick
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 30 * 1000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const alerts = useMemo(() => (data ? evaluateAlerts(data, settings) : []), [data, settings]);
  const overall = useMemo(() => overallLevel(alerts), [alerts]);
  const siteLog = useMemo(() => log.filter((r) => (r.siteId ?? 'ahmer-west') === settings.siteId), [log, settings.siteId]);

  const value: Ctx = {
    settings,
    setSettings,
    data,
    status,
    error,
    lastSuccess,
    nextUpdate,
    refreshing,
    switching,
    refresh,
    log: siteLog,
    alerts,
    overall,
    reports,
    setReports,
  };
  return <WeatherCtx.Provider value={value}>{children}</WeatherCtx.Provider>;
}

export function useWeather() {
  const c = useContext(WeatherCtx);
  if (!c) throw new Error('useWeather outside provider');
  return c;
}
