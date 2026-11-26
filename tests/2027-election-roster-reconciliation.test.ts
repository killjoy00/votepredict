import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOpeningElectionRows, reconcile2027OpeningElection } from '../src/operations/2027-election-roster-reconciliation.js';
import type { HistoricalMembershipRecord } from '../src/sources/minnesota/lrl-members.js';

function row(chamber: 'house' | 'senate', district: string, code: string, name: string, party: string, votes: number, reported=10) {
  return ['MN','','','0121',`State ${chamber === 'house' ? 'Representative' : 'Senator'} District ${district}`,district,code,name,'','',party,reported,10,votes,50,100].join(';');
}
function member(chamber: 'house' | 'senate', district: string, lrlId: string, name: string, party: string): HistoricalMembershipRecord {
  return { chamber, district, lrlId, name, normalizedName: name.toLowerCase(), party, startsOn:'2027-01-04', endsOn:'2028-12-31', oathOn:'2027-01-12', sourceUrl:`https://www.lrl.mn.gov/legdb/fulldetail?ID=${lrlId}` };
}
test('strict district file selects chamber and preserves leading zero normalization', () => {
  const house = row('house','01A','0301','Example Candidate','R',100);
  const senate = row('senate','01','0401','Senate Candidate','DFL',100);
  assert.equal(parseOpeningElectionRows(house+'\n'+senate,'house')[0].district,'1A');
  assert.equal(parseOpeningElectionRows(house+'\n'+senate,'senate')[0].district,'1');
  assert.throws(() => parseOpeningElectionRows(house.replace(';100;50;', ';garbage;50;'),'house'), /Malformed/);
  assert.throws(() => parseOpeningElectionRows('<html>error</html>','house'), /Unexpected/);
});
test('reported tally agreement is not certification, recounts remain separate, and no silent missing seats', () => {
  const house = parseOpeningElectionRows([
    row('house','1A','0301','Example Candidate','R',70),row('house','1A','9901','WRITE-IN','WI',30),
    row('house','1B','0301','Different Name','R',100),
    row('house','2A','0301','Partial Count','R',100,9),
    row('house','32A','0301','Recount Candidate','R',100),
  ].join('\n'),'house');
  const senate = parseOpeningElectionRows([
    row('senate','4','0301','Senate Recount','R',100),
    row('senate','1','0301','First Candidate','R',50),row('senate','1','0401','Second Candidate','DFL',50),
  ].join('\n'),'senate');
  const result = reconcile2027OpeningElection([member('house','1A','101','Example Candidate','R'),member('house','1B','102','Other Name','R')],house,senate,'2026-11-26');
  const status = (key:string) => result.results.find(r=>r.seat===key)?.status;
  assert.equal(result.results.length,201);
  assert.equal(result.matchedReportedLeaders,1);
  assert.equal(status('house:1A'),'matched_reported_leader');
  assert.equal(status('house:1B'),'identity_or_party_mismatch');
  assert.equal(status('house:2A'),'incomplete_election');
  assert.equal(status('house:32A'),'recount_requires_certification');
  assert.equal(status('senate:4'),'recount_requires_certification');
  assert.equal(status('senate:1'),'no_unique_named_leader');
  assert.equal(status('senate:67'),'missing_election');
  assert.equal(result.authoritativeRosterVerified,false);
});

import { OPENING_ROSTER_NAME_VARIANTS, isObservedOpeningNameVariant } from '../src/operations/2027-opening-roster-name-variants.js';

test('observed 2027 variants are exact audit-only tuples with no fuzzy fallback', () => {
  assert.equal(OPENING_ROSTER_NAME_VARIANTS.length, 43);
  assert.equal(new Set(OPENING_ROSTER_NAME_VARIANTS.map(x => x.seat)).size, 43);
  for (const item of OPENING_ROSTER_NAME_VARIANTS) {
    const input = { seat: item.seat, lrlId: item.lrlId, electionName: item.electionName,
      lrlName: item.lrlName, electionParty: item.party, lrlParty: item.lrlParty };
    assert.equal(isObservedOpeningNameVariant(input), true);
    assert.equal(isObservedOpeningNameVariant({...input, lrlId:'different'}), false);
    assert.equal(isObservedOpeningNameVariant({...input, seat:'house:99A'}), false);
    assert.equal(isObservedOpeningNameVariant({...input, electionName:input.electionName+' altered'}), false);
    assert.equal(isObservedOpeningNameVariant({...input, lrlName:input.lrlName+' altered'}), false);
    assert.equal(isObservedOpeningNameVariant({...input, lrlParty:'OTHER'}), false);
  }
  const house = parseOpeningElectionRows(row('house','25B','0301','Andy Smith','DFL',100),'house');
  const records = [member('house','25B','15606','Andrew Smith','DFL')];
  const now = reconcile2027OpeningElection(records, house, [], '2026-11-26');
  assert.equal(now.results.find(r=>r.seat==='house:25B')?.status,'observed_same_seat_name_variant');
  assert.equal(now.matchedReportedLeaders,0);
  assert.equal(now.observedNameVariants,1);
  assert.equal(now.authoritativeRosterVerified,false);
  assert.equal(reconcile2027OpeningElection(records, house, [], '2026-11-25').observedNameVariants,0);
  assert.equal(reconcile2027OpeningElection([{...records[0], party:'R'}], house, [], '2026-11-26').observedNameVariants,0);
});
