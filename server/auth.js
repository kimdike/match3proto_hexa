const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_changeme';
const TOKEN_EXPIRES = '30d';
const BCRYPT_COST = 10;

const router = express.Router();

function signToken(user) {
  return jwt.sign({ uid: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
}

function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!isEmail(email)) return res.status(400).json({ error: 'email_invalid' });
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'password_min_8_chars' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) return res.status(409).json({ error: 'email_taken' });

    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const now = Date.now();

    const inserted = await pool.query(
      'INSERT INTO users (email, password_hash, created_at) VALUES ($1, $2, $3) RETURNING id',
      [email, hash, now]
    );
    const userId = Number(inserted.rows[0].id);
    const user = { id: userId, email };

    await pool.query(
      'INSERT INTO player_profiles (user_id, updated_at) VALUES ($1, $2)',
      [userId, now]
    );

    res.status(201).json({ token: signToken(user), user });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'credentials_required' });
    const r = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    );
    if (r.rowCount === 0) return res.status(401).json({ error: 'invalid_credentials' });
    const row = r.rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    const user = { id: Number(row.id), email: row.email };
    res.json({ token: signToken(user), user });
  } catch (e) { next(e); }
});

function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'auth_required' });
  try {
    const decoded = jwt.verify(h.slice(7), JWT_SECRET);
    req.user = { id: decoded.uid, email: decoded.email };
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}

module.exports = { router, requireAuth };
