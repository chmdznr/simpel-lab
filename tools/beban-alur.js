// 500 unique requests by default. Keep acceptance and completion clocks separate.
const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { integer } = require('../layanan/messaging');
async function run() {
  const count = integer('BEBAN_COUNT', 500, 1, 1000);
  const concurrency = integer('BEBAN_CONCURRENCY', 50, 1, 100);
  const base = process.env.GATEWAY_URL || 'http://127.0.0.1:3001';
  const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, application_name: 'alur-observer' });
  const runId = randomUUID(), receipts = [], responseMs = [], completionMs = [], errors = [];
  const starts = new Map(); let cursor = 0, peakDbBusy = 0, peakPgSleep = 0, sampling = true;
  const started = performance.now();
  const sampler = (async () => {
    while (sampling) {
      const r = (await db.query("SELECT count(*) FILTER (WHERE state='active') AS busy, count(*) FILTER (WHERE wait_event='PgSleep') AS sleeping FROM pg_stat_activity WHERE application_name LIKE 'alur-%' AND application_name<>'alur-observer'")).rows[0];
      peakDbBusy = Math.max(peakDbBusy, Number(r.busy)); peakPgSleep = Math.max(peakPgSleep, Number(r.sleeping));
      const ids = receipts.map(r => r.pengajuanId);
      if (ids.length) {
        const done = (await db.query('SELECT pengajuan_id FROM alur_notifikasi WHERE pengajuan_id=ANY($1::text[])', [ids])).rows;
        for (const row of done) if (starts.has(row.pengajuan_id)) {
          completionMs.push(performance.now() - starts.get(row.pengajuan_id)); starts.delete(row.pengajuan_id);
        }
      }
      await delay(25);
    }
  })();
  try {
    await Promise.all(Array.from({ length: Math.min(count, concurrency) }, async () => {
      while (cursor < count) {
        const i = cursor++, t = performance.now();
        try {
          const r = await fetch(base + '/pengajuan', { method: 'POST', signal: AbortSignal.timeout(60000),
            headers: { 'content-type': 'application/json', 'Idempotency-Key': `bench-${runId}-${i}` },
            body: JSON.stringify({ pemohon: 'Synthetic benchmark', jenis: 'siup', kantor: 'jakarta' }) });
          const body = await r.json();
          if (![200, 202].includes(r.status)) throw new Error(`HTTP ${r.status}`);
          receipts.push({ ...body, httpStatus: r.status }); starts.set(body.pengajuanId, t); responseMs.push(performance.now() - t);
        } catch (e) { errors.push({ i, error: e.message }); }
      }
    }));
    const responseWallMs = Math.round(performance.now() - started), deadline = Date.now() + 180000;
    while (completionMs.length < receipts.length && Date.now() < deadline) await delay(50);
    const p95 = a => Math.round([...a].sort((x, y) => x - y)[Math.max(0, Math.ceil(a.length * 0.95) - 1)] || 0);
    return { runId, node: process.version, count, concurrency, accepted: receipts.length, completed: completionMs.length, errors,
      responseP95Ms: p95(responseMs), completionP95Ms: p95(completionMs), responseWallMs,
      completionWallMs: Math.round(performance.now() - started), peakDbBusy, peakPgSleep,
      receipts, samplingMs: 25, note: 'Completion is first observed DB notification receipt after HTTP receipt; includes polling error. DB peaks are sampled, not CPU utilization.' };
  } finally { sampling = false; await sampler; await db.end(); }
}
if (require.main === module) run().then(result => {
  const dir = join(__dirname, '../.evidence'); mkdirSync(dir, { recursive: true });
  const path = join(dir, `benchmark-${result.runId}.json`); writeFileSync(path, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, receipts: undefined, evidence: path }, null, 2));
  if (result.errors.length || result.completed !== result.count) process.exitCode = 1;
}).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { run };
