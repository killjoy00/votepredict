import { getMinnesotaHouseSession, minnesotaLocalDate } from '../src/sources/minnesota/sessions.js';
import { listLrlMemberships } from '../src/sources/minnesota/lrl-members.js';
import { reconcile2027OpeningElection } from '../src/operations/2027-election-roster-reconciliation.js';
import { fetchOpeningElectionDistrict } from '../src/operations/2027-opening-election-source.js';

async function main() {
  // Source-only, bounded, never called automatically by production.
  const [house, senate] = await Promise.all([fetchOpeningElectionDistrict('house'), fetchOpeningElectionDistrict('senate')]);
  const records = await listLrlMemberships(getMinnesotaHouseSession('2027-2028'), { allowIncompleteForAudit: true });
  const result = reconcile2027OpeningElection(records, house.rows, senate.rows, minnesotaLocalDate(new Date()));
  const { rows: _houseRows, ...houseSource } = house;
  const { rows: _senateRows, ...senateSource } = senate;
  console.log(JSON.stringify({ sources: [houseSource, senateSource], ...result }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
