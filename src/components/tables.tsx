import type { DayPoint, HourPoint } from '../lib/openMeteo';
import { fmtDay, fmtTime, isDayAt, localDate } from '../lib/openMeteo';
import { levelFor } from '../lib/alerts';
import type { Settings } from '../lib/settings';
import { compass16, fVis, wmoText } from '../lib/wmo';
import { WeatherIcon } from './WeatherIcon';

const lvlCls = (l: number) => (l ? `cell-lvl-${l}` : '');

export function HourlyTable({ hours, settings, days = [] }: { hours: HourPoint[]; settings: Settings; days?: DayPoint[] }) {
  const tz = settings.timezone;
  const T = settings.thresholds;
  let lastDate = '';
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Time</th>
            <th className="l">Condition</th>
            <th>Temp °C</th>
            <th>Feels °C</th>
            <th>Wind km/h</th>
            <th>Gust km/h</th>
            <th>Direction</th>
            <th>RH %</th>
            <th>Rain prob %</th>
            <th>Precip mm</th>
            <th>Visibility</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((h) => {
            const d = localDate(h.time, tz);
            const newDay = d !== lastDate;
            lastDate = d;
            return (
              <tr key={h.time} className={newDay ? 'day-start' : ''}>
                <td className="mono">
                  {newDay && <span className="day-tag">{fmtDay(h.time, tz)}</span>}
                  {fmtTime(h.time, tz)}
                </td>
                <td className="l">
                  <span className="cond-cell">
                    <WeatherIcon code={h.weatherCode} isDay={isDayAt(days, h.time, tz)} size={26} />
                    {wmoText(h.weatherCode)}
                  </span>
                </td>
                <td className={lvlCls(levelFor(h.temperature, T.heat))}>{h.temperature.toFixed(1)}</td>
                <td>{h.apparentTemperature.toFixed(0)}</td>
                <td className={lvlCls(levelFor(h.windSpeed, T.windSpeed))}>{h.windSpeed.toFixed(0)}</td>
                <td className={lvlCls(levelFor(h.windGust, T.windGust))}>{h.windGust.toFixed(0)}</td>
                <td>
                  <span className="dir-arrow" style={{ transform: `rotate(${h.windDirection + 180}deg)` }}>
                    ↑
                  </span>{' '}
                  {compass16(h.windDirection)} {h.windDirection.toFixed(0)}°
                </td>
                <td>{h.humidity.toFixed(0)}</td>
                <td>{h.precipProbability ?? '—'}</td>
                <td className={lvlCls(levelFor(h.precipitation, T.rain))}>{h.precipitation.toFixed(1)}</td>
                <td className={lvlCls(levelFor(h.visibility, T.visibility))}>{fVis(h.visibility)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DailyTable({ days, settings, past = false }: { days: DayPoint[]; settings: Settings; past?: boolean }) {
  const tz = settings.timezone;
  const T = settings.thresholds;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th className="l">Day</th>
            <th className="l">Condition</th>
            <th>Max °C</th>
            <th>Min °C</th>
            <th>Wind max km/h</th>
            <th>Gust max km/h</th>
            <th>Dominant dir.</th>
            {!past && <th>Rain prob %</th>}
            <th>{past ? 'Rainfall mm' : 'Expected rain mm'}</th>
            <th>Mean RH %</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.time}>
              <td className="l" style={{ fontWeight: 700 }}>{fmtDay(d.time, tz)}</td>
              <td className="l">
                <span className="cond-cell">
                  <WeatherIcon code={d.weatherCode} size={26} />
                  {wmoText(d.weatherCode)}
                </span>
              </td>
              <td className={lvlCls(levelFor(d.tMax, T.heat))}>{d.tMax.toFixed(0)}</td>
              <td>{d.tMin.toFixed(0)}</td>
              <td className={lvlCls(levelFor(d.windMax, T.windSpeed))}>{d.windMax.toFixed(0)}</td>
              <td className={lvlCls(levelFor(d.gustMax, T.windGust))}>{d.gustMax.toFixed(0)}</td>
              <td>
                {compass16(d.windDirDominant)} {d.windDirDominant.toFixed(0)}°
              </td>
              {!past && <td>{d.precipProbMax ?? '—'}</td>}
              <td>{d.precipSum.toFixed(1)}</td>
              <td>{d.humidityMean === null ? '—' : d.humidityMean.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
