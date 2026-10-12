/**
 * #864 Public original Minnesota LRL historical Senate directory:
 * SHA authenticates *year-2024 service facts* rather than dynamic unrelated
 * HTML bytes. This does not assert either raw original acquisition returned
 * identical HTML, publication in 2024, precise hearing-day service, or
 * independence from the government's currently maintained directory.
 *
 * Input stays in source-only/protected memory; only count and one digest leave.
 */
import {createHash} from 'node:crypto';
import type {AuditedOfficialSenateDirectory} from
 './senate-official-ever-served-directory.js';

export const OFFICIAL_2024_SERVICE_SEMANTIC_SCHEMA=
 'senate-864-lrl-original-2024-service-year-semantic-v1' as const;

export function canonicalLrl2024SenateServiceProjection(
 report:AuditedOfficialSenateDirectory,
){
 if(report.schema!=='mn-lrl-official-senate-ever-served-directory-v1'||
  report.source.directoryIsSenatorServiceNotCandidateFiling!==true||
  report.source.originalHistoricDateForDisplayedDirectoryEstablished!==false)
  throw Error('Not an authenticated present-day public original Senate directory');
 const rows=report.senators.map(person=>({
  name:person.officialName.normalize('NFKC').replace(/\s+/g,' ').trim(),
  terms:person.senateServiceTerms
   .filter(t=>t.startsYear<=2024&&(t.endsYear===null||t.endsYear>=2024))
   .map(t=>({
    district:t.district,startsYear:t.startsYear,endsYear:t.endsYear,
   }))
   .sort((a,b)=>
     a.district.localeCompare(b.district)||
     a.startsYear-b.startsYear||
     (a.endsYear??9999)-(b.endsYear??9999)),
 })).filter(x=>x.terms.length>0)
  .sort((a,b)=>a.name.localeCompare(b.name,'en'));
 if(rows.length<67||rows.length>90||
  new Set(rows.map(x=>x.name.toLowerCase())).size!==rows.length||
  rows.some(x=>!x.name||x.name.length>160||
   x.terms.length<1||x.terms.length>5||
   x.terms.some(t=>!Number.isSafeInteger(t.startsYear)||
     t.startsYear<2010||t.startsYear>2024||
     t.endsYear!==null&&(!Number.isSafeInteger(t.endsYear)||
       t.endsYear<2024||t.endsYear>2026)||
     !/^(?:[1-9]|[1-5][0-9]|6[0-7])$/.test(t.district))))
  throw Error('Official year-2024 Senate service projection incomplete');
 const digest=createHash('sha256')
  .update(OFFICIAL_2024_SERVICE_SEMANTIC_SCHEMA+'\n'+JSON.stringify(rows))
  .digest('hex');
 return {
  schemaVersion:OFFICIAL_2024_SERVICE_SEMANTIC_SCHEMA,
  named2024YearSenatePersons:rows.length,
  immutableServiceProjectionSha256:digest,
  /** No projection names/terms must leave the memory holding this report. */
  proofIncludesNamesAndTermsInDigest:true as const,
  contemporary2024DirectoryPublicationProven:false as const,
  exactHearingDayServiceProven:false as const,
 };
}
