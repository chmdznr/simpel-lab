// One executable integration check, isolated Docker project, no .env reads.
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { Pool } = require('pg');
const root = path.resolve(__dirname, '..');
const compose = ['compose', '-p', 'simpel-day4-qa', '-f', path.join(root, 'lab/lab3-producer-consumer/compose.qa.yml')];
Object.assign(process.env, { AMQP_URL: 'amqp://labqa:labqa-only@127.0.0.1:5763', DATABASE_URL: 'postgres://labqa:labqa-only@127.0.0.1:5463/labqa',
  PORT_GATEWAY: '3064', GATEWAY_URL: 'http://127.0.0.1:3064', ALUR_TRANSPORT: 'async', ALUR_WORK_MS: '0', ALUR_NOTIF_MS: '0',
  ALUR_POOL_MAX: '4', ALUR_PREFETCH: '4', ALUR_ACK_DELAY_MS: '0' });
const { openPublisher } = require('../layanan/messaging');
const routing = require('./routing');
const flow = require('../layanan/alur');
const results = [], children = [];
let db, p, ownsStack = false;
const pass = (name, detail = {}) => { results.push({ name, ...detail }); console.log('PASS ' + name); };
function docker(args) {
  const r = spawnSync('docker', [...compose, ...args], { encoding: 'utf8', timeout: 120000 });
  if (r.status) throw new Error(r.stderr.slice(-1200)); return r.stdout.trim();
}
async function until(test, label, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await test()) return; await delay(50); }
  throw new Error('Timeout: ' + label);
}
async function start(args, env = {}) {
  const c = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  c.logs = ''; c.err = ''; c.stdout.on('data', b => { c.logs += b; }); c.stderr.on('data', b => { c.err += b; }); children.push(c);
  await until(() => { if (c.exitCode !== null) throw new Error(c.err); return c.logs.includes('"ready":true'); }, 'child ready'); return c;
}
async function stop(c, signal = 'SIGTERM') {
  if (c.exitCode !== null || c.signalCode) return; c.kill(signal);
  await until(() => c.exitCode !== null || c.signalCode, 'stop', 20000);
}
async function post(key, jenis = 'siup') {
  const r = await fetch(process.env.GATEWAY_URL + '/pengajuan', { method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ pemohon: 'Synthetic', jenis, kantor: 'jakarta' }) });
  return { code: r.status, body: await r.json() };
}
async function status(id) { return (await fetch(process.env.GATEWAY_URL + '/pengajuan/' + id)).json(); }
async function main() {
  const pre = spawnSync('docker', ['ps', '-aq', '--filter', 'label=com.docker.compose.project=simpel-day4-qa'], { encoding: 'utf8' });
  assert.equal(pre.status, 0); assert.equal(pre.stdout.trim(), '', 'Existing QA project must be inspected first'); ownsStack = true;
  docker(['up', '-d', '--wait']);
  db = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  for (const file of ['01-skema.sql', '02-alur.sql']) await db.query(readFileSync(path.join(root, 'db', file), 'utf8'));
  if (process.argv.includes('--browser')) {
    for (const role of ['gateway', 'validasi', 'billing', 'notifikasi', 'tracking']) await start(['layanan/alur.js', role]);
    console.log('BROWSER_READY http://127.0.0.1:3064/health');
    await new Promise(resolve => { process.once('SIGTERM', resolve); process.once('SIGINT', resolve); });
    pass('isolated browser fixture stopped'); return;
  }
  p = await openPublisher(routing.declare);
  for (const key of ['pengajuan.siup.jakarta', 'pengajuan.nib.bandung', 'pengajuan.siup.bandung']) await p.publish(routing.event(), key);
  for (const [q, n] of [['jakarta', 1], ['siup', 2], ['unmatched', 1]]) assert.equal((await p.channel.checkQueue(`lab4b.${q}.q`)).messageCount, n);
  pass('topic copies and alternate exchange match the prediction matrix');
  let rw = await start(['tools/routing.js', 'worker']);
  const job = routing.event(), t = Date.now();
  await p.publish(job, 'work', 'lab4b.jobs', { attempt: 1, failUntil: 99 });
  await until(async () => (await p.channel.checkQueue('lab4b.dlq.q')).messageCount === 1, 'terminal DLQ');
  assert(Date.now() - t >= 3800); assert.equal((rw.logs.match(/"attempt":/g) || []).length, 3);
  const peek = await p.channel.get('lab4b.dlq.q', { noAck: false }); assert.equal(peek.properties.messageId, job.messageId); p.channel.nack(peek, false, true);
  await stop(rw); rw = await start(['tools/routing.js', 'worker'], { LAB4_REPAIRED: '1' });
  const replay = spawnSync(process.execPath, ['tools/routing.js', 'replay', job.messageId], { cwd: root, env: { ...process.env, LAB4_REPAIRED: '1' }, encoding: 'utf8' });
  assert.equal(replay.status, 0, replay.stderr); await until(() => rw.logs.includes('"result":"processed"'), 'replay');
  await stop(rw); await p.close();
  pass('retry waits twice, stops at attempt 3, and replays the same ID after repair');

  p = await openPublisher(flow.declare);
  let gateway = await start(['layanan/alur.js', 'gateway']);
  const missing = await fetch(process.env.GATEWAY_URL + '/pengajuan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); assert.equal(missing.status, 400);
  const duplicates = await Promise.all(Array.from({ length: 8 }, () => post('same-key')));
  assert(duplicates.every(x => x.code === 202)); assert.equal(new Set(duplicates.map(x => x.body.pengajuanId)).size, 1);
  assert.equal((await post('same-key', 'different')).code, 409);
  assert.equal(Number((await db.query("SELECT count(*) FROM alur_pengajuan WHERE request_key='same-key'")).rows[0].count), 1);
  pass('concurrent HTTP idempotency key reuse creates one submission; conflicting payload returns 409');
  const workers = {};
  for (const role of ['validasi', 'billing', 'notifikasi', 'tracking']) workers[role] = await start(['layanan/alur.js', role]);
  const id = duplicates[0].body.pengajuanId;
  await until(async () => (await status(id)).status === 'SELESAI', 'full flow');
  await until(async () => Number((await db.query('SELECT count(*) FROM alur_tracking WHERE pengajuan_id=$1', [id])).rows[0].count) === 4, 'tracking');
  const original = (await db.query("SELECT event FROM alur_outbox WHERE owner='gateway' AND event->'data'->>'pengajuanId'=$1", [id])).rows[0].event;
  await p.publish(original, original.event); await delay(300);
  assert.equal(Number((await db.query('SELECT count(*) FROM alur_inbox WHERE message_id=$1', [original.messageId])).rows[0].count), 2);
  pass('five roles complete; tracking and validation deduplicate independently');

  await stop(workers.validasi);
  const race = await post('competing-copies');
  const repeated = (await db.query("SELECT event FROM alur_outbox WHERE owner='gateway' AND event->'data'->>'pengajuanId'=$1", [race.body.pengajuanId])).rows[0].event;
  workers.validasi = await start(['layanan/alur.js', 'validasi'], { ALUR_WORK_MS: '200' });
  const competitor = await start(['layanan/alur.js', 'validasi'], { ALUR_WORK_MS: '200' });
  for (let i = 0; i < 8; i++) await p.publish(repeated, repeated.event);
  await until(async () => (await status(race.body.pengajuanId)).status === 'SELESAI', 'competing consumers');
  await until(() => workers.validasi.logs.includes('"duplicate"') || competitor.logs.includes('"duplicate"'), 'duplicate consumer');
  assert.equal(Number((await db.query("SELECT count(*) FROM alur_outbox WHERE owner='validasi' AND event->>'event'='validasi.selesai' AND event->'data'->>'pengajuanId'=$1", [race.body.pengajuanId])).rows[0].count), 1);
  await stop(competitor);
  pass('two competing validation processes and repeated copies create one next event');

  await stop(workers.billing);
  const batch = await Promise.all(Array.from({ length: 20 }, (_, i) => post('billing-down-' + i)));
  assert(batch.every(x => x.code === 202));
  await until(async () => (await p.channel.checkQueue('alur.billing.q')).messageCount === 20, 'billing backlog');
  assert.equal((await status(batch[0].body.pengajuanId)).status, 'VALID');
  workers.billing = await start(['layanan/alur.js', 'billing']);
  await until(async () => (await Promise.all(batch.map(x => status(x.body.pengajuanId)))).every(s => s.status === 'SELESAI'), 'billing recovery');
  pass('billing process outage accepts 20 submissions and catches up after restart without HTTP resubmission');

  const failed = await post('permanent-failure', 'uji-gagal');
  await until(async () => (await status(failed.body.pengajuanId)).status === 'DIBATALKAN', 'compensation');
  assert.equal(Number((await db.query('SELECT count(*) FROM alur_billing WHERE pengajuan_id=$1', [failed.body.pengajuanId])).rows[0].count), 0);
  assert.equal((await p.channel.checkQueue('alur.billing.dlq')).messageCount, 1);
  pass('permanent billing failure reaches terminal DLQ and releases the validation reservation');

  await stop(workers.notifikasi);
  workers.notifikasi = await start(['layanan/alur.js', 'notifikasi'], { ALUR_ACK_DELAY_MS: '10000' });
  const crash = await post('crash-commit');
  await until(async () => (await status(crash.body.pengajuanId)).status === 'SELESAI', 'commit window');
  await stop(workers.notifikasi, 'SIGKILL');
  workers.notifikasi = await start(['layanan/alur.js', 'notifikasi']);
  await until(() => workers.notifikasi.logs.includes('"duplicate"'), 'redelivery after crash');
  assert.equal(Number((await db.query('SELECT count(*) FROM alur_notifikasi WHERE pengajuan_id=$1', [crash.body.pengajuanId])).rows[0].count), 1);
  pass('consumer crash after commit produces one durable notification receipt');

  await db.query('ALTER TABLE alur_billing RENAME TO alur_billing_qa_hidden');
  const rollback = await post('transaction-rollback');
  await until(async () => Number((await db.query("SELECT count(*) FROM alur_retry WHERE layanan='billing'")).rows[0].count) >= 2, 'failed transaction schedules retry');
  const source = (await db.query("SELECT event FROM alur_outbox WHERE owner='validasi' AND event->'data'->>'pengajuanId'=$1", [rollback.body.pengajuanId])).rows[0].event;
  assert.equal(Number((await db.query("SELECT count(*) FROM alur_inbox WHERE layanan='billing' AND message_id=$1", [source.messageId])).rows[0].count), 0);
  await db.query('ALTER TABLE alur_billing_qa_hidden RENAME TO alur_billing');
  await until(async () => (await status(rollback.body.pengajuanId)).status === 'SELESAI', 'transaction recovery');
  pass('failed DB effect rolls back inbox; delayed retry succeeds after table recovery');

  await p.close(); p = null;
  docker(['stop', 'rabbitmq']);
  const offline = await post('broker-down'); assert.equal(offline.code, 202);
  assert.equal((await status(offline.body.pengajuanId)).status, 'DITERIMA');
  docker(['start', 'rabbitmq']);
  await until(async () => (await status(offline.body.pengajuanId)).status === 'SELESAI', 'automatic broker reconnect', 60000);
  pass('database-backed acceptance survives broker outage; relays and consumers reconnect automatically');

  for (const w of Object.values(workers)) await stop(w);
  await stop(gateway);
  const benches = [];
  Object.assign(process.env, { ALUR_WORK_MS: '120', ALUR_NOTIF_MS: '300', BEBAN_COUNT: '500', BEBAN_CONCURRENCY: '50' });
  for (const transport of ['sync', 'async']) {
    process.env.ALUR_TRANSPORT = transport;
    gateway = await start(['layanan/alur.js', 'gateway']);
    const ws = [];
    if (transport === 'async') for (const role of ['validasi', 'billing', 'notifikasi', 'tracking']) ws.push(await start(['layanan/alur.js', role]));
    const bench = await require('./beban-alur').run();
    const evidenceDir = path.join(root, '.evidence'); mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(path.join(evidenceDir, 'day4-benchmark-' + transport + '.json'), JSON.stringify(bench, null, 2));
    assert.equal(bench.errors.length, 0); assert.equal(bench.completed, 500); assert.equal(new Set(bench.receipts.map(x => x.pengajuanId)).size, 500);
    benches.push({ transport, ...bench, receipts: undefined });
    for (const w of ws) await stop(w); await stop(gateway);
  }
  pass('controlled 500-request comparisons', { benchmarks: benches, workMs: 120, notificationMs: 300, poolMax: 4, prefetch: 4 });
  pass('runtime', { node: process.version, rabbitmq: docker(['exec', '-T', 'rabbitmq', 'rabbitmqctl', 'version']) });
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; }).finally(async () => {
  for (const c of children) await stop(c).catch(() => c.kill('SIGKILL'));
  await p?.close(); await db?.end();
  const dir = path.join(root, '.evidence'); mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, process.argv.includes('--browser') ? 'day4-browser.json' : 'day4-verification.json'), JSON.stringify({ passed: !process.exitCode, checkedAt: new Date().toISOString(), results }, null, 2));
  if (ownsStack) docker(['down', '-v']);
  console.log(process.argv.includes('--browser') ? '.evidence/day4-browser.json' : '.evidence/day4-verification.json');
});
