/**
 * #864. Reuse ALL independently authenticated 207 original Senate electronic
 * Minutes OCR recovery artifacts. Exact JSON bytes are SHA-256 checked before
 * Neon credentials; no OCR/text/PDF contents or private DB row exports.
 *
 * The 2025 Judiciary second-sample source only retained a key and count for
 * one 8-choice roll, NOT original named choice fingerprints or the tally.
 * It must remain key-only and NEVER be silently promoted to an exact vote.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {
 OriginalSenateCommitteeYearAudit,OriginalSenateCommitteePdfProof,
} from '../src/evidence/senate-committee-source-to-db-reconciliation.js';

type OcrArtifact={year:2022|2023|2024|2025;id:number;run:number;filename:string;sha:string;expected:number};
export const OCR_207_SOURCE_ARTIFACTS:readonly OcrArtifact[]=[
 {year:2022,id:11676072623,run:38068730892,filename:'senate-committee-six-scanned-ocr-metadata.json',sha:'a530d9121f676d32079d88e514d6d2ae26aac86a3902244234a7bcb886ba3731',expected:6},
 {year:2022,id:11675539378,run:38069432305,filename:'senate-committee-2022-second-ocr-sample.json',sha:'6df6f4305f9e1068884aabcf1adcb2ddb19eeacf93995c5c13a3201258ee2eee',expected:8},
 {year:2023,id:11676162360,run:38069432305,filename:'senate-committee-2023-second-ocr-sample.json',sha:'6c0208c2e590ae066bb06f621b74f28a705180ad6886369791ca548c52ef206c',expected:4},
 {year:2024,id:11675569424,run:38069432305,filename:'senate-committee-2024-second-ocr-sample.json',sha:'15884929cd21cfbb699129249b34581431cce89b753637bf7747c4efcca54ddf',expected:4},
 {year:2025,id:11675584270,run:38069432305,filename:'senate-committee-2025-second-ocr-sample.json',sha:'41c608e88fe0883fea3a5314228a0887f1e6340b0c6129fa0375575bad54ab29',expected:8},
 {year:2023,id:11678185896,run:38073521109,filename:'senate-committee-2023-remaining-scanned-originals.json',sha:'2ea0feb375285de31e3838df4fd88e0cee1aee38f11e71a913b789d38e9c64f4',expected:17},
 {year:2024,id:11677986160,run:38073521109,filename:'senate-committee-2024-remaining-scanned-originals.json',sha:'117eab1b79627bb625c21c424b9e6c302968bed52d6d1f01102dbcfd73b19375',expected:8},
 {year:2022,id:11677439544,run:38075234242,filename:'senate-2022-batch-0.json',sha:'7b424b922f0dcd4d542615875ac29e05443ea9e5c66b2b4a4f8f1571accafd3f',expected:19},
 {year:2022,id:11678168763,run:38075234242,filename:'senate-2022-batch-1.json',sha:'85ea10d5683bf4df8511177564aefcc4e035603750127a4639ab61f1cf8c5649',expected:19},
 {year:2022,id:11677629231,run:38075234242,filename:'senate-2022-batch-2.json',sha:'ec13f318c45003b15c378d72354602fc0c322bbe29043104e49b77176a8eede6',expected:18},
 {year:2022,id:11677879406,run:38075234242,filename:'senate-2022-batch-3.json',sha:'7301c1b7a7a4cc4061916debb5da40cd697b676c88e5896160bf2d09a02d5b6e',expected:18},
 {year:2022,id:11678358764,run:38075234242,filename:'senate-2022-batch-4.json',sha:'b3cb9a2f532bd6ef54b63316318b60f4ac8ec187132107088224cac7aa08659e',expected:18},
 {year:2022,id:11678323861,run:38075234242,filename:'senate-2022-batch-5.json',sha:'15c3e3a03a247d63729f6dbbad212f99f591baecd64efd229f45a0787d9e549e',expected:18},
 {year:2025,id:11677409668,run:38075234242,filename:'senate-2025-batch-0.json',sha:'7a44ab91902f437bd3a77c1ec975f413eed8cb38de03c066500133e12f9f93b8',expected:14},
 {year:2025,id:11678273765,run:38075234242,filename:'senate-2025-batch-1.json',sha:'f7ff5ba388cfe3086cb4515850e258166984b17d1d5fd1269d7b3401c8f85d4c',expected:14},
 {year:2025,id:11677519671,run:38075234242,filename:'senate-2025-batch-2.json',sha:'5212071837dc47404c4836ce1a996a9671f677a842b52008603852682eb6ea6b',expected:14},
] as const;

type RecoveredProof={
 document?:OriginalSenateCommitteePdfProof['document'];
 source?:OriginalSenateCommitteePdfProof['document'];
 voteObservations?:OriginalSenateCommitteePdfProof['voteObservations'];
 voteKeys?:string[];
 observationKeys?:string[];
 sourceParserTotals?:{
  recordedVoteObservations:number;namedRollCalls:number;
  countOnlyRollCalls:number;namedMemberChoicesInPdf:number;
 };
};
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
export type OcrKeyOnlyEvent={
 year:number;sourceUrl:string;externalKey:string;meetingDate:string;
 sourceNamedChoiceTokensKnownCount:number;
};
export function mergeSourceAuditsWithAuthenticated207Ocr(
 original:readonly OriginalSenateCommitteeYearAudit[],
 read:(path:string)=>Buffer=path=>readFileSync(path),
){
 const byYear=new Map<number,OriginalSenateCommitteeYearAudit>();
 const missing=new Map<string,{
  year:number;meetingDate:string;committeeName:string;seen:boolean;
 }>();
 let originalParsed=0,originalUnparsed=0;
 for(const r of original){
  if(![2022,2023,2024,2025].includes(r.auditedYear)||byYear.has(r.auditedYear))
   throw Error('Original source audit year duplicated or missing');
  byYear.set(r.auditedYear,r);
  originalParsed+=r.originalPdfsFetchedAndParsed;
  originalUnparsed+=r.originalPdfsFailedOrUnparsed;
  for(const p of r.unresolvedOriginalDocuments){
   if(missing.has(p.sourceUrl)||!p.sourceUrl.includes('/senate/'+r.auditedYear+'/'))
    throw Error('Original low-text PDF URL not unique or out of year');
   missing.set(p.sourceUrl,{year:r.auditedYear,meetingDate:p.meetingDate,
    // Original initial failure JSON includes committeeName, though strict
    // exported YearAudit type only models sourceUrl/meetingDate.
    committeeName:(p as typeof p & {committeeName?:string}).committeeName??'',seen:false});
  }
 }
 if(byYear.size!==4 ||originalParsed!==1245||originalUnparsed!==207
   ||missing.size!==207)throw Error('Four original parsed/low-text document cohorts not exact');
 const recovered=new Map<string,OriginalSenateCommitteePdfProof[]>();
 const keyOnly:OcrKeyOnlyEvent[]=[];
 let newVoteCandidates=0,knownChoiceTokens=0,allSourceVoteCandidates=0;
 const ocrPerYear=new Map<number,number>([[2022,0],[2023,0],[2024,0],[2025,0]]);
 for(const art of OCR_207_SOURCE_ARTIFACTS){
  const bytes=read('artifacts/ocr/'+art.filename);
  if(bytes.byteLength<30||bytes.byteLength>2_000_000||sha(bytes)!==art.sha)
   throw Error('Pinned immutable original OCR source metadata SHA-256/bound failed');
  const parsed=JSON.parse(bytes.toString('utf8')) as {
   originalProofs?:RecoveredProof[];proofs?:RecoveredProof[];year?:number;
  };
  const proofs=parsed.originalProofs??parsed.proofs;
  if(!Array.isArray(proofs)||proofs.length!==art.expected
    ||(parsed.year!==undefined&&parsed.year!==art.year))
   throw Error('Original government OCR batch proof count/year not exact');
  for(const item of proofs){
   const d=item.document??item.source;
   if(!d||d.year!==art.year
     ||!/^[a-f0-9]{64}$/.test(d.originalRawPdfSha256)
     ||!/^https:\/\/(?:www\.)?lrl\.mn\.gov\/archive\/minutes\/senate\/202[2-5]\//i.test(d.sourceUrl))
    throw Error('Bad original OCR PDF URL/raw byte SHA');
   const source=missing.get(d.sourceUrl);
   if(!source||source.seen||source.year!==art.year
     ||source.meetingDate!==d.meetingDate
     ||(source.committeeName!==''&&source.committeeName!==d.committeeName))
    throw Error('Recovered PDF must match one unique original low-text source and its meeting');
   source.seen=true;
   const totals=item.sourceParserTotals;
   if(!totals||!Number.isSafeInteger(totals.recordedVoteObservations)
     ||!Number.isSafeInteger(totals.namedMemberChoicesInPdf))
    throw Error('OCR parser candidates/tokens missing');
   const fullVotes=item.voteObservations??[];
   const keys=item.voteObservations===undefined
    ?item.voteKeys??item.observationKeys??[]:[];
   if(fullVotes.length+keys.length!==totals.recordedVoteObservations)
    throw Error('OCR event key count not aligned to parser observations');
   for(const key of keys){
    if(typeof key!=='string'||!/^[a-z-]+:[a-f0-9]{16}:[0-9]+$/.test(key))
     throw Error('Unsupported original key-only OCR event');
    keyOnly.push({year:art.year,sourceUrl:d.sourceUrl,externalKey:key,
     meetingDate:d.meetingDate,
     sourceNamedChoiceTokensKnownCount:totals.namedMemberChoicesInPdf});
   }
   allSourceVoteCandidates+=totals.recordedVoteObservations;
   newVoteCandidates+=fullVotes.length;
   knownChoiceTokens+=totals.namedMemberChoicesInPdf;
   const docProof:OriginalSenateCommitteePdfProof={
    document:{
     year:d.year,committeeName:d.committeeName,
     meetingDate:d.meetingDate,sourceUrl:d.sourceUrl,
     originalRawPdfSha256:d.originalRawPdfSha256,
    },voteObservations:fullVotes,contextOnlyActions:[],
   };
   recovered.set(d.sourceUrl,[docProof]);
   ocrPerYear.set(art.year,ocrPerYear.get(art.year)!+1);
  }
 }
 if([...missing.values()].some(r=>!r.seen)||recovered.size!==207
   ||ocrPerYear.get(2022)!==121||ocrPerYear.get(2023)!==22
   ||ocrPerYear.get(2024)!==13||ocrPerYear.get(2025)!==51
   ||allSourceVoteCandidates!==18||newVoteCandidates!==17
   ||knownChoiceTokens!==134||keyOnly.length!==1
   ||keyOnly[0]!.year!==2025
   ||keyOnly[0]!.sourceNamedChoiceTokensKnownCount!==8)
  throw Error('OCR source proof unpaired, extra, duplicated or not original expected 207');
 const years=[...byYear.values()].sort((a,b)=>a.auditedYear-b.auditedYear).map(r=>({
  ...r,
  documentProofs:[
   ...r.documentProofs,...[...recovered.values()].flat().filter(p=>p.document.year===r.auditedYear),
  ],
  originalPdfsFetchedAndParsed:r.independentlyDiscoveredOriginalMinutesPdfLinks,
  originalPdfsFailedOrUnparsed:0,
  unresolvedOriginalDocuments:[],
 }));
 const fullEvents=years.reduce((n,r)=>n+r.documentProofs.reduce((acc,p)=>acc+p.voteObservations.length,0),0);
 const fullChoiceTokens=years.reduce((n,r)=>n+r.documentProofs.reduce((acc,p)=>acc+
  p.voteObservations.reduce((a,v)=>a+v.namedMemberChoicesInPdf,0),0),0);
 if(years.reduce((n,r)=>n+r.documentProofs.length,0)!==1452
   ||fullEvents!==152||fullChoiceTokens!==981)
  throw Error('All 1452 original PDF proofs must be complete, with 152 full-key candidate rolls');
 return {
  years,knownKeyOnlyOriginalEvents:keyOnly,
  metadata:{
   originalElectronicMinutePdfUrls:1452,
   originalRawPdfHashesIndependentlyAuthenticated:1452,
   originalLowTextPdfsWithOcrPdfHashesRecovered:207,
   originalLowTextPdfsStillUnhashed:0,
   metadataArtifactCount:OCR_207_SOURCE_ARTIFACTS.length,
   fullKeyTallyChoiceSourceCandidateRolls:152,
   keyOnlyUnverifiableTallyChoiceOriginalRolls:1,
   allOriginalCandidateRollsIncludingKeyOnly:153,
   sourceNamedChoiceTokensWithExactOriginalChoiceDigests:981,
   sourceNamedChoiceTokensWithoutIndividualDigestProof:8,
   totalSourceNamedChoiceTokens:989,
   originalPdfSourceParserNotAnOfficialAllMotionsDenominator:true,
   noOriginalPdfTextOrOriginalNamesPersisted:true,
   noLiveDatabaseAccessOrMutation:true,
  },
 };
}
