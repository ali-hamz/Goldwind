import { useId } from 'react';
import type { Threshold } from '../lib/settings';
import { compass16, compass8, fmtWind, windCondition } from '../lib/wmo';

const LV = ['#22c55e', '#facc15', '#f97316', '#ef4444'];

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/** 240° dial for sustained wind with colour-coded risk bands taken from the thresholds. */
export function WindGauge({ speed, gust, threshold }: { speed: number; gust: number; threshold: Threshold }) {
  const id = useId().replace(/:/g, '');
  const step = 5;
  const max = Math.max(20, Math.ceil((Math.max(threshold.red * 1.3, gust * 1.15, speed) || step) / step) * step);
  const START = -120;
  const SWEEP = 240;
  const angle = (v: number) => START + (Math.min(Math.max(v, 0), max) / max) * SWEEP;
  const cx = 120;
  const cy = 118;
  const r = 92;
  const bands = [
    { from: 0, to: threshold.yellow, color: LV[0] },
    { from: threshold.yellow, to: threshold.orange, color: LV[1] },
    { from: threshold.orange, to: threshold.red, color: LV[2] },
    { from: threshold.red, to: max, color: LV[3] },
  ];
  const level = speed >= threshold.red ? 3 : speed >= threshold.orange ? 2 : speed >= threshold.yellow ? 1 : 0;
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  const [nx, ny] = polar(cx, cy, r - 24, angle(speed));
  const [gx, gy] = polar(cx, cy, r, angle(gust));
  return (
    <div className="gauge">
      <svg viewBox="0 0 240 200" role="img" aria-label={`Wind speed ${fmtWind(speed)} m/s`}>
        <defs>
          <linearGradient id={`${id}prog`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <filter id={`${id}sh`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0f2547" floodOpacity="0.25" />
          </filter>
        </defs>
        <path d={arc(cx, cy, r, START, START + SWEEP)} stroke="var(--track)" strokeWidth="16" fill="none" strokeLinecap="round" />
        <path d={arc(cx, cy, r, START, Math.max(START + 0.5, angle(speed)))} stroke={`url(#${id}prog)`} strokeWidth="16" fill="none" strokeLinecap="round" />
        {threshold.enabled &&
          bands.map((b) => <path key={b.color} d={arc(cx, cy, r + 15, angle(b.from), angle(b.to))} stroke={b.color} strokeWidth="5" fill="none" />)}
        {ticks.map((t) => {
          const major = t % 10 === 0;
          const [x1, y1] = polar(cx, cy, r - 14, angle(t));
          const [x2, y2] = polar(cx, cy, r - (major ? 21 : 18), angle(t));
          const [lx, ly] = polar(cx, cy, r - 32, angle(t));
          return (
            <g key={t}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeOpacity={major ? 0.9 : 0.45} strokeWidth={major ? 1.6 : 1} strokeLinecap="round" />
              {major && (
                <text x={lx} y={ly + 3.5} fontSize="9.5" fill="var(--muted)" textAnchor="middle" fontWeight="500">
                  {t}
                </text>
              )}
            </g>
          );
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--text)" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="8" fill="var(--card)" stroke="var(--text)" strokeWidth="3.5" />
        <circle cx={gx} cy={gy} r="7" fill="#f59e0b" stroke="#fff" strokeWidth="2.5" filter={`url(#${id}sh)`} />
        <text x={cx} y={cy + 46} fontSize="34" fontWeight="700" fill="var(--text)" textAnchor="middle" letterSpacing="-1">
          {fmtWind(speed)}
        </text>
        <text x={cx} y={cy + 62} fontSize="11" fill="var(--muted)" textAnchor="middle" fontWeight="500">
          m/s sustained
        </text>
      </svg>
      <div className="gauge-chips">
        <div className="chip">
          <span className="chip-dot" style={{ background: '#f59e0b' }} />
          Gust <b>{fmtWind(gust)} m/s</b>
        </div>
        <div className="chip">
          <span className="chip-dot" style={{ background: LV[level] }} />
          {windCondition(speed)}
        </div>
      </div>
    </div>
  );
}

/** Compass showing the direction the wind is blowing FROM (meteorological convention). */
export function Compass({ deg, speed }: { deg: number; speed: number }) {
  const id = useId().replace(/:/g, '');
  const cx = 120;
  const cy = 112;
  const r = 92;
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return (
    <div className="gauge">
      <svg viewBox="0 0 240 224" role="img" aria-label={`Wind from ${compass16(deg)} ${deg.toFixed(0)} degrees`}>
        <defs>
          <radialGradient id={`${id}face`} cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="var(--card)" />
            <stop offset="100%" stopColor="var(--card-2)" />
          </radialGradient>
          <linearGradient id={`${id}needle`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
          <filter id={`${id}sh`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0f2547" floodOpacity="0.14" />
          </filter>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill={`url(#${id}face)`} stroke="var(--border)" strokeWidth="1.5" filter={`url(#${id}sh)`} />
        <circle cx={cx} cy={cy} r={r - 34} fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="2 4" />
        {Array.from({ length: 72 }, (_, i) => i * 5).map((a) => {
          const major = a % 45 === 0;
          const [x1, y1] = polar(cx, cy, r - 6, a);
          const [x2, y2] = polar(cx, cy, r - (major ? 14 : a % 15 === 0 ? 11 : 9), a);
          return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeOpacity={major ? 0.95 : 0.35} strokeWidth={major ? 2 : 1} strokeLinecap="round" />;
        })}
        {labels.map((l, i) => {
          const [x, y] = polar(cx, cy, r - 25, i * 45);
          return (
            <text key={l} x={x} y={y + 4} fontSize={l.length === 1 ? 13 : 9.5} fontWeight="700" fill={l === 'N' ? '#16a34a' : 'var(--muted)'} textAnchor="middle">
              {l}
            </text>
          );
        })}
        <g transform={`rotate(${deg} ${cx} ${cy})`}>
          <path d={`M ${cx} ${cy - r + 38} L ${cx + 9} ${cy} L ${cx} ${cy + 6} L ${cx - 9} ${cy} Z`} fill={`url(#${id}needle)`} />
          <path d={`M ${cx} ${cy + r - 38} L ${cx + 7} ${cy} L ${cx - 7} ${cy} Z`} fill="var(--track)" />
        </g>
        <circle cx={cx} cy={cy} r="24" fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
        <text x={cx} y={cy + 1} fontSize="14" fontWeight="700" fill="var(--text)" textAnchor="middle">
          {compass16(deg)}
        </text>
        <text x={cx} y={cy + 14} fontSize="9.5" fill="var(--muted)" textAnchor="middle" fontWeight="500">
          {deg.toFixed(0)}°
        </text>
      </svg>
      <div className="gauge-chips">
        <div className="chip">
          From <b>{compass8(deg)}</b>
        </div>
        <div className="chip">
          <b>{fmtWind(speed)}</b> m/s
        </div>
      </div>
    </div>
  );
}
