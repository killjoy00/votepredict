/**
 * One-shot public source acquisition; always verify exact previously
 * downloaded Minnesota LRL original directory source bytes before a network
 * request, and only preserve attributed senators' domain source records.
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseOfficialMnSenateServiceDirectory} from '../src/evidence/senate-official-ever-served-directory.js';
import {acquire2022ServedSenatorDomainHistoricalPages}
 from './acquire-senate-2022-served-domain-wide-pages.js';
const argv=process.argv.slice(2);
const option=(name:string)=>{
 const i=argv.indexOf(name),v=i>=0?argv[i+1]:undefined;
 return v&&!v.startsWith('--')?v:undefined;
};
async function main(){
 const source=option('--lrl-original');
 const metadata=option('--lrl-metadata');
 const dest=option('--output-dir');
 if(!source||!metadata||!dest||argv.length!==6)
  throw Error('Provide exactly --lrl-original --lrl-metadata --output-dir');
 const raw=resolve(source),meta=resolve(metadata),output=resolve(dest);
 if(output===raw||output===meta||raw===meta)
  throw Error('Cannot overwrite original independent Senate-service source');
 const rawStat=statSync(raw),metaStat=statSync(meta);
 if(!rawStat.isFile()||!metaStat.isFile()||rawStat.size<9000
  ||rawStat.size>5*1024*1024||metaStat.size<100||metaStat.size>3*1024*1024)
  throw Error('Missing/invalid original LRL Senate-service source bytes');
 const html=readFileSync(raw);
 const evidence=JSON.parse(readFileSync(meta,'utf8')) as {
  source?:{observedAt?:string;sourceBytesSha256?:string;url?:string};
 };
 if(evidence.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||!evidence.source.observedAt||!/^[0-9a-f]{64}$/.test(evidence.source.sourceBytesSha256??''))
  throw Error('Exact independently acquired Minnesota Senate source provenance unavailable');
 const actual=createHash('sha256').update(html).digest('hex');
 if(actual!==evidence.source.sourceBytesSha256)
  throw Error('Independent Minnesota Senate service original SHA-256 does not match');
 const verified=parseOfficialMnSenateServiceDirectory(html,evidence.source.observedAt);
 if(verified.source.sourceBytesSha256!==actual)
  throw Error('Official Senate original changed across acquisition');
 const result=await acquire2022ServedSenatorDomainHistoricalPages(output,verified);
 console.log('SENATE-2022-HOST-CAPTURE-FINAL '+JSON.stringify({
  verifiedActualSenatePeople:result.totals.verifiedServedSenatorsWithQueriedDomains,
  originalHistoricalSitesDigestMatched:result.totals.distinctSenatorsWithVerifiedOriginal2022Page,
  actualHistoricalPageBodies:result.totals.originalHistoricalPageBodiesIndependentlyDigestVerified,
  verifiedCandidateOwnedStatements:0,
  nonSenatorNamesPublished:0,
  modelEvidenceAdmitted:0,
 }));
}
main().catch(e=>{
 console.error('Public senator-only domain archive discovery failed closed: '+
  (e instanceof Error?e.message.slice(0,140):'unknown'));
 process.exitCode=1;
});
