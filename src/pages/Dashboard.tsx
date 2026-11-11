import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, CloudRain, Cloudy, Compass as CompassIco, Droplets, Eye, FileText, Gauge, ShieldCheck, Activity, Wind as WindIco, MapPin, TriangleAlert } from 'lucide-react';
import { useWeather } from '../WeatherContext';
import { Compass, WindGauge } from '../components/gauges';
import { COLORS, TrendChart } from '../components/charts';
import { LevelBadge, Panel, Seg, SourceTag } from '../components/ui';
import { WeatherIcon } from '../components/WeatherIcon';
import { fmtDay, fmtTime, forecastDays, isDayAt, localDate, nextHours, nowSec, pastHours, todayIndex, type HourPoint, type WeatherData } from '../lib/openMeteo';
import { compass16, f1, fVis, wmoText } from '../lib/wmo';
import { buildAdvisories } from '../lib/hse';
import { forecastSummary } from '../lib/reports';
import { LEVEL_NAME, LEVEL_TEXT } from '../lib/alerts';

function heroTone(w: WeatherData, dustLevel: number) {
  const c = w.current;
  if (dustLevel >= 2) return 'hero-dust';
  if (c.weatherCode >= 51) return 'hero-rain';
  if (!c.isDay) return 'hero-night';
  if (c.weatherCode === 3 || c.weatherCode === 45 || c.weatherCode === 48) return 'hero-cloud';
  return 'hero-day';
}

/** Representative hours for the "today at a glance" panel (site-local). */
function glance(w: WeatherData) {
  const today = localDate(nowSec(), w.timezone);
  const hourOf = (h: HourPoint) => Number(fmtTime(h.time, w.timezone).slice(0, 2));
  const todays = w.hourly.filter((h) => localDate(h.time, w.timezone) === today);
  return [
    { label: 'Morning', at: 8 },
    { label: 'Afternoon', at: 14 },
    { label: 'Evening', at: 19 },
    { label: 'Night', at: 23 },
  ].map((p) => ({ ...p, h: todays.find((h) => hourOf(h) === p.at) ?? null }));
}

export default function Dashboard() {
  const { data, settings, alerts, overall, reports } = useWeather();
  const [metric, setMetric] = useState<'wind' | 'temp' | 'humidity'>('wind');
  if (!data) return null;
  const tz = settings.timezone;
  const c = data.current;
  const today = data.daily[todayIndex(data)];
  const past = pastHours(data, 24);
  const labels = past.map((h) => fmtTime(h.time, tz));
  const next = nextHours(data, 9).slice(0, 9);
  const days = forecastDays(data, 7);
  const adv = buildAdvisories(alerts);
  const dust = alerts.find((a) => a.category === 'dust');
  const tone = heroTone(data, dust?.available ? dust.level : 0);
  const weekMin = Math.min(...days.map((d) => d.tMin));
  const weekMax = Math.max(...days.map((d) => d.tMax));
  const todayReport = reports.find((r) => r.date === localDate(nowSec(), tz));

  return (
    <div className="grid dash">
      {/* ---------- HERO ---------- */}
      <section className={`hero span-8 ${tone}`}>
        <div className="hero-bg" aria-hidden />
        <div className="hero-top">
          <span className="glass-pill">
            <MapPin size={14} /> {settings.siteName}, {settings.locationLabel}
          </span>
          <span className="glass-pill subtle">Model estimate · valid {fmtTime(c.time, tz)}</span>
        </div>
        <div className="hero-main">
          <div>
            <div className="hero-cond">{wmoText(c.weatherCode)}</div>
            <div className="hero-temp">
              {c.windSpeed.toFixed(0)}
              <span>km/h</span>
            </div>
            <div className="hero-meta">
              Gust <b>{c.windGust.toFixed(0)} km/h</b>
              <span className="sep" />
              {compass16(c.windDirection)}
              <span className="sep" />
              <b>{c.temperature.toFixed(0)}°C</b>
            </div>
          </div>
          <WeatherIcon code={c.weatherCode} isDay={c.isDay} size={190} className="hero-icon" />
        </div>
        <div className="hero-chips">
          <div className="glass-chip">
            <Droplets size={15} />
            <span>Humidity</span>
            <b>{c.humidity.toFixed(0)}%</b>
          </div>
          <div className="glass-chip">
            <Eye size={15} />
            <span>Visibility</span>
            <b>{fVis(c.visibility)}</b>
          </div>
          <div className="glass-chip">
            <Gauge size={15} />
            <span>Pressure</span>
            <b>{c.pressure.toFixed(0)} hPa</b>
          </div>
          <div className="glass-chip">
            <Cloudy size={15} />
            <span>Cloud</span>
            <b>{c.cloudCover.toFixed(0)}%</b>
          </div>
          <div className="glass-chip">
            <CloudRain size={15} />
            <span>Precip.</span>
            <b>{f1(c.precipitation)} mm</b>
          </div>
        </div>
        <div className="hero-hours">
          {next.map((h, i) => (
            <div key={h.time} className={`hh ${i === 0 ? 'now' : ''}`}>
              <span className="hh-t">{i === 0 ? 'Now' : fmtTime(h.time, tz)}</span>
              <WeatherIcon code={h.weatherCode} isDay={i === 0 ? c.isDay : isDayAt(data.daily, h.time, tz)} size={34} />
              <b>{h.temperature.toFixed(0)}°</b>
              <span className="hh-w">
                {h.windSpeed.toFixed(0)} <small>km/h</small>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- ALERT OVERVIEW ---------- */}
      <Panel title="Weather alerts" subtitle="Now and next 24 hours" icon={TriangleAlert} right={<Link to="/alerts" className="link-arrow">Details <ArrowRight size={14} /></Link>} className="span-4">
        <div className={`alert-hero lvl-soft-${overall}`}>
          <div className={`ah-ring lvl-ring-${overall}`}>
            <TriangleAlert size={22} />
          </div>
          <div>
            <div className="ah-label">Overall site level</div>
            <div className="ah-level">{LEVEL_NAME[overall]}</div>
            <div className="ah-text">{LEVEL_TEXT[overall]}</div>
          </div>
        </div>
        <div className="alert-list">
          {alerts.map((a) => (
            <div key={a.category} className="alert-row">
              <span className={`ar-dot lvl-dot-${a.available ? a.level : 'na'}`} />
              <span className="ar-name">{a.label}</span>
              <LevelBadge level={a.level} na={!a.available} />
            </div>
          ))}
        </div>
      </Panel>

      {/* ---------- WIND ---------- */}
      <Panel title="Live wind speed" subtitle="Sustained at 10 m · gust marker in amber" icon={WindIco} right={<SourceTag />} className="span-4">
        <WindGauge speed={c.windSpeed} gust={c.windGust} threshold={settings.thresholds.windSpeed} />
      </Panel>
      <Panel title="Wind direction" subtitle="Direction the wind blows from" icon={CompassIco} right={<SourceTag />} className="span-4">
        <Compass deg={c.windDirection} speed={c.windSpeed} />
      </Panel>
      <Panel title="Today at a glance" subtitle={today ? fmtDay(today.time, tz) : ''} icon={Activity} className="span-4">
        <div className="glance">
          {glance(data).map((g) => (
            <div key={g.label} className="glance-col">
              <span className="g-label">{g.label}</span>
              {g.h ? (
                <>
                  <WeatherIcon code={g.h.weatherCode} isDay={isDayAt(data.daily, g.h.time, tz)} size={44} />
                  <b className="g-temp">{g.h.temperature.toFixed(0)}°</b>
                  <span className="g-sub">
                    {g.h.windSpeed.toFixed(0)} km/h {compass16(g.h.windDirection)}
                  </span>
                  <span className="g-sub">{g.h.precipProbability ?? 0}% rain</span>
                </>
              ) : (
                <span className="g-sub">—</span>
              )}
            </div>
          ))}
        </div>
        <div className="glance-foot">
          <div>
            <span>Max gust</span>
            <b>{f1(today?.gustMax, 0)} km/h</b>
          </div>
          <div>
            <span>Rain chance</span>
            <b>{today?.precipProbMax ?? 0}%</b>
          </div>
          <div>
            <span>Expected</span>
            <b>{f1(today?.precipSum)} mm</b>
          </div>
        </div>
      </Panel>

      {/* ---------- EVOLUTION ---------- */}
      <Panel
        title="Real-time weather evolution"
        subtitle="Last 24 hours · timestamps in site time"
        icon={Activity}
        right={
          <Seg
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'wind', label: 'Wind & gust' },
              { value: 'temp', label: 'Temperature' },
              { value: 'humidity', label: 'Humidity' },
            ]}
          />
        }
        className="span-8"
      >
        {metric === 'wind' && (
          <TrendChart
            labels={labels}
            yLabel="km/h"
            yMin={0}
            height={280}
            series={[
              { label: 'Wind speed', data: past.map((h) => h.windSpeed), color: COLORS.wind, fill: true },
              { label: 'Wind gust', data: past.map((h) => h.windGust), color: COLORS.gust },
            ]}
          />
        )}
        {metric === 'temp' && (
          <TrendChart
            labels={labels}
            yLabel="°C"
            height={280}
            series={[
              { label: 'Temperature', data: past.map((h) => h.temperature), color: COLORS.temp, fill: true },
              { label: 'Feels like', data: past.map((h) => h.apparentTemperature), color: COLORS.feels, dashed: true },
            ]}
          />
        )}
        {metric === 'humidity' && (
          <TrendChart
            labels={labels}
            yLabel="%"
            yMin={0}
            height={280}
            series={[{ label: 'Relative humidity', data: past.map((h) => h.humidity), color: COLORS.humidity, fill: true }]}
          />
        )}
      </Panel>

      {/* ---------- 7 DAY ---------- */}
      <Panel title="7-day forecast" icon={CalendarDays} right={<Link to="/daily" className="link-arrow">More <ArrowRight size={14} /></Link>} className="span-4">
        <div className="week">
          {days.map((d, i) => {
            const span = weekMax - weekMin || 1;
            return (
              <div key={d.time} className="week-row">
                <span className="w-day">{i === 0 ? 'Today' : fmtDay(d.time, tz).split(' ')[0]}</span>
                <WeatherIcon code={d.weatherCode} size={30} />
                <span className="w-rain">{d.precipProbMax ? `${d.precipProbMax}%` : ''}</span>
                <span className="w-min">{d.tMin.toFixed(0)}°</span>
                <span className="w-bar">
                  <i style={{ left: `${((d.tMin - weekMin) / span) * 100}%`, right: `${100 - ((d.tMax - weekMin) / span) * 100}%` }} />
                </span>
                <span className="w-max">{d.tMax.toFixed(0)}°</span>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* ---------- HSE ---------- */}
      <Panel title="HSE weather advisory" subtitle="Automatic risk assessment" icon={ShieldCheck} right={<Link to="/hse" className="link-arrow">Full advisory <ArrowRight size={14} /></Link>} className="span-8">
        <p className="summary">{forecastSummary(data, settings)}</p>
        {adv.length === 0 ? (
          <div className="ok-state">No configured threshold exceeded in the next 24 hours. Maintain routine weather awareness.</div>
        ) : (
          <div className="adv-grid">
            {adv.slice(0, 6).map((a) => (
              <div key={a.category} className={`adv-card lvl-edge-${a.level}`}>
                <div className="adv-head">
                  <b>{a.title}</b>
                  <LevelBadge level={a.level} />
                </div>
                <p>{a.items[0]}</p>
                <span className="muted small">+{a.items.length - 1} more precautions</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ---------- REPORT ---------- */}
      <section className="card report-card span-4">
        <div className="rc-ico">
          <FileText size={22} />
        </div>
        <h3>Daily weather report</h3>
        <p className="muted">
          Scheduled {settings.schedule.reportTime} site time · reviewed by {settings.reviewedBy}
        </p>
        <div className="rc-status">
          {todayReport ? (
            <span className={`status-pill sp-${todayReport.status}`}>
              {todayReport.status === 'approved' ? 'Approved' : todayReport.status === 'rejected' ? 'Rejected' : 'Pending review'}
            </span>
          ) : (
            <span className="status-pill sp-none">Not generated yet</span>
          )}
        </div>
        <Link to="/reports" className="btn btn-primary btn-block">
          Open reports <ArrowRight size={15} />
        </Link>
      </section>
    </div>
  );
}
