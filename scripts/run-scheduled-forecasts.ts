import { pool } from '../src/lib/db/index.js';
import { runScheduledForecasts } from '../src/operations/scheduled-forecasts.js';

runScheduledForecasts(Number(process.env.FORECAST_BATCH_SIZE ?? 10))
  .then((result) => { console.log(JSON.stringify(result)); if (result.failed > 0) process.exitCode = 1; })
  .catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exitCode = 1; })
  .finally(() => pool.end());
