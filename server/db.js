const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('[db] DATABASE_URL not set — set in server/.env (Supabase connection string).');
}

const isSupabase = /supabase\.co/i.test(connectionString || '');
const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : false,
  max: 5,
});

pool.on('error', (err) => {
  console.error('[db] idle client error', err);
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  character TEXT,
  nickname TEXT,
  stage INTEGER DEFAULT 1,
  gold INTEGER DEFAULT 0,
  diamond INTEGER DEFAULT 0,
  candy INTEGER DEFAULT 0,
  hearts INTEGER DEFAULT 5,
  heart_charge_at BIGINT DEFAULT 0,
  basic_charge_at BIGINT DEFAULT 0,
  balls_json TEXT NOT NULL DEFAULT '{}',
  materials_json TEXT NOT NULL DEFAULT '{}',
  pity_main INTEGER DEFAULT 0,
  pity_repeat INTEGER DEFAULT 0,
  auto_flee SMALLINT DEFAULT 0,
  auto_flee_seen SMALLINT DEFAULT 0,
  dark_mode SMALLINT DEFAULT 0,
  intro_done SMALLINT DEFAULT 0,
  high_score INTEGER DEFAULT 0,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS dex_entries (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dex_id INTEGER NOT NULL,
  state TEXT NOT NULL,
  capture_count INTEGER DEFAULT 0,
  fail_stack INTEGER DEFAULT 0,
  biggest_json TEXT,
  smallest_json TEXT,
  first_caught BIGINT,
  PRIMARY KEY (user_id, dex_id)
);

CREATE TABLE IF NOT EXISTS skin_slots (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_index SMALLINT NOT NULL,
  dex_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, slot_index),
  CHECK (slot_index BETWEEN 0 AND 5)
);

CREATE TABLE IF NOT EXISTS skin_unlocked (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dex_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, dex_id)
);
`;

async function init() {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  await pool.query(SCHEMA);
  console.log('[db] migrations applied');
}

module.exports = { pool, init };
