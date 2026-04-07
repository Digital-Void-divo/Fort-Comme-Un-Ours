const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserPRs } = require('../../services/prService');
const { COLORS } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pr')
    .setDescription('View your personal records')
    .addUserOption(opt =>
      opt.setName('user').setDescription('View another user\'s PRs')),

  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser('user') || interaction.user;
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

    await interaction.editReply({ embeds: [e] });
  },
};
