/**
 * #863 frozen non-serving historical proof ledger, outcome-blind.
 * Strictly consumes five pinned, already-existing GH Actions artifacts.
 * Neither publisher date nor an official bill-version posting date alone
 * establishes first-public availability of the MEMBER'S statement.
 *
 * Requires env: ROSTER_863_V18_MANIFEST, ROSTER_863_V18_MATRIX,
 * ROSTER_863_V15_EXACT_SIGNALS, ROSTER_863_ARCHIVE_REPAIR,
 * ROSTER_863_P2_REMAINING, ROSTER_863_2025_READINESS, ROSTER_863_PROOF_OUTPUT.
 */
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

export const ROSTER_863_PROOF_MARKER='ROSTER_863_FROZEN_92_PROOF_V1_20261018';
export const ROSTER_863_PINNED_DIGESTS={
 matrixGzip:'42f9d79bd69df63b46a2f0f5c1636f4cc7f8fd0ec0a65ae905d85f28fd436700',
 matrixRaw:'2d4ed4993fd7efce5a0c7de2a4331f1f3a0f163e323f437c6f9e7dacf266a30b',
 matrixManifest:'449564349fa304604bc81879c76832dd3aab79f15aa7015a1808218612e4586d',
 signals:'68358c257d8dc1f95f946a1f80634f58d807afcd6097546e90341107969950e9',
 repair:'5ee6842698fd947da23aa1b0eed803cb160ea11b1681c63dbcc08c73da89bef4',
 readiness:'1eb6cc29bebc4a59851b26bb911608932d7def9bf7c05b2020786ce56e928407',
 p2remaining:'6dd6997dd706ef1058bc68cde9b5a36ac54411e8a4c30d7c68b1ed4af962c1da',
} as const;
const sha=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
type Json=Record<string,any>;
const date=(s:string)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
function readPinned(path:string,shaExpected:string):Buffer{
 const bytes=readFileSync(path);
 if(sha(bytes)!==shaExpected)throw Error('Immutable historical artifact byte digest mismatch');
 return bytes;
}
const jsonPinned=(path:string,digest:string)=>JSON.parse(readPinned(path,digest).toString('utf8')) as Json;
const key=(r:Json)=>String(r.voteEventId)+'|'+String(r.membershipId);
const present=(arr:unknown)=>Array.isArray(arr)&&arr.some(v=>Number(v)!==0);
export function checkRoster863ProofFreeze(){
 if(Object.values(ROSTER_863_PINNED_DIGESTS).some(x=>!/^[a-f0-9]{64}$/.test(x)) ||
   new Set(Object.values(ROSTER_863_PINNED_DIGESTS)).size!==7)
   throw Error('Frozen proof digest constants modified');
 return true;
}
export function auditRoster863FrozenProof(input:{
 manifest:Json;rows:Json[];signals:Json[];repair:Json;
 readiness:Json;p2remaining:Json;
}){
 checkRoster863ProofFreeze();
 if(input.manifest.schemaVersion!=='evidence-quality-historical-feature-matrix-v1.8-manifest'||
   input.manifest.coverage?.matrixRows!==135457||
   input.manifest.coverage?.combinedNonzeroRows!==92||
   input.manifest.coverage?.exactNonzeroRows!==38||
   input.manifest.coverage?.reviewedApplicabilityNonzeroRows!==54||
   input.manifest.digests?.matrixGzipSha256!==ROSTER_863_PINNED_DIGESTS.matrixGzip||
   input.manifest.digests?.matrixCanonicalNdjsonSha256!==ROSTER_863_PINNED_DIGESTS.matrixRaw||
   input.rows.length!==135457||
   input.repair.schemaVersion!=='evidence-quality-granular-availability-repair-plan-v1'||
   input.repair.summary?.distinctEvidenceItemsWithExactExcerptProof!==49||
   input.repair.summary?.sourcesApprovedForSourceWidePromotion!==0||
   input.readiness.schemaVersion!=='historical-density-2025-house-applicability-integration-readiness-v1'||
   input.readiness.integration?.rows?.length!==48||
   input.p2remaining.schemaVersion!=='historical-density-p2-remaining-applicability-canonical-v1'||
   input.p2remaining.applicableRows?.length!==4)
   throw Error('Frozen 92-row source manifest or proof source drift');
 const repair=new Map<string,Json>();
 for(const c of input.repair.repairCandidates as Json[]){
  for(const k of c.provenTargetRowKeys as string[]){
   if(repair.has(k))throw Error('Archive proof row appears twice');
   repair.set(k,c);
  }
 }
 const readiness=new Map<string,Json>();
 for(const r of input.readiness.integration.rows as Json[]){
  if(readiness.has(String(r.rowKey)))throw Error('Repeated 2025 witness');
  readiness.set(String(r.rowKey),r);
 }
 const p2=new Map<string,Json>();
 for(const r of input.p2remaining.applicableRows as Json[])p2.set(key(r),r);
 const report:Json[]=[];
 const seen=new Set<string>();
 for(const r of input.rows){
  const isExact=present(r.features),isReviewed=present(r.reviewedApplicabilityFeatures);
  if(!isExact&&!isReviewed)continue;
  if(isExact&&isReviewed)throw Error('Frozen exact/reviewed signals must not overlap');
  const k=key(r),ref=sha(k).slice(0,20);
  if(seen.has(ref))throw Error('Duplicate directional row');
  seen.add(ref);
  if(!date(r.occurredOn)||!['2021-2022','2023-2024','2025-2026'].includes(r.session))
   throw Error('Unexpected directional event date/session');
  const item:Json={
   rowRef:ref,session:r.session,chamber:r.chamber,bill:r.identifier,voteDay:r.occurredOn,
   featureFamily:isExact?'exact_bill':'reviewed_applicability',
   historicalClaimProof:'unsupported_historical_publication',
   claimAvailableOn:null,independentArchivedExcerptAt:null,
   independentArchivedExcerptSha256:null,claimSourceUrl:null,
   datedOfficialBillVersionPostingOn:null,datedOfficialBillTextSha256:null,
   memberClaimFirstPublicBytesIndependentlyVerified:false,
   onlyNonServingDiagnostic:true,noModelOrVoteLabelChanges:true,
  };
  if(isExact){
   const eligible=input.signals.filter((s:Json)=>
    s.membershipId===r.membershipId && s.billId===r.billId &&
    s.availabilityEligible===true && date(s.availableOn) &&
    s.availableOn<r.occurredOn);
   if(eligible.length===0)throw Error('No matching frozen strict pre-event exact-bill signal');
   item.claimAvailableOn=eligible.map((s:Json)=>s.availableOn).sort()[0];
   item.exactSignalCount=eligible.length;
   const proof=repair.get(k);
   if(proof){
    const metadata=proof.recommendedEvidenceMetadataPatch;
    if(metadata?.availabilityScope!=='evidence_item_excerpt'||
      metadata?.availabilityContentIdentity!=='exact_frozen_excerpt_match'||
      metadata?.availabilityProof!=='independent_archive_capture'||
      typeof proof.earliestVerifiedCapturedAt!=='string'||
      proof.earliestVerifiedCapturedAt.slice(0,10)>=r.occurredOn||
      !/^[a-f0-9]{64}$/.test(metadata.availabilityProofArchiveContentSha256)||
      !(proof.evidenceId&&proof.sourceDocumentId))
      throw Error('Archive excerpt proof identity/timestamp not independently sufficient');
    item.historicalClaimProof='archived_exact_excerpt_match';
    item.claimSourceUrl=proof.sourceUrl;
    item.independentArchivedExcerptAt=proof.earliestVerifiedCapturedAt;
    item.independentArchivedExcerptSha256=metadata.availabilityProofArchiveContentSha256;
    item.memberClaimFirstPublicBytesIndependentlyVerified=true;
    item.archiveScope='exact_frozen_excerpt_not_whole_source_document';
   }else{
    item.historicalClaimProof='publisher_date_metadata_only';
    item.archiveScope='no_independent_pre_vote_excerpt_replay_proof_in_recovered_source';
   }
  }else{
   const refProof=r.reviewedApplicability;
   if(!refProof||!date(refProof.versionPostedOn)||
     refProof.versionPostedOn>=r.occurredOn||
     !/^[a-f0-9]{64}$/.test(refProof.versionTextSha256))
     throw Error('Reviewed applicability lacks dated official bill version lineage');
   item.datedOfficialBillVersionPostingOn=refProof.versionPostedOn;
   item.datedOfficialBillTextSha256=refProof.versionTextSha256;
   item.officialBillPostingDoesNotProveMemberClaimPublication=true;
   const prior=readiness.get(k)??p2.get(k);
   if(prior){
    const claim=Array.isArray(prior.claims)?prior.claims[0]:prior;
    if(!claim||!date(claim.claimAvailableAt)||claim.claimAvailableAt>=r.occurredOn)
     throw Error('Reviewed claim has no strictly pre-vote asserted date');
    item.historicalClaimProof='publisher_date_metadata_only';
    item.claimAvailableOn=claim.claimAvailableAt;
    item.claimSourceUrl=Array.isArray(claim.sourceUrls)?claim.sourceUrls[0]??null:null;
   }else if(r.session!=='2021-2022'){
    throw Error('Only two original P2 reviewed claims may lack upstream dated record');
   }
  }
  report.push(item);
 }
 report.sort((a,b)=>a.session.localeCompare(b.session)||
  a.voteDay.localeCompare(b.voteDay)||a.bill.localeCompare(b.bill)||
  a.rowRef.localeCompare(b.rowRef));
 const count=(p:string)=>report.filter(r=>r.historicalClaimProof===p).length;
 if(report.length!==92||seen.size!==92||
   count('archived_exact_excerpt_match')!==19||
   count('publisher_date_metadata_only')!==71||
   count('unsupported_historical_publication')!==2||
   report.filter(r=>r.featureFamily==='exact_bill').length!==38||
   report.filter(r=>r.featureFamily==='reviewed_applicability').length!==54)
   throw Error('Frozen 92-row proof classification cardinalities changed; HOLD');
 const bySession=Object.fromEntries(['2021-2022','2023-2024','2025-2026']
    .map(s=>[s,report.filter(r=>r.session===s).length]));
 if(bySession['2021-2022']!==9||bySession['2023-2024']!==32||
    bySession['2025-2026']!==51)throw Error('Frozen session split drifted');
 const content={
  schemaVersion:'historical-roster-863-directional-availability-proof-v1',
  frozenMatrixArtifactId:11494634289,
  frozenMatrixRawSha256:ROSTER_863_PINNED_DIGESTS.matrixRaw,
  externalArchiveSourceProofArtifactId:11315632754,
  sourceSignalsArtifactId:11380755983,
  2025ReadinessArtifactId:11493988951,
  sourceP2ApplicabilityArtifactId:11436288880,
  directionalRows:92,bySession,
  byFamily:{exactBill:38,reviewedApplicability:54},
  historicalMemberStatementProof:{
   archivedExactExcerpt:19,publisherDateMetadataOnly:71,
   insufficientFrozenHistoricalPublicationProof:2,
  },
  allBillVersionPostingProofIsSeparateFromMemberClaimAvailability:true,
  noSourceWidePromotion:true,
  historicalOutcomesRead:false,trainingOrForecastWeightsChanged:false,
  productionDatabaseQueried:false,servingChanged:false,
  rows:report,
 };
 return {...content,contentSha256:sha(JSON.stringify(content))};
}
async function main(){
 const mode=process.argv[2];
 if(process.argv.length!==3||!['--preflight','--run'].includes(mode))
  throw Error('Expected only --preflight or --run');
 checkRoster863ProofFreeze();
 if(mode==='--preflight'){
  console.log('ROSTER_863_FROZEN_92_PROOF_PINNED_SOURCE_PREFLIGHT_OK');return;
 }
 const env=(name:string)=>{const v=process.env[name]?.trim();if(!v)throw Error('Required frozen artifact path '+name);return v};
 const manifest=jsonPinned(env('ROSTER_863_V18_MANIFEST'),ROSTER_863_PINNED_DIGESTS.matrixManifest);
 const zipped=readPinned(env('ROSTER_863_V18_MATRIX'),ROSTER_863_PINNED_DIGESTS.matrixGzip);
 const raw=gunzipSync(zipped);
 if(sha(raw)!==ROSTER_863_PINNED_DIGESTS.matrixRaw)
  throw Error('Frozen matrix canonical content drifted');
 const rows=raw.toString('utf8').trimEnd().split('\n').map(s=>JSON.parse(s) as Json);
 const sigGzip=readPinned(env('ROSTER_863_V15_EXACT_SIGNALS'),ROSTER_863_PINNED_DIGESTS.signals);
 const signals=gunzipSync(sigGzip).toString('utf8').trimEnd().split('\n').map(s=>JSON.parse(s) as Json);
 const repair=jsonPinned(env('ROSTER_863_ARCHIVE_REPAIR'),ROSTER_863_PINNED_DIGESTS.repair);
 const readiness=jsonPinned(env('ROSTER_863_2025_READINESS'),ROSTER_863_PINNED_DIGESTS.readiness);
 const p2remaining=jsonPinned(env('ROSTER_863_P2_REMAINING'),ROSTER_863_PINNED_DIGESTS.p2remaining);
 const ledger=auditRoster863FrozenProof({manifest,rows,signals,repair,readiness,p2remaining});
 const outDir=resolve(env('ROSTER_863_PROOF_OUTPUT'));
 mkdirSync(outDir,{recursive:true});
 writeFileSync(resolve(outDir,'historical-roster-863-92-proof-ledger.json'),
   JSON.stringify(ledger,null,2)+'\n');
 writeFileSync(resolve(outDir,'historical-roster-863-92-proof-ledger.tsv'),[
  ['rowRef','session','bill','voteDay','featureFamily','historicalClaimProof',
   'claimAvailableOn','independentArchivedExcerptAt','datedOfficialBillVersionPostingOn'].join('\t'),
  ...ledger.rows.map((r:Json)=>[
   r.rowRef,r.session,r.bill,r.voteDay,r.featureFamily,r.historicalClaimProof,
   r.claimAvailableOn??'',r.independentArchivedExcerptAt??'',
   r.datedOfficialBillVersionPostingOn??''].join('\t')),
 ].join('\n')+'\n');
 console.log('ROSTER_863_FROZEN_92_PROOF='+JSON.stringify({
  exactBill:ledger.byFamily.exactBill,reviewedApplicability:ledger.byFamily.reviewedApplicability,
  proof:ledger.historicalMemberStatementProof,
  bySession:ledger.bySession,ledgerSha256:ledger.contentSha256,
  frozenRowsUnchanged:true,sourceWidePromotion:false,
  outcomeRead:false,productionContacted:false,
 }));
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-863-frozen-directional-proof.ts'))
 void main().catch(()=>{console.error('ROSTER_863_FROZEN_92_PROOF_HOLD');process.exitCode=1});
