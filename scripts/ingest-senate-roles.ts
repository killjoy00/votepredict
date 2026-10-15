import { collectSenateRoles } from '../src/sources/minnesota/senate-roles.js';
import { getMinnesotaHouseSession, MINNESOTA_HOUSE_HISTORICAL_SESSIONS } from '../src/sources/minnesota/sessions.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const arg = args.find((value) => value.startsWith('--session='));
  const index = args.indexOf('--session');
  const sessionName = arg?.slice('--session='.length) ?? (index >= 0 ? args[index + 1] : undefined);
  const sessions = sessionName ? [getMinnesotaHouseSession(sessionName)] : [...MINNESOTA_HOUSE_HISTORICAL_SESSIONS];
  const dryRun = args.includes('--dry-run');
  if (!dryRun && !process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED required unless --dry-run');
  }
  let missing = false;
  for (const session of sessions) {
    const result = await collectSenateRoles(session);
    const details = { session: session.slug, roleCount: result.total, byRole: result.counts, sourcePages: result.sources.length, failedSourceUrls: result.failedSourceUrls };
    console.log(JSON.stringify(details));
    if (result.total === 0) { missing = true; continue; }
    if (!dryRun) {
      const { persistSenateRoleCollection } = await import('../src/operations/senate-role-ingest.js');
      console.log(JSON.stringify({ session: session.slug, ...(await persistSenateRoleCollection(result)) }));
    }
  }
  if (missing) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
