import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LEVEL_NAME, LEVEL_TEXT, type Level } from '../lib/alerts';

export function Logo({ className = '' }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div className={`logo-plate ${className}`}>
        <div className="logo-fallback" aria-label="Goldwind">
          <span className="lf-mark">GW</span>
          <span className="lf-text">GOLDWIND</span>
        </div>
      </div>
    );
  return (
    <div className={`logo-plate ${className}`}>
      <img className="logo" src="/brand/goldwind-logo.jpeg" alt="Goldwind" onError={() => setFailed(true)} />
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  icon: Icon,
  right,
  children,
  className = '',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <header className="card-head">
          <div className="card-title">
            {Icon && (
              <span className="card-ico">
                <Icon size={17} strokeWidth={2.2} />
              </span>
            )}
            <div>
              <h2>{title}</h2>
              {subtitle && <div className="card-sub">{subtitle}</div>}
            </div>
          </div>
          {right && <div className="card-right">{right}</div>}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

export function Stat({ label, value, unit, sub, icon: Icon, tone }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; icon?: LucideIcon; tone?: string }) {
  return (
    <div className="stat">
      <div className="stat-top">
        {Icon && (
          <span className={`stat-ico tone-${tone ?? 'blue'}`}>
            <Icon size={16} strokeWidth={2.2} />
          </span>
        )}
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function LevelBadge({ level, na, text }: { level: Level; na?: boolean; text?: boolean }) {
  if (na)
    return (
      <span className="badge lvl-na">
        <i />
        N/A
      </span>
    );
  return (
    <span className={`badge lvl-${level}`}>
      <i />
      {LEVEL_NAME[level]}
      {text && <span className="badge-sub"> · {LEVEL_TEXT[level]}</span>}
    </span>
  );
}

export function SourceTag({ kind = 'model' }: { kind?: 'model' | 'forecast' | 'hindcast' | 'local' }) {
  const t = {
    model: 'Model estimate',
    forecast: 'Model forecast',
    hindcast: 'Model hindcast',
    local: 'Logged in this browser',
  }[kind];
  const title = {
    model: 'Numerical weather model estimate for the site grid point – not an on-site instrument measurement',
    forecast: 'Numerical weather model forecast',
    hindcast: 'Model values for past hours – not an instrument record',
    local: 'API snapshots captured by this browser at each refresh',
  }[kind];
  return (
    <span className={`source-tag st-${kind}`} title={title}>
      {t}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
