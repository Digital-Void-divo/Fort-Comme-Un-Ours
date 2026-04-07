const { getDb } = require('./database');
const { todayEpoch, daysBetween } = require('../utils/helpers');

function updateStreak(userId, guildId) {
  const db = getDb();
  const today = todayEpoch();

  let streak = db.prepare(
    'SELECT * FROM streaks WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);

  if (!streak) {
    db.prepare(
      'INSERT INTO streaks (user_id, guild_id, current_streak, longest_streak, last_workout_date) VALUES (?, ?, 1, 1, ?)'
    ).run(userId, guildId, today);
    return { current: 1, longest: 1, isNew: true };
  }

  const daysSince = daysBetween(streak.last_workout_date, today);

  if (daysSince === 0) {
    // Already logged today
    return { current: streak.current_streak, longest: streak.longest_streak, isNew: false };
  }

  let newStreak;
  if (daysSince === 1) {
    // Consecutive day
    newStreak = streak.current_streak + 1;
  } else {
    // Streak broken
    newStreak = 1;
  }

  const newLongest = Math.max(newStreak, streak.longest_streak);

  db.prepare(
    'UPDATE streaks SET current_streak = ?, longest_streak = ?, last_workout_date = ? WHERE user_id = ? AND guild_id = ?'
  ).run(newStreak, newLongest, today, userId, guildId);

  return { current: newStreak, longest: newLongest, isNew: true };
}

function getStreak(userId, guildId) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM streaks WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId) || { current_streak: 0, longest_streak: 0 };
}

module.exports = { updateStreak, getStreak };
