const express = require('express');
const { pool } = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();

router.use(requireAuth);

// GET /api/profile — 현재 user의 전체 상태 반환
router.get('/', async (req, res, next) => {
  try {
    const uid = req.user.id;

    const profileRes = await pool.query(
      `SELECT character, nickname, stage, gold, diamond, candy,
              hearts, heart_charge_at, basic_charge_at,
              balls_json, materials_json,
              pity_main, pity_repeat,
              auto_flee, auto_flee_seen, dark_mode, intro_done, high_score,
              updated_at
       FROM player_profiles WHERE user_id = $1`, [uid]
    );
    const profileRow = profileRes.rows[0] || null;

    const dexRes = await pool.query(
      `SELECT dex_id, state, capture_count, fail_stack,
              biggest_json, smallest_json, first_caught
       FROM dex_entries WHERE user_id = $1`, [uid]
    );

    const slotsRes = await pool.query(
      `SELECT slot_index, dex_id FROM skin_slots WHERE user_id = $1 ORDER BY slot_index`, [uid]
    );

    const unlockedRes = await pool.query(
      `SELECT dex_id FROM skin_unlocked WHERE user_id = $1`, [uid]
    );

    res.json({
      profile: profileRow ? hydrateProfile(profileRow) : null,
      dex: dexRes.rows.map(hydrateDexEntry),
      skinSlots: slotsRes.rows.map(r => ({ slotIndex: r.slot_index, dexId: r.dex_id })),
      skinUnlocked: unlockedRes.rows.map(r => r.dex_id),
    });
  } catch (e) { next(e); }
});

// PUT /api/profile — 전체 일괄 동기화 (upsert)
// body: { profile?, dex?, skinSlots?, skinUnlocked? }
router.put('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const uid = req.user.id;
    const { profile, dex, skinSlots, skinUnlocked } = req.body || {};

    await client.query('BEGIN');

    if (profile && typeof profile === 'object') {
      const p = sanitizeProfile(profile);
      await client.query(
        `INSERT INTO player_profiles (
           user_id, character, nickname, stage, gold, diamond, candy,
           hearts, heart_charge_at, basic_charge_at,
           balls_json, materials_json,
           pity_main, pity_repeat,
           auto_flee, auto_flee_seen, dark_mode, intro_done, high_score, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         ON CONFLICT (user_id) DO UPDATE SET
           character = EXCLUDED.character,
           nickname = EXCLUDED.nickname,
           stage = EXCLUDED.stage,
           gold = EXCLUDED.gold,
           diamond = EXCLUDED.diamond,
           candy = EXCLUDED.candy,
           hearts = EXCLUDED.hearts,
           heart_charge_at = EXCLUDED.heart_charge_at,
           basic_charge_at = EXCLUDED.basic_charge_at,
           balls_json = EXCLUDED.balls_json,
           materials_json = EXCLUDED.materials_json,
           pity_main = EXCLUDED.pity_main,
           pity_repeat = EXCLUDED.pity_repeat,
           auto_flee = EXCLUDED.auto_flee,
           auto_flee_seen = EXCLUDED.auto_flee_seen,
           dark_mode = EXCLUDED.dark_mode,
           intro_done = EXCLUDED.intro_done,
           high_score = EXCLUDED.high_score,
           updated_at = EXCLUDED.updated_at`,
        [uid, p.character, p.nickname, p.stage, p.gold, p.diamond, p.candy,
         p.hearts, p.heart_charge_at, p.basic_charge_at,
         p.balls_json, p.materials_json,
         p.pity_main, p.pity_repeat,
         p.auto_flee, p.auto_flee_seen, p.dark_mode, p.intro_done, p.high_score, Date.now()]
      );
    }

    if (Array.isArray(dex)) {
      await client.query('DELETE FROM dex_entries WHERE user_id = $1', [uid]);
      for (const e of dex) {
        if (!e || typeof e.dexId !== 'number' || !e.state) continue;
        await client.query(
          `INSERT INTO dex_entries (
             user_id, dex_id, state, capture_count, fail_stack,
             biggest_json, smallest_json, first_caught
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [uid, e.dexId, String(e.state),
           Number(e.captureCount) || 0,
           Number(e.failStack) || 0,
           e.biggest ? JSON.stringify(e.biggest) : null,
           e.smallest ? JSON.stringify(e.smallest) : null,
           e.firstCaught ? Number(e.firstCaught) : null]
        );
      }
    }

    if (Array.isArray(skinSlots)) {
      await client.query('DELETE FROM skin_slots WHERE user_id = $1', [uid]);
      for (const s of skinSlots) {
        if (!s || typeof s.slotIndex !== 'number' || typeof s.dexId !== 'number') continue;
        if (s.slotIndex < 0 || s.slotIndex > 5) continue;
        await client.query(
          `INSERT INTO skin_slots (user_id, slot_index, dex_id) VALUES ($1,$2,$3)`,
          [uid, s.slotIndex, s.dexId]
        );
      }
    }

    if (Array.isArray(skinUnlocked)) {
      await client.query('DELETE FROM skin_unlocked WHERE user_id = $1', [uid]);
      for (const id of skinUnlocked) {
        if (typeof id !== 'number') continue;
        await client.query(
          `INSERT INTO skin_unlocked (user_id, dex_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [uid, id]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    next(e);
  } finally {
    client.release();
  }
});

function hydrateProfile(r) {
  return {
    character: r.character,
    nickname: r.nickname,
    stage: r.stage,
    gold: r.gold,
    diamond: r.diamond,
    candy: r.candy,
    hearts: r.hearts,
    heart_charge_at: Number(r.heart_charge_at) || 0,
    basic_charge_at: Number(r.basic_charge_at) || 0,
    balls: safeJson(r.balls_json, {}),
    materials: safeJson(r.materials_json, {}),
    pity_main: r.pity_main,
    pity_repeat: r.pity_repeat,
    auto_flee: !!r.auto_flee,
    auto_flee_seen: !!r.auto_flee_seen,
    dark_mode: !!r.dark_mode,
    intro_done: !!r.intro_done,
    high_score: r.high_score,
    updated_at: Number(r.updated_at) || 0,
  };
}

function hydrateDexEntry(r) {
  return {
    dexId: r.dex_id,
    state: r.state,
    captureCount: r.capture_count,
    failStack: r.fail_stack,
    biggest: safeJson(r.biggest_json, null),
    smallest: safeJson(r.smallest_json, null),
    firstCaught: Number(r.first_caught) || null,
  };
}

function sanitizeProfile(p) {
  return {
    character: typeof p.character === 'string' ? p.character.slice(0, 16) : null,
    nickname: typeof p.nickname === 'string' ? p.nickname.slice(0, 24) : null,
    stage: Number.isInteger(p.stage) ? p.stage : 1,
    gold: Number.isInteger(p.gold) ? p.gold : 0,
    diamond: Number.isInteger(p.diamond) ? p.diamond : 0,
    candy: Number.isInteger(p.candy) ? p.candy : 0,
    hearts: Number.isInteger(p.hearts) ? p.hearts : 5,
    heart_charge_at: Number.isFinite(p.heart_charge_at) ? Math.floor(p.heart_charge_at) : 0,
    basic_charge_at: Number.isFinite(p.basic_charge_at) ? Math.floor(p.basic_charge_at) : 0,
    balls_json: p.balls && typeof p.balls === 'object' ? JSON.stringify(p.balls) : '{}',
    materials_json: p.materials && typeof p.materials === 'object' ? JSON.stringify(p.materials) : '{}',
    pity_main: Number.isInteger(p.pity_main) ? p.pity_main : 0,
    pity_repeat: Number.isInteger(p.pity_repeat) ? p.pity_repeat : 0,
    auto_flee: p.auto_flee ? 1 : 0,
    auto_flee_seen: p.auto_flee_seen ? 1 : 0,
    dark_mode: p.dark_mode ? 1 : 0,
    intro_done: p.intro_done ? 1 : 0,
    high_score: Number.isInteger(p.high_score) ? p.high_score : 0,
  };
}

function safeJson(s, fallback) {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

module.exports = { router };
