import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'egc-weather.theme';
const listeners = new Set<() => void>();

function initial(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* ignore */
  }
  return 'light';
}

let current: Theme = initial();
document.documentElement.dataset.theme = current;

export function setTheme(t: Theme) {
  current = t;
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

/** Palette used by canvas charts (CSS variables cannot be read by Chart.js directly). */
export function chartPalette(t: Theme) {
  return t === 'dark'
    ? { text: '#93a4c3', grid: 'rgba(147,164,195,0.12)', tooltipBg: '#101d36', tooltipBorder: '#24365a', tooltipText: '#e9eef8' }
    : { text: '#6b7a93', grid: 'rgba(20,40,80,0.07)', tooltipBg: '#ffffff', tooltipBorder: '#e3e9f2', tooltipText: '#14213d' };
}
