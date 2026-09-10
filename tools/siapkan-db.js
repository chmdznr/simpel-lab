// Apply only the lab's idempotent CREATE TABLE statements, including existing volumes.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Pool } = require('pg');
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await pool.query(readFileSync(join(__dirname, '../db/01-skema.sql'), 'utf8'));
    console.log('PASS: lab tables are available; existing rows were retained.');
  } finally { await pool.end(); }
}
main().catch(() => { console.error('Database setup failed. Check DATABASE_URL and the lab database.'); process.exitCode = 1; });
