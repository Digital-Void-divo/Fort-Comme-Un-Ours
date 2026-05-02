const { getDb } = require('./database');

const REQUEST_EXPIRY_SEC = 7 * 86400;

function getActiveBuddies(userId, guildId) {
  return getDb().prepare(
    `SELECT id, user1_id, user2_id, relationship_label, created_at,
            CASE WHEN user1_id = ? THEN user2_id ELSE user1_id END AS partner_id
       FROM accountability_pairs
      WHERE guild_id = ? AND status = 'active' AND active = 1
        AND (user1_id = ? OR user2_id = ?)
      ORDER BY created_at ASC`
  ).all(userId, guildId, userId, userId);
}

function getActiveBuddyIds(userId, guildId) {
  return getActiveBuddies(userId, guildId).map(b => b.partner_id);
}

function getPendingIncoming(userId, guildId) {
  return getDb().prepare(
    `SELECT * FROM accountability_pairs
      WHERE guild_id = ? AND user2_id = ? AND status = 'pending' AND active = 1
      ORDER BY requested_at DESC`
  ).all(guildId, userId);
}

function getPendingOutgoing(userId, guildId) {
  return getDb().prepare(
    `SELECT * FROM accountability_pairs
      WHERE guild_id = ? AND user1_id = ? AND status = 'pending' AND active = 1
      ORDER BY requested_at DESC`
  ).all(guildId, userId);
}

function getById(id) {
  return getDb().prepare('SELECT * FROM accountability_pairs WHERE id = ?').get(id);
}

function findExisting(guildId, userA, userB) {
  return getDb().prepare(
    `SELECT * FROM accountability_pairs
      WHERE guild_id = ?
        AND ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))
      ORDER BY id DESC LIMIT 1`
  ).get(guildId, userA, userB, userB, userA);
}

function createRequest(guildId, requesterId, targetId, label = null) {
  const now = Math.floor(Date.now() / 1000);
  const existing = findExisting(guildId, requesterId, targetId);
  if (existing && (existing.status === 'active' || existing.status === 'pending')) {
    return { ok: false, reason: existing.status === 'active' ? 'already_active' : 'already_pending', existing };
  }

  // Re-use the row if previously declined/removed; otherwise insert new.
  if (existing) {
    getDb().prepare(
      `UPDATE accountability_pairs
          SET user1_id = ?, user2_id = ?, status = 'pending', active = 1,
              relationship_label = ?, requested_at = ?, responded_at = NULL,
              dm_message_id = NULL, dm_channel_id = NULL
        WHERE id = ?`
    ).run(requesterId, targetId, label, now, existing.id);
    return { ok: true, id: existing.id };
  }

  try {
    const result = getDb().prepare(
      `INSERT INTO accountability_pairs
         (guild_id, user1_id, user2_id, status, active, relationship_label, requested_at)
       VALUES (?, ?, ?, 'pending', 1, ?, ?)`
    ).run(guildId, requesterId, targetId, label, now);
    return { ok: true, id: result.lastInsertRowid };
  } catch (err) {
    return { ok: false, reason: 'db_error', error: err.message };
  }
}

function attachDmInfo(pairId, channelId, messageId) {
  getDb().prepare(
    'UPDATE accountability_pairs SET dm_channel_id = ?, dm_message_id = ? WHERE id = ?'
  ).run(channelId, messageId, pairId);
}

function findByDmMessage(messageId) {
  return getDb().prepare(
    `SELECT * FROM accountability_pairs WHERE dm_message_id = ? AND status = 'pending' AND active = 1`
  ).get(messageId);
}

function accept(pairId) {
  const now = Math.floor(Date.now() / 1000);
  const result = getDb().prepare(
    `UPDATE accountability_pairs SET status = 'active', responded_at = ? WHERE id = ? AND status = 'pending'`
  ).run(now, pairId);
  return result.changes > 0;
}

function decline(pairId) {
  const now = Math.floor(Date.now() / 1000);
  const result = getDb().prepare(
    `UPDATE accountability_pairs SET status = 'declined', active = 0, responded_at = ? WHERE id = ? AND status = 'pending'`
  ).run(now, pairId);
  return result.changes > 0;
}

function remove(guildId, userA, userB) {
  const result = getDb().prepare(
    `UPDATE accountability_pairs
        SET status = 'removed', active = 0, responded_at = strftime('%s','now')
      WHERE guild_id = ? AND status = 'active' AND active = 1
        AND ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))`
  ).run(guildId, userA, userB, userB, userA);
  return result.changes;
}

function expireOldPending() {
  const cutoff = Math.floor(Date.now() / 1000) - REQUEST_EXPIRY_SEC;
  const result = getDb().prepare(
    `UPDATE accountability_pairs
        SET status = 'expired', active = 0
      WHERE status = 'pending' AND active = 1 AND requested_at IS NOT NULL AND requested_at < ?`
  ).run(cutoff);
  return result.changes;
}

module.exports = {
  REQUEST_EXPIRY_SEC,
  getActiveBuddies,
  getActiveBuddyIds,
  getPendingIncoming,
  getPendingOutgoing,
  getById,
  findExisting,
  createRequest,
  attachDmInfo,
  findByDmMessage,
  accept,
  decline,
  remove,
  expireOldPending,
};
