const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { COLORS, embed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('Set workout reminders')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set a workout reminder')
        .addStringOption(opt =>
          opt.setName('time').setDescription('Time in HH:MM (24h UTC) or cron expression').setRequired(true))
        .addStringOption(opt =>
          opt.setName('days').setDescription('Days of week (e.g., "mon,wed,fri" or "daily")').setRequired(true))
        .addStringOption(opt =>
          opt.setName('message').setDescription('Custom reminder message')))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View your active reminders'))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a reminder')
        .addIntegerOption(opt =>
          opt.setName('id').setDescription('Reminder ID').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'set') {
      const time = interaction.options.getString('time');
      const days = interaction.options.getString('days').toLowerCase();
      const message = interaction.options.getString('message') || 'Time for your workout!';

      // Parse time
      const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/);
      if (!timeMatch) {
        return interaction.reply({ content: 'Please use HH:MM format (24h UTC), e.g., `14:30`.', ephemeral: true });
      }

      const hour = parseInt(timeMatch[1]);
      const minute = parseInt(timeMatch[2]);
      if (hour > 23 || minute > 59) {
        return interaction.reply({ content: 'Invalid time. Hours 0-23, minutes 0-59.', ephemeral: true });
      }

      // Parse days into cron day-of-week
      const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
      let cronDays;
      if (days === 'daily' || days === 'everyday') {
        cronDays = '*';
      } else {
        const parsed = days.split(',').map(d => dayMap[d.trim()]).filter(d => d !== undefined);
        if (parsed.length === 0) {
          return interaction.reply({ content: 'Invalid days. Use: mon,tue,wed,thu,fri,sat,sun or "daily".', ephemeral: true });
        }
        cronDays = parsed.join(',');
      }

      const cronExpr = `${minute} ${hour} * * ${cronDays}`;

      // Schema enforces UNIQUE(user_id, guild_id, reminder_type), so re-running
      // /reminder set replaces the existing workout reminder rather than crashing.
      const result = db.prepare(
        `INSERT INTO reminders (user_id, guild_id, channel_id, reminder_type, message, cron_expression)
         VALUES (?, ?, ?, 'workout', ?, ?)
         ON CONFLICT(user_id, guild_id, reminder_type) DO UPDATE SET
           channel_id = excluded.channel_id,
           message = excluded.message,
           cron_expression = excluded.cron_expression,
           active = 1`
      ).run(interaction.user.id, interaction.guildId, interaction.channelId, message, cronExpr);

      // lastInsertRowid is 0 when ON CONFLICT updates an existing row; look it up.
      let reminderId = Number(result.lastInsertRowid);
      if (!reminderId) {
        const existing = db.prepare(
          "SELECT id FROM reminders WHERE user_id = ? AND guild_id = ? AND reminder_type = 'workout'"
        ).get(interaction.user.id, interaction.guildId);
        reminderId = existing?.id ?? 0;
      }

      const daysDisplay = days === 'daily' ? 'Every day' : days.toUpperCase();

      await interaction.reply({
        embeds: [embed(
          '⏰ Reminder Set',
          `**Time:** ${time} UTC\n**Days:** ${daysDisplay}\n**Message:** ${message}\n**ID:** #${reminderId}`,
          COLORS.success
        )],
        ephemeral: true,
      });

    } else if (sub === 'list') {
      const reminders = db.prepare(
        'SELECT * FROM reminders WHERE user_id = ? AND guild_id = ? AND active = 1 ORDER BY id'
      ).all(interaction.user.id, interaction.guildId);

      if (reminders.length === 0) {
        return interaction.reply({
          embeds: [embed('Your Reminders', 'No active reminders. Use `/reminder set` to create one!', COLORS.warning)],
          ephemeral: true,
        });
      }

      const lines = reminders.map(r => {
        return `**#${r.id}** - \`${r.cron_expression}\` (${r.reminder_type})\n> ${r.message || 'Default reminder'}`;
      }).join('\n\n');

      await interaction.reply({
        embeds: [embed('⏰ Your Reminders', lines, COLORS.primary)],
        ephemeral: true,
      });

    } else if (sub === 'remove') {
      const id = interaction.options.getInteger('id');
      const result = db.prepare(
        'DELETE FROM reminders WHERE id = ? AND user_id = ? AND guild_id = ?'
      ).run(id, interaction.user.id, interaction.guildId);

      if (result.changes === 0) {
        return interaction.reply({ content: 'Reminder not found.', ephemeral: true });
      }

      await interaction.reply({
        embeds: [embed('✅ Reminder Removed', `Reminder #${id} has been deleted.`, COLORS.success)],
        ephemeral: true,
      });
    }
  },
};
