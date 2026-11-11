import { useState } from 'react';
import { useWeather } from '../WeatherContext';
import { Panel, SourceTag } from '../components/ui';
import { COLORS, TrendChart } from '../components/charts';
import { DailyTable } from '../components/tables';
import { fmtDateTime, fmtTime, pastDays, pastHours } from '../lib/openMeteo';
import { compass16, fVis } from '../lib/wmo';
import { clearLog, loadLog } from '../lib/storage';
import { Seg } from '../components/ui';
import { CalendarRange, CloudRain, Database, Download, Droplets, History as HistoryIco, Thermometer, Trash2, Wind } from 'lucide-react';

function downloadCsv(name: string, rows: (string | number | null)[][]) {
  const csv = rows.map((r) => r.map((v) => (v === null ? '' : `"${String(v).replace(/"/g, '""')}"`)).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function History() {
  const { data, settings, log } = useWeather();
  const [range, setRange] = useState<24 | 168>(24);
  const [, force] = useState(0);
  if (!data) return null;
  const tz = settings.timezone;
  const hrs = pastHours(data, range);
  const labels = hrs.map((h) => (range === 24 ? fmtTime(h.time, tz) : fmtDateTime(h.time, tz)));

  const exportHourly = () =>
    downloadCsv(`egc-weather-history-${range}h.csv`, [
      ['time_local', 'temperature_c', 'humidity_pct', 'wind_kmh', 'gust_kmh', 'direction_deg', 'precip_mm', 'visibility_m', 'pressure_hpa', 'dust_ugm3'],
      ...hrs.map((h) => [fmtDateTime(h.time, tz), h.temperature, h.humidity, h.windSpeed, h.windGust, h.windDirection, h.precipitation, h.visibility, h.pressure, h.dust]),
    ]);
  const exportLog = () =>
    downloadCsv('egc-weather-captured-readings.csv', [
      ['captured_utc', 'model_time_utc', 'temperature_c', 'humidity_pct', 'wind_kmh', 'gust_kmh', 'direction_deg', 'pressure_hpa', 'visibility_m', 'precip_mm', 'dust_ugm3'],
      ...loadLog().map((r) => [new Date(r.t).toISOString(), new Date(r.modelTime * 1000).toISOString(), r.temperature, r.humidity, r.windSpeed, r.windGust, r.windDirection, r.pressure, r.visibility, r.precipitation, r.dust]),
    ]);

  return (
    <div className="grid">
      <Panel
        title="Weather history"
        icon={HistoryIco}
        right={
          <div className="row-gap">
            <Seg
              value={range}
              onChange={setRange}
              options={[
                { value: 24 as const, label: 'Previous 24 h' },
                { value: 168 as const, label: 'Previous 7 days' },
              ]}
            />
            <button className="btn btn-sm" onClick={exportHourly}>
              <Download size={14} /> Export CSV
            </button>
          </div>
        }
        className="span-12"
      >
        <p className="muted small" style={{ margin: 0 }}>
          Hourly history is retrieved from Open-Meteo (model hindcast for past hours) on every refresh, so it is identical on every device and survives page reloads. It is
          not an instrument record.
        </p>
      </Panel>
      <Panel title="Temperature history" icon={Thermometer} right={<SourceTag kind="hindcast" />} className="span-6">
        <TrendChart labels={labels} yLabel="°C" series={[{ label: 'Temperature °C', data: hrs.map((h) => h.temperature), color: COLORS.temp, fill: true }]} />
      </Panel>
      <Panel title="Wind speed & gust history" icon={Wind} right={<SourceTag kind="hindcast" />} className="span-6">
        <TrendChart
          labels={labels}
          yLabel="km/h"
          yMin={0}
          series={[
            { label: 'Wind speed', data: hrs.map((h) => h.windSpeed), color: COLORS.wind },
            { label: 'Wind gust', data: hrs.map((h) => h.windGust), color: COLORS.gust },
          ]}
        />
      </Panel>
      <Panel title="Humidity history" icon={Droplets} right={<SourceTag kind="hindcast" />} className="span-6">
        <TrendChart labels={labels} yLabel="%" yMin={0} series={[{ label: 'Relative humidity %', data: hrs.map((h) => h.humidity), color: COLORS.humidity, fill: true }]} />
      </Panel>
      <Panel title="Rainfall history" icon={CloudRain} right={<SourceTag kind="hindcast" />} className="span-6">
        <TrendChart labels={labels} yLabel="mm" yMin={0} series={[{ label: 'Precipitation mm/h', data: hrs.map((h) => h.precipitation), color: COLORS.rain, type: 'bar' }]} />
      </Panel>
      <Panel title="Daily summary" subtitle="Previous 7 days" icon={CalendarRange} right={<SourceTag kind="hindcast" />} className="span-12">
        <DailyTable days={pastDays(data, 7)} settings={settings} past />
      </Panel>
      <Panel
        title={`Readings captured by this dashboard (${log.length})`}
        icon={Database}
        right={
          <div className="row-gap">
            <SourceTag kind="local" />
            <button className="btn btn-sm" onClick={exportLog} disabled={!log.length}>
              <Download size={14} /> Export CSV
            </button>
            <button
              className="btn btn-sm btn-ghost btn-danger"
              onClick={() => {
                if (confirm('Clear readings stored in this browser?')) {
                  clearLog();
                  force((n) => n + 1);
                  location.reload();
                }
              }}
            >
              <Trash2 size={14} /> Clear
            </button>
          </div>
        }
        className="span-12"
      >
        <p className="muted small" style={{ marginTop: 0 }}>Each 15-minute refresh stores a timestamped snapshot in this browser (kept 30 days).</p>
        <div className="table-wrap scroll-y">
          <table className="data">
            <thead>
              <tr>
                <th>Captured</th>
                <th>Temp °C</th>
                <th>RH %</th>
                <th>Wind km/h</th>
                <th>Gust km/h</th>
                <th>Dir</th>
                <th>Rain mm</th>
                <th>Visibility</th>
                <th>Dust µg/m³</th>
              </tr>
            </thead>
            <tbody>
              {log
                .slice()
                .reverse()
                .map((r) => (
                  <tr key={r.t}>
                    <td className="mono">{fmtDateTime(Math.floor(r.t / 1000), tz)}</td>
                    <td>{r.temperature.toFixed(1)}</td>
                    <td>{r.humidity.toFixed(0)}</td>
                    <td>{r.windSpeed.toFixed(0)}</td>
                    <td>{r.windGust.toFixed(0)}</td>
                    <td>{compass16(r.windDirection)}</td>
                    <td>{r.precipitation.toFixed(1)}</td>
                    <td>{fVis(r.visibility)}</td>
                    <td>{r.dust === null ? '—' : r.dust.toFixed(0)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
