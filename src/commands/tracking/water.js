const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { COLORS, progressBar, todayEpoch, embed, publishButton } = require('../../utils/helpers');
const { cacheEmbed } = require('../../services/buttonHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('water')
    .setDescription('Track water intake')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Log water intake')
        .addIntegerOption(opt =>
          opt.setName('amount').setDescription('Amount in ml (or use cups option)').setMinValue(1))
        .addIntegerOption(opt =>
          opt.setName('cups').setDescription('Number of cups (250ml each)').setMinValue(1).setMaxValue(20)))
    .addSubcommand(sub =>
      sub.setName('today')
        .setDescription('View today\'s water intake'))
    .addSubcommand(sub =>
      sub.setName('reminder')
        .setDescription('Toggle water reminders')
        .addStringOption(opt =>
          opt.setName('action').setDescription('Enable or disable').setRequired(true).addChoices(
            { name: 'Enable', value: 'on' },
            { name: 'Disable', value: 'off' },
          ))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'add') {
      const ml = interaction.options.getInteger('amount');
      const cups = interaction.options.getInteger('cups');

      if (!ml && !cups) {
        return interaction.reply({ content: 'Please specify either `amount` (ml) or `cups`.', ephemeral: true });
      }

      const totalMl = ml || (cups * 250);

      db.prepare(
        'INSERT INTO water_logs (user_id, guild_id, amount_ml) VALUES (?, ?, ?)'
      ).run(interaction.user.id, interaction.guildId, totalMl);

      // Get today's total
      const today = todayEpoch();
      const total = db.prepare(
        'SELECT COALESCE(SUM(amount_ml), 0) as total FROM water_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ?'
      ).get(interaction.user.id, interaction.guildId, today);

      const profile = db.prepare(
        'SELECT water_goal_ml FROM user_profiles WHERE user_id = ? AND guild_id = ?'
      ).get(interaction.user.id, interaction.guildId);

      const goal = profile?.water_goal_ml || 2500;
      const pct = Math.min(100, Math.round((total.total / goal) * 100));

      const e = new EmbedBuilder()
        .setTitle('💧 Water Logged')
        .setDescription(`Added **${totalMl}ml** (${(totalMl / 250).toFixed(1)} cups)`)
        .addFields(
          { name: 'Today\'s Total', value: `${total.total}ml / ${goal}ml`, inline: true },
          { name: 'Progress', value: `${progressBar(total.total, goal)} ${pct}%`, inline: true },
        )
        .setColor(total.total >= goal ? COLORS.success : COLORS.water)
        .setTimestamp();

      if (total.total >= goal) {
        e.addFields({ name: '🎉', value: 'You hit your water goal for today!' });
      }

      const wKey = `water|${interaction.user.id}|${Date.now()}`;
      cacheEmbed(wKey, [e], interaction.guildId);
      await interaction.reply({ embeds: [e], components: [publishButton(wKey)], ephemeral: true });

    } else if (sub === 'today') {
      const today = todayEpoch();
      const total = db.prepare(
        'SELECT COALESCE(SUM(amount_ml), 0) as total FROM water_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ?'
      ).get(interaction.user.id, interaction.guildId, today);

      const entries = db.prepare(
        'SELECT amount_ml, created_at FROM water_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ? ORDER BY created_at'
      ).all(interaction.user.id, interaction.guildId, today);

      const profile = db.prepare(
        'SELECT water_goal_ml FROM user_profiles WHERE user_id = ? AND guild_id = ?'
      ).get(interaction.user.id, interaction.guildId);

      const goal = profile?.water_goal_ml || 2500;
      const pct = Math.min(100, Math.round((total.total / goal) * 100));

      const timeline = entries.map(e => {
        const time = new Date(e.created_at * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return `\`${time}\` — ${e.amount_ml}ml`;
      }).join('\n') || 'No water logged today.';

      const e = new EmbedBuilder()
        .setTitle('💧 Water Intake — Today')
        .setDescription(timeline)
        .addFields(
          { name: 'Total', value: `${total.total}ml / ${goal}ml`, inline: true },
          { name: 'Progress', value: `${progressBar(total.total, goal)} ${pct}%`, inline: true },
          { name: 'Cups', value: `${(total.total / 250).toFixed(1)} cups`, inline: true },
        )
        .setColor(COLORS.water)
        .setTimestamp();

      await interaction.reply({ embeds: [e], ephemeral: true });

    } else if (sub === 'reminder') {
      const action = interaction.options.getString('action');

      if (action === 'on') {
        db.prepare(`
          INSERT INTO reminders (user_id, guild_id, channel_id, reminder_type, cron_expression)
          VALUES (?, ?, ?, 'water', '0 */2 * * *')
          ON CONFLICT DO NOTHING
        `).run(interaction.user.id, interaction.guildId, interaction.channelId);
        await interaction.reply({ embeds: [embed('💧 Water Reminders', 'Water reminders **enabled**! You\'ll be reminded every 2 hours.', COLORS.water)], ephemeral: true });
      } else {
        db.prepare(
          "DELETE FROM reminders WHERE user_id = ? AND guild_id = ? AND reminder_type = 'water'"
        ).run(interaction.user.id, interaction.guildId);
        await interaction.reply({ embeds: [embed('💧 Water Reminders', 'Water reminders **disabled**.', COLORS.water)], ephemeral: true });
      }
    }
  },
};
