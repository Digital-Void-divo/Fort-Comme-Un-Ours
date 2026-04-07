const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { COLORS, embed, progressBar, publishButton } = require('../../utils/helpers');
const { cacheEmbed } = require('../../services/buttonHandler');

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
        .addStringOption(opt =>
          opt.setName('direction').setDescription('Goal direction').addChoices(
            { name: 'Increase (e.g., lift more)', value: 'increase' },
            { name: 'Decrease (e.g., lose weight)', value: 'decrease' },
          ))
        .addNumberOption(opt =>
          opt.setName('current').setDescription('Starting/current value'))
        .addStringOption(opt =>
          opt.setName('unit').setDescription('Unit (e.g., lbs, km, reps)'))
        .addIntegerOption(opt =>
          opt.setName('days').setDescription('Days until deadline'))
        .addIntegerOption(opt =>
          opt.setName('milestone_pct').setDescription('Announce milestones every N% (e.g., 25)').setMinValue(5).setMaxValue(50)))
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
          opt.setName('id').setDescription('Goal ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a goal')
        .addIntegerOption(opt =>
          opt.setName('id').setDescription('Goal ID').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'set') {
      const title = interaction.options.getString('title');
      const category = interaction.options.getString('category');
      const target = interaction.options.getNumber('target');
      const direction = interaction.options.getString('direction') || 'increase';
      const current = interaction.options.getNumber('current') || 0;
      const unit = interaction.options.getString('unit') || '';
      const days = interaction.options.getInteger('days');
      const milestonePct = interaction.options.getInteger('milestone_pct') || null;
      const deadline = days ? Math.floor(Date.now() / 1000) + (days * 86400) : null;

      const result = db.prepare(
        'INSERT INTO goals (user_id, guild_id, title, category, target_value, current_value, unit, direction, milestone_pct, deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(interaction.user.id, interaction.guildId, title, category, target, current, unit, direction, milestonePct, deadline);

      const pct = Math.round((current / target) * 100);
      const dirIcon = direction === 'decrease' ? '📉' : '📈';
      const e = new EmbedBuilder()
        .setTitle('🎯 Goal Created')
        .addFields(
          { name: 'Goal', value: title },
          { name: 'Direction', value: `${dirIcon} ${direction}`, inline: true },
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
      if (milestonePct) {
        e.addFields({ name: 'Milestones', value: `Every ${milestonePct}%`, inline: true });
      }

      await interaction.reply({ embeds: [e], ephemeral: true });

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

      const pct = goal.target_value > 0 ? Math.min(100, Math.round((value / goal.target_value) * 100)) : 0;

      // Check direction-based completion
      const completed = goal.direction === 'decrease'
        ? value <= goal.target_value
        : value >= goal.target_value;

      if (completed) {
        db.prepare('UPDATE goals SET completed = 1 WHERE id = ?').run(id);
      }

      // Check milestone announcements
      const milestoneEvents = [];
      if (goal.milestone_pct && !completed) {
        const announced = JSON.parse(goal.milestones_announced || '[]');
        const totalDelta = Math.abs(goal.target_value - (goal.current_value || 0));
        if (totalDelta > 0) {
          const progress = goal.direction === 'decrease'
            ? (goal.current_value || 0) - value
            : value - (goal.current_value || 0);
          // Check from baseline, not just current increment
          const baseVal = goal.direction === 'decrease' ? goal.current_value : 0;
          const totalRange = Math.abs(goal.target_value - baseVal);
          if (totalRange > 0) {
            const currentProgress = goal.direction === 'decrease'
              ? baseVal - value
              : value - baseVal;
            const progressPct = (Math.max(0, currentProgress) / totalRange) * 100;
            let thresh = goal.milestone_pct;
            while (thresh < 100) {
              if (progressPct >= thresh && !announced.includes(thresh)) {
                announced.push(thresh);
                milestoneEvents.push(thresh);
              }
              thresh += goal.milestone_pct;
            }
            if (milestoneEvents.length > 0) {
              db.prepare('UPDATE goals SET milestones_announced = ? WHERE id = ?')
                .run(JSON.stringify(announced), id);
            }
          }
        }
      }

      const e = new EmbedBuilder()
        .setTitle(completed ? '🎉 Goal Achieved!' : '📈 Goal Updated')
        .addFields(
          { name: 'Goal', value: goal.title },
          { name: 'Progress', value: `${value} / ${goal.target_value} ${goal.unit}\n${progressBar(value, goal.target_value)} ${pct}%` },
        )
        .setColor(completed ? COLORS.gold : COLORS.success)
        .setTimestamp();

      if (milestoneEvents.length > 0) {
        e.addFields({
          name: '🎉 Milestone Hit!',
          value: milestoneEvents.map(p => `**${p}%** of the way there!`).join('\n'),
        });
      }

      const key = `goal|${interaction.user.id}|${Date.now()}`;
      cacheEmbed(key, [e], interaction.guildId);

      await interaction.reply({
        embeds: [e],
        components: [publishButton(key)],
        ephemeral: true,
      });

    } else if (sub === 'list') {
      await interaction.deferReply({ ephemeral: true });
      const target = interaction.options.getUser('user') || interaction.user;

      // Privacy check
      if (target.id !== interaction.user.id) {
        const profile = db.prepare('SELECT is_public FROM user_profiles WHERE user_id = ? AND guild_id = ?')
          .get(target.id, interaction.guildId);
        if (profile && !profile.is_public) {
          return interaction.editReply({ content: 'This user\'s profile is private.' });
        }
      }

      const goals = db.prepare(
        'SELECT * FROM goals WHERE user_id = ? AND guild_id = ? ORDER BY completed ASC, created_at DESC'
      ).all(target.id, interaction.guildId);

      if (goals.length === 0) {
        return interaction.editReply({
          embeds: [embed('Goals', `No goals set for <@${target.id}>. Use \`/goal set\` to create one!`, COLORS.warning)]
        });
      }

      const e = new EmbedBuilder()
        .setTitle(`🎯 Goals - ${target.displayName}`)
        .setColor(COLORS.primary)
        .setTimestamp();

      for (const g of goals.slice(0, 10)) {
        const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0;
        const status = g.completed ? '✅' : '🔄';
        const dirIcon = g.direction === 'decrease' ? '📉' : '📈';
        let value = `${status} ${dirIcon} ${g.current_value} / ${g.target_value} ${g.unit}\n${progressBar(g.current_value, g.target_value)} ${pct}%`;
        if (g.deadline) value += `\nDeadline: <t:${g.deadline}:R>`;
        if (g.milestone_pct) {
          const announced = JSON.parse(g.milestones_announced || '[]');
          if (announced.length > 0) value += `\nMilestones: ${announced.map(p => `${p}%`).join(', ')}`;
        }
        e.addFields({ name: `#${g.id} - ${g.title}`, value });
      }

      const key = `goals|${target.id}|${Date.now()}`;
      cacheEmbed(key, [e], interaction.guildId);

      await interaction.editReply({
        embeds: [e],
        components: [publishButton(key)],
      });

    } else if (sub === 'complete') {
      const id = interaction.options.getInteger('id');
      const goal = db.prepare(
        'SELECT * FROM goals WHERE id = ? AND user_id = ? AND guild_id = ?'
      ).get(id, interaction.user.id, interaction.guildId);

      if (!goal) {
        return interaction.reply({ content: 'Goal not found.', ephemeral: true });
      }

      db.prepare('UPDATE goals SET completed = 1, current_value = target_value WHERE id = ?').run(id);

      const e = embed('🎉 Goal Complete!', `**${goal.title}** has been marked as complete!`, COLORS.gold);
      const key = `goalc|${interaction.user.id}|${Date.now()}`;
      cacheEmbed(key, [e], interaction.guildId);

      await interaction.reply({
        embeds: [e],
        components: [publishButton(key)],
        ephemeral: true,
      });

    } else if (sub === 'delete') {
      const id = interaction.options.getInteger('id');
      const result = db.prepare(
        'DELETE FROM goals WHERE id = ? AND user_id = ? AND guild_id = ?'
      ).run(id, interaction.user.id, interaction.guildId);

      if (result.changes === 0) {
        return interaction.reply({ content: 'Goal not found.', ephemeral: true });
      }

      await interaction.reply({
        embeds: [embed('🗑️ Goal Deleted', `Goal #${id} has been removed.`, COLORS.warning)],
        ephemeral: true,
      });
    }
  },
};
