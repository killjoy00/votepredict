import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fetchOpeningElectionDistrict} from '../src/operations/2027-opening-election-source.js';
import {buildPreseasonDistrictReview,type ProjectedDistrictMember} from '../src/operations/2027-preseason-district-context.js';

async function main(){
  const path='docs/evaluation/source-proof/2027-preseason-roster-20261126.json';
  const raw=readFileSync(path);
  const roster=JSON.parse(raw.toString('utf8')) as {session:string;complete:boolean;authoritativeRosterVerified:boolean;readyForActivation:boolean;members:ProjectedDistrictMember[]};
  if(roster.session!=='2027-2028'||!roster.complete||roster.authoritativeRosterVerified||roster.readyForActivation)throw Error('Unexpected projected roster');
  const [house,senate]=await Promise.all([fetchOpeningElectionDistrict('house'),fetchOpeningElectionDistrict('senate')]);
  const review=buildPreseasonDistrictReview(roster.members,house.rows,senate.rows);
  const sources=[house,senate].map(({rows,...source})=>({...source,candidateRows:rows.length}));
  const admitted=review.filter(r=>r.status==='reported_tally');
  const summary={expectedSeats:201,reportedTallies:admitted.length,held:review.filter(r=>r.status==='held').map(r=>({seat:r.seat,reason:r.reason})),uncontested:admitted.filter(r=>r.uncontested).length,sourceRequests:2,originalBodiesRetained:false,productionWrites:0,modelChanges:0};
  console.log('DISTRICT_CONTEXT_SUMMARY '+JSON.stringify(summary));
  console.log('DISTRICT_CONTEXT_REVIEW '+JSON.stringify({schemaVersion:'2027-preseason-district-context-probe-v1',session:roster.session,rosterSha256:createHash('sha256').update(raw).digest('hex'),sources,summary,rows:review,servingEligible:false}));
  if(admitted.length!==198||summary.held.length!==3||summary.held.some(r=>r.reason!=='separate_recount_tally_required'))throw Error('Unexpected district evidence gaps: review before intake');
}
main().catch(()=>{console.error('Bounded district context probe failed closed');process.exitCode=1;});
