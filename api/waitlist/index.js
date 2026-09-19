const { pool, ensureTable } = require('../../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  await ensureTable();

  // POST: Add waitlist entry
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    } else if (!body) {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
      }
      try { body = JSON.parse(raw || '{}'); } catch (e) { body = {}; }
    }

    const { name, email, phone, user_type, department } = body || {};

    if (!name || !email || !phone || !user_type) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Missing required fields' }));
      return;
    }

    try {
      if (!pool) throw new Error('Database connection not available');
      const query = `
        INSERT INTO waitlist (name, email, phone, user_type, department)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const result = await pool.query(query, [name, email, phone, user_type, department || '']);
      const savedEntry = result.rows[0];

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 201;
      res.end(JSON.stringify({ success: true, entry: savedEntry }));
    } catch (err) {
      console.error('Waitlist insert error:', err.message);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Database error: ' + err.message }));
    }
    return;
  }

  // GET: Fetch waitlist entries and statistics
  if (req.method === 'GET') {
    try {
      let entries = [];
      if (pool) {
        const result = await pool.query('SELECT * FROM waitlist ORDER BY created_at DESC;');
        entries = result.rows;
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const stats = {
        total: entries.length,
        students: entries.filter(e => (e.user_type || '').toLowerCase() === 'student').length,
        vendors: entries.filter(e => (e.user_type || '').toLowerCase() === 'vendor').length,
        staff: entries.filter(e => (e.user_type || '').toLowerCase() === 'staff').length,
        others: entries.filter(e => {
          const t = (e.user_type || '').toLowerCase();
          return t !== 'student' && t !== 'vendor' && t !== 'staff';
        }).length,
        today: entries.filter(e => e.created_at && String(e.created_at).slice(0, 10) === todayStr).length
      };

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, entries, stats, dbConnected: !!pool }));
    } catch (err) {
      console.error('Error fetching waitlist:', err.message);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Failed to retrieve waitlist entries' }));
    }
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 405;
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
};
