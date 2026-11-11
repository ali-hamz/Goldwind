import { useWeather } from '../WeatherContext';
import { LevelBadge, Panel } from '../components/ui';
import { ADVISORY_DISCLAIMER, buildAdvisories, PRECAUTIONS } from '../lib/hse';
import { forecastSummary } from '../lib/reports';
import { CATEGORY_LABEL, type AlertCategory } from '../lib/alerts';
import { fmtDateTime } from '../lib/openMeteo';
import { BookOpen, ClipboardCheck, Info, ShieldCheck } from 'lucide-react';

export default function Hse() {
  const { data, settings, alerts } = useWeather();
  if (!data) return null;
  const adv = buildAdvisories(alerts);
  const tz = settings.timezone;
  return (
    <div className="grid">
      <Panel title="HSE weather risk assessment" subtitle="Generated automatically from current alerts" icon={ShieldCheck} className="span-12">
        <p className="summary">{forecastSummary(data, settings)}</p>
        <p className="warn-box">
          <Info size={18} style={{ flexShrink: 0 }} />
          <span>{ADVISORY_DISCLAIMER}</span>
        </p>
      </Panel>

      {adv.length === 0 ? (
        <Panel title="Active advisories" icon={ClipboardCheck} className="span-12">
          <p className="ok-state" style={{ margin: 0 }}>No configured weather threshold is exceeded now or in the next 24 hours. Maintain routine weather awareness and standard controls.</p>
        </Panel>
      ) : (
        adv.map((a) => {
          const al = alerts.find((x) => x.category === a.category)!;
          return (
            <Panel key={a.category} title={a.title} icon={ClipboardCheck} right={<LevelBadge level={a.level} text />} className={`span-6 lvl-border-${a.level}`}>
              <p className="small muted" style={{ marginTop: 0 }}>
                Now: {al.nowValue} · Worst next 24 h: {al.peakValue}
                {al.peakTime ? ` @ ${fmtDateTime(al.peakTime, tz)}` : ''}
              </p>
              <ul className="checklist">
                {a.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </Panel>
          );
        })
      )}

      <Panel title="Reference – precautions by hazard" icon={BookOpen} className="span-12">
        <div className="ref-grid">
          {(Object.keys(PRECAUTIONS) as AlertCategory[]).map((k) => (
            <div key={k} className="ref-card">
              <h3>{CATEGORY_LABEL[k]}</h3>
              <ul className="small">
                {PRECAUTIONS[k].items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
