// Day-five tools use their own stack and ports; they never read the participant .env.
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { openPublisher } = require('../layanan/messaging');
const root = path.resolve(__dirname, '..');
const user = process.env.OPS_USER || 'labops';
const password = process.env.OPS_PASSWORD || 'labops-only';
const apiBase = process.env.OPS_API_URL || 'http://127.0.0.1:15695';
const dbUrl = process.env.OPS_DATABASE_URL || 'postgres://labops:labops-only@127.0.0.1:5475/labops';
function amqpUrl(vhost, name = user, secret = password) {
  const url = new URL(process.env.OPS_AMQP_URL || 'amqp://127.0.0.1:5775');
  url.username = name; url.password = secret; url.pathname = '/' + encodeURIComponent(vhost);
  return url.toString();
}
async function api(resource, method = 'GET', body) {
  const response = await fetch(apiBase + '/api' + resource, {
    method, headers: { authorization: 'Basic ' + Buffer.from(user + ':' + password).toString('base64'), 'content-type': 'application/json' },
    signal: AbortSignal.timeout(10000), ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  if (!response.ok) throw new Error('Management API ' + method + ' returned HTTP ' + response.status);
  const text = await response.text(); return text ? JSON.parse(text) : null;
}
async function vhost(name) {
  await api('/vhosts/' + encodeURIComponent(name), 'PUT', {});
  await api('/permissions/' + encodeURIComponent(name) + '/' + encodeURIComponent(user), 'PUT', { configure: '.*', write: '.*', read: '.*' });
}
async function topology(ch) {
  await ch.assertExchange('lab6.events', 'direct', { durable: true });
  await ch.assertExchange('lab6.other', 'direct', { durable: true });
  await ch.assertQueue('lab6.q', { durable: true });
  await ch.bindQueue('lab6.q', 'lab6.events', 'demo');
  return { exchange: 'lab6.events' };
}
async function setup() {
  await vhost('lab6'); const p = await openPublisher(topology, amqpUrl('lab6')); await p.close();
}
async function snapshot(name = 'lab6') {
  const [queues, nodes, connections] = await Promise.all([api('/queues/' + encodeURIComponent(name)), api('/nodes'), api('/connections')]);
  return {
    sampledAt: new Date().toISOString(),
    queues: queues.map(q => ({ name: q.name, vhost: q.vhost, ready: q.messages_ready, unacked: q.messages_unacknowledged,
      consumers: q.consumers, consumerCapacity: q.consumer_capacity ?? q.consumer_utilisation,
      publishRate: q.message_stats?.publish_details?.rate ?? null, deliveryRate: q.message_stats?.deliver_get_details?.rate ?? null,
      ackRate: q.message_stats?.ack_details?.rate ?? null, redeliveries: q.message_stats?.redeliver ?? 0 })),
    nodes: nodes.map(n => ({ memoryBytes: n.mem_used, memoryLimitBytes: n.mem_limit, memoryAlarm: n.mem_alarm,
      diskFreeBytes: n.disk_free, diskLimitBytes: n.disk_free_limit, diskAlarm: n.disk_free_alarm })),
    connections: connections.filter(c => c.vhost === name).map(c => ({ user: c.user, vhost: c.vhost, state: c.state, channels: c.channels }))
  };
}
async function permissions() {
  await api('/users/lab6-publisher', 'PUT', { password: 'publisher-lab-only', tags: '' });
  await api('/permissions/lab6/lab6-publisher', 'PUT', { configure: '^$', write: '^lab6\\.events$', read: '^$' });
  return { user: 'lab6-publisher', vhost: 'lab6', configure: '^$', write: '^lab6\\.events$', read: '^$', tags: [] };
}
async function probe() {
  const restricted = amqpUrl('lab6', 'lab6-publisher', 'publisher-lab-only');
  const p = await openPublisher(async () => ({ exchange: 'lab6.events' }), restricted);
  const event = { messageId: 'permission-' + randomUUID(), correlationId: 'permissions', event: 'demo' };
  await p.publish(event, 'demo'); await p.close();
  const results = [{ action: 'publish lab6.events', allowed: true }];
  for (const [label, operation] of [
    ['publish another exchange', q => q.publish({ ...event, messageId: randomUUID() }, 'demo', 'lab6.other')],
    ['declare a queue', q => q.channel.assertQueue('lab6.forbidden')],
    ['read lab6.q', q => q.channel.get('lab6.q', { noAck: false })]
  ]) {
    const q = await openPublisher(async () => ({ exchange: 'lab6.events' }), restricted);
    let denied = false;
    q.channel.once('error', error => { denied = error.code === 403 || /ACCESS_REFUSED/.test(error.message); });
    try { await operation(q); } catch (_) {} finally { await q.close(); }
    if (!denied) throw new Error('Permission unexpectedly allowed: ' + label);
    results.push({ action: label, denied });
  }
  return results;
}
async function consume() {
  const p = await openPublisher(topology, amqpUrl('lab6'));
  await p.channel.prefetch(2); let active = 0, stopping = false;
  const { consumerTag } = await p.channel.consume('lab6.q', async m => {
    if (!m) return; active++;
    try { await delay(200); p.channel.ack(m); console.log(JSON.stringify({ processed: m.properties.messageId })); }
    catch (_) { await p.close(); } finally { active--; }
  }, { noAck: false });
  console.log(JSON.stringify({ ready: true, queue: 'lab6.q' }));
  await new Promise(resolve => {
    p.connection.once('close', resolve);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
      if (stopping) return; stopping = true;
      await p.channel.cancel(consumerTag).catch(() => {});
      while (active) await delay(25); await p.close(); resolve();
    });
  });
}
async function main() {
  const [command = 'snapshot', value = '20'] = process.argv.slice(2);
  if (['up', 'down'].includes(command)) {
    const project = process.env.OPS_PROJECT || 'simpel-ops';
    if (!/^simpel-(ops|day5-qa)$/.test(project)) throw new Error('Unsupported operations project');
    const result = spawnSync('docker', ['compose', '-p', project, '-f', path.join(root, 'lab/lab6-monitoring/compose.yml'),
      ...(command === 'up' ? ['up', '-d', '--wait'] : ['down'])], { cwd: root, stdio: 'inherit' });
    process.exitCode = result.status ?? 1; return;
  }
  if (command === 'setup') { await setup(); console.log('Topology lab6 is ready'); }
  else if (command === 'snapshot') console.log(JSON.stringify(await snapshot(), null, 2));
  else if (command === 'permissions') console.log(JSON.stringify(await permissions(), null, 2));
  else if (command === 'probe') console.log(JSON.stringify(await probe(), null, 2));
  else if (command === 'consumer') await consume();
  else if (command === 'publish') {
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1 || count > 200) throw new Error('Count must be 1..200');
    const p = await openPublisher(topology, amqpUrl('lab6'));
    try {
      for (let i = 0; i < count; i++) {
        const messageId = 'ops-' + randomUUID(); await p.publish({ messageId, correlationId: 'ops-demo', event: 'demo' }, 'demo');
        console.log(JSON.stringify({ confirmed: messageId }));
      }
    } finally { await p.close(); }
  } else throw new Error('Use up, down, setup, snapshot, publish, consumer, permissions, or probe');
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { api, amqpUrl, vhost, topology, setup, snapshot, permissions, probe, dbUrl };
