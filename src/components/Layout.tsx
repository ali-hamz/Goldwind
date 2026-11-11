import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  FileText,
  History,
  LayoutDashboard,
  Menu,
  Moon,
  Radar,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sun,
  Thermometer,
  Wind,
  X,
  MapPin,
} from 'lucide-react';
import { useWeather } from '../WeatherContext';
import { SITES, withSite } from '../lib/settings';
import { LevelBadge, Logo } from './ui';
import { setTheme, useTheme } from '../lib/theme';

export const NAV = [
  { to: '/', label: 'Main Dashboard', icon: LayoutDashboard, desc: 'Live overview of site weather, alerts and outlook' },
  { to: '/current', label: 'Current Weather', icon: Thermometer, desc: 'Latest model estimate for the site grid point' },
  { to: '/hourly', label: 'Hourly Forecast', icon: Clock3, desc: 'Hour-by-hour forecast for the next 24–72 hours' },
  { to: '/daily', label: '7-Day Forecast', icon: CalendarDays, desc: 'Daily outlook for the coming week' },
  { to: '/wind', label: 'Wind Monitoring', icon: Wind, desc: 'Wind speed, gusts and direction for lifting & work at height' },
  { to: '/alerts', label: 'Weather Alerts', icon: AlertTriangle, desc: 'Automatic GREEN / YELLOW / ORANGE / RED warning indicators' },
  { to: '/history', label: 'Weather History', icon: History, desc: 'Previous 24 hours and 7 days' },
  { to: '/radar', label: 'Weather Radar', icon: Radar, desc: 'Precipitation radar for the selected site' },
  { to: '/hse', label: 'HSE Weather Advisory', icon: ShieldCheck, desc: 'Weather-related risks and recommended precautions' },
  { to: '/reports', label: 'Daily PDF Reports', icon: FileText, desc: 'Daily weather forecast & monitoring report with review workflow' },
  { to: '/settings', label: 'System Settings', icon: Settings, desc: 'Location, schedule and alert thresholds' },
];

const fmtClock = (ms: number | null, tz: string) =>
  ms ? new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(ms) : '—';

function liveClock(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).formatToParts(ms);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { hm: `${get('hour')}:${get('minute')}`, sec: get('second'), ampm: get('dayPeriod').toUpperCase() };
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function Layout() {
  const { settings, setSettings, status, error, lastSuccess, nextUpdate, refresh, refreshing, switching, data, overall } = useWeather();
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const loc = useLocation();
  const now = useNow();
  useEffect(() => setOpen(false), [loc.pathname]);
  const tz = settings.timezone;
  const mins = nextUpdate ? Math.max(0, Math.round((nextUpdate - now) / 60000)) : null;
  const page = NAV.find((n) => (n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to))) ?? NAV[0];
  const statusLabel = { loading: 'Connecting', online: 'Live', stale: 'API unreachable · showing last data', offline: 'Offline' }[status];
  const dateStr = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const clock = liveClock(now, tz);

  return (
    <div className={`app ${open ? 'nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="side-brand">
          <Logo />
          <div className="side-title">
            Weather Monitoring
            <br />& Forecast System
          </div>
          <button className="icon-btn side-close" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>
        <nav>
          <div className="nav-group">Monitoring</div>
          {NAV.slice(0, 8).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <n.icon size={18} strokeWidth={2} />
              <span>{n.label}</span>
              {n.to === '/alerts' && data && overall > 0 && <span className={`nav-dot lvl-dot-${overall}`} />}
            </NavLink>
          ))}
          <div className="nav-group">HSE & Reporting</div>
          {NAV.slice(8).map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <n.icon size={18} strokeWidth={2} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-site">
          <div className="side-site-ico">
            <MapPin size={16} />
          </div>
          <div className="side-site-copy">
            <div className="side-site-name">{settings.shortName}</div>
            <div className="side-site-sub">{settings.locationLabel}</div>
          </div>
        </div>
        <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Light mode' : 'Control-room mode'}
        </button>
        <div className="side-credit">developed by Ahmad Madni</div>
      </aside>
      <div className="backdrop" onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <div className="title-block">
            <div className="eyebrow">{dateStr}</div>
            <h1>{page.label}</h1>
            <div className="subtitle">{page.desc}</div>
          </div>
          <div className="top-right">
            <div className="site-switch" role="group" aria-label="Location">
              {SITES.map((site) => (
                <button key={site.id} type="button" className={settings.siteId === site.id ? 'on' : ''} onClick={() => setSettings(withSite(settings, site.id))} aria-pressed={settings.siteId === site.id}>
                  {switching && settings.siteId === site.id && <span className="switch-spin" />}
                  {site.label}
                </button>
              ))}
            </div>
            {data && (
              <div className="top-pill">
                <span className="tp-label">Site alert</span>
                <LevelBadge level={overall} />
              </div>
            )}
            <div className="top-pill clock-pill">
              <span className="clock-time mono">
                {clock.hm}
                <span className="clock-sec">:{clock.sec}</span>
              </span>
              <span className="clock-ampm">{clock.ampm}</span>
              <span className="tp-label">Riyadh</span>
            </div>
          </div>
        </header>

        <div className={`status-bar st-${status}`}>
          <span className="status-live">
            <span className="dot" />
            {statusLabel}
          </span>
          <span>
            Updated <b>{fmtClock(lastSuccess, tz)}</b>
          </span>
          <span>
            Next <b>{fmtClock(nextUpdate, tz)}</b>
            {mins !== null && <span className="muted"> · in {mins} min</span>}
          </span>
          <button className="icon-btn status-refresh" onClick={() => void refresh()} disabled={refreshing} aria-label="Refresh now" title="Refresh now">
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
          </button>
          {error && status !== 'online' && <span className="err">{error}</span>}
        </div>

        <main className="content">
          {data || loc.pathname === '/settings' ? (
            <div key={loc.pathname} className="page-enter">
              <div key={data ? data.latitude.toFixed(4) : 'settings'} className={`site-fade ${switching ? 'is-switching' : ''}`}>
                <Outlet />
              </div>
            </div>
          ) : status === 'offline' ? (
            <div className="empty-state">
              <div className="es-ico">
                <AlertTriangle size={28} />
              </div>
              <h3>Weather data could not be loaded</h3>
              <p>{error}</p>
              <p className="muted small">The app retries automatically with increasing intervals.</p>
              <button className="btn btn-primary" onClick={() => void refresh()}>
                <RefreshCw size={15} /> Retry now
              </button>
            </div>
          ) : (
            <div className="skeleton-grid">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className={`skeleton s${i}`} />
              ))}
            </div>
          )}
        </main>
        <footer className="footer">
          <span>
            {settings.companyName} · HSE Department · Project: {settings.shortName}
          </span>
          <span>
            Weather data by{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo.com
            </a>{' '}
            (CC BY 4.0) · Air quality: CAMS / Copernicus
          </span>
        </footer>
      </div>
    </div>
  );
}
