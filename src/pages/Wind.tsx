import { useWeather } from '../WeatherContext';
import { Compass, WindGauge } from '../components/gauges';
import { COLORS, TrendChart } from '../components/charts';
import { Panel, SourceTag, Stat } from '../components/ui';
import { HourlyTable } from '../components/tables';
import { fmtDateTime, nowSec, pastHours, todayIndex } from '../lib/openMeteo';
import { compass16 } from '../lib/wmo';
import { Activity, Compass as CompassIco, Gauge, Table2, Wind as WindIco, PieChart } from 'lucide-react';

const SECTORS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export default function Wind() {
  const { data, settings } = useWeather();
  if (!data) return null;
  const tz = settings.timezone;
  const c = data.current;
  const now = nowSec();
  const win = data.hourly.filter((h) => h.time > now - 24 * 3600 && h.time <= now + 48 * 3600);
  const nowIdx = win.findIndex((h) => h.time > now) - 1;
  const week = pastHours(data, 7 * 24);
  const freq = SECTORS.map((s) => week.filter((h) => compass16(h.windDirection) === s).length);
  const meanSpeed = SECTORS.map((s) => {
    const hs = week.filter((h) => compass16(h.windDirection) === s);
    return hs.length ? hs.reduce((a, b) => a + b.windSpeed, 0) / hs.length : 0;
  });
  const today = data.daily[todayIndex(data)];
  const T = settings.thresholds;

  return (
    <div className="grid">
      <Panel title="Live wind speed" icon={WindIco} right={<SourceTag />} className="span-4">
        <WindGauge speed={c.windSpeed} gust={c.windGust} threshold={T.windSpeed} />
      </Panel>
      <Panel title="Wind direction" icon={CompassIco} right={<SourceTag />} className="span-4">
        <Compass deg={c.windDirection} speed={c.windSpeed} />
      </Panel>
      <Panel title="Wind summary" icon={Gauge} className="span-4">
        <div className="stat-grid two">
          <Stat label="Sustained" value={c.windSpeed.toFixed(0)} unit="km/h" />
          <Stat label="Gust" value={c.windGust.toFixed(0)} unit="km/h" />
          <Stat label="Today max wind" value={today?.windMax.toFixed(0) ?? '—'} unit="km/h" />
          <Stat label="Today max gust" value={today?.gustMax.toFixed(0) ?? '—'} unit="km/h" />
          <Stat label="Speed thresholds" value={`${T.windSpeed.yellow}/${T.windSpeed.orange}/${T.windSpeed.red}`} unit="km/h" sub="Y / O / R (placeholder until approved)" />
          <Stat label="Gust thresholds" value={`${T.windGust.yellow}/${T.windGust.orange}/${T.windGust.red}`} unit="km/h" sub="Y / O / R" />
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          For lifting operations, always apply the crane / lifting equipment manufacturer's wind limits and the approved lift plan; model wind is at 10 m height and does not
          replace an anemometer at the lift.
        </p>
      </Panel>
      <Panel title="Wind speed & gust" subtitle="Past 24 h and next 48 h · dashed red = RED threshold" icon={Activity} right={<SourceTag kind="forecast" />} className="span-8">
        <TrendChart
          labels={win.map((h) => fmtDateTime(h.time, tz))}
          yLabel="km/h"
          yMin={0}
          markIndex={nowIdx}
          series={[
            { label: 'Wind speed', data: win.map((h) => h.windSpeed), color: COLORS.wind, fill: true },
            { label: 'Wind gust', data: win.map((h) => h.windGust), color: COLORS.gust },
            { label: 'RED (speed)', data: win.map(() => (T.windSpeed.enabled ? T.windSpeed.red : null)), color: '#d22828', dashed: true },
          ]}
        />
      </Panel>
      <Panel title="Direction distribution" subtitle="Last 7 days" icon={PieChart} right={<SourceTag kind="hindcast" />} className="span-4">
        <TrendChart
          labels={SECTORS}
          yLabel="hours"
          y1Label="km/h"
          series={[
            { label: 'Hours from sector', data: freq, color: COLORS.wind, type: 'bar' },
            { label: 'Mean speed km/h', data: meanSpeed, color: COLORS.gust, axis: 'y1' },
          ]}
        />
      </Panel>
      <Panel title="Hourly wind forecast" subtitle="Next 24 hours" icon={Table2} right={<SourceTag kind="forecast" />} className="span-12">
        <HourlyTable hours={win.slice(Math.max(0, nowIdx), Math.max(0, nowIdx) + 24)} settings={settings} days={data.daily} />
      </Panel>
    </div>
  );
}
