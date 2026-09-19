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

module.exports = { pool, ensureTable };
