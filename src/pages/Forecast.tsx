import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useWeather } from '../WeatherContext';
import { Panel, Seg, SourceTag } from '../components/ui';
import { CalendarDays, Clock3, LineChart, Table2 } from 'lucide-react';
import { DailyTable, HourlyTable } from '../components/tables';
import { COLORS, TrendChart } from '../components/charts';
import { fmtDateTime, fmtDay, forecastDays, nextHours } from '../lib/openMeteo';
import { WeatherIcon } from '../components/WeatherIcon';
import { wmoText } from '../lib/wmo';

function ForecastSwitch() {
  return (
    <nav className="forecast-switch" aria-label="Forecast range">
      <NavLink to="/hourly">Hourly</NavLink>
      <NavLink to="/daily">7-day</NavLink>
    </nav>
  );
}

export function Hourly() {
  const { data, settings } = useWeather();
  const [span, setSpan] = useState(24);
  if (!data) return null;
  const hours = nextHours(data, span);
  const tz = settings.timezone;
  return (
    <div className="grid">
      <div className="span-12">
        <ForecastSwitch />
      </div>
      <Panel
        title={`Hourly forecast – next ${span} hours`}
        icon={LineChart}
        subtitle="Temperature, wind, gust and rain probability"
        right={<Seg value={span} onChange={setSpan} options={[24, 48, 72].map((n) => ({ value: n, label: `${n} h` }))} />}
        className="span-12"
      >
        <TrendChart
          labels={hours.map((h) => fmtDateTime(h.time, tz))}
          yLabel="°C / km/h"
          y1Label="%"
          y1Max={100}
          series={[
            { label: 'Temperature °C', data: hours.map((h) => h.temperature), color: COLORS.temp },
            { label: 'Wind km/h', data: hours.map((h) => h.windSpeed), color: COLORS.wind },
            { label: 'Gust km/h', data: hours.map((h) => h.windGust), color: COLORS.gust, dashed: true },
            { label: 'Rain probability %', data: hours.map((h) => h.precipProbability), color: COLORS.rainProb, type: 'bar', axis: 'y1' },
          ]}
        />
      </Panel>
      <Panel title="Hourly forecast table" icon={Clock3} right={<SourceTag kind="forecast" />} className="span-12">
        <p className="muted small" style={{ marginTop: 0 }}>Highlighted cells exceed the configured YELLOW / ORANGE / RED thresholds.</p>
        <HourlyTable hours={hours} settings={settings} days={data.daily} />
      </Panel>
    </div>
  );
}

export function Daily() {
  const { data, settings } = useWeather();
  if (!data) return null;
  const days = forecastDays(data, 7);
  const tz = settings.timezone;
  return (
    <div className="grid">
      <div className="span-12">
        <ForecastSwitch />
      </div>
      <div className="span-12 day-cards">
        {days.map((d, i) => (
          <div key={d.time} className={`day-card ${i === 0 ? 'today' : ''}`}>
            <span className="dc-day">{i === 0 ? 'Today' : fmtDay(d.time, tz)}</span>
            <WeatherIcon code={d.weatherCode} size={64} />
            <span className="dc-cond">{wmoText(d.weatherCode)}</span>
            <span className="dc-t">
              <b>{d.tMax.toFixed(0)}°</b> <span>{d.tMin.toFixed(0)}°</span>
            </span>
            <span className="dc-meta">Gust {d.gustMax.toFixed(0)} km/h</span>
            <span className="dc-meta">
              {d.precipProbMax ?? 0}% · {d.precipSum.toFixed(1)} mm
            </span>
          </div>
        ))}
      </div>
      <Panel title="7-day forecast" subtitle="Temperature, wind gust and rainfall" icon={CalendarDays} right={<SourceTag kind="forecast" />} className="span-12">
        <TrendChart
          labels={days.map((d) => fmtDay(d.time, tz))}
          yLabel="°C / km/h"
          y1Label="mm"
          series={[
            { label: 'Max °C', data: days.map((d) => d.tMax), color: COLORS.temp },
            { label: 'Min °C', data: days.map((d) => d.tMin), color: COLORS.feels },
            { label: 'Max gust km/h', data: days.map((d) => d.gustMax), color: COLORS.gust, dashed: true },
            { label: 'Rain mm', data: days.map((d) => d.precipSum), color: COLORS.rain, type: 'bar', axis: 'y1' },
          ]}
        />
      </Panel>
      <Panel title="7-day forecast table" icon={Table2} right={<SourceTag kind="forecast" />} className="span-12">
        <DailyTable days={days} settings={settings} />
      </Panel>
    </div>
  );
}
