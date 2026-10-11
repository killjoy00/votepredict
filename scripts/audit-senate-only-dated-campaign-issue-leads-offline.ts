/**
 * Build a named senator-only dated original campaign-quote ledger, after
 * validating saved official Minnesota LRL original HTML SHA-256 and observedAt.
 *
 * node --import tsx scripts/audit-senate-only-dated-campaign-issue-leads-offline.ts \
 *  --lrl-original /original/mn-lrl-official-senate-service-directory.html \
 *  --lrl-metadata /original/mn-lrl-official-senate-service-directory-audit.json \
 *  --output /tmp/only-ever-served-senators-dated-issue-leads.json
 */
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {parseOfficialMnSenateServiceDirectory} from
 '../src/evidence/senate-official-ever-served-directory.js';
import {buildOnlyActualSenatorsDatedIssueSourceLedger} from
 '../src/evidence/senate-only-dated-campaign-issue-leads.js';
const args=process.argv.slice(2);
function arg(key:string):string|undefined{
 const i=args.indexOf(key);
 const val=i>=0?args[i+1]:undefined;
 return val&&!val.startsWith('--')?val:undefined;
}
function main(){
 const original=arg('--lrl-original'),metadata=arg('--lrl-metadata'),
  swearing=arg('--lrl-swearing-html'),out=arg('--output');
 if(!original||!metadata||!swearing||!out||args.length!==8)
  throw Error('Require exactly --lrl-original --lrl-metadata --output');
 const paths=[original,metadata,swearing,out].map(value=>resolve(value));
 if(new Set(paths).size!==paths.length)
  throw Error('Do not overwrite official original Senate service source file');
 const a=statSync(paths[0]),b=statSync(paths[1]),c=statSync(paths[2]);
 if(!a.isFile()||a.size<9000||a.size>5*1024*1024
   ||!b.isFile()||b.size<100||b.size>3*1024*1024
   ||!c.isFile()||c.size<9000||c.size>5*1024*1024)
  throw Error('Original official Senate service source is missing/oversized');
 const raw=readFileSync(paths[0]);
 const stored=JSON.parse(readFileSync(paths[1],'utf8')) as {
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
  supplementalSwearingSource?:{observedAt?:string;sourceBytesSha256?:string};
 };
 if(stored.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||!stored.source?.observedAt
  ||!stored.source.sourceBytesSha256
  ||stored.source.sourceBytesSha256!==createHash('sha256').update(raw).digest('hex'))
  throw Error('Official Senate directory retrieval date and raw SHA-256 do not match');
 const swornRaw=readFileSync(paths[2]);
 if(!stored.supplementalSwearingSource?.observedAt
   ||stored.supplementalSwearingSource.sourceBytesSha256!==
     createHash('sha256').update(swornRaw).digest('hex'))
  throw Error('Official 2025 special Senate swearing original missing or source SHA mismatch');
 const official=parseOfficialMnSenateServiceDirectory(raw,stored.source.observedAt,
   swornRaw,stored.supplementalSwearingSource.observedAt);
 const report=buildOnlyActualSenatorsDatedIssueSourceLedger(official);
 mkdirSync(dirname(paths[3]),{recursive:true});
 writeFileSync(paths[3],JSON.stringify(report,null,2)+'\n',
  {flag:'wx',mode:0o600});
 console.log(JSON.stringify({
  sourceOriginalObservedAtUtc:report.sourceValidation.officialLRLSenateDirectoryObservedAtUtc,
  senatePersonsVerified:report.totals.namedIndependentlyConfirmedPeopleWhoServedInSenate,
  datedCandidateStatements:report.totals.namedIssueSourceQuoteLeads,
  historicalArchiveStatementDates:report.totals.actualArchivedHistoricalCampaignQuoteLeads,
  currentlyDated2026OnlyLeads:report.totals['2026OnlyPublisherStatementQuoteLeads'],
  outOfScopeRowsSuppressed:report.totals.outOfScopeOrUnverifiedStatementRowsSuppressedWithoutNamingAnyone,
  modelEvidenceAdded:0,output:paths[3],
 }));
}
main();
