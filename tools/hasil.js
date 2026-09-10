const { Pool } = require('pg');
async function main() {
  const runId = process.argv[2];
  if (!runId || !/^[A-Za-z0-9-]{1,32}$/.test(runId)) throw new Error('Usage: npm run hasil -- RUN-ID');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const pattern = `SIM-${runId}-%`;
    const validation = await pool.query('SELECT count(*)::int AS count FROM pengajuan WHERE id LIKE $1', [pattern]);
    const tracking = await pool.query('SELECT count(*)::int AS count FROM jejak_pengajuan WHERE pengajuan_id LIKE $1', [pattern]);
    console.log(JSON.stringify({ runId, validationRows: validation.rows[0].count, trackingRows: tracking.rows[0].count }));
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
