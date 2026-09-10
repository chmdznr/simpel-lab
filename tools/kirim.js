// Bounded synthetic HTTP publisher for participant experiments.
const { writeFileSync, mkdirSync } = require('node:fs');
const { dirname } = require('node:path');
const options = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
async function main() {
  const count = Number(options.count || 1);
  const runId = options.run || `r${Date.now()}`;
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('count must be 1-1000');
  if (!/^[A-Za-z0-9-]{1,32}$/.test(runId)) throw new Error('Invalid run ID');
  const base = process.env.GATEWAY_URL || 'http://127.0.0.1:3001';
  const receipts = [];
  let failure = null;
  const start = performance.now();
  try {
  for (let i = 0; i < count; i++) {
    const response = await fetch(`${base}/pengajuan`, { method: 'POST',
      headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ pemohon: `Peserta sintetis ${i + 1}`, jenis: options.jenis || 'siup', kantor: options.kantor || 'jakarta', runId }) });
    const body = await response.json();
    if (response.status !== 202) throw new Error(`HTTP ${response.status}; stop and inspect before retrying: ${JSON.stringify(body)}`);
    receipts.push(body);
  }
  } catch (error) { failure = error.message; }
  const times = receipts.map(r => r.durasiMs).sort((a, b) => a - b);
  const result = { runId, requested: count, confirmed: receipts.length, failure, publishWallMs: Math.round(performance.now() - start),
    responseP95Ms: times[Math.ceil(times.length * 0.95) - 1], receipts };
  const output = options.output || `.evidence/${runId}.json`;
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ runId, confirmed: result.confirmed, responseP95Ms: result.responseP95Ms, output }));
  if (failure) throw new Error(failure + '; receipts saved to ' + output);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
