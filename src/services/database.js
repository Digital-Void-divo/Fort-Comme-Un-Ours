const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

let db;

function getDb() {
  if (db) return db;

  const dir = path.dirname(config.dbPath);
  const fs = require('fs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initialize(db);
  migrate(db);
  postMigrationIndexes(db);
  return db;
}

function initialize(db) {
  db.exec(`
    -- Workout logs
    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      exercise TEXT NOT NULL,
      category TEXT DEFAULT 'Strength',
      sets INTEGER,
      reps INTEGER,
      weight REAL,
      weight_unit TEXT DEFAULT 'lbs',
      duration_sec INTEGER,
      details TEXT,
      notes TEXT,
      session_id INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Personal records (now supports validation workflow)
    -- record_type: 'weight' (heaviest), 'reps' (most reps), 'duration' (longest hold), 'distance', 'time' (fastest)
    -- status: 'pending' | 'approved' | 'rejected' | 'expired'
    CREATE TABLE IF NOT EXISTS personal_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      exercise TEXT NOT NULL,
      record_type TEXT DEFAULT 'weight',
      weight REAL,
      weight_unit TEXT DEFAULT 'lbs',
      reps INTEGER DEFAULT 1,
      duration_sec INTEGER,
      distance REAL,
      distance_unit TEXT,
      time_sec INTEGER,
      value REAL,
      value_unit TEXT,
      evidence_url TEXT,
      status TEXT DEFAULT 'approved',
      validator_id TEXT,
      validated_at INTEGER,
      rejection_reason TEXT,
      superseded_pr_id INTEGER,
      notes TEXT,
      validation_message_ids TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Body tracking
    CREATE TABLE IF NOT EXISTS body_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT DEFAULT 'lbs',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Baseline stats
    CREATE TABLE IF NOT EXISTS baseline_stats (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      weight REAL,
      body_fat_pct REAL,
      neck REAL,
      chest REAL,
      waist REAL,
      resting_heart_rate REAL,
      bench REAL,
      cardio_duration TEXT,
      notes TEXT,
      unit_preference TEXT DEFAULT 'lbs',
      set_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      PRIMARY KEY (user_id, guild_id)
    );

    -- Goals
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      target_value REAL,
      current_value REAL DEFAULT 0,
      unit TEXT,
      direction TEXT DEFAULT 'increase',
      milestone_pct REAL,
      milestones_announced TEXT DEFAULT '[]',
      deadline INTEGER,
      completed INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Streaks
    CREATE TABLE IF NOT EXISTS streaks (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_workout_date INTEGER DEFAULT 0,
      shields_available INTEGER DEFAULT 0,
      shields_earned_total INTEGER DEFAULT 0,
      shields_used_total INTEGER DEFAULT 0,
      last_shield_award_streak INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, guild_id)
    );

    -- Water intake
    CREATE TABLE IF NOT EXISTS water_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      amount_ml INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Calorie/macro logs
    CREATE TABLE IF NOT EXISTS nutrition_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      food_name TEXT NOT NULL,
      calories REAL DEFAULT 0,
      protein REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      fat REAL DEFAULT 0,
      serving_size TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Challenges (server-wide and buddy-only)
    -- scope: 'guild' (anyone can join) | 'buddy' (creator + invited buddy only)
    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      exercise TEXT,
      challenge_type TEXT NOT NULL,
      target_value REAL,
      start_date INTEGER NOT NULL,
      end_date INTEGER NOT NULL,
      scope TEXT DEFAULT 'guild',
      invited_user_id TEXT,
      active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Challenge participants
    CREATE TABLE IF NOT EXISTS challenge_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      value REAL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(challenge_id, user_id)
    );

    -- Reminders
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      reminder_type TEXT NOT NULL,
      message TEXT,
      cron_expression TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(user_id, guild_id, reminder_type)
    );

    -- Sleep logs
    CREATE TABLE IF NOT EXISTS sleep_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      hours REAL NOT NULL,
      quality INTEGER,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Accountability partners (multi-buddy capable)
    -- user1 = requester, user2 = target. status: pending|active|declined|removed|expired
    CREATE TABLE IF NOT EXISTS accountability_pairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user1_id TEXT NOT NULL,
      user2_id TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      relationship_label TEXT,
      requested_at INTEGER,
      responded_at INTEGER,
      dm_message_id TEXT,
      dm_channel_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(guild_id, user1_id, user2_id)
    );

    -- Gym/workout sessions (check-in/check-out)
    CREATE TABLE IF NOT EXISTS gym_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      duration_sec INTEGER,
      location TEXT,
      session_type TEXT,
      planned_activities TEXT,
      activities TEXT,
      intensity INTEGER,
      mood TEXT,
      energy INTEGER,
      soreness_pre INTEGER,
      soreness_post INTEGER,
      heart_rate_avg INTEGER,
      heart_rate_max INTEGER,
      calories_est INTEGER,
      water_ml INTEGER,
      notes TEXT,
      partner_user_id TEXT,
      is_public INTEGER DEFAULT 1,
      reminder_sent INTEGER DEFAULT 0,
      cancelled INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Generic metric logs (mood, steps, HRV, supplements, etc.)
    CREATE TABLE IF NOT EXISTS metric_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      metric_key TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT,
      notes TEXT,
      recorded_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Rest days (intentional, separate from missed days)
    CREATE TABLE IF NOT EXISTS rest_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      day_epoch INTEGER NOT NULL,
      reason TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(user_id, guild_id, day_epoch)
    );

    -- User profiles / preferences
    -- visibility_default: 'public' | 'buddies' | 'private'
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      height_cm REAL,
      weight_kg REAL,
      age INTEGER,
      gender TEXT,
      activity_level TEXT DEFAULT 'moderate',
      weight_unit TEXT DEFAULT 'lbs',
      measurement_unit TEXT DEFAULT 'imperial',
      timezone TEXT DEFAULT 'UTC',
      is_public INTEGER DEFAULT 1,
      visibility_default TEXT DEFAULT 'public',
      buddy_bypass_privacy INTEGER DEFAULT 1,
      tag_in_messages INTEGER DEFAULT 1,
      notify_buddy_on_workout INTEGER DEFAULT 1,
      notify_buddy_on_pr INTEGER DEFAULT 1,
      notify_buddy_on_goal INTEGER DEFAULT 1,
      notify_buddy_on_session INTEGER DEFAULT 1,
      notify_buddy_on_missed_streak INTEGER DEFAULT 0,
      include_in_guild_stats INTEGER DEFAULT 0,
      water_goal_ml INTEGER DEFAULT 2500,
      calorie_goal REAL,
      protein_goal REAL,
      carb_goal REAL,
      fat_goal REAL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      PRIMARY KEY (user_id, guild_id)
    );

    -- Milestone tracking for role rewards
    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      milestone_type TEXT NOT NULL,
      milestone_value INTEGER NOT NULL,
      awarded_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(user_id, guild_id, milestone_type, milestone_value)
    );

    -- Progress photos
    CREATE TABLE IF NOT EXISTS progress_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      url TEXT NOT NULL,
      caption TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Weekly history notes
    CREATE TABLE IF NOT EXISTS history_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      week_start TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(user_id, guild_id, week_start)
    );

    -- Audit log
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Guild config (for fitness role, channels, etc.)
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (guild_id, key)
    );

    CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id, guild_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_body_stats_user ON body_stats(user_id, guild_id, type, created_at);
    CREATE INDEX IF NOT EXISTS idx_water_user ON water_logs(user_id, guild_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_nutrition_user ON nutrition_logs(user_id, guild_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sleep_user ON sleep_logs(user_id, guild_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_challenges_guild ON challenges(guild_id, active);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON gym_sessions(user_id, guild_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_active ON gym_sessions(user_id, guild_id, ended_at);
    CREATE INDEX IF NOT EXISTS idx_metric_logs_user ON metric_logs(user_id, guild_id, metric_key, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_rest_days_user ON rest_days(user_id, guild_id, day_epoch);
    CREATE INDEX IF NOT EXISTS idx_audit_guild ON audit_log(guild_id, created_at);
  `);
}

// Indexes that depend on columns added by migrate() — created after migrations run.
function postMigrationIndexes(db) {
  const safeIdx = [
    'CREATE INDEX IF NOT EXISTS idx_workouts_session ON workouts(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_pairs_status ON accountability_pairs(guild_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_pairs_users ON accountability_pairs(user1_id, user2_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_pr_status ON personal_records(user_id, guild_id, exercise, status)',
  ];
  for (const sql of safeIdx) {
    try { db.exec(sql); } catch (err) { console.error('Index creation skipped:', err.message); }
  }
}

function migrate(db) {
  // Migration: add columns that may not exist on older databases
  const migrations = [
    { table: 'goals', column: 'direction', sql: "ALTER TABLE goals ADD COLUMN direction TEXT DEFAULT 'increase'" },
    { table: 'goals', column: 'milestone_pct', sql: 'ALTER TABLE goals ADD COLUMN milestone_pct REAL' },
    { table: 'goals', column: 'milestones_announced', sql: "ALTER TABLE goals ADD COLUMN milestones_announced TEXT DEFAULT '[]'" },
    { table: 'workouts', column: 'category', sql: "ALTER TABLE workouts ADD COLUMN category TEXT DEFAULT 'Strength'" },
    { table: 'workouts', column: 'details', sql: 'ALTER TABLE workouts ADD COLUMN details TEXT' },
    { table: 'workouts', column: 'session_id', sql: 'ALTER TABLE workouts ADD COLUMN session_id INTEGER' },
    { table: 'user_profiles', column: 'is_public', sql: 'ALTER TABLE user_profiles ADD COLUMN is_public INTEGER DEFAULT 1' },
    { table: 'user_profiles', column: 'visibility_default', sql: "ALTER TABLE user_profiles ADD COLUMN visibility_default TEXT DEFAULT 'public'" },
    { table: 'user_profiles', column: 'buddy_bypass_privacy', sql: 'ALTER TABLE user_profiles ADD COLUMN buddy_bypass_privacy INTEGER DEFAULT 1' },
    { table: 'user_profiles', column: 'tag_in_messages', sql: 'ALTER TABLE user_profiles ADD COLUMN tag_in_messages INTEGER DEFAULT 1' },
    { table: 'user_profiles', column: 'notify_buddy_on_workout', sql: 'ALTER TABLE user_profiles ADD COLUMN notify_buddy_on_workout INTEGER DEFAULT 1' },
    { table: 'user_profiles', column: 'notify_buddy_on_pr', sql: 'ALTER TABLE user_profiles ADD COLUMN notify_buddy_on_pr INTEGER DEFAULT 1' },
    { table: 'user_profiles', column: 'notify_buddy_on_goal', sql: 'ALTER TABLE user_profiles ADD COLUMN notify_buddy_on_goal INTEGER DEFAULT 1' },
    { table: 'user_profiles', column: 'notify_buddy_on_session', sql: 'ALTER TABLE user_profiles ADD COLUMN notify_buddy_on_session INTEGER DEFAULT 1' },
    { table: 'user_profiles', column: 'notify_buddy_on_missed_streak', sql: 'ALTER TABLE user_profiles ADD COLUMN notify_buddy_on_missed_streak INTEGER DEFAULT 0' },
    { table: 'user_profiles', column: 'include_in_guild_stats', sql: 'ALTER TABLE user_profiles ADD COLUMN include_in_guild_stats INTEGER DEFAULT 0' },
    { table: 'user_profiles', column: 'timezone', sql: "ALTER TABLE user_profiles ADD COLUMN timezone TEXT DEFAULT 'UTC'" },
    { table: 'user_profiles', column: 'weight_kg', sql: 'ALTER TABLE user_profiles ADD COLUMN weight_kg REAL' },
    { table: 'accountability_pairs', column: 'status', sql: "ALTER TABLE accountability_pairs ADD COLUMN status TEXT DEFAULT 'active'" },
    { table: 'accountability_pairs', column: 'relationship_label', sql: 'ALTER TABLE accountability_pairs ADD COLUMN relationship_label TEXT' },
    { table: 'accountability_pairs', column: 'requested_at', sql: 'ALTER TABLE accountability_pairs ADD COLUMN requested_at INTEGER' },
    { table: 'accountability_pairs', column: 'responded_at', sql: 'ALTER TABLE accountability_pairs ADD COLUMN responded_at INTEGER' },
    { table: 'accountability_pairs', column: 'dm_message_id', sql: 'ALTER TABLE accountability_pairs ADD COLUMN dm_message_id TEXT' },
    { table: 'accountability_pairs', column: 'dm_channel_id', sql: 'ALTER TABLE accountability_pairs ADD COLUMN dm_channel_id TEXT' },
    { table: 'streaks', column: 'shields_available', sql: 'ALTER TABLE streaks ADD COLUMN shields_available INTEGER DEFAULT 0' },
    { table: 'streaks', column: 'shields_earned_total', sql: 'ALTER TABLE streaks ADD COLUMN shields_earned_total INTEGER DEFAULT 0' },
    { table: 'streaks', column: 'shields_used_total', sql: 'ALTER TABLE streaks ADD COLUMN shields_used_total INTEGER DEFAULT 0' },
    { table: 'streaks', column: 'last_shield_award_streak', sql: 'ALTER TABLE streaks ADD COLUMN last_shield_award_streak INTEGER DEFAULT 0' },
    { table: 'challenges', column: 'scope', sql: "ALTER TABLE challenges ADD COLUMN scope TEXT DEFAULT 'guild'" },
    { table: 'challenges', column: 'invited_user_id', sql: 'ALTER TABLE challenges ADD COLUMN invited_user_id TEXT' },
    { table: 'personal_records', column: 'record_type', sql: "ALTER TABLE personal_records ADD COLUMN record_type TEXT DEFAULT 'weight'" },
    { table: 'personal_records', column: 'duration_sec', sql: 'ALTER TABLE personal_records ADD COLUMN duration_sec INTEGER' },
    { table: 'personal_records', column: 'distance', sql: 'ALTER TABLE personal_records ADD COLUMN distance REAL' },
    { table: 'personal_records', column: 'distance_unit', sql: 'ALTER TABLE personal_records ADD COLUMN distance_unit TEXT' },
    { table: 'personal_records', column: 'time_sec', sql: 'ALTER TABLE personal_records ADD COLUMN time_sec INTEGER' },
    { table: 'personal_records', column: 'value', sql: 'ALTER TABLE personal_records ADD COLUMN value REAL' },
    { table: 'personal_records', column: 'value_unit', sql: 'ALTER TABLE personal_records ADD COLUMN value_unit TEXT' },
    { table: 'personal_records', column: 'evidence_url', sql: 'ALTER TABLE personal_records ADD COLUMN evidence_url TEXT' },
    { table: 'personal_records', column: 'status', sql: "ALTER TABLE personal_records ADD COLUMN status TEXT DEFAULT 'approved'" },
    { table: 'personal_records', column: 'validator_id', sql: 'ALTER TABLE personal_records ADD COLUMN validator_id TEXT' },
    { table: 'personal_records', column: 'validated_at', sql: 'ALTER TABLE personal_records ADD COLUMN validated_at INTEGER' },
    { table: 'personal_records', column: 'rejection_reason', sql: 'ALTER TABLE personal_records ADD COLUMN rejection_reason TEXT' },
    { table: 'personal_records', column: 'superseded_pr_id', sql: 'ALTER TABLE personal_records ADD COLUMN superseded_pr_id INTEGER' },
    { table: 'personal_records', column: 'notes', sql: 'ALTER TABLE personal_records ADD COLUMN notes TEXT' },
    { table: 'personal_records', column: 'validation_message_ids', sql: 'ALTER TABLE personal_records ADD COLUMN validation_message_ids TEXT' },
  ];

  for (const m of migrations) {
    try {
      const cols = db.prepare(`PRAGMA table_info(${m.table})`).all();
      if (!cols.find(c => c.name === m.column)) {
        db.exec(m.sql);
      }
    } catch (err) {
      console.error(`Migration failed for ${m.table}.${m.column}:`, err.message);
    }
  }

  // Backfill visibility_default from is_public for existing rows.
  // SQLite's ALTER ADD COLUMN populates existing rows with the DEFAULT, so
  // we look for the legacy combo (is_public=0 + default value still 'public').
  try {
    db.prepare(
      "UPDATE user_profiles SET visibility_default = 'private' WHERE is_public = 0 AND visibility_default = 'public'"
    ).run();
  } catch (err) {
    console.error('Failed to backfill visibility_default:', err.message);
  }

  // The legacy UNIQUE on personal_records (user_id, guild_id, exercise) blocks the
  // new pending+approved+history workflow. Drop it if it exists.
  try {
    const idx = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='personal_records'`).all();
    for (const i of idx) {
      if (i.name && i.name.startsWith('sqlite_autoindex_personal_records')) {
        // Auto-indexes from UNIQUE constraints can't be dropped directly; check column-info instead.
        break;
      }
    }
    // Detect old schema by looking at uniqueness; if we still need the legacy constraint, rebuild.
    const tableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='personal_records'").get();
    if (tableSql && /UNIQUE\s*\(\s*user_id\s*,\s*guild_id\s*,\s*exercise\s*\)/i.test(tableSql.sql)) {
      db.exec(`
        BEGIN;
        CREATE TABLE personal_records_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          exercise TEXT NOT NULL,
          record_type TEXT DEFAULT 'weight',
          weight REAL,
          weight_unit TEXT DEFAULT 'lbs',
          reps INTEGER DEFAULT 1,
          duration_sec INTEGER,
          distance REAL,
          distance_unit TEXT,
          time_sec INTEGER,
          value REAL,
          value_unit TEXT,
          evidence_url TEXT,
          status TEXT DEFAULT 'approved',
          validator_id TEXT,
          validated_at INTEGER,
          rejection_reason TEXT,
          superseded_pr_id INTEGER,
          notes TEXT,
          validation_message_ids TEXT,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
        );
        INSERT INTO personal_records_new
          (id, user_id, guild_id, exercise, record_type, weight, weight_unit, reps,
           duration_sec, distance, distance_unit, time_sec, value, value_unit,
           evidence_url, status, validator_id, validated_at, rejection_reason,
           superseded_pr_id, notes, validation_message_ids, created_at)
          SELECT id, user_id, guild_id, exercise,
                 COALESCE(record_type, 'weight'),
                 weight, weight_unit, reps,
                 duration_sec, distance, distance_unit, time_sec, value, value_unit,
                 evidence_url,
                 COALESCE(status, 'approved'),
                 validator_id, validated_at, rejection_reason,
                 superseded_pr_id, notes, validation_message_ids, created_at
          FROM personal_records;
        DROP TABLE personal_records;
        ALTER TABLE personal_records_new RENAME TO personal_records;
        CREATE INDEX IF NOT EXISTS idx_pr_status ON personal_records(user_id, guild_id, exercise, status);
        COMMIT;
      `);
    }
  } catch (err) {
    console.error('PR table migration failed:', err.message);
  }
}

function getGuildConfig(guildId, key) {
  const row = getDb().prepare('SELECT value FROM guild_config WHERE guild_id = ? AND key = ?').get(guildId, key);
  return row ? row.value : null;
}

function setGuildConfig(guildId, key, value) {
  getDb().prepare(
    'INSERT INTO guild_config (guild_id, key, value) VALUES (?, ?, ?) ON CONFLICT(guild_id, key) DO UPDATE SET value = excluded.value'
  ).run(guildId, key, value);
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, close, getGuildConfig, setGuildConfig };
