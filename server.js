require('dotenv').config();
const dns = require('dns');
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

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
    console.error('PostgreSQL client error:', err.message);
  });
} else {
  console.warn('⚠ No DATABASE_URL found in environment.');
}

async function ensureTable() {
  if (dbConnected || !pool) return;
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
  } catch (err) {
    console.error('ensureTable error:', err.message);
  }
}

// Initial table check
if (pool) {
  ensureTable();
}

// Local JSON backup path (used if DB connection temporarily fails)
const BACKUP_FILE = path.join(__dirname, 'waitlist_backup.json');
function readLocalWaitlist() {
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      return JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
    }
  } catch (e) {}
  try {
    const tmpBackup = path.join('/tmp', 'waitlist_backup.json');
    if (fs.existsSync(tmpBackup)) {
      return JSON.parse(fs.readFileSync(tmpBackup, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveLocalWaitlist(entries) {
  try {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(entries, null, 2), 'utf8');
  } catch (e) {
    try {
      fs.writeFileSync(path.join('/tmp', 'waitlist_backup.json'), JSON.stringify(entries, null, 2), 'utf8');
    } catch (e2) {}
  }
}

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=UTF-8',
  '.txt': 'text/plain; charset=UTF-8'
};

// Pre-load all static assets directly into memory
// This guarantees Vercel's NFT bundler bundles them and prevents any 404/ENOENT errors
function loadAsset(fileName, mimeType) {
  try {
    const fullPath = path.join(__dirname, fileName);
    if (fs.existsSync(fullPath)) {
      return { content: fs.readFileSync(fullPath), mimeType };
    }
    const publicPath = path.join(__dirname, 'public', fileName);
    if (fs.existsSync(publicPath)) {
      return { content: fs.readFileSync(publicPath), mimeType };
    }
  } catch (err) {
    console.error('Error loading static asset:', fileName, err.message);
  }
  return null;
}

const STATIC_ASSETS = {
  '/': loadAsset('index.html', 'text/html; charset=UTF-8'),
  '/index.html': loadAsset('index.html', 'text/html; charset=UTF-8'),
  '/style.css': loadAsset('style.css', 'text/css; charset=UTF-8'),
  '/script.js': loadAsset('script.js', 'application/javascript; charset=UTF-8'),
  '/admin': loadAsset('admin.html', 'text/html; charset=UTF-8'),
  '/admin.html': loadAsset('admin.html', 'text/html; charset=UTF-8'),
  '/admin.css': loadAsset('admin.css', 'text/css; charset=UTF-8'),
  '/admin.js': loadAsset('admin.js', 'application/javascript; charset=UTF-8'),
  '/hero-campus.svg': loadAsset('hero-campus.svg', 'image/svg+xml'),
  '/sitemap.xml': loadAsset('sitemap.xml', 'application/xml; charset=UTF-8'),
  '/robots.txt': loadAsset('robots.txt', 'text/plain; charset=UTF-8'),

  // Marketplace App routes
  '/app': loadAsset('app/index.html', 'text/html; charset=UTF-8'),
  '/app/': loadAsset('app/index.html', 'text/html; charset=UTF-8'),
  '/app/index.html': loadAsset('app/index.html', 'text/html; charset=UTF-8'),
  '/marketplace': loadAsset('app/index.html', 'text/html; charset=UTF-8'),
  '/marketplace/': loadAsset('app/index.html', 'text/html; charset=UTF-8'),
  '/marketplace/index.html': loadAsset('app/index.html', 'text/html; charset=UTF-8'),

  // App CSS
  '/app/css/tokens.css': loadAsset('app/css/tokens.css', 'text/css; charset=UTF-8'),
  '/app/css/layout.css': loadAsset('app/css/layout.css', 'text/css; charset=UTF-8'),
  '/app/css/marketplace.css': loadAsset('app/css/marketplace.css', 'text/css; charset=UTF-8'),
  '/app/css/tracking.css': loadAsset('app/css/tracking.css', 'text/css; charset=UTF-8'),
  '/app/css/vendor.css': loadAsset('app/css/vendor.css', 'text/css; charset=UTF-8'),
  '/app/css/rider.css': loadAsset('app/css/rider.css', 'text/css; charset=UTF-8'),
  '/app/css/admin.css': loadAsset('app/css/admin.css', 'text/css; charset=UTF-8'),

  // App JS
  '/app/js/data.js': loadAsset('app/js/data.js', 'application/javascript; charset=UTF-8'),
  '/app/js/state.js': loadAsset('app/js/state.js', 'application/javascript; charset=UTF-8'),
  '/app/js/mapbox-service.js': loadAsset('app/js/mapbox-service.js', 'application/javascript; charset=UTF-8'),
  '/app/js/customer.js': loadAsset('app/js/customer.js', 'application/javascript; charset=UTF-8'),
  '/app/js/vendor.js': loadAsset('app/js/vendor.js', 'application/javascript; charset=UTF-8'),
  '/app/js/rider.js': loadAsset('app/js/rider.js', 'application/javascript; charset=UTF-8'),
  '/app/js/admin.js': loadAsset('app/js/admin.js', 'application/javascript; charset=UTF-8'),
  '/app/js/app.js': loadAsset('app/js/app.js', 'application/javascript; charset=UTF-8'),

  // Images & Media
  '/app/hero-food-bg.jpg': loadAsset('app/hero-food-bg.jpg', 'image/jpeg'),
  '/hero-food-bg.jpg': loadAsset('app/hero-food-bg.jpg', 'image/jpeg')
};

// Helper to read request body in both standard Node and serverless environments
function getRequestBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return resolve(req.body);
    }
    if (Buffer.isBuffer(req.body)) {
      try { return resolve(JSON.parse(req.body.toString('utf8'))); } catch (e) { return resolve({}); }
    }
    if (typeof req.body === 'string') {
      try { return resolve(JSON.parse(req.body)); } catch (e) { return resolve({}); }
    }
    if (req.readableEnded || req.complete) {
      return resolve({});
    }

    let raw = '';
    const timer = setTimeout(() => {
      try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve({}); }
    }, 3000);

    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => {
      clearTimeout(timer);
      resolve({});
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || `localhost:${PORT}`;
    const parsedUrl = new URL(req.url, `http://${host}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // -------------------------------------------------------------
    // API: Status / Health (GET /api/status)
    // -------------------------------------------------------------
    if (pathname === '/api/status' && method === 'GET') {
      let statusState = 'disconnected';
      if (pool) {
        try {
          const client = await pool.connect();
          await client.query('SELECT 1;');
          client.release();
          statusState = 'connected';
          dbConnected = true;
        } catch (e) {
          statusState = 'connecting/fallback';
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        database: statusState,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // -------------------------------------------------------------
    // API: Create Waitlist Entry (POST /api/waitlist)
    // -------------------------------------------------------------
    if (pathname === '/api/waitlist' && method === 'POST') {
      try {
        const data = await getRequestBody(req);
        const { name, email, phone, user_type, department } = data || {};

        if (!name || !email || !phone || !user_type) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields' }));
          return;
        }

        let savedEntry = null;

        if (pool) {
          try {
            await ensureTable();
            const query = `
              INSERT INTO waitlist (name, email, phone, user_type, department)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING *;
            `;
            const result = await pool.query(query, [name, email, phone, user_type, department || '']);
            savedEntry = result.rows[0];
          } catch (dbErr) {
            console.error('DB insert failed:', dbErr.message);
          }
        }

        if (!savedEntry) {
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
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
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
    const local = readLocalWaitlist().filter(e => String(e.id) !== String(id));
    saveLocalWaitlist(local);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // -------------------------------------------------------------
  // Serve Static Assets (Fresh from disk if available, fallback to memory)
  // -------------------------------------------------------------
  let relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  if (relPath === 'app' || relPath === 'app/' || relPath === 'marketplace' || relPath === 'marketplace/') {
    relPath = 'app/index.html';
  } else if (relPath.startsWith('marketplace/')) {
    relPath = 'app/' + relPath.replace(/^marketplace\//, '');
  }

  try {
    let filePath = path.join(__dirname, relPath);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(__dirname, 'public', relPath);
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const isCode = ext === '.html' || ext === '.css' || ext === '.js' || ext === '.json';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': isCode ? 'no-cache, no-store, must-revalidate' : 'public, max-age=600'
      });
      res.end(fs.readFileSync(filePath));
      return;
    }
  } catch (fsErr) {
    console.error('File resolution error:', fsErr.message);
  }

  const asset = STATIC_ASSETS[pathname];
  if (asset && asset.content) {
    const isCode = asset.mimeType.includes('text/') || asset.mimeType.includes('javascript') || asset.mimeType.includes('json');
    res.writeHead(200, {
      'Content-Type': asset.mimeType,
      'Cache-Control': isCode ? 'no-cache, no-store, must-revalidate' : 'public, max-age=600'
    });
    res.end(asset.content);
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
  res.end('<h1>404 Not Found</h1><p><a href="/">Return to Chow45 Home</a></p>');
} catch (fatalErr) {
  console.error('Fatal unhandled request error:', fatalErr);
  if (!res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', message: fatalErr.message }));
  }
}
});

if (require.main === module && !process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`🚀 Chow45 server running at http://localhost:${PORT}`);
    console.log(`📊 Admin portal available at http://localhost:${PORT}/admin`);
  });
}

module.exports = server;
