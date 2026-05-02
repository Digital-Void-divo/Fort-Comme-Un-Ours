const { getDb } = require('./database');

function log(guildId, userId, action, details = null) {
  try {
    const detailsStr = details === null || typeof details === 'string'
      ? details
      : JSON.stringify(details);
    getDb().prepare(
      'INSERT INTO audit_log (guild_id, user_id, action, details) VALUES (?, ?, ?, ?)'
    ).run(guildId || 'system', userId || 'system', action, detailsStr);
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

function recent(guildId, limit = 50) {
  return getDb().prepare(
    'SELECT * FROM audit_log WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(guildId, limit);
}

module.exports = { log, recent };
