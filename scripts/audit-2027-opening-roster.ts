import { assess2027OpeningRoster } from '../src/operations/2027-opening-roster-audit.js';
import { listLrlMemberships } from '../src/sources/minnesota/lrl-members.js';
import { getMinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';

async function main() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  const observedOn = `${part('year')}-${part('month')}-${part('day')}`;
  const records = await listLrlMemberships(getMinnesotaHouseSession('2027-2028'), { allowIncompleteForAudit: true });
  const result = assess2027OpeningRoster(records, observedOn);
  console.log(JSON.stringify(result, null, 2));
  // Incomplete is a reportable result, not permission to import or invent seats.
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
