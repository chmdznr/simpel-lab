// Lab 4B uses its own names, leaving Lab 3 and Lab 4A topology intact.
const { randomUUID } = require('node:crypto');
const { openPublisher, validateEvent } = require('../layanan/messaging');
const PREFIX = 'lab4b';
async function declare(ch) {
  await ch.assertExchange(`${PREFIX}.unmatched`, 'fanout', { durable: true });
  await ch.assertQueue(`${PREFIX}.unmatched.q`, { durable: true });
  await ch.bindQueue(`${PREFIX}.unmatched.q`, `${PREFIX}.unmatched`, '');
  await ch.assertExchange(`${PREFIX}.topic`, 'topic', { durable: true, alternateExchange: `${PREFIX}.unmatched` });
  for (const [queue, key] of [['jakarta', 'pengajuan.*.jakarta'], ['siup', 'pengajuan.siup.*']]) {
    await ch.assertQueue(`${PREFIX}.${queue}.q`, { durable: true });
    await ch.bindQueue(`${PREFIX}.${queue}.q`, `${PREFIX}.topic`, key);
  }
  await ch.assertExchange(`${PREFIX}.jobs`, 'direct', { durable: true });
  for (const name of ['work', 'retry', 'dlq']) {
    const args = name === 'retry' ? { messageTtl: 2000, deadLetterExchange: `${PREFIX}.jobs`, deadLetterRoutingKey: 'work' } : {};
    await ch.assertQueue(`${PREFIX}.${name}.q`, { durable: true, ...args });
    await ch.bindQueue(`${PREFIX}.${name}.q`, `${PREFIX}.jobs`, name);
  }
  return { exchange: `${PREFIX}.topic` };
}
function event() {
  return { event: 'pengajuan.diterima', schemaVersion: 1, messageId: `evt-${randomUUID()}`,
    correlationId: `corr-${randomUUID()}`, occurredAt: new Date().toISOString(),
    data: { pengajuanId: `SIM-routing-${randomUUID()}`, pemohon: 'Synthetic', jenis: 'siup', kantor: 'jakarta' } };
}
async function main() {
  const [command = 'inspect', value] = process.argv.slice(2);
  if (!['setup', 'inspect', 'publish', 'job', 'worker', 'peek', 'replay'].includes(command)) throw new Error('Unknown command');
  const p = await openPublisher(declare);
  const ch = p.channel;
  try {
    if (command === 'publish') {
      if (!/^pengajuan\.[a-z]+\.[a-z]+$/.test(value || '')) throw new Error('Use pengajuan.<jenis>.<kantor>');
      const e = event(); await p.publish(e, value); console.log(JSON.stringify({ published: e.messageId, key: value }));
    } else if (command === 'job') {
      const failUntil = Number(value ?? 2);
      if (!Number.isInteger(failUntil) || failUntil < 0 || failUntil > 99) throw new Error('failUntil must be 0..99');
      const e = event(); await p.publish(e, 'work', `${PREFIX}.jobs`, { attempt: 1, failUntil });
      console.log(JSON.stringify({ messageId: e.messageId, failUntil }));
    } else if (command === 'worker') {
      await ch.prefetch(1);
      const repaired = process.env.LAB4_REPAIRED === '1';
      const tag = await ch.consume(`${PREFIX}.work.q`, async m => {
        if (!m) return;
        try {
          const e = validateEvent(JSON.parse(m.content.toString()), m.properties);
          const { attempt, failUntil } = m.properties.headers || {};
          if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3 || !Number.isInteger(failUntil) || failUntil < 0 || failUntil > 99) throw new Error('Invalid retry contract');
          const fails = !repaired && attempt <= failUntil;
          if (fails) await p.publish(e, attempt < 3 ? 'retry' : 'dlq', `${PREFIX}.jobs`, { attempt: attempt < 3 ? attempt + 1 : attempt, failUntil });
          ch.ack(m);
          console.log(JSON.stringify({ messageId: e.messageId, attempt, result: fails ? (attempt < 3 ? 'retry' : 'terminal') : 'processed', redelivered: m.fields.redelivered }));
        } catch (error) {
          // Preserve unknown outcomes by closing, not by dropping the source delivery.
          console.error('Worker stopped; inspect the contract and broker before restarting.');
          process.exitCode = 1; await p.close();
        }
      }, { noAck: false });
      console.log(JSON.stringify({ ready: true, queue: `${PREFIX}.work.q`, repaired }));
      await new Promise(resolve => {
        p.connection.once('close', resolve);
        for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await ch.cancel(tag.consumerTag).catch(() => {}); await p.close(); resolve(); });
      });
    } else if (command === 'peek' || command === 'replay') {
      const m = await ch.get(`${PREFIX}.dlq.q`, { noAck: false });
      if (!m) { console.log('DLQ is empty'); return; }
      const e = JSON.parse(m.content.toString());
      if (command === 'replay') {
        if (value !== e.messageId || process.env.LAB4_REPAIRED !== '1') {
          ch.nack(m, false, true); throw new Error('Replay requires the head messageId and LAB4_REPAIRED=1 after repair');
        }
        await p.publish(e, 'work', `${PREFIX}.jobs`, { attempt: 1, failUntil: 0 });
        ch.ack(m); console.log(JSON.stringify({ replayed: e.messageId }));
      } else { console.log(JSON.stringify({ event: e, headers: m.properties.headers }, null, 2)); ch.nack(m, false, true); }
    } else {
      for (const q of ['jakarta', 'siup', 'unmatched', 'work', 'retry', 'dlq']) {
        const r = await ch.checkQueue(`${PREFIX}.${q}.q`);
        console.log(JSON.stringify({ queue: r.queue, ready: r.messageCount, consumers: r.consumerCount }));
      }
    }
  } finally { await p.close(); }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { declare, event };
