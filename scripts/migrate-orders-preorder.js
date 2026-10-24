require('dotenv').config();
const { Pool } = require('pg');

async function migrateOrdersPreorder() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('--- Adding pre-order columns to orders table ---');
  await pool.query(`
    ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS is_preorder boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS preorder_ready_date varchar(50),
    ADD COLUMN IF NOT EXISTS preorder_ready_time varchar(50),
    ADD COLUMN IF NOT EXISTS is_food_ready boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS food_ready_at timestamp with time zone;
  `);

  console.log('--- Verifying columns on orders table ---');
  const res = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name IN (
      'is_preorder', 'preorder_ready_date', 'preorder_ready_time', 'is_food_ready', 'food_ready_at'
    );
  `);
  console.log('Columns in orders table:', res.rows);

  await pool.end();
}

migrateOrdersPreorder().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
