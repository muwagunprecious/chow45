require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PORT = process.env.PORT || 8000;
const DATABASE_URL = process.env.DATABASE_URL;

// PostgreSQL Connection Pool
let pool = null;
let dbConnected = false;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err.message);
  });

  // Initialize table
  (async () => {
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
      dbConnected = true;
      console.log('✓ PostgreSQL connected and waitlist table ready.');
    } catch (err) {
      console.error('PostgreSQL connection error:', err.message);
      dbConnected = false;
    }
  })();
} else {
  console.warn('⚠ No DATABASE_URL found in environment. Running in local fallback mode.');
}

// Local JSON backup path
const BACKUP_FILE = path.join(__dirname, 'waitlist_backup.json');
function readLocalWaitlist() {
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      return JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading local waitlist:', e);
  }
  return [];
}

function saveLocalWaitlist(entries) {
  try {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(entries, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving local waitlist:', e);
  }
}

// Content-type helper
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // -------------------------------------------------------------
  // API: Status / Health
  // -------------------------------------------------------------
  if (pathname === '/api/status' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      database: dbConnected ? 'connected' : (DATABASE_URL ? 'connecting/fallback' : 'no_env'),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // -------------------------------------------------------------
  // API: Create Waitlist Entry (POST /api/waitlist)
  // -------------------------------------------------------------
  if (pathname === '/api/waitlist' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const { name, email, phone, user_type, department } = data;

        if (!name || !email || !phone || !user_type) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields' }));
          return;
        }

        let savedEntry = null;

        if (pool) {
          try {
            const query = `
              INSERT INTO waitlist (name, email, phone, user_type, department)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING *;
            `;
            const result = await pool.query(query, [name, email, phone, user_type, department || '']);
            savedEntry = result.rows[0];
          } catch (dbErr) {
            console.error('DB insert failed, falling back to local file:', dbErr.message);
          }
        }

        if (!savedEntry) {
          // Local fallback
          const localEntries = readLocalWaitlist();
          savedEntry = {
            id: localEntries.length + 1,
            name,
            email,
            phone,
            user_type,
            department: department || '',
            created_at: new Date().toISOString()
          };
          localEntries.unshift(savedEntry);
          saveLocalWaitlist(localEntries);
        }

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, entry: savedEntry }));
      } catch (err) {
        console.error('Waitlist submission error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // API: Get Waitlist Entries & Stats (GET /api/waitlist)
  // -------------------------------------------------------------
  if (pathname === '/api/waitlist' && method === 'GET') {
    try {
      let entries = [];
      if (pool) {
        try {
          const result = await pool.query('SELECT * FROM waitlist ORDER BY created_at DESC;');
          entries = result.rows;
        } catch (dbErr) {
          console.warn('DB select failed, reading local backup:', dbErr.message);
          entries = readLocalWaitlist();
        }
      } else {
        entries = readLocalWaitlist();
      }

      // Calculate statistics
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

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, entries, stats, dbConnected }));
    } catch (err) {
      console.error('Failed to fetch waitlist:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to retrieve waitlist entries' }));
    }
    return;
  }

  // -------------------------------------------------------------
  // API: Export CSV (GET /api/waitlist/export)
  // -------------------------------------------------------------
  if (pathname === '/api/waitlist/export' && method === 'GET') {
    try {
      let entries = [];
      if (pool) {
        try {
          const result = await pool.query('SELECT * FROM waitlist ORDER BY created_at DESC;');
          entries = result.rows;
        } catch (e) {
          entries = readLocalWaitlist();
        }
      } else {
        entries = readLocalWaitlist();
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
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=UTF-8',
        'Content-Disposition': `attachment; filename="chow45-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`
      });
      res.end(csvContent);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Export failed' }));
    }
    return;
  }

  // -------------------------------------------------------------
  // API: Delete Entry (DELETE /api/waitlist/:id)
  // -------------------------------------------------------------
  if (pathname.startsWith('/api/waitlist/') && method === 'DELETE') {
    const id = pathname.replace('/api/waitlist/', '');
    if (pool) {
      try {
        await pool.query('DELETE FROM waitlist WHERE id = $1;', [id]);
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
    // Also remove from local
    const local = readLocalWaitlist().filter(e => String(e.id) !== String(id));
    saveLocalWaitlist(local);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // -------------------------------------------------------------
  // Route: /admin -> admin.html
  // -------------------------------------------------------------
  if (pathname === '/admin' || pathname === '/admin/') {
    const adminPath = path.join(__dirname, 'admin.html');
    if (fs.existsSync(adminPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(fs.readFileSync(adminPath));
      return;
    }
  }

  // -------------------------------------------------------------
  // Static Files Server
  // -------------------------------------------------------------
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Security check: prevent path traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // 404 fallback
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 Not Found</h1><p><a href="/">Return to Chow45 Home</a></p>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Chow45 server running at http://localhost:${PORT}`);
  console.log(`📊 Admin portal available at http://localhost:${PORT}/admin`);
});
