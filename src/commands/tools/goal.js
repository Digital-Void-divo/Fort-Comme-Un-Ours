const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { COLORS, embed, progressBar } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('goal')
    .setDescription('Set and track fitness goals')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Create a new goal')
        .addStringOption(opt =>
          opt.setName('title').setDescription('Goal title (e.g., "Bench 225 lbs")').setRequired(true))
        .addStringOption(opt =>
          opt.setName('category').setDescription('Goal category').setRequired(true).addChoices(
            { name: 'Weight Loss', value: 'weight_loss' },
            { name: 'Muscle Gain', value: 'muscle_gain' },
            { name: 'Strength', value: 'strength' },
            { name: 'Cardio', value: 'cardio' },
            { name: 'Custom', value: 'custom' },
          ))
        .addNumberOption(opt =>
          opt.setName('target').setDescription('Target value').setRequired(true))
        .addNumberOption(opt =>
          opt.setName('current').setDescription('Starting/current value'))
        .addStringOption(opt =>
          opt.setName('unit').setDescription('Unit (e.g., lbs, km, reps)'))
        .addIntegerOption(opt =>
          opt.setName('days').setDescription('Days until deadline')))
    .addSubcommand(sub =>
      sub.setName('update')
        .setDescription('Update progress on a goal')
        .addIntegerOption(opt =>
          opt.setName('id').setDescription('Goal ID').setRequired(true))
        .addNumberOption(opt =>
          opt.setName('value').setDescription('New current value').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View your goals')
        .addUserOption(opt =>
          opt.setName('user').setDescription('View another user\'s goals')))
    .addSubcommand(sub =>
      sub.setName('complete')
        .setDescription('Mark a goal as complete')
        .addIntegerOption(opt =>
          opt.setName('id').setDescription('Goal ID').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'set') {
      const title = interaction.options.getString('title');
      const category = interaction.options.getString('category');
      const target = interaction.options.getNumber('target');
      const current = interaction.options.getNumber('current') || 0;
      const unit = interaction.options.getString('unit') || '';
      const days = interaction.options.getInteger('days');
      const deadline = days ? Math.floor(Date.now() / 1000) + (days * 86400) : null;

      const result = db.prepare(
        'INSERT INTO goals (user_id, guild_id, title, category, target_value, current_value, unit, deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(interaction.user.id, interaction.guildId, title, category, target, current, unit, deadline);

      const pct = Math.round((current / target) * 100);
      const e = new EmbedBuilder()
        .setTitle('🎯 Goal Created')
        .addFields(
          { name: 'Goal', value: title },
          { name: 'Target', value: `${target} ${unit}`, inline: true },
          { name: 'Current', value: `${current} ${unit}`, inline: true },
          { name: 'Progress', value: `${progressBar(current, target)} ${pct}%` },
          { name: 'ID', value: `#${result.lastInsertRowid}`, inline: true },
        )
        .setColor(COLORS.primary)
        .setTimestamp();

      if (deadline) {
        e.addFields({ name: 'Deadline', value: `<t:${deadline}:R>`, inline: true });
      }

      await interaction.reply({ embeds: [e] });

    } else if (sub === 'update') {
      const id = interaction.options.getInteger('id');
      const value = interaction.options.getNumber('value');

      const goal = db.prepare(
        'SELECT * FROM goals WHERE id = ? AND user_id = ? AND guild_id = ?'
      ).get(id, interaction.user.id, interaction.guildId);

      if (!goal) {
        return interaction.reply({ content: 'Goal not found.', ephemeral: true });
      }

      db.prepare('UPDATE goals SET current_value = ? WHERE id = ?').run(value, id);

      const pct = Math.min(100, Math.round((value / goal.target_value) * 100));
      const completed = value >= goal.target_value;

      if (completed) {
        db.prepare('UPDATE goals SET completed = 1 WHERE id = ?').run(id);
      }

      const e = new EmbedBuilder()
        .setTitle(completed ? '🎉 Goal Achieved!' : '📈 Goal Updated')
        .addFields(
          { name: 'Goal', value: goal.title },
          { name: 'Progress', value: `${value} / ${goal.target_value} ${goal.unit}\n${progressBar(value, goal.target_value)} ${pct}%` },
        )
        .setColor(completed ? COLORS.gold : COLORS.success)
        .setTimestamp();

      await interaction.reply({ embeds: [e] });

    } else if (sub === 'list') {
      await interaction.deferReply();
      const target = interaction.options.getUser('user') || interaction.user;

      const goals = db.prepare(
        'SELECT * FROM goals WHERE user_id = ? AND guild_id = ? ORDER BY completed ASC, created_at DESC'
      ).all(target.id, interaction.guildId);

      if (goals.length === 0) {
        return interaction.editReply({
          embeds: [embed('Goals', `No goals set for <@${target.id}>. Use \`/goal set\` to create one!`, COLORS.warning)]
        });
      }

      const e = new EmbedBuilder()
        .setTitle(`🎯 Goals — ${target.displayName}`)
        .setColor(COLORS.primary)
        .setTimestamp();

      for (const g of goals.slice(0, 10)) {
        const pct = Math.min(100, Math.round((g.current_value / g.target_value) * 100));
        const status = g.completed ? '✅' : '🔄';
        let value = `${status} ${g.current_value} / ${g.target_value} ${g.unit}\n${progressBar(g.current_value, g.target_value)} ${pct}%`;
        if (g.deadline) value += `\nDeadline: <t:${g.deadline}:R>`;
        e.addFields({ name: `#${g.id} — ${g.title}`, value });
      }

      await interaction.editReply({ embeds: [e] });

    } else if (sub === 'complete') {
      const id = interaction.options.getInteger('id');
      const goal = db.prepare(
        'SELECT * FROM goals WHERE id = ? AND user_id = ? AND guild_id = ?'
      ).get(id, interaction.user.id, interaction.guildId);

      if (!goal) {
        return interaction.reply({ content: 'Goal not found.', ephemeral: true });
      }

      db.prepare('UPDATE goals SET completed = 1, current_value = target_value WHERE id = ?').run(id);

      await interaction.reply({
        embeds: [embed('🎉 Goal Complete!', `**${goal.title}** has been marked as complete!`, COLORS.gold)]
      });
    }
  },
};
