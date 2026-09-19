const { pool, ensureTable } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  await ensureTable();

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
    console.error('Export error:', err);
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Export failed' }));
  }
};
