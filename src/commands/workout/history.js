const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getDb } = require('../../services/database');
const { embed, COLORS, publishButton } = require('../../utils/helpers');
const { cacheEmbed } = require('../../services/buttonHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('View your workout history')
    .addIntegerOption(opt =>
      opt.setName('days').setDescription('Number of days to look back (default 7)').setMinValue(1).setMaxValue(90))
    .addUserOption(opt =>
      opt.setName('user').setDescription('View another user\'s history')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const days = interaction.options.getInteger('days') || 7;
    const target = interaction.options.getUser('user') || interaction.user;
    const since = Math.floor(Date.now() / 1000) - (days * 86400);

    // Privacy check
    if (target.id !== interaction.user.id) {
      const db = getDb();
      const profile = db.prepare('SELECT is_public FROM user_profiles WHERE user_id = ? AND guild_id = ?')
        .get(target.id, interaction.guildId);
      if (profile && !profile.is_public) {
        return interaction.editReply({
          embeds: [embed('Private Profile', `<@${target.id}>'s profile is private.`, COLORS.warning)]
        });
      }
    }

    const db = getDb();
    const workouts = db.prepare(
      'SELECT exercise, category, sets, reps, weight, weight_unit, details, notes, created_at FROM workouts WHERE user_id = ? AND guild_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 25'
    ).all(target.id, interaction.guildId, since);

    if (workouts.length === 0) {
      return interaction.editReply({
        embeds: [embed('Workout History', `No workouts found for <@${target.id}> in the last ${days} day(s).`, COLORS.warning)]
      });
    }

    const e = new EmbedBuilder()
      .setTitle(`Workout History - ${target.displayName}`)
      .setColor(COLORS.primary)
      .setDescription(`Last ${days} day(s) · ${workouts.length} exercise(s) logged`)
      .setTimestamp();

    for (const w of workouts.slice(0, 15)) {
      const name = w.exercise.split(' ').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
      const date = new Date(w.created_at * 1000).toLocaleDateString();
      let value = `${w.sets}x${w.reps}`;
      if (w.weight > 0) value += ` @ ${w.weight} ${w.weight_unit}`;
      if (w.details) value += `\n${w.details}`;
      if (w.notes) value += `\n*${w.notes}*`;
      e.addFields({ name: `[${w.category || '?'}] ${name} - ${date}`, value, inline: true });
    }

    if (workouts.length > 15) {
      e.setFooter({ text: `Showing 15 of ${workouts.length} entries` });
    }

    const key = `hist|${target.id}|${Date.now()}`;
    cacheEmbed(key, [e], interaction.guildId);

    await interaction.editReply({
      embeds: [e],
      components: [publishButton(key)],
    });
  },
};
