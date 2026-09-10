import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = new URL(process.env.RABBITMQ_MANAGEMENT_URL ?? 'http://localhost:15672');
assert(['http:', 'https:'].includes(base.protocol), 'Expected an HTTP(S) Management URL');
const adminUser = process.env.RABBITMQ_USER;
const adminPass = process.env.RABBITMQ_PASS;
assert(adminUser && adminPass, 'Set RABBITMQ_USER and RABBITMQ_PASS for the lab administrator');
const suffix = randomUUID().slice(0, 8);
const vhost = `lab1-check-${suffix}`, user = `lab1-check-${suffix}`, password = randomUUID();
const esc = encodeURIComponent;
const auth = (u, p) => `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;
const admin = auth(adminUser, adminPass), learner = auth(user, password);
let createdVhost = false, createdUser = false;

async function request(method, path, data, token = learner, expected) {
  const response = await fetch(new URL(`/api/${path}`, base), {
    method, headers: { authorization: token, 'content-type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(10000)
  });
  if (expected) { assert(expected.includes(response.status), `${method} ${path}: unexpected status ${response.status}`); return; }
  assert(response.ok, `${method} ${path}: HTTP ${response.status}`);
  const body = await response.text();
  return body ? JSON.parse(body) : undefined;
}

try {
  await request('PUT', `vhosts/${esc(vhost)}`, {}, admin); createdVhost = true;
  await request('PUT', `users/${esc(user)}`, { password, tags: 'management' }, admin); createdUser = true;
  await request('PUT', `permissions/${esc(vhost)}/${esc(user)}`, {
    configure: '^lab1\\..*', write: '^lab1\\..*', read: '^lab1\\..*'
  }, admin);
  const prefix = esc(vhost);
  for (const type of ['direct', 'fanout', 'topic', 'headers'])
    await request('PUT', `exchanges/${prefix}/lab1.${type}`, { type, durable: true, auto_delete: false, internal: false, arguments: {} });
  const bindings = [
    ['direct', 'lab1.direct.validasi', 'pengajuan.siup.jakarta', {}],
    ['fanout', 'lab1.fanout.validasi', '', {}], ['fanout', 'lab1.fanout.tracking', '', {}],
    ['topic', 'lab1.topic.jakarta', 'pengajuan.*.jakarta', {}], ['topic', 'lab1.topic.siup', 'pengajuan.siup.#', {}],
    ['headers', 'lab1.headers.jakarta', '', { 'x-match': 'all', jenis: 'siup', kantor: 'jakarta' }]
  ];
  for (const [type, queue, key, args] of bindings) {
    await request('PUT', `queues/${prefix}/${queue}`, { durable: true, auto_delete: false, arguments: { 'x-queue-type': 'classic' } });
    await request('POST', `bindings/${prefix}/e/lab1.${type}/q/${queue}`, { routing_key: key, arguments: args });
  }
  await request('PUT', `queues/${prefix}/lab1.quorum`, { durable: true, auto_delete: false, arguments: { 'x-queue-type': 'quorum' } });
  const q = await request('GET', `queues/${prefix}/lab1.quorum`);
  assert.equal(q.type, 'quorum');
  const cases = [
    ['D1', 'direct', 'pengajuan.siup.jakarta', {}, ['lab1.direct.validasi']],
    ['D2', 'direct', 'pengajuan.siup.bandung', {}, []],
    ['F1', 'fanout', 'bebas', {}, ['lab1.fanout.validasi', 'lab1.fanout.tracking']],
    ['T1', 'topic', 'pengajuan.siup.jakarta', {}, ['lab1.topic.jakarta', 'lab1.topic.siup']],
    ['T2', 'topic', 'pengajuan.nib.jakarta', {}, ['lab1.topic.jakarta']],
    ['T3', 'topic', 'pengajuan.siup.jakarta.revisi', {}, ['lab1.topic.siup']],
    ['H1', 'headers', 'diabaikan', { jenis: 'siup', kantor: 'jakarta' }, ['lab1.headers.jakarta']],
    ['H2', 'headers', 'diabaikan', { jenis: 'siup', kantor: 'bandung' }, []]
  ];
  for (const [id, type, key, headers, destinations] of cases) {
    const result = await request('POST', `exchanges/${prefix}/lab1.${type}/publish`, {
      routing_key: key, properties: { delivery_mode: 2, headers },
      payload: JSON.stringify({ case: id, pengajuanId: 'SIM-001' }), payload_encoding: 'string'
    });
    assert.equal(result.routed, destinations.length > 0, `${id}: routing result`);
    for (const [, queue] of bindings) {
      const messages = await request('POST', `queues/${prefix}/${queue}/get`, {
        count: 10, ackmode: 'ack_requeue_false', encoding: 'auto', truncate: 5000
      });
      assert.equal(messages.length, destinations.includes(queue) ? 1 : 0, `${id}: ${queue}`);
      if (messages.length) assert.equal(JSON.parse(messages[0].payload).case, id);
    }
    console.log(`${id}: expected destinations and payload verified`);
  }
  await request('PUT', `queues/${prefix}/outside.prefix`, { durable: true, arguments: {} }, learner, [401, 403]);
  await request('GET', `queues/${prefix}/outside.prefix`, undefined, admin, [404]);
  const accessible = await request('GET', 'vhosts');
  assert.deepEqual(accessible.map(v => v.name), [vhost], 'Learner must only see the assigned vhost');
  // Management API may hide an inaccessible vhost with 404.
  await request('PUT', `queues/${esc('/')}/lab1.forbidden`, { durable: true, arguments: {} }, learner, [401, 403, 404]);
  await request('GET', `queues/${esc('/')}/lab1.forbidden`, undefined, admin, [404]);
  console.log('PASS: 8 routing cases, quorum declaration, resource permissions and vhost isolation');
} finally {
  // Only remove resources created by this invocation, including after a failed assertion.
  const cleanup = await Promise.allSettled([
    ...(createdVhost ? [request('DELETE', `vhosts/${esc(vhost)}`, undefined, admin)] : []),
    ...(createdUser ? [request('DELETE', `users/${esc(user)}`, undefined, admin)] : [])
  ]);
  assert(cleanup.every(r => r.status === 'fulfilled'), 'Temporary lab cleanup failed; inspect the lab broker');
}
