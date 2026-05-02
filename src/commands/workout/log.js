const { SlashCommandBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const prService = require('../../services/prService');
const { updateStreak } = require('../../services/streakService');
const sessions = require('../../services/sessionService');
const buddies = require('../../services/buddyService');
const privacy = require('../../services/privacyService');
const audit = require('../../services/auditService');
const { successEmbed, publishButton, safeDM } = require('../../utils/helpers');
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
    try {
      const focused = interaction.options.getFocused().toLowerCase();
      const matches = Object.keys(exercises)
        .filter(e => e.includes(focused))
        .slice(0, 25)
        .map(e => ({ name: e.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' '), value: e }));
      await interaction.respond(matches);
    } catch (err) {
      console.error('Autocomplete failed:', err.message);
    }
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
    // Auto-link to active session if any.
    const activeSession = sessions.getActiveSession(interaction.user.id, interaction.guildId);
    db.prepare(
      'INSERT INTO workouts (user_id, guild_id, exercise, category, sets, reps, weight, weight_unit, details, notes, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(interaction.user.id, interaction.guildId, exercise, category, sets, reps, weight, unit, details, notes, activeSession?.id || null);
    audit.log(interaction.guildId, interaction.user.id, 'workout.log', { exercise, sets, reps, weight, sessionId: activeSession?.id });

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
    if (activeSession) fields.push(`**Session:** linked to active session #${activeSession.id}`);

    const e = successEmbed('Workout Logged!', fields.join('\n'));

    // PR suggestion: if heavier than current approved best, suggest /pr submit (no auto self-attest).
    if (weight > 0) {
      const best = prService.bestApproved(interaction.user.id, interaction.guildId, exercise);
      const bestLbs = best ? (best.weight_unit === 'kg' ? best.weight / 0.453592 : best.weight) : 0;
      const newLbs = unit === 'kg' ? weight / 0.453592 : weight;
      if (newLbs > bestLbs) {
        e.addFields({
          name: '🏆 Possible PR',
          value: best
            ? `That beats your validated best of ${best.weight} ${best.weight_unit} × ${best.reps}. Use \`/pr submit\` to have a buddy validate it.`
            : 'No validated PR yet for this lift. Use `/pr submit` to log this for buddy validation.',
        });
      }
    }

    // Streak milestones
    const milestoneStreaks = [7, 14, 30, 60, 90, 100, 180, 365];
    if (milestoneStreaks.includes(streak.current)) {
      e.addFields({ name: '🎉 Streak Milestone!', value: `You've worked out ${streak.current} days in a row!` });
    }

    // Shield earned this log?
    if (streak.shieldEarned) {
      e.addFields({
        name: '🛡️ Streak Shield Earned',
        value: `You now have **${streak.shieldsAvailable}** shield(s). One shield will absorb a missed day so your streak survives.`,
      });
    }

    // Role reward milestones
    try {
      const newMilestones = await checkMilestones(interaction.user.id, interaction.guildId, interaction.guild);
      for (const ms of newMilestones) {
        e.addFields({ name: '🏅 Milestone Unlocked!', value: `**${ms.name}** - Keep it up!` });
      }
    } catch (err) {
      console.error('Milestone check failed:', err.message);
    }

    // Notify buddies (multi-buddy, privacy-aware)
    try {
      const senderSettings = privacy.getSettings(interaction.user.id, interaction.guildId);
      if (senderSettings.notifyBuddyOnWorkout) {
        const buddyIds = buddies.getActiveBuddyIds(interaction.user.id, interaction.guildId);
        for (const bid of buddyIds) {
          try {
            const member = await interaction.guild.members.fetch(bid);
            await safeDM(member.user, {
              embeds: [successEmbed(
                'Buddy Workout!',
                `Your accountability buddy **${interaction.user.displayName}** just logged **${exerciseTitle}** (${sets}x${reps}${weight > 0 ? ` @ ${weight}${unit}` : ''}). Don't fall behind! 💪`
              )],
            });
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.error('Buddy notification failed:', err.message);
    }

    const key = `log|${interaction.user.id}|${Date.now()}`;
    cacheEmbed(key, [e], interaction.guildId);

    await interaction.editReply({
      embeds: [e],
      components: [publishButton(key)],
    });
  },
};
