// Four independent troubleshooting vhosts. All payloads and receipts are synthetic.
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { setTimeout: delay } = require('node:timers/promises');
const { openPublisher } = require('../layanan/messaging');
const ops = require('./operasi');
function caseId(value) {
  if (!['a', 'b', 'c', 'd'].includes(value)) throw new Error('Case must be a, b, c, or d');
  return value;
}
async function topology(ch, id) {
  await ch.assertExchange('case.unmatched', 'fanout', { durable: true });
  await ch.assertQueue('case.unmatched.q', { durable: true });
  await ch.bindQueue('case.unmatched.q', 'case.unmatched', '');
  await ch.assertExchange('case.events', 'direct', { durable: true, alternateExchange: 'case.unmatched' });
  await ch.assertExchange('case.retry', 'direct', { durable: true });
  await ch.assertQueue('case.work.q', { durable: true });
  if (id !== 'b') await ch.bindQueue('case.work.q', 'case.events', 'task');
  await ch.bindQueue('case.work.q', 'case.retry', 'work');
  await ch.assertQueue('case.retry.q', { durable: true, messageTtl: 2000, deadLetterExchange: 'case.retry', deadLetterRoutingKey: 'work' });
  await ch.bindQueue('case.retry.q', 'case.retry', 'delay');
  await ch.assertQueue('case.dlq', { durable: true });
  await ch.bindQueue('case.dlq', 'case.retry', 'terminal');
  return { exchange: 'case.events' };
}
const publisher = id => openPublisher(ch => topology(ch, id), ops.amqpUrl('lab7-' + id));
async function prepare(id, db) {
  await db.query(readFileSync(path.join(__dirname, '../db/03-operasi.sql'), 'utf8'));
  const inserted = await db.query('INSERT INTO lab7_control(case_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING case_id', [id]);
  if (!inserted.rowCount) throw new Error('Case already exists. Inspect and repair it; preparation will not erase evidence.');
  await ops.vhost('lab7-' + id); const p = await publisher(id);
  try {
    if (id === 'b') await p.channel.bindQueue('case.work.q', 'case.events', 'wrong.key');
    for (let i = 0; i < 5; i++) {
      const event = { messageId: 'case-' + id + '-' + randomUUID(), correlationId: 'lab7-' + id, event: 'task', data: { caseId: id, item: i } };
      await db.query('INSERT INTO lab7_input VALUES($1,$2,$3)', [id, event.messageId, event]);
      await p.publish(event, 'task', 'case.events', { attempt: 1 });
    }
  } finally { await p.close(); }
  return { caseId: id, published: 5, vhost: 'lab7-' + id };
}
async function inspect(id, db) {
  const input = Number((await db.query('SELECT count(*) FROM lab7_input WHERE case_id=$1', [id])).rows[0].count);
  const processed = Number((await db.query('SELECT count(*) FROM lab7_hasil WHERE case_id=$1', [id])).rows[0].count);
  return { caseId: id, expected: input, processed, broker: await ops.snapshot('lab7-' + id) };
}
async function worker(id, db) {
  const p = await publisher(id); const ch = p.channel; let active = 0, stopping = false;
  await ch.prefetch(2);
  const { consumerTag } = await ch.consume('case.work.q', async m => {
    if (!m) return; active++;
    try {
      const e = JSON.parse(m.content.toString());
      const attempt = m.properties.headers?.attempt ?? 1;
      if (e.data?.caseId !== id || typeof e.messageId !== 'string' || !Number.isInteger(attempt) || attempt < 1 || attempt > 3) throw new Error('Invalid case contract');
      const fault = async () => Boolean((await db.query('SELECT fault FROM lab7_control WHERE case_id=$1', [id])).rows[0]?.fault);
      if (id === 'c' && await fault()) {
        console.log(JSON.stringify({ caseId: id, waiting: 'processing dependency', messageId: e.messageId }));
        while (!stopping && await fault()) await delay(200);
        if (stopping) return;
      }
      if (id === 'd' && await fault()) {
        await p.publish(e, attempt < 3 ? 'delay' : 'terminal', 'case.retry', { attempt: Math.min(attempt + 1, 3) });
        ch.ack(m); console.log(JSON.stringify({ caseId: id, attempt, result: attempt < 3 ? 'retry' : 'terminal', messageId: e.messageId }));
        return;
      }
      const r = await db.query('INSERT INTO lab7_hasil(case_id,message_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, e.messageId]);
      ch.ack(m); console.log(JSON.stringify({ caseId: id, committed: e.messageId, duplicate: r.rowCount === 0 }));
    } catch (_) { console.error('Case worker stopped; inspect payload, database, and broker. Source delivery was not acknowledged.'); process.exitCode = 1; await p.close(); }
    finally { active--; }
  }, { noAck: false });
  console.log(JSON.stringify({ ready: true, caseId: id, queue: 'case.work.q' }));
  await new Promise(resolve => {
    p.connection.once('close', () => { stopping = true; resolve(); });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
      if (stopping) return; stopping = true; await ch.cancel(consumerTag).catch(() => {});
      while (active) await delay(25); await p.close(); resolve();
    });
  });
}
async function repair(id, db) {
  if (id === 'a') return { next: 'Start: npm run kasus -- worker a. Keep the original five IDs.' };
  await db.query('UPDATE lab7_control SET fault=false WHERE case_id=$1', [id]);
  const p = await publisher(id);
  try {
    if (id === 'b') {
      await p.channel.bindQueue('case.work.q', 'case.events', 'task');
      await p.channel.unbindQueue('case.work.q', 'case.events', 'wrong.key');
    }
    if (id === 'b' || id === 'd') {
      const queue = id === 'b' ? 'case.unmatched.q' : 'case.dlq'; let replayed = 0;
      while (replayed < 5) {
        const m = await p.channel.get(queue, { noAck: false }); if (!m) break;
        const e = JSON.parse(m.content.toString());
        const known = await db.query('SELECT 1 FROM lab7_input WHERE case_id=$1 AND message_id=$2', [id, e.messageId]);
        if (!known.rowCount) { p.channel.nack(m, false, true); throw new Error('Unexpected message preserved; inspect before replay'); }
        await p.publish(e, 'task', 'case.events', { attempt: 1 }); p.channel.ack(m); replayed++;
      }
      return { repaired: id, replayed };
    }
    return { repaired: id, dependencyRecovered: true };
  } finally { await p.close(); }
}
async function verify(id, db) {
  const input = (await db.query('SELECT message_id FROM lab7_input WHERE case_id=$1 ORDER BY message_id', [id])).rows.map(x => x.message_id);
  const done = (await db.query('SELECT message_id FROM lab7_hasil WHERE case_id=$1 ORDER BY message_id', [id])).rows.map(x => x.message_id);
  const passed = input.length === 5 && JSON.stringify(input) === JSON.stringify(done);
  return { caseId: id, passed, expected: input.length, processed: done.length, missing: input.filter(x => !done.includes(x)) };
}
async function main() {
  const [command, value] = process.argv.slice(2), id = caseId(value);
  const db = new Pool({ connectionString: ops.dbUrl, max: 3, connectionTimeoutMillis: 3000 });
  try {
    let result;
    if (command === 'prepare') result = await prepare(id, db);
    else if (command === 'inspect') result = await inspect(id, db);
    else if (command === 'worker') await worker(id, db);
    else if (command === 'repair') result = await repair(id, db);
    else if (command === 'verify') { result = await verify(id, db); if (!result.passed) process.exitCode = 1; }
    else throw new Error('Use prepare, inspect, worker, repair, or verify, followed by a..d');
    if (result) console.log(JSON.stringify(result, null, 2));
  } finally { await db.end(); }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { prepare, inspect, worker, repair, verify };
