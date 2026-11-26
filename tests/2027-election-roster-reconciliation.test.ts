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
