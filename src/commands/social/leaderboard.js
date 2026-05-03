const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { COLORS, publishButton } = require('../../utils/helpers');
const { cacheEmbed } = require('../../services/buttonHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View server fitness leaderboards')
    .addStringOption(opt =>
      opt.setName('type').setDescription('Leaderboard type').setRequired(true).addChoices(
        { name: 'Workout Count (7d)', value: 'workouts' },
        { name: 'Longest Streak', value: 'streak' },
        { name: 'Water Intake (7d)', value: 'water' },
        { name: 'Total Volume Lifted (7d)', value: 'volume' },
      )),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const type = interaction.options.getString('type');
    const db = getDb();
    const weekAgo = Math.floor(Date.now() / 1000) - 604800;

    let rows, title, valueLabel;

    switch (type) {
      case 'workouts':
        rows = db.prepare(
          'SELECT user_id, COUNT(*) as value FROM workouts WHERE guild_id = ? AND created_at >= ? GROUP BY user_id ORDER BY value DESC LIMIT 10'
        ).all(interaction.guildId, weekAgo);
        title = 'Most Workouts (7 Days)';
        valueLabel = 'workouts';
        break;

      case 'streak':
        rows = db.prepare(
          'SELECT user_id, current_streak as value FROM streaks WHERE guild_id = ? ORDER BY current_streak DESC LIMIT 10'
        ).all(interaction.guildId);
        title = 'Longest Active Streaks';
        valueLabel = 'days';
        break;

      case 'water':
        rows = db.prepare(
          'SELECT user_id, SUM(amount_ml) as value FROM water_logs WHERE guild_id = ? AND created_at >= ? GROUP BY user_id ORDER BY value DESC LIMIT 10'
        ).all(interaction.guildId, weekAgo);
        title = 'Most Water Intake (7 Days)';
        valueLabel = 'ml';
        break;

      case 'volume':
        // Normalize kg → lbs so users with mixed unit logs are compared fairly.
        rows = db.prepare(
          `SELECT user_id,
                  SUM(sets * reps * (CASE WHEN weight_unit = 'kg' THEN weight / 0.453592 ELSE weight END)) AS value
             FROM workouts
            WHERE guild_id = ? AND created_at >= ? AND weight > 0
            GROUP BY user_id ORDER BY value DESC LIMIT 10`
        ).all(interaction.guildId, weekAgo);
        title = 'Total Volume Lifted (7 Days)';
        valueLabel = 'lbs';
        break;
    }

    if (!rows || rows.length === 0) {
      return interaction.editReply({ content: 'No data yet for this leaderboard. Start logging!' });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = rows.map((r, i) => {
      const prefix = medals[i] || `\`${i + 1}.\``;
      const val = type === 'water' ? `${(r.value / 1000).toFixed(1)}L` : `${Math.round(r.value).toLocaleString()} ${valueLabel}`;
      return `${prefix} <@${r.user_id}> - **${val}**`;
    }).join('\n');

    const e = new EmbedBuilder()
      .setTitle(`🏆 ${title}`)
      .setDescription(lines)
      .setColor(COLORS.gold)
      .setTimestamp();

    const key = `lb|${type}|${Date.now()}`;
    cacheEmbed(key, [e], interaction.guildId);
    await interaction.editReply({ embeds: [e], components: [publishButton(key)] });
  },
};
