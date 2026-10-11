/**
 * Execute public-only 2022 campaign archive acquisition with independently
 * acquired original Minnesota LRL Senate service directory bytes (from #953).
 * No public target can run unless its exact person served in the Senate.
 *
 * node --import tsx scripts/run-senate-2022-ever-served-campaign-originals.ts \
 *   --lrl-original /path/mn-lrl-official-senate-service-directory.html \
 *   --lrl-metadata /path/mn-lrl-official-senate-service-directory-audit.json \
 *   --output-dir /new/private/2022-senator-archive-run
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseOfficialMnSenateServiceDirectory} from
  '../src/evidence/senate-official-ever-served-directory.js';
import {acquire2022EverServedSenateCampaignOriginals} from
  './acquire-senate-2022-ever-served-campaign-originals.js';
const argv=process.argv.slice(2);
const opt=(name:string)=>{
 const idx=argv.indexOf(name);
 const result=idx<0?undefined:argv[idx+1];
 return result&&!result.startsWith('--')?result:undefined;
};
async function main(){
 const file=opt('--lrl-original'),meta=opt('--lrl-metadata'),out=opt('--output-dir');
 if(!file||!meta||!out||argv.length!==6)
   throw Error('Require --lrl-original --lrl-metadata --output-dir exactly');
 const rawPath=resolve(file),jsonPath=resolve(meta),dest=resolve(out);
 if(dest===rawPath||dest===jsonPath)
   throw Error('Public acquisition must not overwrite source Senate service bytes');
 const stat=statSync(rawPath),metaStat=statSync(jsonPath);
 if(!stat.isFile()||stat.size<9000||stat.size>5*1024*1024
   ||!metaStat.isFile()||metaStat.size<100||metaStat.size>3*1024*1024)
   throw Error('Missing/oversized independent Minnesota Senate service original');
 const html=readFileSync(rawPath);
 const provenance=JSON.parse(readFileSync(jsonPath,'utf8')) as {
  source?:{observedAt?:string;sourceBytesSha256?:string;url?:string};
 };
 if(!provenance.source?.observedAt||!provenance.source.sourceBytesSha256
   ||provenance.source.url!=='https://www.lrl.mn.gov/legdb/senate_dir')
   throw Error('Original LRL service provenance missing exact observed UTC and official URL');
 const hashed=createHash('sha256').update(html).digest('hex');
 if(hashed!==provenance.source.sourceBytesSha256)
   throw Error('Previously acquired official LRL senator directory original SHA-256 mismatch');
 const service=parseOfficialMnSenateServiceDirectory(html,provenance.source.observedAt);
 if(service.source.sourceBytesSha256!==hashed)
   throw Error('LRL original source changed under its dated provenance');
 const report=await acquire2022EverServedSenateCampaignOriginals(dest,service);
 console.log(JSON.stringify({
  archiveRunAtUtc:report.acquiredAtUtc,
  verifiedEverServedPeople:report.totals.actualEverServedSenators,
  original2022PagesVerified:
    report.totals.historicWaybackPagesVerifiedByOriginalDigest+
    report.totals.commonCrawlOriginalPagesVerifiedByWarcAndIndexDigest,
  excludedNeverServedPeopleCountInNewResearch:report.totals.nonsenatorNamesIncluded,
  sourceStatementsAutomaticallyPromoted:0,
 }));
}
main().catch(e=>{
 // Public-only source audit errors may be logged, never private keys or DB.
 const msg=e instanceof Error?e.message:'unknown error';
 console.error('SENATE-2022-CAMPAIGN-ARCHIVE-FAILED '+JSON.stringify({
  error:msg.slice(0,180),noEvidencePromoted:true,
 }));
 process.exitCode=1;
});
