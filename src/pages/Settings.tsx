import { useRef, useState } from 'react';
import { useWeather } from '../WeatherContext';
import { Panel } from '../components/ui';
import { CalendarClock, FileJson, Info, KeyRound, MapPin, Save, SlidersHorizontal } from 'lucide-react';
import { DEFAULT_SETTINGS, mergeSettings, type Settings as S, type ThresholdKey } from '../lib/settings';

export default function Settings() {
  const { settings, setSettings } = useWeather();
  const [draft, setDraft] = useState<S>(settings);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof S>(k: K, v: S[K]) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [k]: v }));
  };
  const setT = (k: ThresholdKey, field: 'yellow' | 'orange' | 'red' | 'enabled', v: number | boolean) => {
    setSaved(false);
    setDraft((d) => ({ ...d, thresholds: { ...d.thresholds, [k]: { ...d.thresholds[k], [field]: v } } }));
  };

  const errors: string[] = [];
  if (!(draft.latitude >= -90 && draft.latitude <= 90)) errors.push('Latitude must be between -90 and 90.');
  if (!(draft.longitude >= -180 && draft.longitude <= 180)) errors.push('Longitude must be between -180 and 180.');
  if (!(draft.refreshMinutes >= 5 && draft.refreshMinutes <= 180)) errors.push('Refresh interval must be 5–180 minutes.');
  try {
    new Intl.DateTimeFormat('en', { timeZone: draft.timezone });
  } catch {
    errors.push('Unknown timezone.');
  }
  for (const t of Object.values(draft.thresholds)) {
    const ok = t.direction === 'above' ? t.yellow <= t.orange && t.orange <= t.red : t.yellow >= t.orange && t.orange >= t.red;
    if (!ok) errors.push(`${t.label}: levels must be ordered YELLOW → ORANGE → RED.`);
  }

  const save = () => {
    if (errors.length) return;
    setSettings(draft);
    setSaved(true);
  };

  const exportJson = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ ...draft, apiKey: '' }, null, 2)], { type: 'application/json' }));
    a.download = 'egc-weather-settings.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (f: File) => {
    try {
      const next = mergeSettings(JSON.parse(await f.text()));
      setDraft({ ...next, apiKey: draft.apiKey });
      setSaved(false);
    } catch {
      alert('Invalid settings file.');
    }
  };

  const numInput = (value: number, onChange: (n: number) => void, step = 'any') => (
    <input type="number" step={step} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
  );

  return (
    <div className="grid">
      <Panel title="Site location" icon={MapPin} className="span-6">
        <div className="form">
          <label className="field">
            <span>Company</span>
            <input value={draft.companyName} onChange={(e) => set('companyName', e.target.value)} />
          </label>
          <label className="field">
            <span>Short name</span>
            <input value={draft.shortName} onChange={(e) => set('shortName', e.target.value)} />
          </label>
          <label className="field">
            <span>Site / project name</span>
            <input value={draft.siteName} onChange={(e) => set('siteName', e.target.value)} />
          </label>
          <label className="field">
            <span>Location label</span>
            <input value={draft.locationLabel} onChange={(e) => set('locationLabel', e.target.value)} />
          </label>
          <label className="field">
            <span>Latitude (°)</span>
            {numInput(draft.latitude, (n) => set('latitude', n))}
          </label>
          <label className="field">
            <span>Longitude (°)</span>
            {numInput(draft.longitude, (n) => set('longitude', n))}
          </label>
          <label className="field">
            <span>Timezone (IANA)</span>
            <input value={draft.timezone} onChange={(e) => set('timezone', e.target.value)} />
          </label>
          <p className="small dim">
            Al-Ahmer west is 22.465242, 46.040207. Al-Haddar east (WTG82) is 22.266667, 45.983333. Choose the operational point from the sidebar. Both points must be verified against the approved site survey before operational use.
          </p>
        </div>
      </Panel>

      <Panel title="Data refresh & API" icon={KeyRound} className="span-6">
        <div className="form">
          <label className="field">
            <span>Automatic refresh interval (minutes)</span>
            {numInput(draft.refreshMinutes, (n) => set('refreshMinutes', n), '1')}
          </label>
          <label className="field">
            <span>Open-Meteo commercial API key (optional)</span>
            <input type="password" value={draft.apiKey} onChange={(e) => set('apiKey', e.target.value)} placeholder="Leave empty for the free endpoint" autoComplete="off" />
          </label>
          <p className="small warn-box">
            The free Open-Meteo endpoint is licensed for <b>non-commercial use</b>. Commercial operation requires an Open-Meteo API subscription. A key entered here is stored
            only in this browser and is sent directly to Open-Meteo; it is not part of the published website. See README for the optional server-side proxy that keeps the key
            completely private.
          </p>
        </div>
      </Panel>

      <Panel title="Daily report schedule" subtitle="Site time" icon={CalendarClock} className="span-6">
        <div className="form three">
          <label className="field">
            <span>Retrieve weather</span>
            <input type="time" value={draft.schedule.fetchTime} onChange={(e) => set('schedule', { ...draft.schedule, fetchTime: e.target.value })} />
          </label>
          <label className="field">
            <span>Prepare report</span>
            <input type="time" value={draft.schedule.prepareTime} onChange={(e) => set('schedule', { ...draft.schedule, prepareTime: e.target.value })} />
          </label>
          <label className="field">
            <span>Generate PDF</span>
            <input type="time" value={draft.schedule.reportTime} onChange={(e) => set('schedule', { ...draft.schedule, reportTime: e.target.value })} />
          </label>
        </div>
        <div className="form">
          <label className="field">
            <span>Prepared By</span>
            <input value={draft.preparedBy} onChange={(e) => set('preparedBy', e.target.value)} />
          </label>
          <label className="field">
            <span>Reviewed By</span>
            <input value={draft.reviewedBy} onChange={(e) => set('reviewedBy', e.target.value)} />
          </label>
        </div>
      </Panel>

      <Panel title="Configuration file" icon={FileJson} className="span-6">
        <p className="small">
          Settings are stored per browser. To apply the same approved thresholds on every screen, export the configuration once and import it on each device – or edit
          <code> src/lib/settings.ts</code> and redeploy to change the defaults for everyone.
        </p>
        <div className="row-gap wrap">
          <button className="btn" onClick={exportJson}>
            Export JSON
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (confirm('Reset all settings to defaults?')) {
                setDraft(structuredClone(DEFAULT_SETTINGS));
                setSaved(false);
              }
            }}
          >
            Reset to defaults
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && void importJson(e.target.files[0])} />
        </div>
      </Panel>

      <Panel title="Alert thresholds" icon={SlidersHorizontal} className="span-12">
        <p className="warn-box" style={{ marginTop: 0, marginBottom: 14 }}>
          <Info size={18} style={{ flexShrink: 0 }} />
          <span>
          Default values are <b>placeholders</b> for initial set-up only and are <b>not</b> approved site or HSE limits. Enter the limits from the applicable
          site procedures, client requirements and approved HSE limits, and record the reference below.
          </span>
        </p>
        <label className="field">
          <span>Approved limits reference (procedure / document no., revision)</span>
          <input value={draft.thresholdsApprovedRef} onChange={(e) => set('thresholdsApprovedRef', e.target.value)} placeholder="e.g. Site HSE Procedure XXX Rev. 0" />
        </label>
        <div className="table-wrap">
          <table className="data thresholds">
            <thead>
              <tr>
                <th className="l">Parameter</th>
                <th>Unit</th>
                <th>Trigger</th>
                <th className="lvl-h-1">YELLOW</th>
                <th className="lvl-h-2">ORANGE</th>
                <th className="lvl-h-3">RED</th>
                <th>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(draft.thresholds) as ThresholdKey[]).map((k) => {
                const t = draft.thresholds[k];
                return (
                  <tr key={k}>
                    <td className="l">{t.label}</td>
                    <td>{t.unit}</td>
                    <td>{t.direction === 'above' ? '≥' : '≤'}</td>
                    <td>{numInput(t.yellow, (n) => setT(k, 'yellow', n))}</td>
                    <td>{numInput(t.orange, (n) => setT(k, 'orange', n))}</td>
                    <td>{numInput(t.red, (n) => setT(k, 'red', n))}</td>
                    <td>
                      <input type="checkbox" checked={t.enabled} onChange={(e) => setT(k, 'enabled', e.target.checked)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="span-12 save-bar">
        {errors.length > 0 && (
          <ul className="err small">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <button className="btn btn-primary" onClick={save} disabled={errors.length > 0}>
          <Save size={15} /> Save settings
        </button>
        {saved && <span className="ok">Saved.</span>}
      </div>
    </div>
  );
}
