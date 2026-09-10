// Shared AMQP boundaries used by the day-three gateway and workers.
const amqp = require('amqplib');

function integer(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function topology() {
  const mode = process.env.SIMPEL_MODE || 'work';
  if (!['work', 'fanout'].includes(mode)) throw new Error('SIMPEL_MODE must be work or fanout');
  return mode === 'work'
    ? { mode, exchange: 'simpel.events', type: 'topic', validation: 'validasi.q' }
    : { mode, exchange: 'simpel.fanout', type: 'fanout', validation: 'validasi.fanout.q' };
}

async function declareTopology(channel, spec = topology()) {
  // Invalid contracts are retained for inspection. Timed retries belong to Lab 4B.
  await channel.assertExchange('simpel.invalid', 'direct', { durable: true });
  await channel.assertQueue('pengajuan.invalid', { durable: true });
  await channel.bindQueue('pengajuan.invalid', 'simpel.invalid', 'invalid');
  await channel.assertExchange(spec.exchange, spec.type, { durable: true });
  const options = { durable: true, deadLetterExchange: 'simpel.invalid', deadLetterRoutingKey: 'invalid' };
  await channel.assertQueue(spec.validation, options);
  await channel.bindQueue(spec.validation, spec.exchange, 'pengajuan.diterima');
  if (spec.mode === 'fanout') {
    await channel.assertQueue('tracking.q', options);
    await channel.bindQueue('tracking.q', spec.exchange, '');
  }
  return spec;
}

function validateEvent(event, properties = {}) {
  if (!event || event.event !== 'pengajuan.diterima' || event.schemaVersion !== 1) throw new Error('Unsupported event or schemaVersion');
  for (const key of ['messageId', 'correlationId']) {
    if (typeof event[key] !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(event[key])) throw new Error(`Invalid ${key}`);
  }
  if (typeof event.occurredAt !== 'string' || !Number.isFinite(Date.parse(event.occurredAt))) throw new Error('Invalid occurredAt');
  for (const key of ['pengajuanId', 'pemohon', 'jenis', 'kantor']) {
    if (typeof event.data?.[key] !== 'string' || !event.data[key].trim() || event.data[key].length > 160) throw new Error(`Invalid data.${key}`);
  }
  if (properties.messageId && properties.messageId !== event.messageId) throw new Error('Conflicting messageId');
  if (properties.correlationId && properties.correlationId !== event.correlationId) throw new Error('Conflicting correlationId');
  return event;
}

async function openPublisher() {
  const connection = await amqp.connect(process.env.AMQP_URL || 'amqp://simpel:simpel123@localhost:5672');
  connection.on('error', () => {}); // Close rejects pending work; never print connection URLs.
  let channel, spec;
  try {
    channel = await connection.createConfirmChannel();
    channel.on('error', () => {}); // Topology errors may arrive before setup finishes.
    spec = await declareTopology(channel);
  } catch (error) {
    await connection.close().catch(() => {});
    throw error;
  }
  const pending = new Map();
  let ready = true;
  let buffered = false;
  function failPending(reason) {
    ready = false;
    for (const job of pending.values()) job.finish(new Error(reason));
  }
  channel.on('error', () => failPending('Publisher channel failed; outcome may be unknown'));
  channel.on('close', () => {
    failPending('Publisher channel closed; outcome may be unknown');
    void connection.close().catch(() => {});
  });
  connection.on('close', () => failPending('Broker connection closed; outcome may be unknown'));
  channel.on('drain', () => { buffered = false; });
  channel.on('return', message => {
    const job = pending.get(message.properties.messageId);
    if (job) job.returned = true;
  });
  return {
    channel, connection, spec,
    isReady: () => ready && !buffered,
    publish(event, routingKey = 'pengajuan.diterima', exchange = spec.exchange) {
      if (!ready || buffered) return Promise.reject(new Error('Publisher is not ready'));
      if (pending.has(event.messageId)) return Promise.reject(new Error('The same messageId is already in flight'));
      return new Promise((resolve, reject) => {
        const job = { returned: false, timer: null, finish(error) {
          if (!pending.has(event.messageId)) return;
          pending.delete(event.messageId);
          clearTimeout(job.timer);
          error ? reject(error) : resolve();
        } };
        pending.set(event.messageId, job);
        job.timer = setTimeout(() => job.finish(new Error('Confirm timed out; outcome may be unknown')), 10000);
        try {
          const writable = channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(event)), {
            persistent: true, mandatory: true, contentType: 'application/json',
            messageId: event.messageId, correlationId: event.correlationId,
          }, error => job.finish(error || (job.returned ? new Error('Unroutable publication') : null)));
          // publish()'s boolean is local buffer pressure, not broker acceptance.
          if (!writable) buffered = true;
        } catch (error) { job.finish(error); }
      });
    },
    async close() {
      ready = false;
      await channel.close().catch(() => {});
      await connection.close().catch(() => {});
    },
  };
}

module.exports = { integer, topology, declareTopology, validateEvent, openPublisher };
