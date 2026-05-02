const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { COLORS, embed, publishButton } = require('../../utils/helpers');
const { cacheEmbed } = require('../../services/buttonHandler');
const charts = require('../../services/chartService');
const audit = require('../../services/auditService');

const PERIODS = [
  { name: 'Last 7 days', value: '7' },
  { name: 'Last 30 days', value: '30' },
  { name: 'Last 90 days', value: '90' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guildstats')
    .setDescription('Anonymized server-wide fitness stats (opted-in users only)')
    .addStringOption(opt =>
      opt.setName('period').setDescription('Time period').addChoices(...PERIODS)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const days = parseInt(interaction.options.getString('period') || '30', 10);
    const since = Math.floor(Date.now() / 1000) - days * 86400;
    const db = getDb();

    const optedIn = db.prepare(
      'SELECT user_id FROM user_profiles WHERE guild_id = ? AND include_in_guild_stats = 1'
    ).all(interaction.guildId);
    const ids = optedIn.map(r => r.user_id);

    if (ids.length === 0) {
      return interaction.editReply({
        embeds: [embed('Server Stats',
          'No users have opted in yet. Use `/privacy guild_stats` and set it to **Yes** to contribute.',
          COLORS.warning)],
      });
    }

    const placeholders = ids.map(() => '?').join(',');

    const totalWorkouts = db.prepare(
      `SELECT COUNT(*) as c FROM workouts WHERE guild_id = ? AND created_at >= ? AND user_id IN (${placeholders})`
    ).get(interaction.guildId, since, ...ids).c;

    const totalSessions = db.prepare(
      `SELECT COUNT(*) as c, COALESCE(SUM(duration_sec), 0) as sec
         FROM gym_sessions
        WHERE guild_id = ? AND started_at >= ? AND ended_at IS NOT NULL AND cancelled = 0
          AND user_id IN (${placeholders})`
    ).get(interaction.guildId, since, ...ids);

    // Workouts per day (last `days`)
    const perDay = db.prepare(
      `SELECT date(created_at, 'unixepoch') as d, COUNT(*) as c
         FROM workouts
        WHERE guild_id = ? AND created_at >= ? AND user_id IN (${placeholders})
        GROUP BY d ORDER BY d`
    ).all(interaction.guildId, since, ...ids);

    // Top categories
    const cats = db.prepare(
      `SELECT category, COUNT(*) as c
         FROM workouts
        WHERE guild_id = ? AND created_at >= ? AND user_id IN (${placeholders})
        GROUP BY category ORDER BY c DESC`
    ).all(interaction.guildId, since, ...ids);

    audit.log(interaction.guildId, interaction.user.id, 'guildstats.view', { days, optedIn: ids.length });

    const e = new EmbedBuilder()
      .setTitle(`📊 Server Stats — Last ${days}d`)
      .setColor(COLORS.primary)
      .setDescription(`Aggregated across **${ids.length}** opted-in member(s).`)
      .addFields(
        { name: 'Workouts Logged', value: `${totalWorkouts}`, inline: true },
        { name: 'Sessions Completed', value: `${totalSessions.c}`, inline: true },
        { name: 'Total Session Hours', value: `${(totalSessions.sec / 3600).toFixed(1)}`, inline: true },
      )
      .setTimestamp();

    if (cats.length) {
      e.addFields({
        name: 'Category Breakdown',
        value: cats.map(c => `${c.category || '?'}: ${c.c}`).join(' · '),
      });
    }

    const files = [];
    if (perDay.length > 0) {
      const labels = perDay.map(r => r.d.slice(5));
      const data = perDay.map(r => r.c);
      const chart = charts.barChart({
        title: `Workouts per Day (${days}d)`,
        labels, data, label: 'Workouts', color: 'primary',
      });
      try {
        const buf = await charts.chartToBuffer(chart);
        files.push(new AttachmentBuilder(buf, { name: 'guildstats.png' }));
        e.setImage('attachment://guildstats.png');
      } catch (err) {
        console.error('Chart render failed:', err.message);
        e.addFields({ name: 'Daily counts', value: perDay.map(r => `${r.d.slice(5)}: ${r.c}`).join(' · ').slice(0, 1000) });
      }
    }

    const key = `gs|${interaction.guildId}|${Date.now()}`;
    cacheEmbed(key, [e], interaction.guildId);
    return interaction.editReply({ embeds: [e], files, components: [publishButton(key)] });
  },
};
