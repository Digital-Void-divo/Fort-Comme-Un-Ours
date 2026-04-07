const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { COLORS, embed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sleep')
    .setDescription('Track sleep and recovery')
    .addSubcommand(sub =>
      sub.setName('log')
        .setDescription('Log sleep')
        .addNumberOption(opt =>
          opt.setName('hours').setDescription('Hours of sleep').setRequired(true).setMinValue(0).setMaxValue(24))
        .addIntegerOption(opt =>
          opt.setName('quality').setDescription('Sleep quality (1-5)').setMinValue(1).setMaxValue(5))
        .addStringOption(opt =>
          opt.setName('notes').setDescription('Notes (e.g., "woke up twice")')))
    .addSubcommand(sub =>
      sub.setName('stats')
        .setDescription('View sleep statistics')
        .addIntegerOption(opt =>
          opt.setName('days').setDescription('Days to look back (default 7)').setMinValue(1).setMaxValue(90))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'log') {
      const hours = interaction.options.getNumber('hours');
      const quality = interaction.options.getInteger('quality') || null;
      const notes = interaction.options.getString('notes') || null;

      db.prepare(
        'INSERT INTO sleep_logs (user_id, guild_id, hours, quality, notes) VALUES (?, ?, ?, ?, ?)'
      ).run(interaction.user.id, interaction.guildId, hours, quality, notes);

      // Calculate recovery score
      const recoveryScore = calculateRecovery(hours, quality);
      const recoveryLabel = recoveryScore >= 80 ? 'Excellent' : recoveryScore >= 60 ? 'Good' : recoveryScore >= 40 ? 'Fair' : 'Poor';
      const recoveryColor = recoveryScore >= 80 ? COLORS.success : recoveryScore >= 60 ? COLORS.primary : recoveryScore >= 40 ? COLORS.warning : COLORS.error;

      const fields = [`**Hours:** ${hours}h`];
      if (quality) fields.push(`**Quality:** ${'⭐'.repeat(quality)}${'☆'.repeat(5 - quality)}`);
      fields.push(`**Recovery Score:** ${recoveryScore}% — ${recoveryLabel}`);
      if (notes) fields.push(`**Notes:** ${notes}`);

      await interaction.reply({
        embeds: [embed('😴 Sleep Logged', fields.join('\n'), recoveryColor)]
      });

    } else if (sub === 'stats') {
      await interaction.deferReply();
      const days = interaction.options.getInteger('days') || 7;
      const since = Math.floor(Date.now() / 1000) - (days * 86400);

      const entries = db.prepare(
        'SELECT hours, quality, created_at FROM sleep_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ? ORDER BY created_at DESC'
      ).all(interaction.user.id, interaction.guildId, since);

      if (entries.length === 0) {
        return interaction.editReply({
          embeds: [embed('No Data', 'No sleep data found. Use `/sleep log` to start tracking!', COLORS.warning)]
        });
      }

      const avgHours = entries.reduce((s, e) => s + e.hours, 0) / entries.length;
      const qualityEntries = entries.filter(e => e.quality != null);
      const avgQuality = qualityEntries.length > 0
        ? qualityEntries.reduce((s, e) => s + e.quality, 0) / qualityEntries.length
        : null;

      const avgRecovery = entries.reduce((s, e) => s + calculateRecovery(e.hours, e.quality), 0) / entries.length;

      const chart = entries.slice().reverse().map(e => {
        const date = new Date(e.created_at * 1000).toLocaleDateString('en-US', { weekday: 'short' });
        const bars = Math.round(e.hours * 2);
        return `\`${date.padStart(3)}\` ${'█'.repeat(bars)} ${e.hours}h`;
      }).join('\n');

      const e = new EmbedBuilder()
        .setTitle(`😴 Sleep Stats — Last ${days} Days`)
        .setDescription(chart)
        .addFields(
          { name: 'Avg Hours', value: `${avgHours.toFixed(1)}h`, inline: true },
          { name: 'Avg Quality', value: avgQuality ? `${avgQuality.toFixed(1)}/5` : 'N/A', inline: true },
          { name: 'Avg Recovery', value: `${avgRecovery.toFixed(0)}%`, inline: true },
        )
        .setColor(COLORS.primary)
        .setTimestamp();

      await interaction.editReply({ embeds: [e] });
    }
  },
};

function calculateRecovery(hours, quality) {
  // Hours contribute 60%, quality 40%
  const hourScore = Math.min(100, (hours / 8) * 100);
  const qualityScore = quality ? (quality / 5) * 100 : 60; // Default 60 if not provided
  return Math.round(hourScore * 0.6 + qualityScore * 0.4);
}
