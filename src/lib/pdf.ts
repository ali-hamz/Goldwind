import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import { evaluateAlerts, levelFor, LEVEL_NAME, LEVEL_TEXT, overallLevel, type Level } from './alerts';
import { buildAdvisories, ADVISORY_DISCLAIMER, PRECAUTIONS } from './hse';
import { forecastDays, fmtDay, fmtFullDate, fmtTime, nextHours, todayIndex } from './openMeteo';
import { forecastSummary, type ReportRecord } from './reports';
import type { Threshold } from './settings';
import { compass16, f1, fVis, windCondition, wmoText } from './wmo';

type RGB = [number, number, number];
/** Goldwind navy (#0B3A66) and wind blue (#2F80ED). */
const PURPLE: RGB = [11, 58, 102];
const GOLD: RGB = [47, 128, 237];
const OK_GREEN: RGB = [31, 122, 77];
const INK: RGB = [42, 18, 56];
const MUTED: RGB = [100, 112, 133];
const LINE: RGB = [230, 220, 236];
const SOFT: RGB = [250, 246, 252];
const LEVEL_RGB: Record<Level, RGB> = { 0: [22, 163, 74], 1: [234, 179, 8], 2: [234, 88, 12], 3: [220, 38, 38] };
const LEVEL_SOFT: Record<Level, RGB> = { 0: [231, 248, 238], 1: [254, 246, 214], 2: [255, 234, 214], 3: [254, 226, 226] };
const LEVEL_INK: Record<Level, RGB> = { 0: [21, 128, 61], 1: [146, 100, 6], 2: [194, 65, 12], 3: [185, 28, 28] };

/** Standard PDF fonts only cover Latin-1; replace symbols they cannot render. */
const t = (s: string) =>
  s.replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

interface Logo {
  data: string;
  format: 'PNG' | 'JPEG';
  w: number;
  h: number;
}

async function loadLogo(): Promise<Logo | null> {
  try {
    const res = await fetch('/brand/goldwind-logo.jpeg', { cache: 'no-cache' });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.startsWith('image/')) return null;
    const blob = await res.blob();
    const data: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const img = new Image();
    img.src = data;
    await img.decode();
    const format: Logo['format'] = type.includes('png') || data.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    return { data, format, w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    return null;
  }
}

const PT = 0.3528; // mm per point

export async function buildReportPdf(rec: ReportRecord): Promise<jsPDF> {
  const w = rec.snapshot;
  const s = rec.settings;
  const T = s.thresholds;
  const tz = s.timezone;
  const now = Math.floor(rec.createdAt / 1000);
  const alerts = evaluateAlerts(w, s, now);
  const overall = overallLevel(alerts);
  const advisories = buildAdvisories(alerts);
  const today = w.daily[todayIndex(w, now)];
  const c = w.current;
  const hours = nextHours(w, 24, now);
  const logo = await loadLogo();

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const CW = W - 2 * M;
  const TOP = 38;
  const BOTTOM = H - 16;
  let y = 0;

  /* ---------- primitives ---------- */
  const font = (size: number, style: 'normal' | 'bold' = 'normal', color: RGB = INK) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const newPage = () => {
    doc.addPage();
    y = TOP;
  };
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };

  /** Paragraph drawn from the top of its first line (never overlaps what is above). */
  const para = (text: string, size = 8.8, color: RGB = INK, style: 'normal' | 'bold' = 'normal', gapAfter = 3) => {
    font(size, style, color);
    const lines: string[] = doc.splitTextToSize(t(text), CW);
    const lh = size * PT * 1.35;
    ensure(lines.length * lh + 2);
    doc.text(lines, M, y, { baseline: 'top', lineHeightFactor: 1.35 });
    y += lines.length * lh + gapAfter;
  };

  let sectionNo = 0;
  const section = (title: string, minBody = 30) => {
    ensure(12 + minBody);
    sectionNo += 1;
    doc.setFillColor(...GOLD);
    doc.roundedRect(M, y, 1.6, 7, 0.8, 0.8, 'F');
    font(11, 'bold', PURPLE);
    doc.text(`${sectionNo}. ${t(title)}`, M + 4.5, y + 3.6, { baseline: 'middle' });
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(M, y + 9.5, W - M, y + 9.5);
    y += 13;
  };

  const table = (opts: Parameters<typeof autoTable>[1]) => {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: TOP, bottom: 18 },
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 7.8, cellPadding: { top: 1.25, bottom: 1.25, left: 2, right: 2 }, textColor: INK, lineColor: LINE, lineWidth: 0.2, valign: 'middle' },
      headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6 },
      alternateRowStyles: { fillColor: [250, 246, 252] },
      ...opts,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  };

  const reportNo = `GW-HSE-WX-${rec.date.replace(/-/g, '')}-R0`;
  const company = s.companyName || 'Goldwind';
  const projectShort = s.shortName || 'Starah IPP 2GW';
  const location = s.locationLabel || 'Al-Ahmer west';

  /* ---------- header (brand) ---------- */
  const header = () => {
    doc.setFillColor(...PURPLE);
    doc.rect(0, 0, W, 30, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, 30, W, 1.2, 'F');
    let tx = M;
    if (logo) {
      // Logo on white rounded plate, never stretched.
      const padX = 2.4;
      const padY = 2.2;
      const scale = Math.min(40 / logo.w, 20 / logo.h);
      const lw = logo.w * scale;
      const lh = logo.h * scale;
      const plateW = lw + padX * 2;
      const plateH = lh + padY * 2;
      const plateY = (30 - plateH) / 2;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(M, plateY, plateW, plateH, 2.2, 2.2, 'F');
      doc.addImage(logo.data, logo.format, M + padX, plateY + padY, lw, lh);
      tx = M + plateW + 5;
    }
    font(11, 'bold', [255, 255, 255]);
    doc.text(t(company.toUpperCase()), tx, 9.5);
    font(9.5, 'bold', [255, 255, 255]);
    doc.text('DAILY WEATHER FORECAST & MONITORING REPORT', tx, 15.5);
    font(7.5, 'normal', [210, 224, 240]);
    doc.text(t(`Project: ${projectShort.toUpperCase()}  |  Location: ${location.toUpperCase()}`), tx, 21);
    font(7, 'normal', [186, 214, 245]);
    doc.text(`Report No: ${reportNo}`, tx, 26.5);
  };

  header();
  y = TOP;

  /* ---------- report information ---------- */
  const reviewedAt = Math.floor((rec.reviewedAt ?? 0) / 1000);
  const statusText =
    rec.status === 'approved'
      ? `APPROVED by ${rec.reviewer ?? s.reviewedBy} - ${fmtDay(reviewedAt, tz)} ${fmtTime(reviewedAt, tz)}`
      : rec.status === 'rejected'
        ? 'REJECTED - NOT FOR DISTRIBUTION'
        : 'DRAFT - PENDING HSE MANAGER REVIEW';
  table({
    theme: 'plain',
    body: [
      ['Report date', fmtFullDate(now, tz), 'Preparation time', `${fmtTime(now, tz)} (${tz})`],
      ['Project', t(s.siteName), 'Location', t(location)],
      ['Weather data source', t(w.source), 'Report status', statusText],
      ['Site coordinates', `${w.latitude.toFixed(4)}, ${w.longitude.toFixed(4)} (elev. ${w.elevation.toFixed(0)} m)`, 'Prepared by', s.preparedBy],
    ] as RowInput[],
    styles: { fontSize: 8, cellPadding: { top: 1.5, bottom: 1.5, left: 2.5, right: 2 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.2 } },
    columnStyles: { 0: { fontStyle: 'bold', textColor: MUTED, cellWidth: 34 }, 1: { cellWidth: 60 }, 2: { fontStyle: 'bold', textColor: MUTED, cellWidth: 30 } },
    didParseCell: (d) => {
      if (d.row.index === 2 && d.column.index === 3) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.textColor = rec.status === 'approved' ? OK_GREEN : [190, 30, 30];
      }
    },
  });
  y -= 2;
  doc.setFillColor(255, 247, 230);
  doc.roundedRect(M, y, CW, 8, 1.5, 1.5, 'F');
  font(7.4, 'bold', [146, 64, 14]);
  doc.text('DATA NOTICE:', M + 3, y + 4, { baseline: 'middle' });
  font(7.4, 'normal', [146, 64, 14]);
  doc.text('All values are numerical weather-model estimates and forecasts for the site grid point - NOT measurements from on-site instruments.', M + 22, y + 4, {
    baseline: 'middle',
  });
  y += 13;

  /* ---------- 1. executive summary ---------- */
  section('EXECUTIVE SUMMARY', 60);
  {
    const boxW = 46;
    const boxH = 34;
    doc.setFillColor(...LEVEL_RGB[overall]);
    doc.roundedRect(M, y, boxW, boxH, 3, 3, 'F');
    const onLvl: RGB = overall === 1 ? [66, 32, 6] : [255, 255, 255];
    font(7.2, 'bold', onLvl);
    doc.text('OVERALL ALERT LEVEL', M + boxW / 2, y + 7, { align: 'center' });
    font(20, 'bold', onLvl);
    doc.text(LEVEL_NAME[overall], M + boxW / 2, y + 16.5, { align: 'center' });
    font(8.5, 'normal', onLvl);
    doc.text(LEVEL_TEXT[overall], M + boxW / 2, y + 23, { align: 'center' });
    font(6.8, 'normal', onLvl);
    doc.text('Now + next 24 hours', M + boxW / 2, y + 29, { align: 'center' });

    const tiles: [string, string, string][] = [
      ['TEMPERATURE', `${f1(c.temperature)} °C`, `Feels like ${f1(c.apparentTemperature, 0)} °C`],
      ['MAX / MIN TODAY', `${f1(today?.tMax, 0)} / ${f1(today?.tMin, 0)} °C`, wmoText(today?.weatherCode ?? c.weatherCode)],
      ['WIND', `${c.windSpeed.toFixed(0)} km/h ${compass16(c.windDirection)}`, `${windCondition(c.windSpeed)} - gust ${c.windGust.toFixed(0)} km/h`],
      ['MAX GUST TODAY', `${f1(today?.gustMax, 0)} km/h`, `Dominant ${compass16(today?.windDirDominant ?? c.windDirection)}`],
      ['RAIN', `${today?.precipProbMax ?? 0} %`, `${f1(today?.precipSum)} mm expected today`],
      ['HUMIDITY / VISIBILITY', `${c.humidity.toFixed(0)} % / ${fVis(c.visibility)}`, `Pressure ${c.pressure.toFixed(0)} hPa`],
    ];
    const gx = M + boxW + 4;
    const cols = 3;
    const gap = 3;
    const tw = (CW - boxW - 4 - gap * (cols - 1)) / cols;
    const th = (boxH - gap) / 2;
    tiles.forEach(([label, value, sub], i) => {
      const x = gx + (i % cols) * (tw + gap);
      const ty = y + Math.floor(i / cols) * (th + gap);
      doc.setFillColor(...SOFT);
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, ty, tw, th, 2, 2, 'FD');
      font(6.4, 'bold', MUTED);
      doc.text(label, x + 3, ty + 4.2);
      font(11.5, 'bold', INK);
      doc.text(t(value), x + 3, ty + 9.6);
      font(6.6, 'normal', MUTED);
      doc.text(doc.splitTextToSize(t(sub), tw - 5)[0], x + 3, ty + 13.4);
    });
    y += boxH + 5;
    font(8.2, 'bold', PURPLE);
    doc.text('Weather forecast summary', M, y, { baseline: 'top' });
    y += 4.6;
    para(forecastSummary(w, s, now), 8.6, INK, 'normal', 4);
  }

  /* ---------- 2. current conditions ---------- */
  section(`CURRENT WEATHER CONDITIONS (MODEL ESTIMATE AT ${fmtTime(c.time, tz)})`, 40);
  table({
    body: [
      ['Condition', wmoText(c.weatherCode), 'Temperature', `${f1(c.temperature)} °C`, 'Feels like', `${f1(c.apparentTemperature)} °C`],
      ['Max temp (today)', `${f1(today?.tMax)} °C`, 'Min temp (today)', `${f1(today?.tMin)} °C`, 'Rel. humidity', `${c.humidity.toFixed(0)} %`],
      ['Wind speed', `${c.windSpeed.toFixed(0)} km/h`, 'Wind direction', `${compass16(c.windDirection)} (${c.windDirection.toFixed(0)}°)`, 'Wind gust', `${c.windGust.toFixed(0)} km/h`],
      ['Max gust (today)', `${f1(today?.gustMax, 0)} km/h`, 'Visibility', fVis(c.visibility), 'Pressure (MSL)', `${c.pressure.toFixed(0)} hPa`],
      ['Cloud cover', `${c.cloudCover.toFixed(0)} %`, 'Precipitation', `${f1(c.precipitation)} mm`, 'Rain probability (today)', `${today?.precipProbMax ?? '—'} %`],
      ['Expected rainfall (today)', `${f1(today?.precipSum)} mm`, 'Surface dust (CAMS)', c.dust === null ? 'n/a' : `${c.dust.toFixed(0)} µg/m³`, 'Sunrise / Sunset', today ? `${fmtTime(today.sunrise, tz)} / ${fmtTime(today.sunset, tz)}` : '—'],
    ].map((r) => r.map((x) => t(String(x)))),
    columnStyles: {
      0: { fontStyle: 'bold', textColor: MUTED, fillColor: SOFT },
      2: { fontStyle: 'bold', textColor: MUTED, fillColor: SOFT },
      4: { fontStyle: 'bold', textColor: MUTED, fillColor: SOFT },
    },
    alternateRowStyles: {},
  });

  /* ---------- 3. alerts ---------- */
  section(`WEATHER ALERTS - OVERALL LEVEL: ${LEVEL_NAME[overall]}`, 50);
  table({
    head: [['Hazard', 'Now', 'Next 24 h', 'Current value', 'Worst in next 24 h', 'Threshold basis (Y / O / R)']],
    body: alerts.map((a) => [
      a.label,
      a.available ? LEVEL_NAME[a.nowLevel] : 'N/A',
      a.available ? LEVEL_NAME[a.forecastLevel] : 'N/A',
      t(a.available ? a.nowValue : 'Not available'),
      t(a.available ? a.peakValue + (a.peakTime ? ` @ ${fmtTime(a.peakTime, tz)}` : '') : '-'),
      t(a.basis),
    ]),
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 }, 1: { cellWidth: 17 }, 2: { cellWidth: 17 }, 5: { cellWidth: 58, fontSize: 6.6, textColor: MUTED } },
    didParseCell: (d) => {
      if (d.section === 'body' && (d.column.index === 1 || d.column.index === 2)) {
        const a = alerts[d.row.index];
        d.cell.styles.halign = 'center';
        d.cell.styles.fontStyle = 'bold';
        if (!a.available) return;
        const lvl = d.column.index === 1 ? a.nowLevel : a.forecastLevel;
        d.cell.styles.fillColor = LEVEL_SOFT[lvl];
        d.cell.styles.textColor = LEVEL_INK[lvl];
      }
    },
  });
  y -= 3;
  para(
    `Thresholds: ${s.thresholdsApprovedRef ? `as per ${s.thresholdsApprovedRef}.` : 'PLACEHOLDER DEFAULTS - not approved site/client limits. Replace in System Settings with the approved HSE limits.'}`,
    7,
    MUTED,
  );

  /* ---------- 4. HSE ---------- */
  section('HSE WEATHER RISK ASSESSMENT & RECOMMENDED PRECAUTIONS', 30);
  if (advisories.length === 0) {
    doc.setFillColor(...LEVEL_SOFT[0]);
    const msg = doc.splitTextToSize(
      t('No configured weather threshold is exceeded now or in the next 24 hours. Maintain routine weather awareness and standard controls.'),
      CW - 8,
    );
    const bh = msg.length * 8.6 * PT * 1.35 + 6;
    doc.roundedRect(M, y, CW, bh, 2, 2, 'F');
    font(8.6, 'bold', LEVEL_INK[0]);
    doc.text(msg, M + 4, y + 3, { baseline: 'top', lineHeightFactor: 1.35 });
    y += bh + 4;
  } else {
    table({
      head: [['Hazard', 'Level', 'Recommended precautions']],
      body: advisories.map((a) => [a.title, LEVEL_NAME[a.level], a.items.map((i) => `-  ${t(i)}`).join('\n')]),
      columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' }, 1: { cellWidth: 18, halign: 'center', fontStyle: 'bold' } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 1) {
          const lvl = advisories[d.row.index].level;
          d.cell.styles.fillColor = LEVEL_SOFT[lvl];
          d.cell.styles.textColor = LEVEL_INK[lvl];
        }
      },
    });
  }
  if (!advisories.some((a) => a.category === 'heat') && (today?.tMax ?? 0) >= 35) {
    para(`Heat stress: ${PRECAUTIONS.heat.items.slice(0, 3).join(' ')}`, 8, INK);
  }
  para(ADVISORY_DISCLAIMER, 6.9, MUTED, 'normal', 5);

  /* ---------- 7. 7-day ---------- */
  section('7-DAY WEATHER FORECAST', 45);
  table({
    head: [['Day', 'Condition', 'Max °C', 'Min °C', 'Wind max km/h', 'Gust max km/h', 'Dir', 'Rain %', 'Rain mm', 'RH mean %']],
    body: forecastDays(w, 7, now).map((d) =>
      [
        fmtDay(d.time, tz),
        wmoText(d.weatherCode),
        d.tMax.toFixed(0),
        d.tMin.toFixed(0),
        d.windMax.toFixed(0),
        d.gustMax.toFixed(0),
        compass16(d.windDirDominant),
        d.precipProbMax === null ? '-' : String(d.precipProbMax),
        d.precipSum.toFixed(1),
        d.humidityMean === null ? '-' : d.humidityMean.toFixed(0),
      ].map((x) => t(x)),
    ),
    styles: { fontSize: 7.6, cellPadding: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 }, halign: 'center', textColor: INK, lineColor: LINE, lineWidth: 0.2 },
    columnStyles: { 0: { fontStyle: 'bold', halign: 'left' }, 1: { halign: 'left' } },
  });

  /* ---------- 5. 24-hour trend chart ---------- */
  section('24-HOUR TREND - TEMPERATURE, WIND & GUST', 52);
  if (hours.length > 1) {
    const cx = M + 10;
    const cw = CW - 20;
    const ch = 30;
    const cy = y + 4;
    const temps = hours.map((h) => h.temperature);
    const tMin = Math.floor(Math.min(...temps) - 1);
    const tMax = Math.ceil(Math.max(...temps) + 1);
    const wMax = Math.max(10, Math.ceil((Math.max(...hours.map((h) => h.windGust)) * 1.15) / 5) * 5);
    const px = (i: number) => cx + (i / (hours.length - 1)) * cw;
    const pyT = (v: number) => cy + ch - ((v - tMin) / (tMax - tMin || 1)) * ch;
    const pyW = (v: number) => cy + ch - (v / wMax) * ch;

    doc.setFillColor(...SOFT);
    doc.roundedRect(M, y, CW, ch + 16, 2, 2, 'F');
    doc.setLineWidth(0.15);
    for (let g = 0; g <= 4; g++) {
      const gy = cy + (g / 4) * ch;
      doc.setDrawColor(...LINE);
      doc.line(cx, gy, cx + cw, gy);
      font(6, 'normal', [220, 60, 80]);
      doc.text((tMax - (g / 4) * (tMax - tMin)).toFixed(0), cx - 2, gy, { align: 'right', baseline: 'middle' });
      font(6, 'normal', [37, 99, 235]);
      doc.text((wMax - (g / 4) * wMax).toFixed(0), cx + cw + 2, gy, { baseline: 'middle' });
    }
    font(6, 'normal', MUTED);
    hours.forEach((h, i) => {
      if (i % 3 === 0) doc.text(fmtTime(h.time, tz), px(i), cy + ch + 4, { align: 'center' });
    });
    const poly = (vals: number[], py: (v: number) => number, color: RGB, width: number, dash = false) => {
      doc.setDrawColor(...color);
      doc.setLineWidth(width);
      if (dash) doc.setLineDashPattern([1.2, 1], 0);
      for (let i = 1; i < vals.length; i++) doc.line(px(i - 1), py(vals[i - 1]), px(i), py(vals[i]));
      doc.setLineDashPattern([], 0);
    };
    if (T.windSpeed.enabled && T.windSpeed.yellow < wMax) {
      doc.setDrawColor(...LEVEL_RGB[1]);
      doc.setLineWidth(0.25);
      doc.setLineDashPattern([0.6, 0.8], 0);
      doc.line(cx, pyW(T.windSpeed.yellow), cx + cw, pyW(T.windSpeed.yellow));
      doc.setLineDashPattern([], 0);
    }
    poly(hours.map((h) => h.windGust), pyW, [245, 158, 11], 0.5, true);
    poly(hours.map((h) => h.windSpeed), pyW, [37, 99, 235], 0.7);
    poly(temps, pyT, [225, 29, 72], 0.8);
    const legend: [RGB, string][] = [
      [[225, 29, 72], 'Temperature °C (left)'],
      [[37, 99, 235], 'Wind km/h (right)'],
      [[245, 158, 11], 'Gust km/h (right)'],
      [LEVEL_RGB[1], `YELLOW wind threshold (${T.windSpeed.yellow} km/h)`],
    ];
    let lx = cx;
    legend.forEach(([col, label]) => {
      doc.setFillColor(...col);
      doc.roundedRect(lx, cy + ch + 7.2, 4, 1.4, 0.5, 0.5, 'F');
      font(6.4, 'normal', MUTED);
      doc.text(t(label), lx + 5.5, cy + ch + 8.4);
      lx += doc.getTextWidth(t(label)) + 12;
    });
    y += ch + 20;
  }

  /* ---------- 6. hourly ---------- */
  section('HOURLY WEATHER FORECAST (NEXT 24 HOURS)', 40);
  const tCell = (v: number | null, th: Threshold) => levelFor(v, th);
  const cellLevels = hours.map((h) => [0, 0, tCell(h.temperature, T.heat), 0, tCell(h.windSpeed, T.windSpeed), tCell(h.windGust, T.windGust), 0, 0, 0, tCell(h.precipitation, T.rain), tCell(h.visibility, T.visibility)] as Level[]);
  table({
    head: [['Time', 'Condition', 'Temp °C', 'Feels °C', 'Wind km/h', 'Gust km/h', 'Dir', 'RH %', 'Rain %', 'Precip mm', 'Visibility']],
    body: hours.map((h) =>
      [
        fmtTime(h.time, tz),
        wmoText(h.weatherCode),
        h.temperature.toFixed(1),
        h.apparentTemperature.toFixed(0),
        h.windSpeed.toFixed(0),
        h.windGust.toFixed(0),
        compass16(h.windDirection),
        h.humidity.toFixed(0),
        h.precipProbability === null ? '-' : String(h.precipProbability),
        h.precipitation.toFixed(1),
        fVis(h.visibility),
      ].map((x) => t(x)),
    ),
    styles: { fontSize: 6.9, cellPadding: { top: 0.75, bottom: 0.75, left: 1.5, right: 1.5 }, halign: 'center', textColor: INK, lineColor: LINE, lineWidth: 0.2 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'left', cellWidth: 32 } },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      const lvl = cellLevels[d.row.index]?.[d.column.index] ?? 0;
      if (lvl > 0) {
        d.cell.styles.fillColor = LEVEL_SOFT[lvl as Level];
        d.cell.styles.textColor = LEVEL_INK[lvl as Level];
        d.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y -= 4;
  para('Highlighted cells exceed the configured YELLOW / ORANGE / RED thresholds.', 6.6, MUTED, 'normal', 2);

  /* ---------- 8. sign-off ---------- */
  section('REVIEW & APPROVAL', 26);
  table({
    head: [['Prepared By', 'Reviewed By', 'Project']],
    body: [
      [s.preparedBy, rec.status === 'approved' ? `${s.reviewedBy}: ${rec.reviewer ?? ''}` : s.reviewedBy, projectShort],
      [
        'Signature / date:\n ',
        rec.status === 'approved' ? `Approved electronically\n${fmtDay(reviewedAt, tz)} ${fmtTime(reviewedAt, tz)}` : 'Signature / date:\n ',
        `${s.siteName}, ${location}`,
      ],
    ],
    styles: { fontSize: 8, cellPadding: 2.2, textColor: INK, lineColor: LINE, lineWidth: 0.2 },
    alternateRowStyles: {},
  });

  /* ---------- page furniture ---------- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    if (p > 1) header();
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(M, H - 11, W - M, H - 11);
    font(7, 'bold', PURPLE);
    doc.text(t(`${company}  |  Weather Monitoring & Forecast System`), M, H - 7.2);
    font(7, 'bold', MUTED);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 7.2, { align: 'right' });
    font(6.2, 'normal', MUTED);
    doc.text('Model-derived data (Open-Meteo / MET Norway, CC BY 4.0) - not on-site instrument measurements', M, H - 4);
    if (rec.status !== 'approved') {
      font(7.5, 'bold', [200, 30, 30]);
      doc.text(rec.status === 'rejected' ? 'REJECTED' : 'DRAFT - PENDING REVIEW', W - M, 34.5, { align: 'right' });
    }
  }
  return doc;
}

export async function downloadReportPdf(rec: ReportRecord) {
  const doc = await buildReportPdf(rec);
  const suffix = rec.status === 'approved' ? 'APPROVED' : rec.status === 'rejected' ? 'REJECTED' : 'DRAFT';
  doc.save(`Starah_IPP_2GW_Daily_Weather_Report_${rec.date}_${suffix}.pdf`);
}
