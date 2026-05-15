require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { init: initDb } = require('./db');
const auth = require('./auth');
const profile = require('./profile');

const PORT = parseInt(process.env.PORT || '8080', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const app = express();

app.use(express.json({ limit: '256kb' }));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.length === 0) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: false,
}));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.use('/api/auth', auth.router);
app.use('/api/profile', profile.router);

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'internal_error' });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[server] listening on port ${PORT}`);
      if (ALLOWED_ORIGINS.length) {
        console.log(`[server] CORS allowed: ${ALLOWED_ORIGINS.join(', ')}`);
      } else {
        console.log('[server] CORS: open (no ALLOWED_ORIGINS set) — production에서는 반드시 설정');
      }
    });
  })
  .catch((err) => {
    console.error('[db] init failed:', err.message);
    process.exit(1);
  });
