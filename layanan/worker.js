// Two concrete consumers share lifecycle, validation, and acknowledgement rules.
const amqp = require('amqplib');
const { Pool } = require('pg');
const { setTimeout: delay } = require('node:timers/promises');
const { integer, topology, declareTopology, validateEvent } = require('./messaging');

async function runWorker(role) {
  if (!['validasi', 'tracking'].includes(role)) throw new Error('Unknown worker role');
  const spec = topology();
  if (role === 'tracking' && spec.mode !== 'fanout') throw new Error('Tracking requires SIMPEL_MODE=fanout');
  const prefetch = integer('VALIDASI_PREFETCH', 1, 1, 100);
  const workMs = role === 'validasi' ? integer('VALIDASI_KERJA_MS', 120, 0, 5000) : 0;
  const ackDelay = integer('VALIDASI_ACK_DELAY_MS', 0, 0, 10000);
  const worker = process.env.WORKER_ID || `${role}-${process.pid}`;
  if (!/^[A-Za-z0-9-]{1,40}$/.test(worker)) throw new Error('Invalid WORKER_ID');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL,
    max: integer('VALIDASI_POOL_MAX', 4, 1, 16), connectionTimeoutMillis: 3000,
    statement_timeout: 10000, application_name: `simpel-${worker}` });
  await pool.query('SELECT 1');
  const connection = await amqp.connect(process.env.AMQP_URL || 'amqp://simpel:simpel123@localhost:5672');
  connection.on('error', () => {});
  const channel = await connection.createChannel();
  await declareTopology(channel, spec);
  const queue = role === 'validasi' ? spec.validation : 'tracking.q';
  // TODO(Lab 3d): compare 1 and 100 via the environment; do not assume CPU falls.
  await channel.prefetch(prefetch);
  let active = 0;
  let stopping = false;
  let channelOpen = true;
  let consumerTag;
  const cpuStart = process.cpuUsage();
  const stats = { received: 0, stored: 0, duplicates: 0, rejected: 0, dbErrors: 0,
    maxInFlight: 0, maxPoolWaiting: 0, dbAndWaitMs: 0 };
  const log = data => console.log(JSON.stringify({ service: role, worker, ...data }));
  function metrics(final = false) {
    const cpu = process.cpuUsage(cpuStart);
    log({ metrics: true, final, ...stats, inFlight: active, poolWaiting: pool.waitingCount,
      cpuMs: Number(((cpu.user + cpu.system) / 1000).toFixed(2)) });
  }
  const timer = setInterval(metrics, 1000);
  timer.unref();
  async function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    if (consumerTag && channelOpen) await channel.cancel(consumerTag).catch(() => {});
    const deadline = Date.now() + 12000;
    while (active && Date.now() < deadline) await delay(25);
    clearInterval(timer);
    metrics(true);
    await channel.close().catch(() => {});
    await connection.close().catch(() => {});
    await pool.end();
  }
  channel.on('error', () => { channelOpen = false; void stop(1); });
  channel.on('close', () => { channelOpen = false; if (!stopping) void stop(1); });
  connection.on('close', () => { channelOpen = false; if (!stopping) void stop(1); });
  pool.on('error', () => { log({ error: 'Database connection failed' }); void stop(1); });
  process.once('SIGINT', () => { void stop(); });
  process.once('SIGTERM', () => { void stop(); });
  const consumed = await channel.consume(queue, async message => {
    if (!message) { if (!stopping) void stop(1); return; }
    if (stopping) { if (channelOpen) channel.nack(message, false, true); return; }
    active++;
    stats.received++;
    stats.maxInFlight = Math.max(stats.maxInFlight, active);
    let event;
    try {
      event = validateEvent(JSON.parse(message.content.toString('utf8')), message.properties);
    } catch (error) {
      stats.rejected++;
      log({ rejected: true, reason: error.message });
      // The predeclared DLX retains malformed contracts for this local exercise.
      if (channelOpen) channel.nack(message, false, false);
      active--;
      return;
    }
    let client;
    const started = performance.now();
    try {
      const acquired = pool.connect();
      stats.maxPoolWaiting = Math.max(stats.maxPoolWaiting, pool.waitingCount);
      client = await acquired;
      // A controlled I/O workload makes pool pressure observable; this is not CPU work.
      if (workMs) await client.query('SELECT pg_sleep($1)', [workMs / 1000]);
      const data = event.data;
      const result = role === 'validasi'
        ? await client.query("INSERT INTO pengajuan (id,pemohon,jenis,kantor,status) VALUES ($1,$2,$3,$4,'valid') ON CONFLICT (id) DO NOTHING", [data.pengajuanId, data.pemohon, data.jenis, data.kantor])
        : await client.query('INSERT INTO jejak_pengajuan (message_id,pengajuan_id,event) VALUES ($1,$2,$3) ON CONFLICT (message_id) DO NOTHING', [event.messageId, data.pengajuanId, event.event]);
      stats[result.rowCount ? 'stored' : 'duplicates']++;
      stats.dbAndWaitMs += Math.round(performance.now() - started);
      client.release();
      client = null;
      log({ committed: true, messageId: event.messageId, pengajuanId: data.pengajuanId,
        duplicate: result.rowCount === 0, redelivered: message.fields.redelivered });
      if (ackDelay) await delay(ackDelay); // Classroom crash window; disabled by default.
      // TODO(Lab 3b): explain why moving this line before the INSERT creates a loss window.
      if (channelOpen) channel.ack(message);
    } catch (_error) {
      stats.dbErrors++;
      log({ error: 'Database processing failed; stopping to avoid an immediate requeue loop', messageId: event.messageId });
      // Leave failed work unacked. Closing after cancellation returns it for a later restart.
      void stop(1);
    } finally {
      if (client) client.release();
      active--;
    }
  }, { noAck: false });
  consumerTag = consumed.consumerTag;
  log({ ready: true, queue, prefetch, poolMax: pool.options.max, workMs });
}

module.exports = { runWorker };
