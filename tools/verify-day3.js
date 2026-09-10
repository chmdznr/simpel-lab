// One integration check. Owns only project simpel-day3-qa and its child processes.
// Requires Docker and Node >=20. It never reads .env or touches the participant stack.
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const root = path.resolve(__dirname, '..');
const compose = ['compose', '-p', 'simpel-day3-qa', '-f', path.join(root, 'lab/lab3-producer-consumer/compose.qa.yml')];
Object.assign(process.env, { AMQP_URL: 'amqp://labqa:labqa-only@127.0.0.1:5763',
  DATABASE_URL: 'postgres://labqa:labqa-only@127.0.0.1:5463/labqa', PORT_GATEWAY: '3063',
  SIMPEL_MODE: 'work', VALIDASI_KERJA_MS: '0', VALIDASI_ACK_DELAY_MS: '0',
  VALIDASI_PREFETCH: '1', VALIDASI_POOL_MAX: '4' });
const { openPublisher, declareTopology } = require('../layanan/messaging');
const children = [];
const results = [];
let publisher, db;
function docker(args) {
  const r = spawnSync('docker', [...compose, ...args], { encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0) throw new Error('QA Docker command failed: ' + r.stderr.slice(-1500));
}
async function until(test, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await test()) return; await delay(50); }
  throw new Error('Timeout: ' + label);
}
async function start(role, extra = {}) {
  const child = spawn(process.execPath, [path.join(root, 'layanan', role, 'index.js')],
    { cwd: root, env: { ...process.env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.lines = []; child.errors = '';
  let buffer = '';
  child.stdout.on('data', b => {
    buffer += b;
    const lines = buffer.split('\n'); buffer = lines.pop();
    for (const line of lines) { try { child.lines.push(JSON.parse(line)); } catch {} }
  });
  child.stderr.on('data', b => { child.errors += b; });
  children.push(child);
  await until(() => {
    if (child.exitCode !== null) throw new Error(role + ' exited: ' + child.errors);
    return child.lines.some(x => x.ready);
  }, role + ' ready');
  return child;
}
async function stop(child, signal = 'SIGTERM') {
  if (child.exitCode !== null || child.signalCode) return;
  child.kill(signal);
  await until(() => child.exitCode !== null || child.signalCode, 'child stop', 15000);
}
function event(run, i) {
  return { event: 'pengajuan.diterima', schemaVersion: 1, messageId: 'evt-' + randomUUID(),
    correlationId: 'corr-' + randomUUID(), occurredAt: new Date().toISOString(),
    data: { pengajuanId: 'SIM-' + run + '-' + i, pemohon: 'Synthetic participant', jenis: 'siup', kantor: 'jakarta' } };
}
async function rows(run, table = 'pengajuan') {
  // table is an internal constant, never user input.
  const col = table === 'pengajuan' ? 'id' : 'pengajuan_id';
  return (await db.query('SELECT ' + col + ' AS id FROM ' + table + ' WHERE ' + col + ' LIKE $1 ORDER BY 1',
    ['SIM-' + run + '-%'])).rows.map(r => r.id);
}
async function empty(queue = 'validasi.q') {
  await until(async () => (await publisher.channel.checkQueue(queue)).messageCount === 0, 'queue drained');
}
function pass(name, detail = {}) { results.push({ name, ...detail }); console.log('PASS ' + name); }
async function main() {
  const existing = spawnSync('docker', ['ps', '-aq', '--filter', 'label=com.docker.compose.project=simpel-day3-qa'], { encoding: 'utf8' });
  assert.equal(existing.stdout.trim(), '', 'QA project already exists; inspect it before removing or rerunning.');
  docker(['up', '-d', '--wait']);
  db = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  await db.query(readFileSync(path.join(root, 'db/01-skema.sql'), 'utf8'));
  publisher = await openPublisher();
  const gateway = await start('gateway');
  const bad = await fetch('http://127.0.0.1:3063/pengajuan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(bad.status, 400);
  const receipts = [];
  for (let i = 0; i < 100; i++) {
    const r = await fetch('http://127.0.0.1:3063/pengajuan', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pemohon: 'Synthetic', jenis: 'siup', kantor: 'jakarta', runId: 'outage' }) });
    assert.equal(r.status, 202); receipts.push(await r.json());
  }
  assert.equal((await publisher.channel.checkQueue('validasi.q')).messageCount, 100);
  assert.equal((await rows('outage')).length, 0);
  let worker = await start('validasi');
  await until(async () => (await rows('outage')).length === 100, '100 IDs committed');
  assert.deepEqual(await rows('outage'), receipts.map(r => r.pengajuanId).sort());
  await empty(); await stop(worker);
  pass('consumer outage: 100 confirmed HTTP receipts match 100 stored IDs');

  await assert.rejects(publisher.publish(event('unroutable', 1), 'does.not.match'), /Unroutable/);
  pass('mandatory return rejects an unroutable publish');
  worker = await start('validasi');
  await publisher.publish({ ...event('invalid', 1), schemaVersion: 99 });
  await until(async () => (await publisher.channel.checkQueue('pengajuan.invalid')).messageCount === 1, 'invalid retained');
  assert.equal((await rows('invalid')).length, 0);
  await stop(worker);
  pass('invalid schema is retained through the predeclared invalid DLX');

  const repeated = event('crash', 1);
  worker = await start('validasi', { VALIDASI_ACK_DELAY_MS: '10000' });
  await publisher.publish(repeated);
  await until(() => worker.lines.some(x => x.committed), 'commit before ack');
  await stop(worker, 'SIGKILL');
  worker = await start('validasi');
  await until(() => worker.lines.some(x => x.duplicate && x.redelivered), 'redelivered duplicate');
  await publisher.publish(repeated);
  await until(() => worker.lines.filter(x => x.duplicate).length >= 2, 'explicit duplicate');
  assert.equal((await rows('crash')).length, 1);
  await stop(worker);
  pass('crash after commit plus explicit replay: one business row, duplicate observed');

  for (const prefetch of [1, 100]) {
    const run = 'prefetch' + prefetch;
    const workers = [];
    for (let i = 0; i < 3; i++) workers.push(await start('validasi', {
      VALIDASI_PREFETCH: String(prefetch), VALIDASI_KERJA_MS: '120', WORKER_ID: run + '-' + i }));
    let peakActiveDb = 0;
    const started = performance.now();
    for (let i = 0; i < 120; i++) await publisher.publish(event(run, i));
    await until(async () => {
      const n = Number((await db.query("SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE 'simpel-prefetch%' AND wait_event = 'PgSleep'")).rows[0].count);
      peakActiveDb = Math.max(peakActiveDb, n);
      return (await rows(run)).length === 120;
    }, run);
    const wallMs = Math.round(performance.now() - started);
    for (const w of workers) await stop(w);
    const metrics = workers.map(w => w.lines.findLast(x => x.metrics && x.final));
    assert(metrics.every(Boolean));
    assert(metrics.every(m => m.maxInFlight <= prefetch));
    assert(peakActiveDb <= (prefetch === 1 ? 3 : 12));
    pass('prefetch ' + prefetch, { messages: 120, workers: 3, poolMax: 4, workMs: 120,
      wallMs, peakActiveDb, metrics });
  }

  // A missing table causes one bounded stop; failed work returns when the channel closes.
  await db.query('ALTER TABLE pengajuan RENAME TO pengajuan_qa_hidden');
  worker = await start('validasi');
  await publisher.publish(event('dbfail', 1));
  await until(() => worker.exitCode !== null, 'DB failure exits');
  assert.equal(worker.exitCode, 1);
  await db.query('ALTER TABLE pengajuan_qa_hidden RENAME TO pengajuan');
  worker = await start('validasi');
  await until(async () => (await rows('dbfail')).length === 1, 'manual recovery');
  await stop(worker);
  pass('database statement failure stops consumer; manual restart recovers delivery');

  await stop(gateway);
  process.env.SIMPEL_MODE = 'fanout';
  await declareTopology(publisher.channel);
  const fanGateway = await start('gateway');
  worker = await start('validasi');
  let tracking = await start('tracking');
  for (let i = 0; i < 10; i++) await publisher.publish(event('fanout', i), '', 'simpel.fanout');
  await until(async () => (await rows('fanout')).length === 10 && (await rows('fanout', 'jejak_pengajuan')).length === 10, 'both subscriptions');
  await stop(tracking);
  for (let i = 0; i < 5; i++) await publisher.publish(event('trackingoff', i), '', 'simpel.fanout');
  await until(async () => (await rows('trackingoff')).length === 5, 'validation independent');
  assert.equal((await publisher.channel.checkQueue('tracking.q')).messageCount, 5);
  tracking = await start('tracking');
  await until(async () => (await rows('trackingoff', 'jejak_pengajuan')).length === 5, 'tracking catches up');
  await stop(worker); await stop(tracking);
  pass('fanout: both subscriptions receive copies; tracking outage does not stop validation');

  // Exchange mismatch fails promptly rather than leaving a startup connection alive.
  await publisher.channel.deleteExchange('simpel.fanout');
  await publisher.channel.assertExchange('simpel.fanout', 'direct', { durable: true });
  await assert.rejects(openPublisher(), /PRECONDITION|inequivalent/);
  pass('incompatible topology rejects publisher startup and closes its connection');
  pass('runtime versions', { node: process.version,
    rabbitmq: spawnSync('docker', [...compose, 'exec', '-T', 'rabbitmq', 'rabbitmqctl', 'version'], { encoding: 'utf8' }).stdout.trim() });
  await stop(fanGateway);
}
let ownsStack = false;
// Ownership is granted only after the initial preflight says the project is absent.
const preflight = spawnSync('docker', ['ps', '-aq', '--filter', 'label=com.docker.compose.project=simpel-day3-qa'], { encoding: 'utf8' });
if (preflight.status === 0 && !preflight.stdout.trim()) ownsStack = true;
main().catch(error => {
  console.error(error.stack); process.exitCode = 1;
  if (ownsStack) {
    const logs = spawnSync('docker', [...compose, 'logs', '--no-color', '--tail', '60', 'rabbitmq'], { encoding: 'utf8', timeout: 10000 });
    console.error((logs.stdout || '').slice(-12000));
  }
})
  .finally(async () => {
    for (const child of children) await stop(child).catch(() => child.kill('SIGKILL'));
    if (publisher) await publisher.close();
    if (db) await db.end();
    const output = path.join(root, '.evidence', 'day3-verification.json');
    mkdirSync(path.dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify({ passed: !process.exitCode, checkedAt: new Date().toISOString(), results }, null, 2) + '\n');
    if (ownsStack) docker(['down', '-v']);
    console.log(output);
  });
