import { backfillRevisorInitialTextBatch } from '../src/operations/revisor-initial-text-backfill.js';
import { syncLiveRevisorStatusBatch } from '../src/operations/live-revisor-status.js';

const INITIAL_TEXT_BATCHES_PER_RUN = 5;

async function main() {
  const status = await syncLiveRevisorStatusBatch();
  if (status.selected > 0 && status.fetched === 0) {
    throw new Error(`All ${status.selected} selected 2027 Revisor status records failed to fetch`);
  }

  let initialTextProcessed = 0;
  let initialTextDone = false;
  for (let batch = 0; batch < INITIAL_TEXT_BATCHES_PER_RUN; batch += 1) {
    const result = await backfillRevisorInitialTextBatch();
    initialTextProcessed += result.processed;
    if (result.done) {
      initialTextDone = true;
      break;
    }
  }

  console.log(JSON.stringify({
    liveRevisorStatus: status,
    initialText: {
      processed: initialTextProcessed,
      done: initialTextDone,
      maxBatches: INITIAL_TEXT_BATCHES_PER_RUN,
    },
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
