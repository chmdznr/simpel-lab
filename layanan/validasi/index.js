// Working starter. Read acknowledgement and prefetch exercises in ../worker.js.
const { runWorker } = require('../worker');
runWorker('validasi').catch(() => {
  console.error('validasi startup failed. Check broker, database, and npm run db:siapkan.');
  process.exit(1);
});
