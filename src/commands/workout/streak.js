const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getStreak } = require('../../services/streakService');
const { COLORS, progressBar, publishButton } = require('../../utils/helpers');
const { cacheEmbed } = require('../../services/buttonHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('streak')
    .setDescription('View your workout streak')
    .addUserOption(opt =>
      opt.setName('user').setDescription('View another user\'s streak')),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const streak = getStreak(target.id, interaction.guildId);

    const fireEmoji = streak.current_streak >= 30 ? '🔥🔥🔥'
      : streak.current_streak >= 14 ? '🔥🔥'
      : streak.current_streak >= 7 ? '🔥'
      : '';

    const nextMilestones = [7, 14, 30, 60, 90, 100, 180, 365];
    const next = nextMilestones.find(m => m > streak.current_streak) || 365;

    const e = new EmbedBuilder()
      .setTitle(`Workout Streak — ${target.displayName}`)
      .setColor(streak.current_streak >= 7 ? COLORS.fire : COLORS.primary)
      .addFields(
        { name: 'Current Streak', value: `**${streak.current_streak}** day(s) ${fireEmoji}`, inline: true },
        { name: 'Longest Streak', value: `**${streak.longest_streak}** day(s)`, inline: true },
        { name: `Progress to ${next}-Day Milestone`, value: `${progressBar(streak.current_streak, next)} ${streak.current_streak}/${next}` },
      )
      .setTimestamp();

    const key = `streak|${target.id}|${Date.now()}`;
    cacheEmbed(key, [e], interaction.guildId);

    await interaction.reply({
      embeds: [e],
      components: [publishButton(key)],
      ephemeral: true,
    });
  },
};
