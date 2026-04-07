const { getDb } = require('./database');

const MILESTONES = {
  workouts: [10, 25, 50, 100, 250, 500, 1000],
  streak: [7, 14, 30, 60, 90, 100, 180, 365],
};

const MILESTONE_ROLES = {
  'workouts_10': 'Gym Newbie',
  'workouts_25': 'Regular',
  'workouts_50': 'Dedicated',
  'workouts_100': '100 Club',
  'workouts_250': 'Iron Will',
  'workouts_500': 'Beast Mode',
  'workouts_1000': 'Living Legend',
  'streak_7': '7-Day Warrior',
  'streak_14': '2-Week Champion',
  'streak_30': 'Monthly Machine',
  'streak_60': '60-Day Beast',
  'streak_90': 'Quarter Master',
  'streak_100': 'Century Streak',
  'streak_365': 'Year of Iron',
};

async function checkMilestones(userId, guildId, guild) {
  const db = getDb();
  const earned = [];

  // Check workout count milestones
  const workoutCount = db.prepare(
    'SELECT COUNT(*) as count FROM workouts WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);

  for (const threshold of MILESTONES.workouts) {
    if (workoutCount.count >= threshold) {
      const key = `workouts_${threshold}`;
      const existing = db.prepare(
        'SELECT 1 FROM milestones WHERE user_id = ? AND guild_id = ? AND milestone_type = ? AND milestone_value = ?'
      ).get(userId, guildId, 'workouts', threshold);

      if (!existing) {
        db.prepare(
          'INSERT OR IGNORE INTO milestones (user_id, guild_id, milestone_type, milestone_value) VALUES (?, ?, ?, ?)'
        ).run(userId, guildId, 'workouts', threshold);
        earned.push({ key, name: MILESTONE_ROLES[key], type: 'workouts', value: threshold });
      }
    }
  }

  // Check streak milestones
  const streak = db.prepare(
    'SELECT current_streak FROM streaks WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);

  if (streak) {
    for (const threshold of MILESTONES.streak) {
      if (streak.current_streak >= threshold) {
        const key = `streak_${threshold}`;
        const existing = db.prepare(
          'SELECT 1 FROM milestones WHERE user_id = ? AND guild_id = ? AND milestone_type = ? AND milestone_value = ?'
        ).get(userId, guildId, 'streak', threshold);

        if (!existing) {
          db.prepare(
            'INSERT OR IGNORE INTO milestones (user_id, guild_id, milestone_type, milestone_value) VALUES (?, ?, ?, ?)'
          ).run(userId, guildId, 'streak', threshold);
          earned.push({ key, name: MILESTONE_ROLES[key], type: 'streak', value: threshold });
        }
      }
    }
  }

  // Try to assign roles for earned milestones
  for (const milestone of earned) {
    try {
      const role = guild.roles.cache.find(r => r.name === milestone.name);
      if (role) {
        const member = await guild.members.fetch(userId);
        await member.roles.add(role);
      }
    } catch (err) {
      console.error(`Failed to assign role "${milestone.name}" to user ${userId}:`, err.message);
    }
  }

  return earned;
}

function getMilestoneRoles() {
  return MILESTONE_ROLES;
}

module.exports = { checkMilestones, getMilestoneRoles, MILESTONE_ROLES };
