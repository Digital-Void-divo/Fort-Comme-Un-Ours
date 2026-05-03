const { getDb } = require('./database');

const KG_PER_LB = 0.453592;

function toLbs(weight, unit) {
  if (weight === null || weight === undefined) return 0;
  return unit === 'kg' ? weight / KG_PER_LB : weight;
}

function distanceToMeters(distance, unit) {
  if (distance === null || distance === undefined) return 0;
  switch ((unit || '').toLowerCase()) {
    case 'km': return distance * 1000;
    case 'mi': case 'mile': case 'miles': return distance * 1609.344;
    case 'm': case 'meter': case 'meters': return distance;
    case 'in': case 'inch': case 'inches': return distance * 0.0254;
    case 'ft': case 'foot': case 'feet': return distance * 0.3048;
    case 'cm': return distance / 100;
    default: return distance;
  }
}

// Comparable score for "is this a new record?"
function comparableScore(pr) {
  switch (pr.record_type) {
    case 'weight':   return toLbs(pr.weight, pr.weight_unit);
    case 'reps':     return pr.reps || 0;
    case 'duration': return pr.duration_sec || 0;
    case 'distance': return distanceToMeters(pr.distance, pr.distance_unit);
    case 'time':     return pr.time_sec || 0; // lower is better — caller compares
    default:         return pr.value || 0;
  }
}

// Lower score wins for time-based records, higher wins for everything else.
function isBetter(candidate, incumbent) {
  if (!incumbent) return true;
  const a = comparableScore(candidate);
  const b = comparableScore(incumbent);
  return candidate.record_type === 'time' ? a < b : a > b;
}

function bestApproved(userId, guildId, exercise) {
  const rows = getDb().prepare(
    `SELECT * FROM personal_records
      WHERE user_id = ? AND guild_id = ? AND exercise = ? AND status = 'approved'`
  ).all(userId, guildId, exercise);
  let best = null;
  for (const r of rows) if (isBetter(r, best)) best = r;
  return best;
}

function getUserPRs(userId, guildId, status = 'approved') {
  return getDb().prepare(
    `SELECT * FROM personal_records
      WHERE user_id = ? AND guild_id = ? AND status = ?
      ORDER BY exercise`
  ).all(userId, guildId, status);
}

// Returns one row per exercise — the current best (highest score, or lowest for time).
function currentBests(userId, guildId) {
  const rows = getUserPRs(userId, guildId, 'approved');
  const byEx = new Map();
  for (const r of rows) {
    const cur = byEx.get(r.exercise);
    if (isBetter(r, cur)) byEx.set(r.exercise, r);
  }
  return [...byEx.values()].sort((a, b) => a.exercise.localeCompare(b.exercise));
}

function createPending(prData) {
  const result = getDb().prepare(
    `INSERT INTO personal_records
       (user_id, guild_id, exercise, record_type, weight, weight_unit, reps,
        duration_sec, distance, distance_unit, time_sec, value, value_unit,
        evidence_url, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(
    prData.userId, prData.guildId, prData.exercise.toLowerCase().trim(),
    prData.recordType || 'weight',
    prData.weight ?? null, prData.weightUnit ?? null, prData.reps ?? null,
    prData.durationSec ?? null, prData.distance ?? null, prData.distanceUnit ?? null,
    prData.timeSec ?? null, prData.value ?? null, prData.valueUnit ?? null,
    prData.evidenceUrl ?? null, prData.notes ?? null,
  );
  return result.lastInsertRowid;
}

function getById(id) {
  return getDb().prepare('SELECT * FROM personal_records WHERE id = ?').get(id);
}

function approve(id, validatorId) {
  const pr = getById(id);
  if (!pr || pr.status !== 'pending') return { ok: false, reason: 'not_pending' };

  const previous = bestApproved(pr.user_id, pr.guild_id, pr.exercise);
  const isImprovement = isBetter(pr, previous);

  getDb().prepare(
    `UPDATE personal_records
        SET status = 'approved', validator_id = ?, validated_at = strftime('%s','now'),
            superseded_pr_id = ?
      WHERE id = ?`
  ).run(validatorId, previous && isImprovement ? previous.id : null, id);

  return { ok: true, isImprovement, previous };
}

function reject(id, validatorId, reason) {
  const pr = getById(id);
  if (!pr || pr.status !== 'pending') return { ok: false, reason: 'not_pending' };
  getDb().prepare(
    `UPDATE personal_records
        SET status = 'rejected', validator_id = ?, validated_at = strftime('%s','now'),
            rejection_reason = ?
      WHERE id = ?`
  ).run(validatorId, reason || null, id);
  return { ok: true };
}

function setValidationMessages(id, mapping) {
  getDb().prepare('UPDATE personal_records SET validation_message_ids = ? WHERE id = ?')
    .run(JSON.stringify(mapping), id);
}

function pendingFor(validatorId, guildId) {
  return getDb().prepare(
    `SELECT pr.*
       FROM personal_records pr
       JOIN accountability_pairs ap
         ON ap.guild_id = pr.guild_id AND ap.status = 'active' AND ap.active = 1
        AND ((ap.user1_id = pr.user_id AND ap.user2_id = ?) OR
             (ap.user2_id = pr.user_id AND ap.user1_id = ?))
      WHERE pr.guild_id = ? AND pr.status = 'pending'
      ORDER BY pr.created_at DESC`
  ).all(validatorId, validatorId, guildId);
}

module.exports = {
  bestApproved,
  currentBests,
  getUserPRs,
  createPending,
  getById,
  approve,
  reject,
  setValidationMessages,
  pendingFor,
  comparableScore,
};
