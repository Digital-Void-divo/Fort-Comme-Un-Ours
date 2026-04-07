const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserPRs } = require('../../services/prService');
const { COLORS, publishButton } = require('../../utils/helpers');
const { cacheEmbed } = require('../../services/buttonHandler');
const { getDb } = require('../../services/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pr')
    .setDescription('View your personal records')
    .addUserOption(opt =>
      opt.setName('user').setDescription('View another user\'s PRs')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user') || interaction.user;

    // Privacy check
    if (target.id !== interaction.user.id) {
      const db = getDb();
      const profile = db.prepare('SELECT is_public FROM user_profiles WHERE user_id = ? AND guild_id = ?')
        .get(target.id, interaction.guildId);
      if (profile && !profile.is_public) {
        return interaction.editReply({ content: 'This user\'s profile is private.' });
      }
    }

    const prs = getUserPRs(target.id, interaction.guildId);

    if (prs.length === 0) {
      const e = new EmbedBuilder()
        .setTitle('Personal Records')
        .setDescription(`No PRs recorded for <@${target.id}> yet. Log workouts with weight to track PRs!`)
        .setColor(COLORS.warning);
      return interaction.editReply({ embeds: [e] });
    }

    const e = new EmbedBuilder()
      .setTitle(`🏆 Personal Records — ${target.displayName}`)
      .setColor(COLORS.gold)
      .setTimestamp();

    for (const pr of prs) {
      const name = pr.exercise.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      const date = new Date(pr.created_at * 1000).toLocaleDateString();
      e.addFields({
        name,
        value: `**${pr.weight} ${pr.weight_unit}** x${pr.reps} rep(s)\nSet on ${date}`,
        inline: true,
      });
    }

    const key = `pr|${target.id}|${Date.now()}`;
    cacheEmbed(key, [e], interaction.guildId);

    await interaction.editReply({
      embeds: [e],
      components: [publishButton(key)],
    });
  },
};
