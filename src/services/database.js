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
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Personal records
    CREATE TABLE IF NOT EXISTS personal_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      exercise TEXT NOT NULL,
      weight REAL NOT NULL,
      weight_unit TEXT DEFAULT 'lbs',
      reps INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(user_id, guild_id, exercise)
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

    -- Challenges
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
      active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    -- Challenge participants
    CREATE TABLE IF NOT EXISTS challenge_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL REFERENCES challenges(id),
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

    -- Accountability partners
    CREATE TABLE IF NOT EXISTS accountability_pairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user1_id TEXT NOT NULL,
      user2_id TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(guild_id, user1_id, user2_id)
    );

    -- User profiles / preferences
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      height_cm REAL,
      age INTEGER,
      gender TEXT,
      activity_level TEXT DEFAULT 'moderate',
      weight_unit TEXT DEFAULT 'lbs',
      measurement_unit TEXT DEFAULT 'imperial',
      is_public INTEGER DEFAULT 1,
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
  `);
}

function migrate(db) {
  // Migration: add columns that may not exist on older databases
  const migrations = [
    { table: 'goals', column: 'direction', sql: "ALTER TABLE goals ADD COLUMN direction TEXT DEFAULT 'increase'" },
    { table: 'goals', column: 'milestone_pct', sql: 'ALTER TABLE goals ADD COLUMN milestone_pct REAL' },
    { table: 'goals', column: 'milestones_announced', sql: "ALTER TABLE goals ADD COLUMN milestones_announced TEXT DEFAULT '[]'" },
    { table: 'workouts', column: 'category', sql: "ALTER TABLE workouts ADD COLUMN category TEXT DEFAULT 'Strength'" },
    { table: 'workouts', column: 'details', sql: 'ALTER TABLE workouts ADD COLUMN details TEXT' },
    { table: 'user_profiles', column: 'is_public', sql: 'ALTER TABLE user_profiles ADD COLUMN is_public INTEGER DEFAULT 1' },
  ];

  for (const m of migrations) {
    try {
      const cols = db.prepare(`PRAGMA table_info(${m.table})`).all();
      if (!cols.find(c => c.name === m.column)) {
        db.exec(m.sql);
      }
    } catch {}
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
