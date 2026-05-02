const { getDb } = require('./database');

const VALID_VISIBILITIES = new Set(['public', 'buddies', 'private']);

function getProfile(userId, guildId) {
  return getDb().prepare(
    'SELECT * FROM user_profiles WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);
}

function getSettings(userId, guildId) {
  const p = getProfile(userId, guildId) || {};
  return {
    visibility: VALID_VISIBILITIES.has(p.visibility_default) ? p.visibility_default : 'public',
    buddyBypass: p.buddy_bypass_privacy === undefined ? 1 : p.buddy_bypass_privacy,
    tagInMessages: p.tag_in_messages === undefined ? 1 : p.tag_in_messages,
    notifyBuddyOnWorkout: p.notify_buddy_on_workout === undefined ? 1 : p.notify_buddy_on_workout,
    notifyBuddyOnPR: p.notify_buddy_on_pr === undefined ? 1 : p.notify_buddy_on_pr,
    notifyBuddyOnGoal: p.notify_buddy_on_goal === undefined ? 1 : p.notify_buddy_on_goal,
    notifyBuddyOnSession: p.notify_buddy_on_session === undefined ? 1 : p.notify_buddy_on_session,
    notifyBuddyOnMissedStreak: p.notify_buddy_on_missed_streak || 0,
    includeInGuildStats: p.include_in_guild_stats || 0,
  };
}

function isActiveBuddy(viewerId, ownerId, guildId) {
  if (viewerId === ownerId) return true;
  const row = getDb().prepare(
    `SELECT 1 FROM accountability_pairs
     WHERE guild_id = ? AND status = 'active' AND active = 1
       AND ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))`
  ).get(guildId, viewerId, ownerId, ownerId, viewerId);
  return !!row;
}

/**
 * Whether viewer can see owner's data in given category.
 * Categories: workouts, prs, body, nutrition, sleep, sessions, goals, metrics, profile.
 * Currently uses a single visibility setting + buddy_bypass — categories are reserved
 * for future per-category overrides.
 */
function canViewer(viewerId, ownerId, guildId, _category = 'profile') {
  if (viewerId === ownerId) return true;
  const settings = getSettings(ownerId, guildId);
  if (settings.visibility === 'public') return true;
  const buddy = isActiveBuddy(viewerId, ownerId, guildId);
  if (settings.visibility === 'buddies') return buddy;
  // private
  return buddy && !!settings.buddyBypass;
}

function denyMessage() {
  return 'This user\'s profile is private.';
}

function ensureProfileRow(userId, guildId) {
  getDb().prepare(
    'INSERT OR IGNORE INTO user_profiles (user_id, guild_id) VALUES (?, ?)'
  ).run(userId, guildId);
}

function setSetting(userId, guildId, column, value) {
  ensureProfileRow(userId, guildId);
  const allowed = new Set([
    'visibility_default', 'buddy_bypass_privacy', 'tag_in_messages',
    'notify_buddy_on_workout', 'notify_buddy_on_pr', 'notify_buddy_on_goal',
    'notify_buddy_on_session', 'notify_buddy_on_missed_streak',
    'include_in_guild_stats', 'is_public',
  ]);
  if (!allowed.has(column)) throw new Error(`Privacy column not allowed: ${column}`);
  // Keep is_public in sync with visibility_default for backward compat.
  if (column === 'visibility_default') {
    getDb().prepare(
      `UPDATE user_profiles SET visibility_default = ?, is_public = ? WHERE user_id = ? AND guild_id = ?`
    ).run(value, value === 'private' ? 0 : 1, userId, guildId);
    return;
  }
  getDb().prepare(
    `UPDATE user_profiles SET ${column} = ? WHERE user_id = ? AND guild_id = ?`
  ).run(value, userId, guildId);
}

module.exports = {
  canViewer,
  isActiveBuddy,
  getSettings,
  denyMessage,
  setSetting,
  ensureProfileRow,
  VALID_VISIBILITIES: [...VALID_VISIBILITIES],
};
