const { SlashCommandBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { embed, COLORS, weekStartFor } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weeknote')
    .setDescription('Add or update a note for a week')
    .addStringOption(opt =>
      opt.setName('note').setDescription('Your note for this week').setRequired(true).setMaxLength(1000))
    .addStringOption(opt =>
      opt.setName('week').setDescription('Week start date (YYYY-MM-DD), defaults to current week')),

  async execute(interaction) {
    const note = interaction.options.getString('note');
    const weekInput = interaction.options.getString('week');
    const ws = weekInput || weekStartFor();

    // Validate date format
    if (weekInput && !/^\d{4}-\d{2}-\d{2}$/.test(weekInput)) {
      return interaction.reply({ content: 'Invalid date format. Use YYYY-MM-DD.', ephemeral: true });
    }

    const db = getDb();
    db.prepare(`
      INSERT INTO history_notes (user_id, guild_id, week_start, note)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, guild_id, week_start) DO UPDATE SET note = excluded.note
    `).run(interaction.user.id, interaction.guildId, ws, note);

    await interaction.reply({
      embeds: [embed('📝 Weekly Note Saved', `Note for week of **${ws}**:\n\n${note}`, COLORS.success)],
      ephemeral: true,
    });
  },
};
