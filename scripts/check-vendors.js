require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT id, store_id, business_name, address, location, latitude, longitude FROM vendors')
  .then(res => {
    console.log('Vendors:', res.rows);
    pool.end();
  })
  .catch(err => {
    console.error(err);
    pool.end();
  });
