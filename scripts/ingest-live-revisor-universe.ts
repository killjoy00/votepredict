import { syncLiveRevisorUniverse } from '../src/operations/live-revisor-universe.js';

syncLiveRevisorUniverse()
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
