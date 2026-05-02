const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { COLORS, embed, progressBar, publishButton } = require('../../utils/helpers');
const { getStreak } = require('../../services/streakService');
const { cacheEmbed } = require('../../services/buttonHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View or set up your fitness profile')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View a fitness profile')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to view')))
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Set up your fitness profile')
        .addIntegerOption(opt =>
          opt.setName('age').setDescription('Your age').setMinValue(13).setMaxValue(120))
        .addStringOption(opt =>
          opt.setName('gender').setDescription('Biological sex').addChoices(
            { name: 'Male', value: 'male' },
            { name: 'Female', value: 'female' },
          ))
        .addNumberOption(opt =>
          opt.setName('height').setDescription('Height in cm').setMinValue(50).setMaxValue(300))
        .addStringOption(opt =>
          opt.setName('activity').setDescription('Activity level').addChoices(
            { name: 'Sedentary', value: 'sedentary' },
            { name: 'Light', value: 'light' },
            { name: 'Moderate', value: 'moderate' },
            { name: 'Active', value: 'active' },
            { name: 'Very Active', value: 'very_active' },
          ))
        .addStringOption(opt =>
          opt.setName('units').setDescription('Preferred unit system').addChoices(
            { name: 'Imperial (lbs/in)', value: 'imperial' },
            { name: 'Metric (kg/cm)', value: 'metric' },
          ))
        .addIntegerOption(opt =>
          opt.setName('water_goal').setDescription('Daily water goal in ml (default 2500)').setMinValue(500).setMaxValue(10000))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'setup') {
      const age = interaction.options.getInteger('age');
      const gender = interaction.options.getString('gender');
      const height = interaction.options.getNumber('height');
      const activity = interaction.options.getString('activity');
      const units = interaction.options.getString('units');
      const waterGoal = interaction.options.getInteger('water_goal');

      db.prepare(`
        INSERT INTO user_profiles (user_id, guild_id, age, gender, height_cm, activity_level, measurement_unit, water_goal_ml)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, guild_id) DO UPDATE SET
          age = COALESCE(excluded.age, user_profiles.age),
          gender = COALESCE(excluded.gender, user_profiles.gender),
          height_cm = COALESCE(excluded.height_cm, user_profiles.height_cm),
          activity_level = COALESCE(excluded.activity_level, user_profiles.activity_level),
          measurement_unit = COALESCE(excluded.measurement_unit, user_profiles.measurement_unit),
          water_goal_ml = COALESCE(excluded.water_goal_ml, user_profiles.water_goal_ml)
      `).run(interaction.user.id, interaction.guildId, age, gender, height, activity, units, waterGoal);

      await interaction.reply({
        embeds: [embed('✅ Profile Updated', 'Your fitness profile has been updated!', COLORS.success)],
        ephemeral: true,
      });

    } else if (sub === 'view') {
      await interaction.deferReply({ ephemeral: true });
      const target = interaction.options.getUser('user') || interaction.user;

      // Privacy check
      const privacy = require('../../services/privacyService');
      if (!privacy.canViewer(interaction.user.id, target.id, interaction.guildId, 'profile')) {
        return interaction.editReply({ content: privacy.denyMessage() });
      }

      const profile = db.prepare(
        'SELECT * FROM user_profiles WHERE user_id = ? AND guild_id = ?'
      ).get(target.id, interaction.guildId);

      const streak = getStreak(target.id, interaction.guildId);
      const weekAgo = Math.floor(Date.now() / 1000) - 604800;

      const workoutCount = db.prepare(
        'SELECT COUNT(*) as count FROM workouts WHERE user_id = ? AND guild_id = ?'
      ).get(target.id, interaction.guildId);

      const weekWorkouts = db.prepare(
        'SELECT COUNT(*) as count FROM workouts WHERE user_id = ? AND guild_id = ? AND created_at >= ?'
      ).get(target.id, interaction.guildId, weekAgo);

      const prCount = db.prepare(
        'SELECT COUNT(*) as count FROM personal_records WHERE user_id = ? AND guild_id = ?'
      ).get(target.id, interaction.guildId);

      const goalCount = db.prepare(
        'SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as done FROM goals WHERE user_id = ? AND guild_id = ?'
      ).get(target.id, interaction.guildId);

      const latestWeight = db.prepare(
        "SELECT value, unit FROM body_stats WHERE user_id = ? AND guild_id = ? AND type = 'weight' ORDER BY created_at DESC LIMIT 1"
      ).get(target.id, interaction.guildId);

      const e = new EmbedBuilder()
        .setTitle(`💪 Fitness Profile - ${target.displayName}`)
        .setThumbnail(target.displayAvatarURL())
        .setColor(COLORS.primary)
        .addFields(
          { name: 'Total Workouts', value: `${workoutCount.count}`, inline: true },
          { name: 'This Week', value: `${weekWorkouts.count}`, inline: true },
          { name: 'PRs', value: `${prCount.count}`, inline: true },
          { name: 'Current Streak', value: `${streak.current_streak} day(s) ${streak.current_streak >= 7 ? '🔥' : ''}`, inline: true },
          { name: 'Longest Streak', value: `${streak.longest_streak} day(s)`, inline: true },
          { name: 'Goals', value: `${goalCount.done || 0}/${goalCount.total || 0} complete`, inline: true },
        )
        .setTimestamp();

      if (latestWeight) {
        e.addFields({ name: 'Current Weight', value: `${latestWeight.value} ${latestWeight.unit}`, inline: true });
      }

      if (profile) {
        const details = [];
        if (profile.age) details.push(`Age: ${profile.age}`);
        if (profile.height_cm) details.push(`Height: ${profile.height_cm}cm`);
        if (profile.activity_level) details.push(`Activity: ${profile.activity_level}`);
        if (details.length > 0) {
          e.addFields({ name: 'Profile', value: details.join(' | ') });
        }
      }

      const key = `profile|${target.id}|${Date.now()}`;
      cacheEmbed(key, [e], interaction.guildId);
      await interaction.editReply({ embeds: [e], components: [publishButton(key)] });
    }
  },
};
