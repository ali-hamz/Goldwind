# EGC – Weather Monitoring & Forecast System

Live weather monitoring, forecast, alert and HSE advisory dashboard for **EZDIHAR AL GARRAF COMPANY (EGC)**
operations for **PETRONAS – Garraf Oil Field, Dhi Qar, Iraq**.

A static single-page web application (Vite + React + TypeScript). It has **no backend, no database and no
login**. It runs entirely in the browser and deploys to Vercel (or any static host) at no cost.

## Features

| Module | Implementation |
|---|---|
| Main Dashboard | Wind-speed dial with colour-coded risk bands, wind compass, alert board, current conditions, 24 h evolution charts, 12 h strip, 7-day outlook, HSE summary |
| Current Weather | All 12 required parameters plus dust and sunrise/sunset, valid time, grid point |
| Hourly Forecast | 24 / 48 / 72 h table and chart; cells coloured by threshold level |
| 7-Day Forecast | Max/min, condition, wind, max gust, rain probability, expected rain, mean humidity |
| Wind Monitoring | Gauge, compass, past-24 h/next-48 h chart with RED line, 7-day direction distribution |
| Weather Alerts | GREEN/YELLOW/ORANGE/RED for wind, heat, dust storm, visibility, heavy rain, thunderstorm, lightning (indicative), shown for now and for the next 24 h |
| Weather History | Previous 24 h and 7 days (temperature, wind, gust, humidity, rainfall), daily summary, CSV export, a log of readings captured in the browser |
| Weather Radar | OpenFreeMap base map (OpenStreetMap data, clean grey style with a dark variant); RainViewer ground-radar composite with a coverage layer; NASA GPM IMERG satellite-precipitation layer. All are free and keyless. Shows **"Ground radar data unavailable"** when RainViewer is unreachable, and never displays fabricated imagery |
| HSE Weather Advisory | Automatic precautions per active hazard, plus a reference sheet |
| Daily PDF Reports | Branded 2–3 page A4 PDF with all 13 required sections; pending → approved/rejected workflow; download button |
| System Settings | Company, client, site, coordinates, timezone, refresh interval, optional API key, schedule, alert thresholds, approved-limits reference, JSON export/import |

All weather values are labelled as **model-derived estimates**, never as on-site instrument measurements.

## Data sources (free, no API key)

Weather requests go through a small Vercel serverless function, **`api/weather.ts`** (`/api/weather`). It works as
follows:

1. It tries the **Open-Meteo Forecast API** first: current, hourly, daily and 7 days of history. It fetches dust
   concentration from the **CAMS air-quality API** at the same time.
2. If Open-Meteo fails (rate limit, "service is overloaded", or an outage), it falls back automatically to
   **MET Norway Locationforecast 2.0**, the free global forecast from the Norwegian Meteorological Institute. No key
   is needed.
3. If both fail, it serves the last good response it holds, up to 24 hours old.

The Vercel CDN caches every response for 15 minutes. All viewers together therefore make about **one upstream
request per 15 minutes**, so browsers are never rate-limited individually.

MET Norway does not publish visibility or 7-day history. While the fallback is in use, the visibility alert shows
N/A and history charts keep the hours already loaded.

When you run the app locally with `npm run dev`, the function is not available. The browser then calls Open-Meteo
directly.

Refresh interval: 15 minutes by default, configurable. The status bar shows the last successful update, the next
update, the active source and the connection state. If a request fails, the last data stays on screen and retries
back off: 1, 2, 4, 8, then up to 15 minutes.

## Licensing (read before production use)

- **The free Open-Meteo endpoint is for non-commercial use only.** For commercial operation, buy an Open-Meteo
  API subscription. Then add the key in Vercel under **Project → Settings → Environment Variables →
  `OPEN_METEO_API_KEY`**. The key stays on the server and never reaches the browser.
- MET Norway data is free, including commercial use, under CC BY 4.0. Attribution is required, and the function
  sends an identifying User-Agent as MET Norway's terms require.
- Radar page: OpenFreeMap base-map tiles are free, including commercial use, with no key (OpenStreetMap attribution). NASA GIBS / GPM IMERG
  imagery is public domain. RainViewer's free API is for personal and low-volume use, and its ground-radar
  coverage over southern Iraq is limited.

## Alert thresholds: important

The default values in `src/lib/settings.ts` are **placeholders**. They are **not** PETRONAS, client or
EGC approved limits. Before operational use:

1. Open **System Settings → Alert thresholds** and enter the approved values from the site procedures, client
   requirements and HSE limits.
2. Fill in **Approved limits reference** (procedure number and revision). Until this field is filled, the PDF and
   the alerts page show a "placeholder" warning.
3. Click **Export JSON**, then **Import JSON** on every other screen. Alternatively, edit the defaults in
   `src/lib/settings.ts` and redeploy, so every device uses them.

Lightning risk is indicative only, because there is no lightning-detection feed. Heat uses air temperature,
because WBGT is not available from the API.

## Daily report schedule

The defaults are 05:30 retrieve weather, 05:45 prepare, and 06:00 generate the report as *Pending HSE Manager
review* (site time, Asia/Baghdad). All times can be changed in System Settings.

Because the system has no server, the scheduled steps run in **any browser that has the dashboard open**, such as
a control-room display. If no browser is open at 06:00, the report is generated automatically the first time the
dashboard is opened that day. Reports and approvals are stored in that browser. Approval is a recorded action,
not an authenticated e-signature. Reports are **never emailed automatically**.

## Branding

The EGC logo lives at **`public/brand/egc-logo.png`**. It appears in the sidebar and in every PDF at its native
aspect ratio. If the file is missing, a purple/gold "EGC" text mark is shown. Favicon: `public/brand/favicon.svg`.

Default site: PETRONAS Garraf Oil Field (`31.8250, 46.0471`, Asia/Baghdad). Palette: deep purple `#702082`,
gold `#E8A317` / `#FFCC00`. HSE alert colours (GREEN / YELLOW / ORANGE / RED) are unchanged.

## Run locally

Requires Node.js 18 or later.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. To produce a production build in `dist/`:

```bash
npm run build
```

## Host online (Vercel)

1. Push this repository to GitHub (already done).
2. Go to https://vercel.com/new, click **Import** next to the repository, and leave all settings at their
   defaults. `vercel.json` already sets the framework to Vite, the output to `dist`, and the SPA rewrites.
3. Click **Deploy**. Every later push to the production branch redeploys automatically.

No environment variables are needed. Optionally set `OPEN_METEO_API_KEY` for the commercial Open-Meteo endpoint.
Vercel deploys `api/weather.ts` automatically. Netlify, Cloudflare Pages, GitHub Pages and any web server that serves
`dist/` also work. Configure their SPA fallback to `index.html`.

## Optional upgrades (not required)

- **Shared history and reports across devices, or unattended 06:00 reports**: add a database (for example Neon
  or Supabase) and a scheduled job. Vercel Cron runs in UTC, so 06:00 Baghdad is `0 3 * * *`.
- **Login**: only needed if settings or approvals must be restricted. Vercel's password protection is the
  simplest option.

## Project structure

```
api/
  weather.ts         serverless proxy: Open-Meteo, MET Norway fallback, CDN cache
src/
  lib/openMeteo.ts   API client, normalisation, time helpers
  lib/alerts.ts      threshold engine (GREEN/YELLOW/ORANGE/RED)
  lib/hse.ts         HSE precautions
  lib/settings.ts    defaults and placeholder thresholds
  lib/storage.ts     last-response cache and readings log
  lib/reports.ts     report register and forecast summary
  lib/pdf.ts         PDF report (jsPDF)
  components/        layout, gauges, charts, tables
  pages/             11 navigation pages
```

## Changes from the original plan (`sb_weather_system_580b9c38.plan.md`)

- Next.js, Neon Postgres, Prisma, login and Vercel Cron were dropped in favour of a static app. History comes
  from Open-Meteo `past_days` (identical on every device) plus a browser-side log.
- Rebranded from Sokhoor Al-Behar / TotalEnergies / Artawi to EGC / PETRONAS / Garraf; logo at
  `public/brand/egc-logo.png`.
- Vercel Cron cannot use the `Asia/Baghdad` timezone (UTC only), and Hobby plans allow one daily run. The
  schedule therefore runs in the browser, as described above.
- The dust-storm alert uses the CAMS dust concentration, because the weather codes have no dust code.
