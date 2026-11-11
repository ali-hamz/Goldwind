import { useId } from 'react';

type Kind = 'clear' | 'partly' | 'overcast' | 'fog' | 'rain' | 'showers' | 'snow' | 'thunder';

function kindOf(code: number): Kind {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 95) return 'thunder';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  return 'rain';
}

/** Illustrated, soft-shaded weather icon driven by the WMO weather code. */
export function WeatherIcon({ code, isDay = true, size = 64, className = '' }: { code: number; isDay?: boolean; size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const k = kindOf(code);
  const showSun = k === 'clear' || k === 'partly' || k === 'showers';
  const cloud = k !== 'clear';
  const dark = k === 'thunder' || k === 'overcast';

  const Sun = ({ cx, cy, r }: { cx: number; cy: number; r: number }) =>
    isDay ? (
      <g>
        <circle cx={cx} cy={cy} r={r * 1.55} fill={`url(#${id}glow)`} />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * r * 1.25}
              y1={cy + Math.sin(a) * r * 1.25}
              x2={cx + Math.cos(a) * r * 1.55}
              y2={cy + Math.sin(a) * r * 1.55}
              stroke="#FFC23D"
              strokeWidth={r * 0.16}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={cx} cy={cy} r={r} fill={`url(#${id}sun)`} />
      </g>
    ) : (
      <g>
        <circle cx={cx} cy={cy} r={r * 1.5} fill={`url(#${id}moonglow)`} />
        <mask id={`${id}mm${cx}`}>
          <rect x="0" y="0" width="64" height="64" fill="#fff" />
          <circle cx={cx + r * 0.5} cy={cy - r * 0.35} r={r * 0.85} fill="#000" />
        </mask>
        <circle cx={cx} cy={cy} r={r} fill={`url(#${id}moon)`} mask={`url(#${id}mm${cx})`} />
      </g>
    );

  const Cloud = ({ x, y, s, back = false }: { x: number; y: number; s: number; back?: boolean }) => (
    <g transform={`translate(${x} ${y}) scale(${s})`} filter={`url(#${id}shadow)`}>
      <path
        d="M14 40 C5 40 2 32 6 26 C9 21 15 20 18 22 C20 13 28 8 37 10 C45 12 49 18 50 24 C57 23 62 28 62 34 C62 38 59 40 55 40 Z"
        fill={back ? `url(#${id}cloudBack)` : dark ? `url(#${id}cloudDark)` : `url(#${id}cloud)`}
      />
    </g>
  );

  return (
    <svg className={`wx-icon ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <radialGradient id={`${id}sun`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FFE58A" />
          <stop offset="60%" stopColor="#FFC23D" />
          <stop offset="100%" stopColor="#FF9F1C" />
        </radialGradient>
        <radialGradient id={`${id}glow`}>
          <stop offset="0%" stopColor="#FFD24D" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FFD24D" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}moon`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF6D6" />
          <stop offset="100%" stopColor="#E8C96A" />
        </linearGradient>
        <radialGradient id={`${id}moonglow`}>
          <stop offset="0%" stopColor="#FFF1B8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FFF1B8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}cloud`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#C9DDF5" />
        </linearGradient>
        <linearGradient id={`${id}cloudBack`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E3EEFB" />
          <stop offset="100%" stopColor="#A9C2E3" />
        </linearGradient>
        <linearGradient id={`${id}cloudDark`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B8C6DA" />
          <stop offset="100%" stopColor="#7187A8" />
        </linearGradient>
        <linearGradient id={`${id}drop`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7CC4FF" />
          <stop offset="100%" stopColor="#2E7BEA" />
        </linearGradient>
        <linearGradient id={`${id}bolt`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE066" />
          <stop offset="100%" stopColor="#FF9F1C" />
        </linearGradient>
        <filter id={`${id}shadow`} x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#1B3A6B" floodOpacity="0.22" />
        </filter>
      </defs>

      {k === 'clear' && <Sun cx={32} cy={32} r={14} />}
      {showSun && k !== 'clear' && <Sun cx={40} cy={22} r={10} />}
      {k === 'overcast' && <Cloud x={14} y={4} s={0.7} back />}
      {cloud && <Cloud x={2} y={12} s={k === 'partly' ? 0.82 : 0.88} />}

      {(k === 'rain' || k === 'showers' || k === 'thunder') &&
        [14, 26, 38].map((x, i) => (
          <path key={x} d={`M ${x + 4} ${50 + (i % 2) * 3} q -2 4 -3 7`} stroke={`url(#${id}drop)`} strokeWidth="3.2" strokeLinecap="round" fill="none" />
        ))}
      {k === 'thunder' && <path d="M33 40 L26 52 L32 52 L28 62 L40 47 L33 47 L37 40 Z" fill={`url(#${id}bolt)`} />}
      {k === 'snow' &&
        [16, 28, 40].map((x, i) => (
          <circle key={x} cx={x + 3} cy={53 + (i % 2) * 4} r="2.6" fill="#E6F2FF" stroke="#8CB8E8" strokeWidth="0.8" />
        ))}
      {k === 'fog' &&
        [48, 54, 60].map((y, i) => <line key={y} x1={10 + i * 3} y1={y} x2={54 - i * 4} y2={y} stroke="#9FB3CF" strokeWidth="3" strokeLinecap="round" />)}
    </svg>
  );
}
