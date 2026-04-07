const { SlashCommandBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { checkAndUpdatePR } = require('../../services/prService');
const { updateStreak } = require('../../services/streakService');
const { successEmbed, publishButton, COLORS } = require('../../utils/helpers');
const { checkMilestones } = require('../../services/roleRewards');
const { cacheEmbed } = require('../../services/buttonHandler');
const exercises = require('../../data/exercises');

const WORKOUT_CATEGORIES = ['Strength', 'Cardio', 'Flexibility', 'Sport', 'Other'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log')
    .setDescription('Log a workout exercise')
    .addStringOption(opt =>
      opt.setName('exercise').setDescription('Exercise name').setRequired(true).setAutocomplete(true))
    .addIntegerOption(opt =>
      opt.setName('sets').setDescription('Number of sets').setRequired(true).setMinValue(1).setMaxValue(100))
    .addIntegerOption(opt =>
      opt.setName('reps').setDescription('Reps per set').setRequired(true).setMinValue(1).setMaxValue(1000))
    .addNumberOption(opt =>
      opt.setName('weight').setDescription('Weight used'))
    .addStringOption(opt =>
      opt.setName('unit').setDescription('Weight unit').addChoices(
        { name: 'lbs', value: 'lbs' },
        { name: 'kg', value: 'kg' },
      ))
    .addStringOption(opt =>
      opt.setName('category').setDescription('Workout category').addChoices(
        ...WORKOUT_CATEGORIES.map(c => ({ name: c, value: c })),
      ))
    .addStringOption(opt =>
      opt.setName('details').setDescription('Workout details (e.g. "3x8 @ 155lbs, felt good")'))
    .addStringOption(opt =>
      opt.setName('notes').setDescription('Optional notes')),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const matches = Object.keys(exercises)
      .filter(e => e.includes(focused))
      .slice(0, 25)
      .map(e => ({ name: e.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' '), value: e }));
    await interaction.respond(matches);
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const exercise = interaction.options.getString('exercise').toLowerCase().trim();
    const sets = interaction.options.getInteger('sets');
    const reps = interaction.options.getInteger('reps');
    const weight = interaction.options.getNumber('weight') || 0;
    const unit = interaction.options.getString('unit') || 'lbs';
    const category = interaction.options.getString('category') || 'Strength';
    const details = interaction.options.getString('details') || null;
    const notes = interaction.options.getString('notes') || null;

    const db = getDb();
    db.prepare(
      'INSERT INTO workouts (user_id, guild_id, exercise, category, sets, reps, weight, weight_unit, details, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(interaction.user.id, interaction.guildId, exercise, category, sets, reps, weight, unit, details, notes);

    const streak = updateStreak(interaction.user.id, interaction.guildId);
    const exerciseTitle = exercise.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

    const fields = [
      `**Exercise:** ${exerciseTitle}`,
      `**Category:** ${category}`,
      `**Sets:** ${sets} x ${reps} reps`,
    ];
    if (weight > 0) fields.push(`**Weight:** ${weight} ${unit}`);
    if (details) fields.push(`**Details:** ${details}`);
    if (notes) fields.push(`**Notes:** ${notes}`);
    fields.push(`**Streak:** ${streak.current} day(s) ${streak.current >= 7 ? '🔥' : ''}`);

    const e = successEmbed('Workout Logged!', fields.join('\n'));

    // Check for PR
    if (weight > 0) {
      const pr = checkAndUpdatePR(interaction.user.id, interaction.guildId, exercise, weight, unit, reps);
      if (pr.isNew) {
        const prMsg = pr.previous
          ? `New PR for **${exerciseTitle}**! ${pr.previous.weight} ${pr.previous.unit} → **${weight} ${unit}** 🏆`
          : `First PR recorded for **${exerciseTitle}**: **${weight} ${unit}** 🏆`;
        e.addFields({ name: '🏆 Personal Record!', value: prMsg });
      }
    }

    // Check for milestone streaks
    const milestoneStreaks = [7, 14, 30, 60, 90, 100, 180, 365];
    if (milestoneStreaks.includes(streak.current)) {
      e.addFields({ name: '🎉 Streak Milestone!', value: `You've worked out ${streak.current} days in a row!` });
    }

    // Check for role reward milestones
    try {
      const newMilestones = await checkMilestones(interaction.user.id, interaction.guildId, interaction.guild);
      for (const ms of newMilestones) {
        e.addFields({ name: '🏅 Milestone Unlocked!', value: `**${ms.name}** — Keep it up!` });
      }
    } catch {}

    // Notify accountability partner
    try {
      const pair = db.prepare(
        'SELECT * FROM accountability_pairs WHERE guild_id = ? AND (user1_id = ? OR user2_id = ?) AND active = 1'
      ).get(interaction.guildId, interaction.user.id, interaction.user.id);
      if (pair) {
        const partnerId = pair.user1_id === interaction.user.id ? pair.user2_id : pair.user1_id;
        await interaction.channel.send(`<@${partnerId}> Your accountability partner just logged **${exerciseTitle}**! Don't fall behind! 💪`);
      }
    } catch {}

    // Cache for publish
    const key = `log|${interaction.user.id}|${Date.now()}`;
    cacheEmbed(key, [e], interaction.guildId);

    await interaction.editReply({
      embeds: [e],
      components: [publishButton(key)],
    });
  },
};
