// Lab 3 transport milestone: 202 follows a routed publisher confirm.
// The full MP-5 database/outbox acceptance contract is a later integration step.
const express = require('express');
const { randomUUID } = require('node:crypto');
const { integer, openPublisher } = require('../messaging');

async function main() {
  const publisher = await openPublisher();
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', (_req, res) => res.status(publisher.isReady() ? 200 : 503).json({
    ready: publisher.isReady(), service: 'gateway', mode: publisher.spec.mode,
  }));
  app.post('/pengajuan', async (req, res) => {
    const started = performance.now();
    for (const key of ['pemohon', 'jenis', 'kantor']) {
      if (typeof req.body?.[key] !== 'string' || !req.body[key].trim() || req.body[key].length > 120) {
        return res.status(400).json({ error: `Field ${key} must be a non-empty string, at most 120 characters` });
      }
    }
    const runId = req.body.runId || 'manual';
    if (typeof runId !== 'string' || !/^[A-Za-z0-9-]{1,32}$/.test(runId)) {
      return res.status(400).json({ error: 'runId must contain 1-32 letters, digits, or hyphens' });
    }
    const pengajuanId = `SIM-${runId}-${randomUUID()}`;
    const event = {
      event: 'pengajuan.diterima', schemaVersion: 1,
      messageId: `evt-${randomUUID()}`, correlationId: `corr-${randomUUID()}`,
      occurredAt: new Date().toISOString(),
      data: { pengajuanId, pemohon: req.body.pemohon.trim(), jenis: req.body.jenis.trim(), kantor: req.body.kantor.trim() },
    };
    try {
      await publisher.publish(event);
      res.status(202).json({ status: 'DITERIMA_BROKER', pengajuanId,
        messageId: event.messageId, correlationId: event.correlationId,
        durasiMs: Number((performance.now() - started).toFixed(2)) });
    } catch (error) {
      // Preserve identifiers for investigation; a lost confirm is not proof of absence.
      res.status(503).json({ error: error.message, pengajuanId, messageId: event.messageId });
    }
  });
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: 'Invalid JSON request' }));
  const server = app.listen(integer('PORT_GATEWAY', 3001, 1024, 65535), '127.0.0.1', () => {
    console.log(JSON.stringify({ service: 'gateway', ready: true, mode: publisher.spec.mode }));
  });
  async function stop() {
    server.close();
    await publisher.close();
  }
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  // ponytail: fail-fast channel lifecycle; restart this classroom service after broker recovery.
  publisher.connection.once('close', () => { server.close(); });
}
main().catch(() => { console.error('Gateway startup failed. Check broker access and topology.'); process.exitCode = 1; });
