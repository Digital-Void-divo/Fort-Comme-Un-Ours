const { getDb } = require('./database');

function checkAndUpdatePR(userId, guildId, exercise, weight, weightUnit, reps) {
  const db = getDb();
  const normalizedExercise = exercise.toLowerCase().trim();

  const existing = db.prepare(
    'SELECT * FROM personal_records WHERE user_id = ? AND guild_id = ? AND exercise = ?'
  ).get(userId, guildId, normalizedExercise);

  // Normalize to lbs for comparison
  const weightInLbs = weightUnit === 'kg' ? weight * 2.20462 : weight;
  const existingInLbs = existing
    ? (existing.weight_unit === 'kg' ? existing.weight * 2.20462 : existing.weight)
    : 0;

  if (!existing || weightInLbs > existingInLbs) {
    db.prepare(`
      INSERT INTO personal_records (user_id, guild_id, exercise, weight, weight_unit, reps, created_at)
      VALUES (?, ?, ?, ?, ?, ?, strftime('%s','now'))
      ON CONFLICT(user_id, guild_id, exercise) DO UPDATE SET
        weight = excluded.weight,
        weight_unit = excluded.weight_unit,
        reps = excluded.reps,
        created_at = strftime('%s','now')
    `).run(userId, guildId, normalizedExercise, weight, weightUnit, reps);

    return {
      isNew: true,
      previous: existing ? { weight: existing.weight, unit: existing.weight_unit } : null,
      current: { weight, unit: weightUnit },
    };
  }

  return { isNew: false };
}

function getUserPRs(userId, guildId) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM personal_records WHERE user_id = ? AND guild_id = ? ORDER BY exercise'
  ).all(userId, guildId);
}

module.exports = { checkAndUpdatePR, getUserPRs };
