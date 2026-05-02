const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { COLORS, progressBar, todayEpoch, publishButton } = require('../../utils/helpers');
const { cacheEmbed } = require('../../services/buttonHandler');
const { getStreak } = require('../../services/streakService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Quick fitness summary')
    .addStringOption(opt =>
      opt.setName('period').setDescription('Time period').addChoices(
        { name: 'This Week', value: 'week' },
        { name: 'This Month', value: 'month' },
        { name: 'All Time', value: 'all' },
      ))
    .addUserOption(opt =>
      opt.setName('user').setDescription('View another user\'s stats')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const period = interaction.options.getString('period') || 'week';
    const target = interaction.options.getUser('user') || interaction.user;
    const db = getDb();

    // Privacy check
    const privacy = require('../../services/privacyService');
    if (!privacy.canViewer(interaction.user.id, target.id, interaction.guildId, 'profile')) {
      return interaction.editReply({ content: privacy.denyMessage() });
    }

    const now = Math.floor(Date.now() / 1000);
    const since = period === 'week' ? now - 604800
      : period === 'month' ? now - 2592000
      : 0;
    const periodLabel = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time';

    const userId = target.id;
    const guildId = interaction.guildId;

    // Workouts
    const workouts = db.prepare(
      'SELECT COUNT(*) as count, COUNT(DISTINCT exercise) as exercises FROM workouts WHERE user_id = ? AND guild_id = ? AND created_at >= ?'
    ).get(userId, guildId, since);

    // Total volume
    const volume = db.prepare(
      'SELECT COALESCE(SUM(sets * reps * weight), 0) as total FROM workouts WHERE user_id = ? AND guild_id = ? AND created_at >= ? AND weight > 0'
    ).get(userId, guildId, since);

    // Streak
    const streak = getStreak(userId, guildId);

    // PRs set in this period
    const prs = db.prepare(
      'SELECT COUNT(*) as count FROM personal_records WHERE user_id = ? AND guild_id = ? AND created_at >= ?'
    ).get(userId, guildId, since);

    // Water
    const water = db.prepare(
      'SELECT COALESCE(SUM(amount_ml), 0) as total, COUNT(DISTINCT date(created_at, \'unixepoch\')) as days FROM water_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ?'
    ).get(userId, guildId, since);
    const avgWater = water.days > 0 ? Math.round(water.total / water.days) : 0;

    // Nutrition
    const nutrition = db.prepare(
      'SELECT COALESCE(AVG(daily_cal), 0) as avg_cal, COALESCE(AVG(daily_pro), 0) as avg_pro FROM (SELECT SUM(calories) as daily_cal, SUM(protein) as daily_pro FROM nutrition_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ? GROUP BY date(created_at, \'unixepoch\'))'
    ).get(userId, guildId, since);

    // Sleep
    const sleep = db.prepare(
      'SELECT AVG(hours) as avg_hours, AVG(quality) as avg_quality FROM sleep_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ?'
    ).get(userId, guildId, since);

    // Body weight change
    let weightChange = null;
    if (since > 0) {
      const first = db.prepare(
        "SELECT value, unit FROM body_stats WHERE user_id = ? AND guild_id = ? AND type = 'weight' AND created_at >= ? ORDER BY created_at ASC LIMIT 1"
      ).get(userId, guildId, since);
      const latest = db.prepare(
        "SELECT value, unit FROM body_stats WHERE user_id = ? AND guild_id = ? AND type = 'weight' ORDER BY created_at DESC LIMIT 1"
      ).get(userId, guildId);
      if (first && latest) {
        const diff = latest.value - first.value;
        const sign = diff > 0 ? '+' : '';
        weightChange = `${sign}${diff.toFixed(1)} ${latest.unit}`;
      }
    }

    // Top exercises
    const topExercises = db.prepare(
      'SELECT exercise, COUNT(*) as count FROM workouts WHERE user_id = ? AND guild_id = ? AND created_at >= ? GROUP BY exercise ORDER BY count DESC LIMIT 3'
    ).all(userId, guildId, since);

    // Goals
    const goals = db.prepare(
      'SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as done FROM goals WHERE user_id = ? AND guild_id = ?'
    ).get(userId, guildId);

    // Build embed
    const e = new EmbedBuilder()
      .setTitle(`📊 ${target.displayName} - ${periodLabel}`)
      .setThumbnail(target.displayAvatarURL())
      .setColor(COLORS.primary)
      .setTimestamp();

    // Training section
    const trainingLines = [
      `**${workouts.count}** workouts · **${workouts.exercises}** exercises`,
      `**${Math.round(volume.total).toLocaleString()} lbs** total volume`,
      `**${prs.count}** PR(s) set`,
    ];
    e.addFields({ name: '🏋️ Training', value: trainingLines.join('\n'), inline: true });

    // Streak + goals
    const streakLines = [
      `**${streak.current_streak}** day streak ${streak.current_streak >= 7 ? '🔥' : ''}`,
      `Best: **${streak.longest_streak}** days`,
      `Goals: **${goals.done || 0}**/**${goals.total || 0}** complete`,
    ];
    e.addFields({ name: '🔥 Consistency', value: streakLines.join('\n'), inline: true });

    e.addFields({ name: '\u200b', value: '\u200b', inline: true });

    // Body
    const bodyLines = [];
    if (weightChange) bodyLines.push(`Weight: **${weightChange}**`);
    if (sleep.avg_hours) bodyLines.push(`Sleep: **${sleep.avg_hours.toFixed(1)}h** avg${sleep.avg_quality ? ` (${sleep.avg_quality.toFixed(1)}/5)` : ''}`);
    if (avgWater > 0) bodyLines.push(`Water: **${avgWater}ml**/day avg`);
    if (bodyLines.length > 0) {
      e.addFields({ name: '📏 Body & Recovery', value: bodyLines.join('\n'), inline: true });
    }

    // Nutrition
    if (nutrition.avg_cal > 0) {
      e.addFields({
        name: '🍽️ Nutrition (daily avg)',
        value: `**${Math.round(nutrition.avg_cal)}** kcal · **${Math.round(nutrition.avg_pro)}g** protein`,
        inline: true,
      });
    }

    // Top exercises
    if (topExercises.length > 0) {
      const top = topExercises.map((t, i) => {
        const name = t.exercise.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
        return `${['🥇', '🥈', '🥉'][i]} ${name} (${t.count}x)`;
      }).join('\n');
      e.addFields({ name: '⭐ Most Trained', value: top });
    }

    const key = `stats|${userId}|${Date.now()}`;
    cacheEmbed(key, [e], guildId);

    await interaction.editReply({
      embeds: [e],
      components: [publishButton(key)],
    });
  },
};
