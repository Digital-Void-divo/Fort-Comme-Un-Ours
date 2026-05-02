const { getDb } = require('./database');
const { todayEpoch, daysBetween } = require('../utils/helpers');

// Shields are awarded every 14 days of an active streak. They absorb missed
// days so the streak survives — one shield per missed day.
const SHIELD_AWARD_INTERVAL = 14;
const MAX_SHIELDS = 3;

function ensureRow(db, userId, guildId) {
  db.prepare(
    'INSERT OR IGNORE INTO streaks (user_id, guild_id, current_streak, longest_streak, last_workout_date) VALUES (?, ?, 0, 0, 0)'
  ).run(userId, guildId);
}

function isRestDay(db, userId, guildId, dayEpoch) {
  return !!db.prepare(
    'SELECT 1 FROM rest_days WHERE user_id = ? AND guild_id = ? AND day_epoch = ?'
  ).get(userId, guildId, dayEpoch);
}

function updateStreak(userId, guildId) {
  const db = getDb();
  const today = todayEpoch();

  return db.transaction(() => {
    ensureRow(db, userId, guildId);
    const row = db.prepare(
      'SELECT * FROM streaks WHERE user_id = ? AND guild_id = ?'
    ).get(userId, guildId);

    if (row.last_workout_date === today) {
      return {
        current: row.current_streak,
        longest: row.longest_streak,
        isNew: false,
        shieldsAvailable: row.shields_available,
        shieldEarned: false,
      };
    }

    let newStreak;
    let shieldsAvailable = row.shields_available || 0;

    if (row.last_workout_date === 0) {
      newStreak = 1;
    } else {
      const gap = daysBetween(row.last_workout_date, today);
      if (gap === 1) {
        newStreak = row.current_streak + 1;
      } else {
        // Count missed days (excluding rest days)
        let missed = 0;
        for (let d = row.last_workout_date + 86400; d < today; d += 86400) {
          if (!isRestDay(db, userId, guildId, d)) missed += 1;
        }
        if (missed === 0) {
          newStreak = row.current_streak + 1;
        } else if (shieldsAvailable >= missed) {
          shieldsAvailable -= missed;
          db.prepare('UPDATE streaks SET shields_used_total = shields_used_total + ? WHERE user_id = ? AND guild_id = ?')
            .run(missed, userId, guildId);
          newStreak = row.current_streak + 1;
        } else {
          newStreak = 1;
          shieldsAvailable = 0;
        }
      }
    }

    let shieldEarned = false;
    let lastAward = row.last_shield_award_streak || 0;
    while (
      newStreak >= lastAward + SHIELD_AWARD_INTERVAL &&
      shieldsAvailable < MAX_SHIELDS
    ) {
      shieldsAvailable += 1;
      lastAward += SHIELD_AWARD_INTERVAL;
      shieldEarned = true;
    }
    // Even if shields capped, advance the marker so we don't re-evaluate forever.
    if (newStreak >= lastAward + SHIELD_AWARD_INTERVAL) {
      lastAward = Math.floor(newStreak / SHIELD_AWARD_INTERVAL) * SHIELD_AWARD_INTERVAL;
    }

    const newLongest = Math.max(newStreak, row.longest_streak);

    db.prepare(
      `UPDATE streaks
          SET current_streak = ?, longest_streak = ?, last_workout_date = ?,
              shields_available = ?, last_shield_award_streak = ?,
              shields_earned_total = shields_earned_total + ?
        WHERE user_id = ? AND guild_id = ?`
    ).run(newStreak, newLongest, today, shieldsAvailable, lastAward, shieldEarned ? 1 : 0, userId, guildId);

    return {
      current: newStreak, longest: newLongest, isNew: true,
      shieldsAvailable, shieldEarned,
    };
  })();
}

function getStreak(userId, guildId) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM streaks WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId) || {
    current_streak: 0, longest_streak: 0, shields_available: 0,
    shields_earned_total: 0, shields_used_total: 0,
  };
}

module.exports = { updateStreak, getStreak, SHIELD_AWARD_INTERVAL, MAX_SHIELDS };
