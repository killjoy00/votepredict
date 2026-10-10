/**
 * Issue #864 — credential-free offline 2022 Senate candidate-written quotes.
 *
 * With original publisher bytes from pinned 2026 GitHub source acquisition:
 * node --import tsx scripts/audit-senate-2022-candidate-surveys-offline.ts \
 *  --sd4 /extracted/2022-sd4-ballotpedia-article.response \
 *  --sd32 /extracted/2022-sd32-ballotpedia-article.response \
 *  --output /tmp/senate-2022-candidate-surveys.json
 *
 * Without --sd4/--sd32: identity and source ledger only, DOES NOT claim the
 * article source bytes have been rechecked or were public before election.
 */
import {statSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {auditSenate2022SurveyAttribution} from '../src/evidence/senate-2022-candidate-survey-attribution-audit.js';
const args=process.argv.slice(2);
const flag=(name:string)=>{
 const at=args.indexOf(name);
 const value=at>=0?args[at+1]:args.find(x=>x.startsWith(name+'='))?.slice(name.length+1);
 return value&&!value.startsWith('--')?value:undefined;
};
function limitedBytes(path:string){
 const file=resolve(path);
 const stat=statSync(file);
 if(!stat.isFile()||stat.size>600000||stat.size<100)
   throw Error('Source original publisher HTML must be a bounded regular file');
 return readFileSync(file);
}
function main(){
 const out=flag('--output');
 if(!out)throw Error('Provide unique --output');
 const sd4=flag('--sd4'),sd32=flag('--sd32');
 if(Boolean(sd4)!==Boolean(sd32))
   throw Error('Provide both SD4 and SD32 original public source HTML paths, or neither');
 if([sd4,sd32].filter(Boolean).some(p=>resolve(p!)===resolve(out)))
   throw Error('Cannot overwrite an original source HTML file');
 const report=auditSenate2022SurveyAttribution(sd4&&sd32?{
  sd4Html:limitedBytes(sd4),sd32Html:limitedBytes(sd32),
 }:{});
 mkdirSync(dirname(resolve(out)),{recursive:true});
 writeFileSync(resolve(out),JSON.stringify(report,null,2)+'\n',
   {flag:'wx',mode:0o600,encoding:'utf8'});
 console.log(JSON.stringify({
  originalPublisherHTMLFilesVerified:report.totals.verifiedPublisherHTMLSourceFiles,
  winningCandidateQuotes:report.totals.winningCandidateIssueExcerptLeads,
  defeatedOpponentQuotesExcluded:report.totals.excludedLosingOpponentIssueExcerptLeads,
  namedSpeakerSpanMatches:report.totals.verifiedNamedSpeakerQuoteSpans,
  historicalPre2022ArchiveProof:0,
  forecastStatementsAdmitted:0,
  output:resolve(out),
 }));
}
main();
