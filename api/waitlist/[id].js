const { pool, ensureTable } = require('../../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'DELETE') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  await ensureTable();

  const id = req.query ? req.query.id : null;
  if (!id) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Missing ID' }));
    return;
  }

  try {
    if (pool) {
      await pool.query('DELETE FROM waitlist WHERE id = $1;', [id]);
    }
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    console.error('Delete error:', err.message);
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Failed to delete entry' }));
  }
};
