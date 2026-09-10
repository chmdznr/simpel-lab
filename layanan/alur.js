// Five concrete roles, one teaching implementation. No new runtime dependencies.
const express = require('express');
const { Pool } = require('pg');
const { randomUUID, createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { openPublisher, integer, validateEvent } = require('./messaging');
const roles = ['gateway', 'validasi', 'billing', 'notifikasi', 'tracking'];
const subscriptions = { validasi: ['pengajuan.diterima', 'billing.gagal'], billing: ['validasi.selesai'],
  notifikasi: ['billing.terbit'], tracking: ['#'] };
const eventNames = ['pengajuan.diterima', 'validasi.selesai', 'billing.terbit', 'notifikasi.terkirim', 'billing.gagal', 'pengajuan.dibatalkan'];
async function declare(ch) {
  await ch.assertExchange('alur.events', 'topic', { durable: true });
  await ch.assertExchange('alur.dead', 'direct', { durable: true });
  for (const [role, keys] of Object.entries(subscriptions)) {
    await ch.assertQueue(`alur.${role}.q`, { durable: true });
    for (const key of keys) await ch.bindQueue(`alur.${role}.q`, 'alur.events', key);
    await ch.assertQueue(`alur.${role}.dlq`, { durable: true });
    await ch.bindQueue(`alur.${role}.dlq`, 'alur.dead', role);
  }
  // Direct retry destinations avoid broadcasting a retry to other subscribers.
  await ch.assertExchange('alur.retry', 'direct', { durable: true });
  for (const role of Object.keys(subscriptions)) await ch.bindQueue(`alur.${role}.q`, 'alur.retry', role);
  return { exchange: 'alur.events' };
}
function nextEvent(input, name) {
  return { ...input, event: name, messageId: `evt-${createHash('sha256').update(input.messageId + ':' + name).digest('hex')}`, occurredAt: new Date().toISOString() };
}
async function enqueue(c, owner, event, key = event.event, milliseconds = 0, headers = {}, exchange = 'alur.events') {
  await c.query("INSERT INTO alur_outbox(id,owner,routing_key,event,headers,available_at) VALUES($1,$2,$3,$4,$5,now()+($6 * interval '1 millisecond')) ON CONFLICT DO NOTHING",
    [randomUUID(), owner, key, event, { ...headers, exchange }, milliseconds]);
}
async function transaction(pool, work) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const result = await work(c); await c.query('COMMIT'); return result; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
  finally { c.release(); }
}
function validate(event, props) {
  if (!eventNames.includes(event?.event)) throw new Error('Unknown workflow event');
  validateEvent({ ...event, event: 'pengajuan.diterima' }, props);
}
async function effect(c, role, e) {
  const id = e.data.pengajuanId;
  if (role === 'validasi' && e.event === 'pengajuan.diterima') {
    await c.query('SELECT pg_sleep($1)', [integer('ALUR_WORK_MS', 120, 0, 5000) / 1000]);
    await c.query("INSERT INTO alur_validasi VALUES($1,'reserved') ON CONFLICT DO NOTHING", [id]);
    return nextEvent(e, 'validasi.selesai');
  }
  if (role === 'validasi' && e.event === 'billing.gagal') {
    // Compensation changes a business reservation; it does not erase history.
    await c.query("UPDATE alur_validasi SET status='cancelled' WHERE pengajuan_id=$1 AND status='reserved'", [id]);
    return nextEvent(e, 'pengajuan.dibatalkan');
  }
  if (role === 'billing') {
    if (e.data.jenis === 'uji-gagal') throw new Error('Synthetic permanent billing failure');
    const valid = await c.query("SELECT 1 FROM alur_validasi WHERE pengajuan_id=$1 AND status='reserved'", [id]);
    if (!valid.rowCount) throw new Error('Validation reservation is absent');
    await c.query('INSERT INTO alur_billing VALUES($1,$2) ON CONFLICT DO NOTHING', [id, `BIL-${id}`]);
    return nextEvent(e, 'billing.terbit');
  }
  if (role === 'notifikasi') {
    await delay(integer('ALUR_NOTIF_MS', 300, 0, 5000));
    // ponytail: a durable simulated notification, not a real email/SMS API.
    await c.query('INSERT INTO alur_notifikasi(pengajuan_id) VALUES($1) ON CONFLICT DO NOTHING', [id]);
    return nextEvent(e, 'notifikasi.terkirim');
  }
  if (role === 'tracking') {
    await c.query('INSERT INTO alur_tracking VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [e.messageId, id, e.event]);
    return null;
  }
  throw new Error('Event is not supported by this subscription');
}
async function main() {
  const role = process.argv[2];
  if (!roles.includes(role)) throw new Error('Role must be gateway, validasi, billing, notifikasi, or tracking');
  const sync = process.env.ALUR_TRANSPORT === 'sync';
  if (sync && role !== 'gateway') throw new Error('The controlled synchronous comparator runs in the gateway');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL,
    max: integer('ALUR_POOL_MAX', 4, 1, 16), connectionTimeoutMillis: 15000,
    statement_timeout: 15000, application_name: `alur-${sync ? 'sync' : role}` });
  pool.on('error', () => console.error('Idle database connection failed; the next operation will retry.'));
  await pool.query('SELECT 1 FROM alur_outbox LIMIT 1');
  let stopping = false, publisher, server, consumeTag, active = 0;
  const log = data => console.log(JSON.stringify({ role, ...data }));
  async function processEvent(e, props = {}, emit = true) {
    validate(e, props);
    return transaction(pool, async c => {
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [role, e.messageId]);
      const inserted = await c.query('INSERT INTO alur_inbox VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING message_id', [role, e.messageId]);
      if (!inserted.rowCount) { log({ duplicate: e.messageId }); return; }
      const output = await effect(c, role, e);
      if (output && emit) await enqueue(c, role, output);
      return output;
    });
  }
  async function retry(e, attempt) {
    await transaction(pool, async c => {
      // Serialize a failure decision with a concurrent successful copy of this delivery.
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [role, e.messageId]);
      // A lost commit/ack response is not evidence that the business transaction failed.
      if ((await c.query('SELECT 1 FROM alur_inbox WHERE layanan=$1 AND message_id=$2', [role, e.messageId])).rowCount) return;
      await c.query('INSERT INTO alur_retry VALUES($1,$2,0) ON CONFLICT DO NOTHING', [role, e.messageId]);
      const previous = (await c.query('SELECT failures FROM alur_retry WHERE layanan=$1 AND message_id=$2 FOR UPDATE', [role, e.messageId])).rows[0].failures;
      if (previous >= attempt) return;
      await c.query('UPDATE alur_retry SET failures=$3 WHERE layanan=$1 AND message_id=$2', [role, e.messageId, attempt]);
      if (attempt < 3) await enqueue(c, role, e, role, 2000, { attempt: attempt + 1 }, 'alur.retry');
      else {
        await enqueue(c, role, e, role, 0, { attempt, reason: 'attempt_limit' }, 'alur.dead');
        await c.query('INSERT INTO alur_inbox VALUES($1,$2) ON CONFLICT DO NOTHING', [role, e.messageId]);
        if (role === 'billing') await enqueue(c, role, nextEvent(e, 'billing.gagal'));
      }
    });
    log({ retry: e.messageId, attempt, terminal: attempt === 3 });
  }
  async function connect() {
    const p = await openPublisher(declare);
    if (role !== 'gateway') {
      await p.channel.prefetch(integer('ALUR_PREFETCH', 1, 1, 16));
      consumeTag = (await p.channel.consume(`alur.${role}.q`, async m => {
        if (!m || stopping) return;
        active++;
        let e, contractValid = false, committed = false;
        const attempt = m.properties.headers?.attempt ?? 1;
        try {
          e = JSON.parse(m.content.toString()); validate(e, m.properties);
          if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3) throw new Error('Invalid attempt');
          if (role !== 'tracking' && !subscriptions[role].includes(e.event)) throw new Error('Wrong subscription');
          contractValid = true;
          await processEvent(e, m.properties);
          committed = true;
          log({ committed: e.messageId, event: e.event });
          const ackDelay = integer('ALUR_ACK_DELAY_MS', 0, 0, 10000);
          if (ackDelay) await delay(ackDelay);
          p.channel.ack(m);
        } catch (_) {
          try {
            if (committed) { await p.close(); return; }
            if (contractValid) await retry(e, attempt);
            else {
              // Preserve the raw invalid bytes in a confirmed terminal publication.
              const bad = { messageId: `invalid-${randomUUID()}`, correlationId: 'invalid', raw: m.content.toString('base64') };
              await p.publish(bad, role, 'alur.dead', { reason: 'invalid_contract' });
            }
            p.channel.ack(m);
          } catch (_) { await p.close(); }
        } finally { active--; }
      }, { noAck: false })).consumerTag;
    }
    log({ ready: true }); return p;
  }
  async function relay() {
    while (!stopping) {
      try {
        if (!publisher?.isReady()) { await publisher?.close(); publisher = await connect(); }
        const sent = await transaction(pool, async c => {
          const row = (await c.query('SELECT * FROM alur_outbox WHERE owner=$1 AND published_at IS NULL AND available_at<=now() ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1', [role])).rows[0];
          if (!row) return false;
          await publisher.publish(row.event, row.routing_key, row.headers.exchange, row.headers);
          await c.query('UPDATE alur_outbox SET published_at=now() WHERE id=$1', [row.id]);
          return true;
        });
        if (!sent) await delay(100);
      } catch (_) { log({ waiting: 'broker or database recovery' }); await publisher?.close(); publisher = null; await delay(1000); }
    }
  }
  let relayTask;
  if (!sync) relayTask = relay();
  if (role === 'gateway') {
    const app = express(); app.use(express.json({ limit: '16kb' }));
    app.get('/health', async (_req, res) => {
      try { await pool.query('SELECT 1'); res.json({ ready: true, brokerReady: Boolean(publisher?.isReady()), transport: sync ? 'sync' : 'async' }); }
      catch (_) { res.status(503).json({ ready: false }); }
    });
    app.get('/pengajuan/:id', async (req, res) => {
      if (!/^SIM-[a-f0-9]{32}$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
      try {
        const r = await pool.query("SELECT p.id, p.correlation_id, CASE WHEN v.status='cancelled' THEN 'DIBATALKAN' WHEN n.pengajuan_id IS NOT NULL THEN 'SELESAI' WHEN b.pengajuan_id IS NOT NULL THEN 'BILLING_TERBIT' WHEN v.pengajuan_id IS NOT NULL THEN 'VALID' ELSE 'DITERIMA' END AS status FROM alur_pengajuan p LEFT JOIN alur_validasi v ON v.pengajuan_id=p.id LEFT JOIN alur_billing b ON b.pengajuan_id=p.id LEFT JOIN alur_notifikasi n ON n.pengajuan_id=p.id WHERE p.id=$1", [req.params.id]);
        if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
      } catch (_) { res.status(503).json({ error: 'Status temporarily unavailable' }); }
    });
    app.post('/pengajuan', async (req, res) => {
      const key = req.get('Idempotency-Key');
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(key || '')) return res.status(400).json({ error: 'Idempotency-Key is required (1..100 safe characters)' });
      const body = {};
      for (const field of ['pemohon', 'jenis', 'kantor']) {
        if (typeof req.body?.[field] !== 'string' || !req.body[field].trim() || req.body[field].length > 120) return res.status(400).json({ error: `Invalid ${field}` });
        body[field] = req.body[field].trim();
      }
      const id = `SIM-${createHash('sha256').update(key).digest('hex').slice(0, 32)}`;
      const e = { event: 'pengajuan.diterima', schemaVersion: 1, messageId: `evt-${id}`, correlationId: `corr-${randomUUID()}`,
        occurredAt: new Date().toISOString(), data: { pengajuanId: id, ...body } };
      try {
        const stored = await transaction(pool, async c => {
          const inserted = await c.query('INSERT INTO alur_pengajuan(id,request_key,payload,correlation_id) VALUES($1,$2,$3,$4) ON CONFLICT(request_key) DO NOTHING RETURNING id', [id, key, body, e.correlationId]);
          const existing = (await c.query('SELECT * FROM alur_pengajuan WHERE request_key=$1', [key])).rows[0];
          if (Object.keys(body).some(k => existing.payload[k] !== body[k])) return { conflict: true };
          if (inserted.rowCount && !sync) await enqueue(c, role, e);
          return existing;
        });
        if (stored.conflict) return res.status(409).json({ error: 'Idempotency-Key was used for a different payload' });
        if (sync) {
          // Same business work and SQL effects as async, but one sequential request.
          // ponytail: a controlled comparator, not the older four-HTTP-service demo.
          let current = e;
          for (const service of ['validasi', 'billing', 'notifikasi']) {
            const input = current;
            current = await transaction(pool, c => effect(c, service, input));
            await transaction(pool, c => effect(c, 'tracking', input));
          }
          await transaction(pool, c => effect(c, 'tracking', current));
        }
        res.status(sync ? 200 : 202).location(`/pengajuan/${id}`).json({ pengajuanId: id, correlationId: stored.correlation_id,
          status: sync ? 'SELESAI' : 'DITERIMA', statusUrl: `/pengajuan/${id}` });
      } catch (_) { res.status(503).json({ error: 'Request outcome may be unknown; retry with the same Idempotency-Key' }); }
    });
    app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: 'Invalid JSON request' }));
    server = app.listen(integer('PORT_GATEWAY', 3001, 1024, 65535), '127.0.0.1', () => log({ ready: true, http: true }));
  }
  async function stop() {
    if (stopping) return; stopping = true;
    const httpClosed = server ? new Promise(resolve => server.close(resolve)) : Promise.resolve();
    if (consumeTag) await publisher?.channel.cancel(consumeTag).catch(() => {});
    await httpClosed;
    const deadline = Date.now() + 12000;
    while (active && Date.now() < deadline) await delay(25);
    await relayTask;
    await publisher?.close(); await pool.end();
  }
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void stop(); });
}
if (require.main === module) main().catch(() => { console.error('Workflow startup failed. Check schema, role, and local connections.'); process.exitCode = 1; });
module.exports = { declare, nextEvent, enqueue, transaction, validate, effect };
