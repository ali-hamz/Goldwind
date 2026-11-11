import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MLMap, type RasterTileSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Info, Pause, Play, Radar as RadarIco, Satellite } from 'lucide-react';
import { useWeather } from '../WeatherContext';
import { Panel } from '../components/ui';
import { fmtDateTime } from '../lib/openMeteo';
import { useTheme } from '../lib/theme';

/**
 * All layers are free and need no API key:
 *  - Base map: OpenFreeMap "Positron" vector style (free incl. commercial use, OpenStreetMap data).
 *    Re-coloured at runtime for the dark control-room theme.
 *  - Ground radar: RainViewer public composite (free, personal / low-volume use).
 *  - Satellite precipitation: NASA GIBS – GPM IMERG precipitation rate (public domain, global).
 */
interface Frame {
  time: number;
  path: string;
}
type RadarState = { kind: 'loading' } | { kind: 'unavailable'; reason: string } | { kind: 'ok'; host: string; frames: Frame[] };

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const COVERAGE_URL = 'https://tilecache.rainviewer.com/v2/coverage/0/256/{z}/{x}/{y}/0/0_0.png';
const IMERG_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png';

/** Re-colour the light Positron style into a navy control-room palette. */
function applyDark(map: MLMap) {
  for (const l of map.getStyle().layers ?? []) {
    const id = l.id.toLowerCase();
    try {
      if (l.type === 'background') map.setPaintProperty(l.id, 'background-color', '#0c1830');
      else if (l.type === 'fill') map.setPaintProperty(l.id, 'fill-color', id.includes('water') ? '#0a2546' : '#10203d');
      else if (l.type === 'fill-extrusion') map.setPaintProperty(l.id, 'fill-extrusion-color', '#15274a');
      else if (l.type === 'line')
        map.setPaintProperty(l.id, 'line-color', id.includes('water') || id.includes('river') ? '#0f2e55' : id.includes('boundary') || id.includes('admin') ? '#3b5585' : '#1c3156');
      else if (l.type === 'symbol') {
        map.setPaintProperty(l.id, 'text-color', '#8fa3c6');
        map.setPaintProperty(l.id, 'text-halo-color', '#0c1830');
      }
    } catch {
      /* layer without that paint property */
    }
  }
}

function circlePolygon(lat: number, lon: number, km: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * 2 * Math.PI;
    pts.push([lon + ((km / 111.32) * Math.sin(a)) / Math.cos((lat * Math.PI) / 180), lat + (km / 110.57) * Math.cos(a)]);
  }
  return { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: pts } };
}

export default function Radar() {
  const { settings } = useWeather();
  const theme = useTheme();
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(0); // increments every time a map finishes loading
  const [mapError, setMapError] = useState<string | null>(null);
  const [state, setState] = useState<RadarState>({ kind: 'loading' });
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showRadar, setShowRadar] = useState(true);
  const [showCoverage, setShowCoverage] = useState(false);
  const [showSat, setShowSat] = useState(false);
  const tz = settings.timezone;

  // Radar frame index
  useEffect(() => {
    const ctl = new AbortController();
    fetch('https://api.rainviewer.com/public/weather-maps.json', { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        const frames: Frame[] = j?.radar?.past ?? [];
        if (!j?.host || frames.length === 0) throw new Error('no radar frames published');
        setState({ kind: 'ok', host: j.host, frames });
        setIdx(frames.length - 1);
      })
      .catch((e) => {
        if (ctl.signal.aborted) return;
        setState({ kind: 'unavailable', reason: e instanceof Error ? e.message : String(e) });
      });
    return () => ctl.abort();
  }, []);

  // Map – rebuilt when the theme or site changes
  useEffect(() => {
    if (!mapEl.current) return;
    setMapError(null);
    const m = new maplibregl.Map({
      container: mapEl.current,
      style: STYLE_URL,
      center: [settings.longitude, settings.latitude],
      zoom: 6.6,
      minZoom: 3,
      maxZoom: 11,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    m.on('error', (e) => {
      if (!m.isStyleLoaded()) setMapError(e.error?.message ?? 'Base map could not be loaded');
    });
    m.on('load', () => {
      if (theme === 'dark') applyDark(m);
      m.addSource('site-ring', { type: 'geojson', data: circlePolygon(settings.latitude, settings.longitude, 50) });
      m.addLayer({ id: 'site-ring', type: 'line', source: 'site-ring', paint: { 'line-color': '#16a34a', 'line-width': 1.4, 'line-dasharray': [3, 3] } });
      const el = document.createElement('div');
      el.className = 'site-marker';
      el.innerHTML = `<span class="sm-dot"></span><span class="sm-label">${settings.shortName}</span>`;
      new maplibregl.Marker({ element: el, anchor: 'left', offset: [-9, 0] }).setLngLat([settings.longitude, settings.latitude]).addTo(m);
      setReady((n) => n + 1);
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, [theme, settings.latitude, settings.longitude, settings.shortName]);

  /** Place overlays under the first label layer so place names stay readable. */
  const beforeLabels = (m: MLMap) => m.getStyle().layers?.find((l) => l.type === 'symbol')?.id;

  const setRaster = (id: string, url: string | null, opts: { opacity: number; maxzoom: number }) => {
    const m = map.current;
    if (!m || !ready) return;
    if (!url) {
      if (m.getLayer(id)) m.removeLayer(id);
      if (m.getSource(id)) m.removeSource(id);
      return;
    }
    const src = m.getSource(id) as RasterTileSource | undefined;
    if (src && typeof src.setTiles === 'function') {
      src.setTiles([url]);
      return;
    }
    m.addSource(id, { type: 'raster', tiles: [url], tileSize: 256, maxzoom: opts.maxzoom });
    m.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': opts.opacity, 'raster-fade-duration': 0 } }, beforeLabels(m));
  };

  // Overlays
  useEffect(() => {
    setRaster('coverage', showCoverage && state.kind === 'ok' ? COVERAGE_URL : null, { opacity: 0.28, maxzoom: 7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCoverage, state.kind, ready]);
  useEffect(() => {
    setRaster('imerg', showSat ? IMERG_URL : null, { opacity: 0.7, maxzoom: 6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSat, ready]);
  useEffect(() => {
    const f = state.kind === 'ok' ? state.frames[idx] : null;
    setRaster('radar', showRadar && f && state.kind === 'ok' ? `${state.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png` : null, { opacity: 0.85, maxzoom: 7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, idx, showRadar, ready]);

  // Animation
  useEffect(() => {
    if (!playing || state.kind !== 'ok') return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % state.frames.length), 900);
    return () => window.clearInterval(id);
  }, [playing, state]);

  const frame = state.kind === 'ok' ? state.frames[idx] : null;
  return (
    <div className="grid">
      <Panel
        title="Weather radar"
        subtitle="Al Aflaj, Riyadh Region · free, open data sources"
        icon={RadarIco}
        right={
          state.kind === 'ok' &&
          showRadar && (
            <div className="row-gap wrap">
              <button className="btn btn-sm" onClick={() => setPlaying((p) => !p)}>
                {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? 'Pause' : 'Play loop'}
              </button>
              <input
                type="range"
                min={0}
                max={state.frames.length - 1}
                value={idx}
                onChange={(e) => {
                  setPlaying(false);
                  setIdx(Number(e.target.value));
                }}
              />
              <span className="mono small">{frame ? fmtDateTime(frame.time, tz) : ''}</span>
            </div>
          )
        }
        className="span-12"
      >
        <div className="layer-bar">
          <label className={`layer-chip ${state.kind !== 'ok' ? 'disabled' : ''}`}>
            <input type="checkbox" checked={showRadar && state.kind === 'ok'} disabled={state.kind !== 'ok'} onChange={(e) => setShowRadar(e.target.checked)} />
            <RadarIco size={14} /> Ground radar (RainViewer)
            {state.kind === 'loading' && <span className="muted"> · loading…</span>}
            {state.kind === 'unavailable' && <span className="err"> · unavailable</span>}
          </label>
          <label className="layer-chip">
            <input type="checkbox" checked={showSat} onChange={(e) => setShowSat(e.target.checked)} />
            <Satellite size={14} /> Satellite precipitation (NASA IMERG)
          </label>
          <label className={`layer-chip ${state.kind !== 'ok' ? 'disabled' : ''}`}>
            <input type="checkbox" checked={showCoverage} disabled={state.kind !== 'ok'} onChange={(e) => setShowCoverage(e.target.checked)} /> Radar coverage area
          </label>
        </div>
        {state.kind === 'unavailable' && (
          <div className="warn-box" style={{ marginTop: 0, marginBottom: 12 }}>
            <Info size={18} style={{ flexShrink: 0 }} />
            <span>
              <b>Ground radar data unavailable</b> ({state.reason}). No radar imagery is shown. You can switch on the NASA satellite precipitation estimate above.
            </span>
          </div>
        )}
        <div className="radar-wrap">
          <div ref={mapEl} className="radar-map" />
          {mapError && <div className="map-error">Base map unavailable ({mapError}). Weather overlays may still load.</div>}
          <div className="radar-legend">
            <span>Light</span>
            <i />
            <span>Heavy</span>
          </div>
        </div>
        <div className="info-box">
          <Info size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
          <b>Ground radar</b>: RainViewer composite of national weather radars, about 10-minute updates. Coverage over southern Iraq is limited (switch on "Radar
          coverage area"); outside the covered area radar data is <b>unavailable</b> and an empty map does not mean "no rain". <b>Satellite precipitation</b>: NASA GPM
          IMERG estimate with global coverage, typically a few hours behind real time. Base map: OpenFreeMap / © OpenStreetMap contributors. All layers are free and need no
          API key; RainViewer's free API is intended for personal / low-volume use.
        </div>
      </Panel>
    </div>
  );
}
