const QuickChart = require('quickchart-js');

const COLORS = {
  primary: 'rgba(88, 101, 242, 0.8)',
  primaryBorder: 'rgba(88, 101, 242, 1)',
  success: 'rgba(87, 242, 135, 0.8)',
  successBorder: 'rgba(87, 242, 135, 1)',
  fire: 'rgba(255, 107, 53, 0.8)',
  fireBorder: 'rgba(255, 107, 53, 1)',
  water: 'rgba(52, 152, 219, 0.8)',
  waterBorder: 'rgba(52, 152, 219, 1)',
  gold: 'rgba(241, 196, 15, 0.8)',
  goldBorder: 'rgba(241, 196, 15, 1)',
  muscle: 'rgba(231, 76, 60, 0.8)',
  muscleBorder: 'rgba(231, 76, 60, 1)',
};

const PALETTE = [
  ['rgba(88, 101, 242, 0.8)', 'rgba(88, 101, 242, 1)'],
  ['rgba(87, 242, 135, 0.8)', 'rgba(87, 242, 135, 1)'],
  ['rgba(255, 107, 53, 0.8)', 'rgba(255, 107, 53, 1)'],
  ['rgba(52, 152, 219, 0.8)', 'rgba(52, 152, 219, 1)'],
  ['rgba(241, 196, 15, 0.8)', 'rgba(241, 196, 15, 1)'],
  ['rgba(231, 76, 60, 0.8)', 'rgba(231, 76, 60, 1)'],
];

const BG = '#2b2d31';
const FG = '#e3e5e8';

function baseOptions(title) {
  return {
    plugins: {
      title: { display: !!title, text: title || '', color: FG, font: { size: 18 } },
      legend: { labels: { color: FG } },
    },
    scales: {
      x: { ticks: { color: FG }, grid: { color: 'rgba(255,255,255,0.08)' } },
      y: { ticks: { color: FG }, grid: { color: 'rgba(255,255,255,0.08)' }, beginAtZero: true },
    },
  };
}

function buildChart(config) {
  const chart = new QuickChart();
  chart.setBackgroundColor(BG);
  chart.setWidth(720);
  chart.setHeight(400);
  chart.setVersion('4');
  chart.setConfig(config);
  return chart;
}

// Bar chart for time-series counts (workouts per day, sessions per week, etc.)
function barChart({ title, labels, data, label, color = 'primary' }) {
  const [bg, border] = [COLORS[color] || COLORS.primary, COLORS[`${color}Border`] || COLORS.primaryBorder];
  return buildChart({
    type: 'bar',
    data: { labels, datasets: [{ label: label || 'Count', data, backgroundColor: bg, borderColor: border, borderWidth: 1 }] },
    options: baseOptions(title),
  });
}

// Line chart for trends (body weight, sleep, volume)
function lineChart({ title, labels, datasets }) {
  const ds = datasets.map((d, i) => {
    const [bg, border] = PALETTE[i % PALETTE.length];
    return {
      label: d.label,
      data: d.data,
      backgroundColor: bg,
      borderColor: border,
      borderWidth: 2,
      tension: 0.2,
      fill: false,
      pointRadius: 3,
    };
  });
  return buildChart({
    type: 'line',
    data: { labels, datasets: ds },
    options: baseOptions(title),
  });
}

// Stacked bar (e.g. macros per day)
function stackedBarChart({ title, labels, datasets }) {
  const ds = datasets.map((d, i) => {
    const [bg, border] = PALETTE[i % PALETTE.length];
    return { label: d.label, data: d.data, backgroundColor: bg, borderColor: border, borderWidth: 1 };
  });
  const opts = baseOptions(title);
  opts.scales.x.stacked = true;
  opts.scales.y.stacked = true;
  return buildChart({ type: 'bar', data: { labels, datasets: ds }, options: opts });
}

// Horizontal bar (e.g. top exercises)
function horizontalBarChart({ title, labels, data, label, color = 'primary' }) {
  const [bg, border] = [COLORS[color] || COLORS.primary, COLORS[`${color}Border`] || COLORS.primaryBorder];
  const opts = baseOptions(title);
  opts.indexAxis = 'y';
  return buildChart({
    type: 'bar',
    data: { labels, datasets: [{ label: label || 'Count', data, backgroundColor: bg, borderColor: border, borderWidth: 1 }] },
    options: opts,
  });
}

// Pie / doughnut (category breakdown)
function doughnutChart({ title, labels, data }) {
  const bgs = labels.map((_, i) => PALETTE[i % PALETTE.length][0]);
  const bds = labels.map((_, i) => PALETTE[i % PALETTE.length][1]);
  return buildChart({
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: bgs, borderColor: bds, borderWidth: 1 }] },
    options: { plugins: { title: { display: !!title, text: title || '', color: FG, font: { size: 18 } }, legend: { labels: { color: FG } } } },
  });
}

// Returns { url } or { buffer } depending on caller need.
async function chartToBuffer(chart) {
  return await chart.toBinary();
}

function chartUrl(chart) {
  return chart.getUrl();
}

module.exports = {
  barChart,
  lineChart,
  stackedBarChart,
  horizontalBarChart,
  doughnutChart,
  chartToBuffer,
  chartUrl,
};
