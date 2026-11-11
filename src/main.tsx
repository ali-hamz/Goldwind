import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { WeatherProvider } from './WeatherContext';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import Current from './pages/Current';
import { Daily, Hourly } from './pages/Forecast';
import Wind from './pages/Wind';
import Alerts from './pages/Alerts';
import History from './pages/History';
import Hse from './pages/Hse';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import './styles.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Map library is large: load the radar page only when it is opened.
const Radar = lazy(() => import('./pages/Radar'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <WeatherProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="current" element={<Current />} />
            <Route path="hourly" element={<Hourly />} />
            <Route path="daily" element={<Daily />} />
            <Route path="wind" element={<Wind />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="history" element={<History />} />
            <Route path="radar" element={<Suspense fallback={<div className="skeleton" style={{ height: 600 }} />}><Radar /></Suspense>} />
            <Route path="hse" element={<Hse />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </WeatherProvider>
    </BrowserRouter>
  </StrictMode>,
);
