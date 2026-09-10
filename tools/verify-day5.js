// One integration check owns only simpel-day5-qa. Participant stacks are never reset.
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const ops = require('./operasi');
const cases = require('./kasus');
const { openPublisher } = require('../layanan/messaging');
const root = path.resolve(__dirname, '..');
const compose = ['compose', '-p', 'simpel-day5-qa', '-f', 'lab/lab6-monitoring/compose.yml'];
const children = [], evidence = { startedAt: new Date().toISOString(), node: process.version, checks: [] };
let owned = false, db;
function docker(args) {
  const r = spawnSync('docker', args, { cwd: root, encoding: 'utf8', timeout: 180000 });
  if (r.status !== 0) throw new Error('Docker command failed: ' + (r.stderr || '').slice(-500));
  return r.stdout.trim();
}
async function until(label, check, timeout = 35000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await delay(500); }
  throw new Error('Timed out: ' + label);
}
async function prom(expression) {
  const r = await fetch('http://127.0.0.1:9095/api/v1/query?query=' + encodeURIComponent(expression), { signal: AbortSignal.timeout(5000) });
  assert(r.ok); const j = await r.json(); assert.equal(j.status, 'success'); return j.data.result;
}
function start(script, ...args) {
  const p = spawn(process.execPath, [script, ...args], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  p.log = ''; p.stdout.on('data', d => { p.log += d; }); p.stderr.on('data', d => { p.log += d; });
  children.push(p); return p;
}
function queue(state, name) { return state.broker.queues.find(q => q.name === name); }
async function main() {
  assert(!Object.keys(process.env).some(k => /^OPS_/.test(k)), 'Unset OPS_* overrides before isolated QA');
  assert.equal(docker(['ps', '-aq', '--filter', 'label=com.docker.compose.project=simpel-day5-qa']), '', 'Existing QA stack: refusing to erase it');
  assert.equal(docker(['volume', 'ls', '-q', '--filter', 'label=com.docker.compose.project=simpel-day5-qa']), '', 'Existing QA volumes: refusing to erase evidence');
  owned = true; docker([...compose, 'up', '-d', '--wait']);
  db = new Pool({ connectionString: ops.dbUrl, max: 3 });
  await ops.setup(); await ops.permissions(); evidence.permissions = await ops.probe();
  evidence.brokerVersion = (await ops.api('/overview')).rabbitmq_version;
  await until('RabbitMQ scrape', async () => (await prom('up{job="rabbitmq"}')).some(x => x.value[1] === '1'));
  await until('No-consumer alert firing', async () => (await prom('ALERTS{alertname="SimpelQueueWithoutConsumer",vhost="lab6",alertstate="firing"}')).length > 0);
  evidence.checks.push('real queue series; no-consumer alert fired');
  const consumer = start('tools/operasi.js', 'consumer');
  await until('Monitoring consumer ready', () => consumer.log.includes('"ready":true'));
  const p = await openPublisher(ops.topology, ops.amqpUrl('lab6'));
  try {
    for (let i = 0; i < 100; i++) await p.publish({ messageId: 'qa-monitor-' + i, correlationId: 'day5', event: 'demo' }, 'demo');
  } finally { await p.close(); }
  await until('Monitoring queue drained', async () => {
    const s = await ops.snapshot(); return s.queues.every(q => q.ready === 0 && q.unacked === 0);
  });
  await until('Alert cleared', async () => !(await prom('ALERTS{alertname="SimpelQueueWithoutConsumer",vhost="lab6",alertstate="firing"}')).length);
  const dashboard = JSON.parse(readFileSync(path.join(root, 'lab/lab6-monitoring/grafana/dashboards/simpel.json')));
  for (const panel of dashboard.panels) for (const query of panel.targets) {
    await until('Dashboard series: ' + panel.title, async () => {
      const series = await prom(query.expr.replaceAll('$vhost', 'lab6')); return series.length > 0 && series.every(s => Number.isFinite(Number(s.value[1])));
    });
  }
  const auth = 'Basic ' + Buffer.from('labops:labops-only').toString('base64');
  const dashboardResponse = await fetch('http://127.0.0.1:3005/api/dashboards/uid/simpel-ops', { headers: { authorization: auth } });
  assert(dashboardResponse.ok); assert.equal((await dashboardResponse.json()).dashboard.panels.length, 6);
  evidence.checks.push('alert cleared; all seven panel queries returned numeric series; Grafana dashboard provisioned');
  evidence.cases = [];
  for (const id of ['a', 'b', 'c', 'd']) {
    await cases.prepare(id, db);
    let worker;
    if (id !== 'a') {
      worker = start('tools/kasus.js', 'worker', id);
      await until('Case worker ' + id, () => worker.log.includes('"ready":true'));
    }
    await until('Case fault ' + id, async () => {
      const s = await cases.inspect(id, db), q = queue(s, 'case.work.q');
      return id === 'a' ? q.ready === 5 && q.consumers === 0 : id === 'b' ? queue(s, 'case.unmatched.q').ready === 5 :
        id === 'c' ? q.unacked === 2 && q.ready === 3 : queue(s, 'case.dlq').ready === 5;
    });
    const before = await cases.inspect(id, db); assert.equal(before.processed, 0);
    await cases.repair(id, db);
    if (id === 'a') worker = start('tools/kasus.js', 'worker', id);
    await until('Five exact receipts for ' + id, async () => (await cases.verify(id, db)).passed);
    await until('All case queues drained ' + id, async () => (await cases.inspect(id, db)).broker.queues.every(q => q.ready === 0 && q.unacked === 0));
    const after = await cases.verify(id, db);
    if (id === 'b') {
      const bindings = await ops.api('/bindings/lab7-b');
      assert(bindings.some(b => b.source === 'case.events' && b.routing_key === 'task'));
      assert(!bindings.some(b => b.source === 'case.events' && b.routing_key === 'wrong.key'));
    }
    if (id === 'd') assert.equal(worker.log.split('"result":"terminal"').length - 1, 5);
    evidence.cases.push({ id, before, after }); console.log('PASS case ' + id + ': five original IDs committed once');
  }
  // Bounded alarm injection on the stack created above, never by exhausting host memory.
  try {
    docker([...compose, 'exec', '-T', 'rabbitmq', 'rabbitmqctl', 'set_vm_memory_high_watermark', 'absolute', '1MB']);
    await until('Memory alarm visible', async () => (await ops.snapshot()).nodes.some(n => n.memoryAlarm), 10000);
    evidence.checks.push('memory alarm observed through Management API');
  } finally {
    docker([...compose, 'exec', '-T', 'rabbitmq', 'rabbitmqctl', 'set_vm_memory_high_watermark', '0.6']);
  }
  await until('Memory alarm cleared', async () => (await ops.snapshot()).nodes.every(n => !n.memoryAlarm));
  evidence.checks.push('memory threshold restored; alarm cleared');
  evidence.passed = true; console.log('PASS day five: monitoring, permissions, four repairs, alarm restoration');
  if (process.argv.includes('--browser-fixture')) {
    console.log('Browser fixture ready on Grafana :3005 and Management :15695; SIGTERM stops this owned stack.');
    await new Promise(resolve => { process.once('SIGTERM', resolve); process.once('SIGINT', resolve); });
  }
}
async function cleanup() {
  for (const p of children) if (p.exitCode === null) p.kill('SIGTERM');
  await Promise.all(children.map(p => p.exitCode !== null ? undefined : Promise.race([once(p, 'exit'), delay(3000).then(() => p.kill('SIGKILL'))])));
  if (db) await db.end();
  if (owned) docker([...compose, 'down', '-v']);
  mkdirSync(path.join(root, '.evidence'), { recursive: true });
  writeFileSync(path.join(root, '.evidence/day5.json'), JSON.stringify(evidence, null, 2) + '\n');
}
main().catch(e => { evidence.error = e.message; console.error(e.message); process.exitCode = 1; }).finally(cleanup);
