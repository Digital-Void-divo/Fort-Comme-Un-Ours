const { getDb } = require('./database');

function getActiveSession(userId, guildId) {
  return getDb().prepare(
    'SELECT * FROM gym_sessions WHERE user_id = ? AND guild_id = ? AND ended_at IS NULL AND cancelled = 0 ORDER BY started_at DESC LIMIT 1'
  ).get(userId, guildId);
}

function startSession({ userId, guildId, location, sessionType, plannedActivities, isPublic = 1 }) {
  const existing = getActiveSession(userId, guildId);
  if (existing) return { ok: false, reason: 'already_active', session: existing };

  const now = Math.floor(Date.now() / 1000);
  const result = getDb().prepare(
    `INSERT INTO gym_sessions
       (user_id, guild_id, started_at, location, session_type, planned_activities, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, guildId, now, location || null, sessionType || null, plannedActivities || null, isPublic ? 1 : 0);
  return { ok: true, sessionId: result.lastInsertRowid, startedAt: now };
}

function endSession(sessionId, fields = {}) {
  const session = getDb().prepare('SELECT * FROM gym_sessions WHERE id = ?').get(sessionId);
  if (!session) return { ok: false, reason: 'not_found' };
  if (session.ended_at) return { ok: false, reason: 'already_ended', session };

  const now = Math.floor(Date.now() / 1000);
  const duration = now - session.started_at;
  const allowed = [
    'activities', 'intensity', 'mood', 'energy', 'soreness_pre', 'soreness_post',
    'heart_rate_avg', 'heart_rate_max', 'calories_est', 'water_ml', 'notes', 'partner_user_id',
  ];
  const sets = ['ended_at = ?', 'duration_sec = ?'];
  const params = [now, duration];
  for (const key of allowed) {
    if (fields[key] !== undefined && fields[key] !== null) {
      sets.push(`${key} = ?`);
      params.push(fields[key]);
    }
  }
  params.push(sessionId);
  getDb().prepare(`UPDATE gym_sessions SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return { ok: true, sessionId, durationSec: duration };
}

function cancelSession(sessionId) {
  const result = getDb().prepare(
    'UPDATE gym_sessions SET cancelled = 1, ended_at = strftime(\'%s\',\'now\') WHERE id = ? AND ended_at IS NULL'
  ).run(sessionId);
  return result.changes > 0;
}

function getSession(sessionId) {
  return getDb().prepare('SELECT * FROM gym_sessions WHERE id = ?').get(sessionId);
}

function getRecent(userId, guildId, limit = 10) {
  return getDb().prepare(
    'SELECT * FROM gym_sessions WHERE user_id = ? AND guild_id = ? AND cancelled = 0 ORDER BY started_at DESC LIMIT ?'
  ).all(userId, guildId, limit);
}

// Active sessions running >4h that haven't sent a "still in the gym?" reminder
function staleActive(thresholdSec = 4 * 3600) {
  const cutoff = Math.floor(Date.now() / 1000) - thresholdSec;
  return getDb().prepare(
    'SELECT * FROM gym_sessions WHERE ended_at IS NULL AND cancelled = 0 AND reminder_sent = 0 AND started_at <= ?'
  ).all(cutoff);
}

function markReminderSent(sessionId) {
  getDb().prepare('UPDATE gym_sessions SET reminder_sent = 1 WHERE id = ?').run(sessionId);
}

function summary(userId, guildId, sinceEpoch) {
  return getDb().prepare(
    `SELECT COUNT(*) as count,
            COALESCE(SUM(duration_sec), 0) as total_sec,
            COALESCE(AVG(intensity), 0) as avg_intensity,
            COALESCE(SUM(calories_est), 0) as total_cal
       FROM gym_sessions
      WHERE user_id = ? AND guild_id = ? AND cancelled = 0 AND ended_at IS NOT NULL AND started_at >= ?`
  ).get(userId, guildId, sinceEpoch);
}

module.exports = {
  getActiveSession,
  startSession,
  endSession,
  cancelSession,
  getSession,
  getRecent,
  staleActive,
  markReminderSent,
  summary,
};
