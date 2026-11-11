import { Link } from 'react-router-dom';
import { useWeather } from '../WeatherContext';
import { LevelBadge, Panel, SourceTag } from '../components/ui';
import { fmtDateTime } from '../lib/openMeteo';
import { LEVEL_NAME, LEVEL_TEXT, type Level } from '../lib/alerts';
import { Info, ListChecks, Palette, TriangleAlert } from 'lucide-react';

export default function Alerts() {
  const { data, settings, alerts, overall } = useWeather();
  if (!data) return null;
  const tz = settings.timezone;
  return (
    <div className="grid">
      <Panel title="Overall site weather alert level" subtitle="Worst level now and in the next 24 hours" icon={TriangleAlert} right={<SourceTag kind="forecast" />} className="span-12">
        <div className={`overall-banner lvl-bg-${overall}`}>
          <TriangleAlert size={34} />
          <span className="ob-level">{LEVEL_NAME[overall]}</span>
          <span className="ob-text">{LEVEL_TEXT[overall]}</span>
        </div>
        {!settings.thresholdsApprovedRef && (
          <p className="warn-box">
            <Info size={18} style={{ flexShrink: 0 }} />
            <span>
            Thresholds are <b>placeholder defaults</b> and are not approved site or HSE limits. Replace them in{' '}
            <Link to="/settings">System Settings</Link> with values from the applicable site procedures and approved HSE limits.
            </span>
          </p>
        )}
      </Panel>
      <Panel title="Automatic weather warning indicators" icon={ListChecks} className="span-12">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="l">Hazard</th>
                <th>Now</th>
                <th>Next 24 h</th>
                <th className="l">Current value</th>
                <th className="l">Worst in next 24 h</th>
                <th className="l">Basis / thresholds (Y / O / R)</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.category}>
                  <td className="l">
                    <b>{a.label}</b>
                  </td>
                  <td>
                    <LevelBadge level={a.nowLevel} na={!a.available} />
                  </td>
                  <td>
                    <LevelBadge level={a.forecastLevel} na={!a.available} />
                  </td>
                  <td className="l">{a.available ? a.nowValue : 'Not available / disabled'}</td>
                  <td className="l">
                    {a.available ? a.peakValue : '—'}
                    {a.available && a.peakTime && <span className="dim"> @ {fmtDateTime(a.peakTime, tz)}</span>}
                  </td>
                  <td className="l small dim">{a.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Warning level legend" icon={Palette} className="span-6">
        <div className="legend">
          {([0, 1, 2, 3] as Level[]).map((l) => (
            <div key={l}>
              <LevelBadge level={l} /> {LEVEL_TEXT[l]}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Data limitations" icon={Info} className="span-6">
        <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Dust uses the CAMS global surface dust forecast (Open-Meteo Air Quality API); the Open-Meteo weather codes have no dust code.</li>
          <li>Thunderstorm uses model weather codes 95/96/99.</li>
          <li>Lightning risk is indicative only – there is no lightning detection network feed. Confirm with an approved lightning detection service.</li>
          <li>Heat uses air temperature. WBGT is not available from the API and must be measured on site where required.</li>
        </ul>
      </Panel>
    </div>
  );
}
