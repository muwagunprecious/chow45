require('dotenv').config();
const dns = require('dns');
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

const { Pool } = require('pg');

let pool = global._pgPool || null;
const DATABASE_URL = process.env.DATABASE_URL;

if (!pool && DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  global._pgPool = pool;
}

let tableInitialized = global._tableInitialized || false;
async function ensureTable() {
  if (tableInitialized || !pool) return;
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        user_type VARCHAR(50) NOT NULL,
        department VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    client.release();
    global._tableInitialized = true;
    tableInitialized = true;
  } catch (err) {
    console.error('Table init error:', err.message);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Parse path
  let pathStr = '';
  if (req.query && req.query.path) {
    const p = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
    pathStr = '/' + p;
  } else {
    const host = req.headers.host || 'localhost';
    const parsedUrl = new URL(req.url, `http://${host}`);
    pathStr = parsedUrl.pathname;
  }

  // Normalize: remove leading /api if present
  const cleanPath = pathStr.replace(/^\/api/, '');
  const method = req.method;

  await ensureTable();

  // 1. Status Check
  if ((cleanPath === '/status' || cleanPath === '') && method === 'GET') {
    let dbStatus = 'disconnected';
    if (pool) {
      try {
        const client = await pool.connect();
        await client.query('SELECT 1;');
        client.release();
        dbStatus = 'connected';
      } catch (e) {
        dbStatus = 'connecting/fallback';
      }
    }
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      status: 'ok',
      database: dbStatus,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 2. Export CSV: /waitlist/export
  if (cleanPath === '/waitlist/export' && method === 'GET') {
    try {
      let entries = [];
      if (pool) {
        const result = await pool.query('SELECT * FROM waitlist ORDER BY created_at DESC;');
        entries = result.rows;
      }

      const headers = ['ID', 'Full Name', 'Email', 'Phone', 'Role', 'Department/Faculty', 'Joined Date'];
      const rows = entries.map(e => [
        e.id,
        `"${(e.name || '').replace(/"/g, '""')}"`,
        `"${(e.email || '').replace(/"/g, '""')}"`,
        `"${(e.phone || '').replace(/"/g, '""')}"`,
        `"${(e.user_type || '').replace(/"/g, '""')}"`,
        `"${(e.department || '').replace(/"/g, '""')}"`,
        `"${(e.created_at ? new Date(e.created_at).toLocaleString() : '')}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=UTF-8');
      res.setHeader('Content-Disposition', `attachment; filename="chow45-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.statusCode = 200;
      res.end(csvContent);
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Export failed' }));
    }
    return;
  }

  // 3. Submit Waitlist: POST /waitlist
  if (cleanPath === '/waitlist' && method === 'POST') {
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

  // 4. Get Waitlist Entries: GET /waitlist
  if (cleanPath === '/waitlist' && method === 'GET') {
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

  // 5. Delete Entry: DELETE /waitlist/:id
  if (cleanPath.startsWith('/waitlist/') && method === 'DELETE') {
    const id = cleanPath.replace('/waitlist/', '');
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
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not Found', path: cleanPath }));
};
