require('dotenv').config();
const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  console.log('--- Migrating delivery_configs ---');
  await pool.query(`
    UPDATE delivery_configs
    SET base_fee = 200,
        min_delivery_fee = 200,
        rate_per_meter = 0.20,
        service_fee = 400,
        updated_at = NOW()
    WHERE id = 1
  `);
  const conf = await pool.query('SELECT * FROM delivery_configs WHERE id = 1');
  console.log('Updated delivery_configs:', conf.rows[0]);

  console.log('--- Checking vendors needing coordinates ---');
  const unassigned = await pool.query('SELECT id, store_id, business_name, address FROM vendors WHERE latitude IS NULL');
  console.log(`Found ${unassigned.rows.length} vendors with null coordinates.`);

  for (const v of unassigned.rows) {
    const text = ((v.address || '') + ' ' + (v.business_name || '')).toLowerCase();
    let lat = 6.840000;
    let lng = 3.650000;

    if (text.includes('ibogun') || text.includes('123456789')) {
      lat = 6.720000;
      lng = 3.390000;
    } else if (text.includes('ago-iwoye') || text.includes('ago iwoye') || text.includes('oou main')) {
      lat = 6.848200;
      lng = 3.654500;
    } else if (text.includes('yaba')) {
      lat = 6.516700;
      lng = 3.385000;
    } else if (text.includes('ikotun') || text.includes('idimu')) {
      lat = 6.570000;
      lng = 3.270000;
    } else {
      // Sagamu default
      lat = 6.840000;
      lng = 3.650000;
    }

    await pool.query(
      'UPDATE vendors SET latitude = $1, longitude = $2 WHERE id = $3',
      [lat, lng, v.id]
    );
    console.log(`Updated vendor ${v.id} (${v.business_name}): lat=${lat}, lng=${lng}`);
  }

  const checkAll = await pool.query('SELECT count(*) as total, count(latitude) as with_coords FROM vendors');
  console.log('Final vendor counts:', checkAll.rows[0]);

  await pool.end();
  process.exit(0);
}

migrate().catch(e => {
  console.error(e);
  process.exit(1);
});
