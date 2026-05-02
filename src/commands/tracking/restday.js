const { SlashCommandBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const audit = require('../../services/auditService');
const { embed, COLORS, todayEpoch } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restday')
    .setDescription('Mark today as an intentional rest day so it doesn\'t break your streak')
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Why? (e.g. recovery, travel, sick)').setMaxLength(60))
    .addStringOption(opt =>
      opt.setName('notes').setDescription('Notes').setMaxLength(200))
    .addBooleanOption(opt =>
      opt.setName('remove').setDescription('Remove today\'s rest day flag instead')),

  async execute(interaction) {
    const remove = interaction.options.getBoolean('remove') || false;
    const reason = interaction.options.getString('reason') || null;
    const notes = interaction.options.getString('notes') || null;
    const day = todayEpoch();
    const db = getDb();

    if (remove) {
      const r = db.prepare(
        'DELETE FROM rest_days WHERE user_id = ? AND guild_id = ? AND day_epoch = ?'
      ).run(interaction.user.id, interaction.guildId, day);
      audit.log(interaction.guildId, interaction.user.id, 'restday.remove', { day });
      return interaction.reply({
        embeds: [embed(r.changes ? 'Rest Day Removed' : 'No Rest Day to Remove',
          r.changes ? 'Today is no longer marked as a rest day.' : 'You hadn\'t flagged today.',
          COLORS.warning)],
        ephemeral: true,
      });
    }

    try {
      db.prepare(
        'INSERT INTO rest_days (user_id, guild_id, day_epoch, reason, notes) VALUES (?, ?, ?, ?, ?)'
      ).run(interaction.user.id, interaction.guildId, day, reason, notes);
      audit.log(interaction.guildId, interaction.user.id, 'restday.add', { day, reason });
    } catch {
      return interaction.reply({ content: 'Today is already flagged as a rest day.', ephemeral: true });
    }

    return interaction.reply({
      embeds: [embed('🛌 Rest Day Logged',
        'Today is marked as an intentional rest day. Your streak won\'t break.' +
        (reason ? `\n**Reason:** ${reason}` : ''),
        COLORS.success)],
      ephemeral: true,
    });
  },
};
