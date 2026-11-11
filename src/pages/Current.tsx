import { useWeather } from '../WeatherContext';
import { Panel, SourceTag, Stat } from '../components/ui';
import { WeatherIcon } from '../components/WeatherIcon';
import { Cloud, CloudRain, Compass, Droplets, Eye, Gauge, History, Sunrise, Thermometer, ThermometerSun, TrendingDown, TrendingUp, Wind, Wind as Gust, Factory } from 'lucide-react';
import { fmtDateTime, fmtTime, todayIndex } from '../lib/openMeteo';
import { compass16, f1, fmtWind, fVis, windCondition, wmoText } from '../lib/wmo';

export function CurrentGrid() {
  const { data, settings } = useWeather();
  if (!data) return null;
  const c = data.current;
  const today = data.daily[todayIndex(data)];
  return (
    <div className="stat-grid">
      <Stat icon={Thermometer} tone="red" label="Temperature" value={f1(c.temperature)} unit="°C" />
      <Stat icon={ThermometerSun} tone="orange" label="Feels like" value={f1(c.apparentTemperature)} unit="°C" />
      <Stat icon={TrendingUp} tone="red" label="Max temp (today)" value={f1(today?.tMax)} unit="°C" />
      <Stat icon={TrendingDown} tone="cyan" label="Min temp (today)" value={f1(today?.tMin)} unit="°C" />
      <Stat icon={Droplets} tone="cyan" label="Relative humidity" value={c.humidity.toFixed(0)} unit="%" />
      <Stat icon={Gauge} tone="violet" label="Pressure (MSL)" value={c.pressure.toFixed(0)} unit="hPa" />
      <Stat icon={Wind} tone="blue" label="Wind speed" value={fmtWind(c.windSpeed)} unit="m/s" sub={windCondition(c.windSpeed)} />
      <Stat icon={Gust} tone="amber" label="Wind gust" value={fmtWind(c.windGust)} unit="m/s" sub={today ? `Today max ${fmtWind(today.gustMax)} m/s` : undefined} />
      <Stat icon={Compass} tone="green" label="Wind direction" value={compass16(c.windDirection)} sub={`${c.windDirection.toFixed(0)}° (from)`} />
      <Stat icon={Eye} tone="slate" label="Visibility" value={fVis(c.visibility)} />
      <Stat icon={Cloud} tone="slate" label="Cloud cover" value={c.cloudCover.toFixed(0)} unit="%" />
      <Stat icon={CloudRain} tone="blue" label="Precipitation" value={f1(c.precipitation)} unit="mm" sub={today ? `Today ${today.precipSum.toFixed(1)} mm expected` : undefined} />
      <Stat icon={Factory} tone="amber" label="Surface dust" value={c.dust === null ? 'n/a' : c.dust.toFixed(0)} unit={c.dust === null ? '' : 'µg/m³'} sub="CAMS model" />
      <Stat icon={Sunrise} tone="orange" label="Sunrise / sunset" value={today ? `${fmtTime(today.sunrise, settings.timezone)} / ${fmtTime(today.sunset, settings.timezone)}` : '—'} />
    </div>
  );
}

export default function Current() {
  const { data, settings, log } = useWeather();
  if (!data) return null;
  const c = data.current;
  const tz = settings.timezone;
  const recent = log.slice(-12).reverse();
  return (
    <div className="grid">
      <Panel title="Current weather conditions" subtitle={`Valid ${fmtDateTime(c.time, tz)} (site time)`} icon={Thermometer} right={<SourceTag />} className="span-12">
        <div className="cond-hero">
          <WeatherIcon code={c.weatherCode} isDay={c.isDay} size={92} />
          <div>
            <div className="big-t">{c.temperature.toFixed(1)}°C</div>
            <div className="c-name">{wmoText(c.weatherCode)}</div>
            <div className="muted small">
              Grid point {data.latitude.toFixed(4)}, {data.longitude.toFixed(4)} · model elevation {data.elevation.toFixed(0)} m · {c.isDay ? 'Daytime' : 'Night-time'}
            </div>
          </div>
        </div>
        <CurrentGrid />
      </Panel>
      <Panel title="Recent readings captured by this dashboard" subtitle="One snapshot per refresh" icon={History} right={<SourceTag kind="local" />} className="span-12">
        {recent.length === 0 ? (
          <p className="dim">No readings logged yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Captured</th>
                  <th>Model time</th>
                  <th>Temp °C</th>
                  <th>RH %</th>
                  <th>Wind m/s</th>
                  <th>Gust m/s</th>
                  <th>Dir</th>
                  <th>Pressure hPa</th>
                  <th>Visibility</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.t}>
                    <td className="mono">{fmtDateTime(Math.floor(r.t / 1000), tz)}</td>
                    <td className="mono">{fmtTime(r.modelTime, tz)}</td>
                    <td>{r.temperature.toFixed(1)}</td>
                    <td>{r.humidity.toFixed(0)}</td>
                    <td>{fmtWind(r.windSpeed)}</td>
                    <td>{fmtWind(r.windGust)}</td>
                    <td>{compass16(r.windDirection)}</td>
                    <td>{r.pressure.toFixed(0)}</td>
                    <td>{fVis(r.visibility)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
