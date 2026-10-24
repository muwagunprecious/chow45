require('dotenv').config();
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    'UPDATE service_zones SET delivery_rules = $1',
    [JSON.stringify({ baseFee: 200, ratePerMeter: 0.20, serviceFee: 400, minDeliveryFee: 200 })]
  );
  const res = await pool.query('SELECT id, name, delivery_rules FROM service_zones LIMIT 5');
  console.log('Updated service_zones:', res.rows);
  await pool.end();
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
