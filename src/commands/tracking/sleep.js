const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { COLORS, embed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sleep')
    .setDescription('Track sleep')
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

      const color = hours >= 7 ? COLORS.success : hours >= 5 ? COLORS.warning : COLORS.error;
      const verdict = hours >= 8 ? 'Great rest!' : hours >= 7 ? 'Solid night.' : hours >= 5 ? 'A bit short - aim for 7-9h.' : 'Very low - recovery will suffer.';

      const fields = [`**Hours:** ${hours}h`];
      if (quality) fields.push(`**Quality:** ${'⭐'.repeat(quality)}${'☆'.repeat(5 - quality)}`);
      fields.push(`**Verdict:** ${verdict}`);
      if (notes) fields.push(`**Notes:** ${notes}`);

      await interaction.reply({
        embeds: [embed('😴 Sleep Logged', fields.join('\n'), color)],
        ephemeral: true,
      });

    } else if (sub === 'stats') {
      await interaction.deferReply({ ephemeral: true });
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

      const bestNight = Math.max(...entries.map(e => e.hours));
      const worstNight = Math.min(...entries.map(e => e.hours));
      const consistency = entries.length >= 3
        ? (1 - (Math.sqrt(entries.reduce((s, e) => s + Math.pow(e.hours - avgHours, 2), 0) / entries.length) / avgHours)) * 100
        : null;

      const chart = entries.slice().reverse().map(e => {
        const date = new Date(e.created_at * 1000).toLocaleDateString('en-US', { weekday: 'short' });
        const bars = Math.round(e.hours * 2);
        const qualityStr = e.quality ? ` ${'⭐'.repeat(e.quality)}` : '';
        return `\`${date.padStart(3)}\` ${'█'.repeat(bars)} ${e.hours}h${qualityStr}`;
      }).join('\n');

      const e = new EmbedBuilder()
        .setTitle(`😴 Sleep Stats - Last ${days} Days`)
        .setDescription(chart)
        .addFields(
          { name: 'Avg Hours', value: `${avgHours.toFixed(1)}h`, inline: true },
          { name: 'Avg Quality', value: avgQuality ? `${avgQuality.toFixed(1)}/5` : 'N/A', inline: true },
          { name: 'Entries', value: `${entries.length}`, inline: true },
          { name: 'Best Night', value: `${bestNight}h`, inline: true },
          { name: 'Worst Night', value: `${worstNight}h`, inline: true },
        )
        .setColor(avgHours >= 7 ? COLORS.success : avgHours >= 5 ? COLORS.warning : COLORS.error)
        .setTimestamp();

      if (consistency !== null) {
        e.addFields({ name: 'Consistency', value: `${Math.max(0, consistency).toFixed(0)}%`, inline: true });
      }

      await interaction.editReply({ embeds: [e] });
    }
  },
};
