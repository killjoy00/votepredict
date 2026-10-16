/** #864 source-only, offline, SHA-verified 2025 Elections committee roster QA. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {audit2025OriginalElectionsAgainstPublicRoster} from
  '../../src/evidence/senate-committee-2025-elections-15-roster-review.js';
function main(){
 const args=process.argv.slice(2);
 if(args.length!==6||args[0]!=='--source-json'||
    args[2]!=='--source-queue-json'||args[4]!=='--output')
   throw Error('Exact --source-json PATH --source-queue-json PATH --output PATH required');
 const original=readFileSync(resolve(args[1]!),'utf8');
 const queue=readFileSync(resolve(args[3]!),'utf8');
 const report=audit2025OriginalElectionsAgainstPublicRoster(original,queue);
 const out=resolve(args[5]!);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({
   originalSourceRun:report.originalSourceRunId,
   priorCandidateBlocks:report.full2025MatchedSourceBlocks,
   matchedHistoricRosterSurnames:report.explicitNamedYeaNaySourceChoiceTokens,
   complete11MemberSourceBlocks:report.completeElevenNamedMemberBlocks,
   partial9Of11MemberSourceBlocks:report.nineOfElevenNamedMemberBlocks,
   sourceDateOrAbsenceHolds:report.blockSourcesWithDateOrAttendanceConflict,
   noAutomaticDBVotes:true,
 },null,2));
}
try{main()}catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1}