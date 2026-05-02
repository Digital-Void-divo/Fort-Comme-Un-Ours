const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const privacy = require('../../services/privacyService');
const audit = require('../../services/auditService');
const { embed, COLORS } = require('../../utils/helpers');

// Reserved keys with built-in commands so we don't shadow them.
const RESERVED_KEYS = new Set(['mood', 'energy', 'water', 'workouts', 'pr', 'sleep']);

const SUGGESTED_METRICS = [
  { name: 'Steps', value: 'steps' },
  { name: 'HRV (heart-rate variability)', value: 'hrv' },
  { name: 'Resting HR', value: 'resting_hr' },
  { name: 'Body Fat %', value: 'body_fat' },
  { name: 'Bodyweight', value: 'bodyweight' },
  { name: 'Mobility minutes', value: 'mobility_min' },
  { name: 'Stretching minutes', value: 'stretching_min' },
  { name: 'Meditation minutes', value: 'meditation_min' },
  { name: 'Sauna minutes', value: 'sauna_min' },
  { name: 'Cold-plunge minutes', value: 'cold_plunge_min' },
  { name: 'Caffeine (mg)', value: 'caffeine_mg' },
  { name: 'Alcohol (drinks)', value: 'alcohol' },
  { name: 'Stress level (1-10)', value: 'stress' },
  { name: 'Soreness (1-10)', value: 'soreness' },
  { name: 'Custom', value: 'custom' },
];

function normalizeKey(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('track')
    .setDescription('Log a custom metric (steps, HRV, mobility minutes, etc.)')
    .addSubcommand(sub =>
      sub.setName('log').setDescription('Record a metric value')
        .addStringOption(opt => opt.setName('metric').setDescription('Metric to log').setRequired(true).addChoices(...SUGGESTED_METRICS))
        .addNumberOption(opt => opt.setName('value').setDescription('Numeric value').setRequired(true))
        .addStringOption(opt => opt.setName('custom_key').setDescription('Use with metric=custom — your metric name').setMaxLength(40))
        .addStringOption(opt => opt.setName('unit').setDescription('Unit label').setMaxLength(20))
        .addStringOption(opt => opt.setName('notes').setDescription('Notes').setMaxLength(200)))
    .addSubcommand(sub =>
      sub.setName('history').setDescription('Show recent values for a metric')
        .addStringOption(opt => opt.setName('metric').setDescription('Metric key (use exact name)').setRequired(true).setAutocomplete(true))
        .addUserOption(opt => opt.setName('user').setDescription('Whose history?'))
        .addIntegerOption(opt => opt.setName('limit').setDescription('Max rows (default 15)').setMinValue(1).setMaxValue(50)))
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List metrics you\'ve logged')),

  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused().toLowerCase();
      const db = getDb();
      const rows = db.prepare(
        `SELECT DISTINCT metric_key FROM metric_logs WHERE user_id = ? AND guild_id = ? ORDER BY metric_key`
      ).all(interaction.user.id, interaction.guildId);
      const matches = rows
        .filter(r => r.metric_key.toLowerCase().includes(focused))
        .slice(0, 25)
        .map(r => ({ name: r.metric_key, value: r.metric_key }));
      await interaction.respond(matches);
    } catch (err) {
      console.error('Track autocomplete failed:', err.message);
    }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'log') {
      let metric = interaction.options.getString('metric');
      const value = interaction.options.getNumber('value');
      const customKey = interaction.options.getString('custom_key');
      const unit = interaction.options.getString('unit') || null;
      const notes = interaction.options.getString('notes') || null;

      if (metric === 'custom') {
        if (!customKey) {
          return interaction.reply({ content: 'Provide `custom_key` when using `metric: Custom`.', ephemeral: true });
        }
        metric = normalizeKey(customKey);
        if (!metric) return interaction.reply({ content: 'Invalid custom key.', ephemeral: true });
        if (RESERVED_KEYS.has(metric)) {
          return interaction.reply({ content: `\`${metric}\` is reserved — use the dedicated command for it.`, ephemeral: true });
        }
      }

      db.prepare(
        'INSERT INTO metric_logs (user_id, guild_id, metric_key, value, unit, notes) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(interaction.user.id, interaction.guildId, metric, value, unit, notes);
      audit.log(interaction.guildId, interaction.user.id, 'track.log', { metric, value });

      return interaction.reply({
        embeds: [embed('Tracked', `**${metric}** = ${value}${unit ? ' ' + unit : ''}${notes ? `\n${notes}` : ''}`, COLORS.success)],
        ephemeral: true,
      });
    }

    if (sub === 'history') {
      const metric = interaction.options.getString('metric');
      const target = interaction.options.getUser('user') || interaction.user;
      const limit = interaction.options.getInteger('limit') || 15;
      if (!privacy.canViewer(interaction.user.id, target.id, interaction.guildId, 'metrics')) {
        return interaction.reply({ content: privacy.denyMessage(), ephemeral: true });
      }
      const rows = db.prepare(
        `SELECT value, unit, notes, recorded_at FROM metric_logs
          WHERE user_id = ? AND guild_id = ? AND metric_key = ?
          ORDER BY recorded_at DESC LIMIT ?`
      ).all(target.id, interaction.guildId, metric, limit);
      if (rows.length === 0) {
        return interaction.reply({ content: `No entries for **${metric}**.`, ephemeral: true });
      }
      const e = new EmbedBuilder()
        .setTitle(`📈 ${metric} — ${target.displayName}`)
        .setColor(COLORS.primary)
        .setDescription(rows.map(r => {
          const date = new Date(r.recorded_at * 1000).toLocaleDateString();
          return `\`${date}\` — **${r.value}**${r.unit ? ' ' + r.unit : ''}${r.notes ? ` · ${r.notes}` : ''}`;
        }).join('\n'))
        .setTimestamp();
      return interaction.reply({ embeds: [e], ephemeral: true });
    }

    if (sub === 'list') {
      const rows = db.prepare(
        `SELECT metric_key, COUNT(*) as count, MAX(recorded_at) as last
           FROM metric_logs WHERE user_id = ? AND guild_id = ?
          GROUP BY metric_key ORDER BY metric_key`
      ).all(interaction.user.id, interaction.guildId);
      if (rows.length === 0) {
        return interaction.reply({ content: 'You haven\'t logged any custom metrics yet.', ephemeral: true });
      }
      const e = new EmbedBuilder().setTitle('📊 Your Metrics').setColor(COLORS.primary)
        .setDescription(rows.map(r => `**${r.metric_key}** — ${r.count} entries, last <t:${r.last}:R>`).join('\n'))
        .setTimestamp();
      return interaction.reply({ embeds: [e], ephemeral: true });
    }
  },
};
