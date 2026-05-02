const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const privacy = require('../../services/privacyService');
const audit = require('../../services/auditService');
const charts = require('../../services/chartService');
const { COLORS, embed, publishButton } = require('../../utils/helpers');
const { cacheEmbed } = require('../../services/buttonHandler');

const PERIODS = [
  { name: 'Last 7 days', value: '7' },
  { name: 'Last 30 days', value: '30' },
  { name: 'Last 90 days', value: '90' },
  { name: 'Year to date', value: 'ytd' },
  { name: 'All time', value: 'all' },
];

const CATEGORIES = [
  { name: 'Workouts per day', value: 'workouts' },
  { name: 'Volume lifted (lbs)', value: 'volume' },
  { name: 'Top exercises', value: 'top_exercises' },
  { name: 'Sessions per week', value: 'sessions' },
  { name: 'Session intensity trend', value: 'intensity' },
  { name: 'Bodyweight trend', value: 'bodyweight' },
  { name: 'Sleep hours trend', value: 'sleep' },
  { name: 'Water intake', value: 'water' },
  { name: 'Daily calories', value: 'calories' },
  { name: 'Daily macros', value: 'macros' },
  { name: 'Mood trend', value: 'mood' },
  { name: 'PR progression', value: 'pr_progress' },
  { name: 'Custom metric', value: 'metric' },
];

const FORMATS = [
  { name: 'Chart (image)', value: 'chart' },
  { name: 'Table (text)', value: 'table' },
  { name: 'CSV (file)', value: 'csv' },
];

function periodSince(period) {
  const now = Math.floor(Date.now() / 1000);
  if (period === 'all') return 0;
  if (period === 'ytd') {
    const d = new Date();
    return Math.floor(Date.UTC(d.getUTCFullYear(), 0, 1) / 1000);
  }
  return now - parseInt(period, 10) * 86400;
}

function fmtDate(epoch) { return new Date(epoch * 1000).toISOString().slice(0, 10); }

function csvAttachment(name, rows) {
  const csv = rows.map(r => r.map(v => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  return new AttachmentBuilder(Buffer.from(csv), { name: `${name}.csv` });
}

async function buildPayload(category, target, guildId, since, format) {
  const db = getDb();
  const userId = target.id;

  switch (category) {
    case 'workouts': {
      const rows = db.prepare(
        `SELECT date(created_at,'unixepoch') as d, COUNT(*) as c
           FROM workouts WHERE user_id = ? AND guild_id = ? AND created_at >= ?
           GROUP BY d ORDER BY d`
      ).all(userId, guildId, since);
      return rowsAsResult({
        title: `${target.displayName} — workouts/day`,
        labels: rows.map(r => r.d.slice(5)), data: rows.map(r => r.c),
        chartFn: () => charts.barChart({ title: `Workouts per day`, labels: rows.map(r => r.d), data: rows.map(r => r.c), label: 'Workouts', color: 'primary' }),
        csvHeader: ['date', 'workouts'], csvRows: rows.map(r => [r.d, r.c]),
        textRows: rows.map(r => `${r.d}: ${r.c}`),
        format,
      });
    }
    case 'volume': {
      const rows = db.prepare(
        `SELECT date(created_at,'unixepoch') as d, COALESCE(SUM(sets*reps*weight),0) as v
           FROM workouts WHERE user_id = ? AND guild_id = ? AND created_at >= ? AND weight > 0
           GROUP BY d ORDER BY d`
      ).all(userId, guildId, since);
      return rowsAsResult({
        title: `${target.displayName} — volume`,
        labels: rows.map(r => r.d.slice(5)), data: rows.map(r => Math.round(r.v)),
        chartFn: () => charts.lineChart({ title: 'Daily Volume (lbs)', labels: rows.map(r => r.d), datasets: [{ label: 'Volume', data: rows.map(r => Math.round(r.v)) }] }),
        csvHeader: ['date', 'volume_lbs'], csvRows: rows.map(r => [r.d, Math.round(r.v)]),
        textRows: rows.map(r => `${r.d}: ${Math.round(r.v).toLocaleString()} lbs`),
        format,
      });
    }
    case 'top_exercises': {
      const rows = db.prepare(
        `SELECT exercise, COUNT(*) as c
           FROM workouts WHERE user_id = ? AND guild_id = ? AND created_at >= ?
           GROUP BY exercise ORDER BY c DESC LIMIT 10`
      ).all(userId, guildId, since);
      return rowsAsResult({
        title: `${target.displayName} — top exercises`,
        labels: rows.map(r => r.exercise), data: rows.map(r => r.c),
        chartFn: () => charts.horizontalBarChart({ title: 'Top Exercises', labels: rows.map(r => r.exercise), data: rows.map(r => r.c), label: 'Logs', color: 'fire' }),
        csvHeader: ['exercise', 'count'], csvRows: rows.map(r => [r.exercise, r.c]),
        textRows: rows.map((r, i) => `${i + 1}. ${r.exercise} — ${r.c}`),
        format,
      });
    }
    case 'sessions': {
      const rows = db.prepare(
        `SELECT strftime('%Y-W%W', started_at, 'unixepoch') as wk, COUNT(*) as c, COALESCE(SUM(duration_sec),0) as sec
           FROM gym_sessions WHERE user_id = ? AND guild_id = ? AND started_at >= ? AND ended_at IS NOT NULL AND cancelled = 0
           GROUP BY wk ORDER BY wk`
      ).all(userId, guildId, since);
      return rowsAsResult({
        title: `${target.displayName} — sessions/week`,
        labels: rows.map(r => r.wk), data: rows.map(r => r.c),
        chartFn: () => charts.barChart({ title: 'Sessions per Week', labels: rows.map(r => r.wk), data: rows.map(r => r.c), label: 'Sessions', color: 'success' }),
        csvHeader: ['week', 'sessions', 'total_seconds'], csvRows: rows.map(r => [r.wk, r.c, r.sec]),
        textRows: rows.map(r => `${r.wk}: ${r.c} sessions, ${(r.sec / 3600).toFixed(1)}h`),
        format,
      });
    }
    case 'intensity': {
      const rows = db.prepare(
        `SELECT date(started_at,'unixepoch') as d, AVG(intensity) as avg_i
           FROM gym_sessions WHERE user_id = ? AND guild_id = ? AND started_at >= ? AND intensity IS NOT NULL AND cancelled = 0
           GROUP BY d ORDER BY d`
      ).all(userId, guildId, since);
      return rowsAsResult({
        title: `${target.displayName} — intensity`,
        labels: rows.map(r => r.d.slice(5)), data: rows.map(r => Number((r.avg_i || 0).toFixed(2))),
        chartFn: () => charts.lineChart({ title: 'Intensity (1-10)', labels: rows.map(r => r.d), datasets: [{ label: 'Avg', data: rows.map(r => Number((r.avg_i || 0).toFixed(2))) }] }),
        csvHeader: ['date', 'avg_intensity'], csvRows: rows.map(r => [r.d, (r.avg_i || 0).toFixed(2)]),
        textRows: rows.map(r => `${r.d}: ${(r.avg_i || 0).toFixed(1)}`),
        format,
      });
    }
    case 'bodyweight': {
      const rows = db.prepare(
        `SELECT created_at, value, unit FROM body_stats
           WHERE user_id = ? AND guild_id = ? AND type = 'weight' AND created_at >= ?
           ORDER BY created_at ASC`
      ).all(userId, guildId, since);
      return rowsAsResult({
        title: `${target.displayName} — bodyweight`,
        labels: rows.map(r => fmtDate(r.created_at)), data: rows.map(r => r.value),
        chartFn: () => charts.lineChart({ title: 'Bodyweight', labels: rows.map(r => fmtDate(r.created_at)), datasets: [{ label: rows[0]?.unit || 'lbs', data: rows.map(r => r.value) }] }),
        csvHeader: ['date', 'weight', 'unit'], csvRows: rows.map(r => [fmtDate(r.created_at), r.value, r.unit]),
        textRows: rows.map(r => `${fmtDate(r.created_at)}: ${r.value} ${r.unit}`),
        format,
      });
    }
    case 'sleep': {
      const rows = db.prepare(
        `SELECT date(created_at,'unixepoch') as d, AVG(hours) as h, AVG(quality) as q
           FROM sleep_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ?
           GROUP BY d ORDER BY d`
      ).all(userId, guildId, since);
      return rowsAsResult({
        title: `${target.displayName} — sleep`,
        labels: rows.map(r => r.d.slice(5)), data: rows.map(r => Number(r.h.toFixed(2))),
        chartFn: () => charts.lineChart({
          title: 'Sleep', labels: rows.map(r => r.d),
          datasets: [
            { label: 'Hours', data: rows.map(r => Number(r.h.toFixed(2))) },
            { label: 'Quality (1-5)', data: rows.map(r => r.q ? Number(r.q.toFixed(2)) : null) },
          ],
        }),
        csvHeader: ['date', 'hours', 'quality'], csvRows: rows.map(r => [r.d, r.h, r.q]),
        textRows: rows.map(r => `${r.d}: ${r.h.toFixed(1)}h${r.q ? ` (${r.q.toFixed(1)}/5)` : ''}`),
        format,
      });
    }
    case 'water': {
      const rows = db.prepare(
        `SELECT date(created_at,'unixepoch') as d, SUM(amount_ml) as ml
           FROM water_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ?
           GROUP BY d ORDER BY d`
      ).all(userId, guildId, since);
      return rowsAsResult({
        title: `${target.displayName} — water`,
        labels: rows.map(r => r.d.slice(5)), data: rows.map(r => r.ml),
        chartFn: () => charts.barChart({ title: 'Water (ml/day)', labels: rows.map(r => r.d), data: rows.map(r => r.ml), label: 'ml', color: 'water' }),
        csvHeader: ['date', 'ml'], csvRows: rows.map(r => [r.d, r.ml]),
        textRows: rows.map(r => `${r.d}: ${r.ml}ml`),
        format,
      });
    }
    case 'calories': {
      const rows = db.prepare(
        `SELECT date(created_at,'unixepoch') as d, SUM(calories) as c
           FROM nutrition_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ?
           GROUP BY d ORDER BY d`
      ).all(userId, guildId, since);
      return rowsAsResult({
        title: `${target.displayName} — calories`,
        labels: rows.map(r => r.d.slice(5)), data: rows.map(r => Math.round(r.c || 0)),
        chartFn: () => charts.barChart({ title: 'Calories per Day', labels: rows.map(r => r.d), data: rows.map(r => Math.round(r.c || 0)), label: 'kcal', color: 'fire' }),
        csvHeader: ['date', 'calories'], csvRows: rows.map(r => [r.d, Math.round(r.c || 0)]),
        textRows: rows.map(r => `${r.d}: ${Math.round(r.c || 0)} kcal`),
        format,
      });
    }
    case 'macros': {
      const rows = db.prepare(
        `SELECT date(created_at,'unixepoch') as d,
                COALESCE(SUM(protein),0) as p,
                COALESCE(SUM(carbs),0) as c,
                COALESCE(SUM(fat),0) as f
           FROM nutrition_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ?
           GROUP BY d ORDER BY d`
      ).all(userId, guildId, since);
      const labels = rows.map(r => r.d);
      return rowsAsResult({
        title: `${target.displayName} — macros`,
        labels: labels.map(d => d.slice(5)), data: null,
        chartFn: () => charts.stackedBarChart({
          title: 'Daily Macros (g)', labels,
          datasets: [
            { label: 'Protein', data: rows.map(r => Math.round(r.p)) },
            { label: 'Carbs', data: rows.map(r => Math.round(r.c)) },
            { label: 'Fat', data: rows.map(r => Math.round(r.f)) },
          ],
        }),
        csvHeader: ['date', 'protein_g', 'carbs_g', 'fat_g'],
        csvRows: rows.map(r => [r.d, Math.round(r.p), Math.round(r.c), Math.round(r.f)]),
        textRows: rows.map(r => `${r.d}: P${Math.round(r.p)}/C${Math.round(r.c)}/F${Math.round(r.f)}`),
        format,
      });
    }
    case 'mood': {
      const rows = db.prepare(
        `SELECT date(recorded_at,'unixepoch') as d, AVG(value) as v
           FROM metric_logs WHERE user_id = ? AND guild_id = ? AND metric_key = 'mood' AND recorded_at >= ?
           GROUP BY d ORDER BY d`
      ).all(userId, guildId, since);
      return rowsAsResult({
        title: `${target.displayName} — mood`,
        labels: rows.map(r => r.d.slice(5)), data: rows.map(r => Number(r.v.toFixed(2))),
        chartFn: () => charts.lineChart({ title: 'Mood (1-5)', labels: rows.map(r => r.d), datasets: [{ label: 'Mood', data: rows.map(r => Number(r.v.toFixed(2))) }] }),
        csvHeader: ['date', 'mood'], csvRows: rows.map(r => [r.d, r.v]),
        textRows: rows.map(r => `${r.d}: ${r.v.toFixed(1)}`),
        format,
      });
    }
    case 'pr_progress': {
      const rows = db.prepare(
        `SELECT created_at, exercise, weight, weight_unit, reps
           FROM personal_records
          WHERE user_id = ? AND guild_id = ? AND status = 'approved'
            AND created_at >= ? AND record_type = 'weight'
          ORDER BY created_at ASC`
      ).all(userId, guildId, since);
      // Group per exercise, plot lines.
      const byEx = new Map();
      for (const r of rows) {
        const ex = r.exercise;
        if (!byEx.has(ex)) byEx.set(ex, []);
        const wLbs = r.weight_unit === 'kg' ? r.weight / 0.453592 : r.weight;
        byEx.get(ex).push({ d: fmtDate(r.created_at), v: Math.round(wLbs) });
      }
      const labelSet = [...new Set(rows.map(r => fmtDate(r.created_at)))].sort();
      const datasets = [...byEx.entries()].map(([ex, pts]) => ({
        label: ex,
        data: labelSet.map(d => pts.find(p => p.d === d)?.v ?? null),
      }));
      return rowsAsResult({
        title: `${target.displayName} — PR progression`,
        labels: labelSet, data: null,
        chartFn: () => charts.lineChart({ title: 'PR Progression (lbs)', labels: labelSet, datasets }),
        csvHeader: ['date', 'exercise', 'weight_lbs', 'reps'],
        csvRows: rows.map(r => [fmtDate(r.created_at), r.exercise, Math.round(r.weight_unit === 'kg' ? r.weight / 0.453592 : r.weight), r.reps]),
        textRows: rows.map(r => `${fmtDate(r.created_at)} — ${r.exercise}: ${r.weight} ${r.weight_unit}`),
        format,
      });
    }
    default: return null;
  }
}

function rowsAsResult({ title, labels, data, chartFn, csvHeader, csvRows, textRows, format }) {
  return { title, labels, data, chartFn, csvHeader, csvRows, textRows, format };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Generate a chart, table, or CSV report')
    .addStringOption(opt => opt.setName('category').setDescription('What to report').setRequired(true).addChoices(...CATEGORIES))
    .addStringOption(opt => opt.setName('period').setDescription('Time window').addChoices(...PERIODS))
    .addStringOption(opt => opt.setName('format').setDescription('Output format').addChoices(...FORMATS))
    .addUserOption(opt => opt.setName('user').setDescription('Whose report?'))
    .addStringOption(opt => opt.setName('metric').setDescription('Metric key (when category=Custom metric)').setMaxLength(40)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const category = interaction.options.getString('category');
    const period = interaction.options.getString('period') || '30';
    const format = interaction.options.getString('format') || 'chart';
    const target = interaction.options.getUser('user') || interaction.user;
    const since = periodSince(period);

    if (target.id !== interaction.user.id) {
      if (!privacy.canViewer(interaction.user.id, target.id, interaction.guildId, category)) {
        return interaction.editReply({ content: privacy.denyMessage() });
      }
    }

    let payload;
    if (category === 'metric') {
      const key = interaction.options.getString('metric');
      if (!key) return interaction.editReply({ content: 'Provide `metric` when category is Custom metric.' });
      const rows = getDb().prepare(
        `SELECT recorded_at, value, unit FROM metric_logs
           WHERE user_id = ? AND guild_id = ? AND metric_key = ? AND recorded_at >= ?
           ORDER BY recorded_at ASC`
      ).all(target.id, interaction.guildId, key, since);
      if (rows.length === 0) {
        return interaction.editReply({ content: `No \`${key}\` entries in this period.` });
      }
      const labels = rows.map(r => fmtDate(r.recorded_at));
      const data = rows.map(r => r.value);
      payload = {
        title: `${target.displayName} — ${key}`,
        labels: labels.map(d => d.slice(5)),
        data,
        chartFn: () => charts.lineChart({ title: key, labels, datasets: [{ label: rows[0]?.unit || key, data }] }),
        csvHeader: ['date', 'value', 'unit'], csvRows: rows.map(r => [fmtDate(r.recorded_at), r.value, r.unit]),
        textRows: rows.map(r => `${fmtDate(r.recorded_at)}: ${r.value}${r.unit ? ' ' + r.unit : ''}`),
        format,
      };
    } else {
      payload = await buildPayload(category, target, interaction.guildId, since, format);
    }

    if (!payload) {
      return interaction.editReply({ content: `Unsupported category.` });
    }
    if ((payload.csvRows && payload.csvRows.length === 0) || (payload.labels && payload.labels.length === 0)) {
      return interaction.editReply({ content: `No data found for this report.` });
    }

    audit.log(interaction.guildId, interaction.user.id, 'report.generate', { category, period, format, target: target.id });

    const e = new EmbedBuilder()
      .setTitle(`📈 ${payload.title} (${period === 'all' ? 'all time' : period === 'ytd' ? 'YTD' : period + 'd'})`)
      .setColor(COLORS.primary).setTimestamp();

    const files = [];

    if (format === 'csv') {
      files.push(csvAttachment(`${category}_${period}`, [payload.csvHeader, ...payload.csvRows]));
      e.setDescription(`CSV attached — ${payload.csvRows.length} row(s).`);
    } else if (format === 'table') {
      e.setDescription('```\n' + payload.textRows.slice(0, 30).join('\n').slice(0, 1900) + '\n```');
      if (payload.textRows.length > 30) e.setFooter({ text: `Showing 30 of ${payload.textRows.length} rows.` });
    } else {
      try {
        const buf = await charts.chartToBuffer(payload.chartFn());
        files.push(new AttachmentBuilder(buf, { name: 'report.png' }));
        e.setImage('attachment://report.png');
      } catch (err) {
        console.error('Chart render failed:', err.message);
        e.setDescription('Chart render failed; here is a text view:\n```\n' + payload.textRows.slice(0, 20).join('\n') + '\n```');
      }
    }

    const cacheKey = `report|${target.id}|${Date.now()}`;
    cacheEmbed(cacheKey, [e], interaction.guildId);
    return interaction.editReply({ embeds: [e], files, components: [publishButton(cacheKey)] });
  },
};
