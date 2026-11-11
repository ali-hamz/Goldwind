import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type ScriptableContext,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { chartPalette, useTheme } from '../lib/theme';

ChartJS.register(LineController, BarController, LineElement, BarElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);
ChartJS.defaults.font.family = "'Plus Jakarta Sans', 'Inter', 'Segoe UI', Roboto, Arial, sans-serif";
ChartJS.defaults.animation = false;

export const COLORS = {
  wind: '#3b82f6',
  gust: '#f59e0b',
  temp: '#f43f5e',
  feels: '#fb923c',
  humidity: '#10b981',
  rain: '#38bdf8',
  rainProb: '#93c5fd',
  dust: '#c08b4f',
};

export interface Series {
  label: string;
  data: (number | null)[];
  color: string;
  type?: 'line' | 'bar';
  axis?: 'y' | 'y1';
  fill?: boolean;
  dashed?: boolean;
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function TrendChart({
  labels,
  series,
  height = 240,
  yLabel,
  y1Label,
  yMin,
  y1Max,
  markIndex,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  yLabel?: string;
  y1Label?: string;
  yMin?: number;
  y1Max?: number;
  markIndex?: number;
}) {
  const theme = useTheme();
  const P = chartPalette(theme);
  const data: ChartData<'line' | 'bar', (number | null)[], string> = {
    labels,
    datasets: series.map((s) => ({
      type: s.type ?? 'line',
      label: s.label,
      data: s.data,
      borderColor: s.color,
      backgroundColor:
        s.type === 'bar'
          ? hexA(s.color, 0.75)
          : s.fill
            ? (ctx: ScriptableContext<'line'>) => {
                const { chart } = ctx;
                const area = chart.chartArea;
                if (!area) return hexA(s.color, 0.15);
                const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
                g.addColorStop(0, hexA(s.color, 0.32));
                g.addColorStop(1, hexA(s.color, 0));
                return g;
              }
            : s.color,
      borderWidth: s.type === 'bar' ? 0 : 2.4,
      borderRadius: s.type === 'bar' ? 6 : 0,
      maxBarThickness: 18,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderWidth: 2.5,
      tension: 0.4,
      fill: s.fill ?? false,
      borderDash: s.dashed ? [6, 5] : undefined,
      yAxisID: s.axis ?? 'y',
      spanGaps: true,
    })) as ChartData<'line' | 'bar', (number | null)[], string>['datasets'],
  };
  const hasY1 = series.some((s) => s.axis === 'y1');
  const tick = { color: P.text, font: { size: 11 } };
  const options: ChartOptions<'line' | 'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', align: 'end', labels: { color: P.text, usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 14, font: { size: 11.5 } } },
      tooltip: {
        backgroundColor: P.tooltipBg,
        borderColor: P.tooltipBorder,
        borderWidth: 1,
        titleColor: P.tooltipText,
        bodyColor: P.tooltipText,
        padding: 10,
        cornerRadius: 10,
        usePointStyle: true,
        boxPadding: 4,
      },
    },
    scales: {
      x: { ticks: { ...tick, maxRotation: 0, autoSkipPadding: 22 }, grid: { display: false }, border: { display: false } },
      y: { title: { display: !!yLabel, text: yLabel ?? '', color: P.text }, min: yMin, ticks: tick, grid: { color: P.grid }, border: { display: false } },
      ...(hasY1
        ? {
            y1: {
              position: 'right' as const,
              title: { display: !!y1Label, text: y1Label ?? '', color: P.text },
              min: 0,
              max: y1Max,
              grid: { drawOnChartArea: false },
              ticks: tick,
              border: { display: false },
            },
          }
        : {}),
    },
  };
  const plugins =
    markIndex !== undefined && markIndex >= 0
      ? [
          {
            id: 'nowMarker',
            afterDatasetsDraw(chart: ChartJS) {
              const x = chart.scales.x.getPixelForValue(markIndex);
              const { top, bottom } = chart.chartArea;
              const ctx = chart.ctx;
              ctx.save();
              ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(20,33,61,0.35)';
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.moveTo(x, top);
              ctx.lineTo(x, bottom);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.fillStyle = '#16a34a';
              const w = 34;
              ctx.beginPath();
              ctx.roundRect(x - w / 2, top - 2, w, 16, 8);
              ctx.fill();
              ctx.fillStyle = '#fff';
              ctx.font = '600 10px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('NOW', x, top + 9.5);
              ctx.restore();
            },
          },
        ]
      : [];
  return (
    <div style={{ height }}>
      <Chart key={theme} type="line" data={data} options={options} plugins={plugins} />
    </div>
  );
}
