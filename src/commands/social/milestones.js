const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { MILESTONE_ROLES } = require('../../services/roleRewards');
const { COLORS } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('milestones')
    .setDescription('View fitness milestones and role rewards')
    .addUserOption(opt =>
      opt.setName('user').setDescription('View another user\'s milestones')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('user') || interaction.user;
    const db = getDb();

    const earned = db.prepare(
      'SELECT milestone_type, milestone_value, awarded_at FROM milestones WHERE user_id = ? AND guild_id = ? ORDER BY awarded_at'
    ).all(target.id, interaction.guildId);

    const earnedKeys = new Set(earned.map(m => `${m.milestone_type}_${m.milestone_value}`));

    const workoutLines = [];
    const streakLines = [];

    for (const [key, roleName] of Object.entries(MILESTONE_ROLES)) {
      const isEarned = earnedKeys.has(key);
      const icon = isEarned ? '✅' : '⬜';
      const line = `${icon} **${roleName}**`;

      if (key.startsWith('workouts_')) {
        workoutLines.push(line);
      } else {
        streakLines.push(line);
      }
    }

    const e = new EmbedBuilder()
      .setTitle(`🏅 Milestones - ${target.displayName}`)
      .addFields(
        { name: 'Workout Milestones', value: workoutLines.join('\n') || 'None', inline: true },
        { name: 'Streak Milestones', value: streakLines.join('\n') || 'None', inline: true },
      )
      .setFooter({ text: `${earned.length}/${Object.keys(MILESTONE_ROLES).length} milestones earned` })
      .setColor(COLORS.gold)
      .setTimestamp();

    await interaction.editReply({ embeds: [e] });
  },
};
