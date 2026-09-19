const { pool, ensureTable } = require('../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  await ensureTable();

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
};
