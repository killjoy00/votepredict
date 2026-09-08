import { pool } from '../src/lib/db/index.js';
import { runScheduledForecasts } from '../src/operations/scheduled-forecasts.js';

runScheduledForecasts(Number(process.env.FORECAST_BATCH_SIZE ?? 20))
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exitCode = 1; })
  .finally(() => pool.end());
