import { ingestLrlMembershipSession } from '../src/operations/lrl-membership-ingest.js';
import {
  getMinnesotaHouseSession,
  MINNESOTA_HOUSE_HISTORICAL_SESSIONS,
} from '../src/sources/minnesota/sessions.js';

function argumentValue(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const requested = argumentValue(args, '--session');
  const sessions = requested
    ? [getMinnesotaHouseSession(requested)]
    : [...MINNESOTA_HOUSE_HISTORICAL_SESSIONS];

  for (const session of sessions) {
    console.log(`[${session.slug}] fetching authoritative membership records from Minnesota LRL`);
    const result = await ingestLrlMembershipSession(session);
    console.log(
      `[${session.slug}] persisted ${result.records} membership records (${result.house} House, ${result.senate} Senate)`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
