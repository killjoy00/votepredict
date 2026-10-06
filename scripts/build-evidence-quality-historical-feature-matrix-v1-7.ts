import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REVIEWED_APPLICABILITY_FEATURE_NAMES, reviewedApplicabilityFeatureVector } from '../src/evidence/historical-density-p2-canonical.js';

const EXPECTED_ROWS = 135457;
const EXPECTED_ROW_KEY_SHA = '3aa47101f9e4a848e293fdaa89ef853919d49826b68ae90960370c5c19e9df72';
const EXPECTED_V16_CANONICAL_SHA = '4d914a55eb9fd3b40402e493665ef8bbbad301a7a56c5a1306439c6e9af8e729';
const EXPECTED_V16_GZIP_SHA = 'b987489f6a31bbba9a711b7d6e917fe202662d8039d0ff65d4aea746e11c6ffc';
const EXPECTED_V16_ARTIFACT = { artifactId: 11391697762, artifactDigest: 'sha256:6d30be0dabed59d66994749ac3a7e872eaf5b652d775b2392c573b300305828f' } as const;
const OUTPUT_MATRIX = 'evidence-quality-historical-feature-matrix-v1.7.ndjson.gz';
const OUTPUT_MANIFEST = 'evidence-quality-historical-feature-matrix-v1.7-manifest.json';

type AlignmentDirection = 'position_aligns_with_bill' | 'position_conflicts_with_bill';
type ApplicableRow = {
  reviewKey: string; voteEventId: string; membershipId: string; memberName: string; semanticKey: string; sourceRows: number[];
  claimAvailableAt: string; memberStance: 'supports' | 'opposes'; normalizedClaim: string;
  claimFeatureMetadata: { claimType: string; explicitness: 'direct_quote' | 'document_position' | 'attributed_paraphrase'; extractionConfidence: number };
  chamber: string; billId: string; identifier: string; occurredOn: string; alignmentDirection: AlignmentDirection; billPolicyDirection: string;
  versionTextSha256: string; versionUrl: string; versionPostedOn: string; contextOnly: boolean; mechanicallyActionable: boolean; modelWeight: number;
};
type CanonicalReview = {
  schemaVersion: string; issue: number;
  review: { candidateReviewGroups: number; candidateClaimPairs: number; decisionCounts: Record<string,{groups:number;pairs:number}>; finalPairStatusCounts: Record<string,number> };
  applicableRows: ApplicableRow[];
  policy: { outcomeUse: string; sameDayVersionEligible: boolean; onlyApplicableMayReachMatrix: boolean; contextOnly: boolean; mechanicallyActionable: boolean; modelWeight: number; productionDatabaseQueried: boolean; productionWrites: boolean; vercelUsed: boolean; modelFitting: string; servingChanged: boolean };
};
type V16Manifest = {
  schemaVersion: string; issue: number;
  targetUniverse: { rows: number; events: number; memberships: number; rowKeySha256: string; [key:string]: unknown };
  featureFamilies: { exactBill: { names: string[]; nonzeroRows: number; featureDigestBefore: string; featureDigestAfter: string; [key:string]:unknown }; reviewedApplicability: { names:string[]; nonzeroRows:number; applicableReviewKeys:string[]; [key:string]:unknown } };
  coverage: { matrixRows:number; exactNonzeroRows:number; reviewedApplicabilityNonzeroRows:number; combinedNonzeroRows:number; membershipsWithCombinedDirectionalEvidence:number; eventsWithCombinedDirectionalEvidence:number; bySession: Record<string,{rows:number; exactNonzeroRows:number; reviewedApplicabilityNonzeroRows:number; combinedNonzeroRows:number}>; [key:string]:unknown };
  digests: { matrixCanonicalNdjsonSha256:string; matrixGzipSha256:string };
  policy: Record<string, unknown>;
  [key:string]: unknown;
};
type MatrixRow = {
  schemaVersion: string; voteEventId:string; membershipId:string; legislatorId:string; session:string; chamber:string; occurredOn:string; billId:string; identifier:string; eventStatus:string;
  features:number[]; reviewedApplicabilityFeatures:number[]; reviewedApplicability: null | Record<string, unknown>;
};
function env(name:string):string { const value=process.env[name]?.trim(); if(!value) throw new Error(`${name} is required`); return value; }
function sha(data:string|Buffer):string { return createHash('sha256').update(data).digest('hex'); }
function rowKey(row:MatrixRow):string { return `${row.voteEventId}|${row.membershipId}`; }
function vectorNonzero(values:readonly number[]):boolean { return values.some((x)=>x!==0); }
function digestVectors(rows:readonly MatrixRow[], field:'features'|'reviewedApplicabilityFeatures'):string {
  const payload=rows.map((r)=>`${rowKey(r)}|${JSON.stringify(r[field])}`).sort().join('\n')+'\n'; return sha(payload);
}
function coverage(rows:readonly MatrixRow[]) {
  const bySession: Record<string,{rows:number;exactNonzeroRows:number;reviewedApplicabilityNonzeroRows:number;combinedNonzeroRows:number}>={};
  const memberships=new Set<string>(), events=new Set<string>(); let exact=0,app=0,combined=0,overlap=0;
  for(const row of rows){ const e=vectorNonzero(row.features), a=vectorNonzero(row.reviewedApplicabilityFeatures); if(e)exact++; if(a)app++; if(e||a){combined++;memberships.add(row.membershipId);events.add(row.voteEventId);} if(e&&a)overlap++;
    const s=bySession[row.session]??={rows:0,exactNonzeroRows:0,reviewedApplicabilityNonzeroRows:0,combinedNonzeroRows:0}; s.rows++; if(e)s.exactNonzeroRows++; if(a)s.reviewedApplicabilityNonzeroRows++; if(e||a)s.combinedNonzeroRows++; }
  return {matrixRows:rows.length,exactNonzeroRows:exact,reviewedApplicabilityNonzeroRows:app,combinedNonzeroRows:combined,overlapRows:overlap,membershipsWithCombinedDirectionalEvidence:memberships.size,eventsWithCombinedDirectionalEvidence:events.size,bySession};
}

function main():void {
  const review=JSON.parse(readFileSync(env('VOTEPREDICT_P2_REMAINING_CANONICAL_REVIEW_PATH'),'utf8')) as CanonicalReview;
  const v16Manifest=JSON.parse(readFileSync(env('VOTEPREDICT_EQ_V16_MANIFEST_PATH'),'utf8')) as V16Manifest;
  const v16Gzip=readFileSync(env('VOTEPREDICT_EQ_V16_MATRIX_PATH'));
  const outDir=env('VOTEPREDICT_EQ_V17_OUTPUT_DIR');
  if(review.schemaVersion!=='historical-density-p2-remaining-applicability-canonical-v1'||review.issue!==718||review.review.candidateReviewGroups!==124||review.review.candidateClaimPairs!==138
    ||review.review.decisionCounts.applicable?.groups!==4||review.review.decisionCounts.ambiguous_fail_closed?.groups!==17||review.review.decisionCounts.not_applicable?.groups!==103||review.review.decisionCounts.pending_review?.groups!==0
    ||review.review.finalPairStatusCounts.applicable!==4||review.review.finalPairStatusCounts.ambiguous_fail_closed!==91||review.review.finalPairStatusCounts.not_applicable!==2621||review.review.finalPairStatusCounts.pending_review!==0
    ||review.applicableRows.length!==4||review.policy.outcomeUse!=='none'||review.policy.sameDayVersionEligible||!review.policy.onlyApplicableMayReachMatrix||!review.policy.contextOnly||review.policy.mechanicallyActionable||review.policy.modelWeight!==0||review.policy.productionDatabaseQueried||review.policy.productionWrites||review.policy.vercelUsed||review.policy.modelFitting!=='none'||review.policy.servingChanged) throw new Error('Remaining canonical review drifted');
  if(v16Manifest.schemaVersion!=='evidence-quality-historical-feature-matrix-v1.6-manifest'||v16Manifest.issue!==718||v16Manifest.targetUniverse.rows!==EXPECTED_ROWS||v16Manifest.targetUniverse.rowKeySha256!==EXPECTED_ROW_KEY_SHA
    ||v16Manifest.coverage.exactNonzeroRows!==38||v16Manifest.coverage.reviewedApplicabilityNonzeroRows!==2||v16Manifest.coverage.combinedNonzeroRows!==40
    ||v16Manifest.digests.matrixCanonicalNdjsonSha256!==EXPECTED_V16_CANONICAL_SHA||v16Manifest.digests.matrixGzipSha256!==EXPECTED_V16_GZIP_SHA
    ||sha(v16Gzip)!==EXPECTED_V16_GZIP_SHA||v16Manifest.policy.outcomeUseDuringFeatureConstruction!=='none'||v16Manifest.policy.productionDatabaseQueried||v16Manifest.policy.vercelUsed||v16Manifest.policy.modelFitting!=='none'||v16Manifest.policy.servingChanged) throw new Error('v1.6 baseline identity/policy drifted');
  const canonical16=gunzipSync(v16Gzip).toString('utf8'); if(sha(canonical16)!==EXPECTED_V16_CANONICAL_SHA) throw new Error('v1.6 canonical digest drifted');
  const rows=canonical16.trimEnd().split('\n').map((line)=>JSON.parse(line) as MatrixRow); if(rows.length!==EXPECTED_ROWS) throw new Error(`Expected ${EXPECTED_ROWS} rows, got ${rows.length}`);
  const keySha=sha(rows.map(rowKey).sort().join('\n')+'\n'); if(keySha!==EXPECTED_ROW_KEY_SHA) throw new Error('Target row-key digest drifted');
  const exactBefore=digestVectors(rows,'features'); const previousReviewedBefore=digestVectors(rows,'reviewedApplicabilityFeatures');
  const newByKey=new Map<string,ApplicableRow>();
  for(const applicable of review.applicableRows){
    if(!applicable.contextOnly||applicable.mechanicallyActionable||applicable.modelWeight!==0||!(applicable.claimAvailableAt<applicable.occurredOn)||!(applicable.versionPostedOn<applicable.occurredOn)) throw new Error(`Unsafe applicable row ${applicable.reviewKey}`);
    const key=`${applicable.voteEventId}|${applicable.membershipId}`; if(newByKey.has(key)) throw new Error(`Duplicate applicable row key ${key}`); newByKey.set(key,applicable);
  }
  const touched=new Set<string>();
  const outRows=rows.map((row):MatrixRow=>{
    const applicable=newByKey.get(rowKey(row));
    if(!applicable) return {...row,schemaVersion:'evidence-quality-historical-feature-matrix-v1.7'};
    if(row.voteEventId!==applicable.voteEventId||row.membershipId!==applicable.membershipId||row.billId!==applicable.billId||row.identifier!==applicable.identifier||row.occurredOn!==applicable.occurredOn||row.chamber!==applicable.chamber) throw new Error(`Target identity mismatch for ${applicable.reviewKey}`);
    if(vectorNonzero(row.features)||vectorNonzero(row.reviewedApplicabilityFeatures)||row.reviewedApplicability!==null) throw new Error(`New applicability row overlaps prior evidence: ${rowKey(row)}`);
    touched.add(rowKey(row));
    return {...row,schemaVersion:'evidence-quality-historical-feature-matrix-v1.7',reviewedApplicabilityFeatures:reviewedApplicabilityFeatureVector({alignmentDirection:applicable.alignmentDirection,explicitness:applicable.claimFeatureMetadata.explicitness,extractionConfidence:applicable.claimFeatureMetadata.extractionConfidence}),reviewedApplicability:{reviewKey:applicable.reviewKey,claimId:applicable.semanticKey,issueFamily:applicable.semanticKey,semanticKey:applicable.semanticKey,alignmentDirection:applicable.alignmentDirection,billPolicyDirection:applicable.billPolicyDirection,versionTextSha256:applicable.versionTextSha256,versionPostedOn:applicable.versionPostedOn}};
  });
  if(touched.size!==4) throw new Error(`Expected four overlaid rows, got ${touched.size}`);
  if(digestVectors(outRows,'features')!==exactBefore) throw new Error('Exact-bill feature vectors changed');
  const untouchedOld=rows.filter((r)=>!newByKey.has(rowKey(r))); const untouchedNew=outRows.filter((r)=>!newByKey.has(rowKey(r)));
  if(digestVectors(untouchedOld,'reviewedApplicabilityFeatures')!==digestVectors(untouchedNew,'reviewedApplicabilityFeatures')) throw new Error('Previous reviewed-applicability vectors changed');
  const cov=coverage(outRows); const s21=cov.bySession['2021-2022'],s23=cov.bySession['2023-2024'],s25=cov.bySession['2025-2026'];
  if(cov.matrixRows!==EXPECTED_ROWS||cov.exactNonzeroRows!==38||cov.reviewedApplicabilityNonzeroRows!==6||cov.combinedNonzeroRows!==44||cov.overlapRows!==0||cov.membershipsWithCombinedDirectionalEvidence!==30||cov.eventsWithCombinedDirectionalEvidence!==39
    ||!s21||s21.rows!==35510||s21.exactNonzeroRows!==3||s21.reviewedApplicabilityNonzeroRows!==6||s21.combinedNonzeroRows!==9
    ||!s23||s23.rows!==49827||s23.exactNonzeroRows!==32||s23.reviewedApplicabilityNonzeroRows!==0||s23.combinedNonzeroRows!==32
    ||!s25||s25.rows!==50120||s25.exactNonzeroRows!==3||s25.reviewedApplicabilityNonzeroRows!==0||s25.combinedNonzeroRows!==3) throw new Error(`v1.7 coverage drifted: ${JSON.stringify(cov)}`);
  const canonical17=outRows.map((r)=>JSON.stringify(r)).join('\n')+'\n'; const gzip17=gzipSync(Buffer.from(canonical17));
  const manifest={schemaVersion:'evidence-quality-historical-feature-matrix-v1.7-manifest',generatedAt:new Date().toISOString(),issue:718,baseline:{artifactId:EXPECTED_V16_ARTIFACT.artifactId,artifactDigest:EXPECTED_V16_ARTIFACT.artifactDigest,matrixSchemaVersion:'evidence-quality-historical-feature-matrix-v1.6',matrixCanonicalNdjsonSha256:EXPECTED_V16_CANONICAL_SHA,matrixGzipSha256:EXPECTED_V16_GZIP_SHA},targetUniverse:v16Manifest.targetUniverse,featureFamilies:{exactBill:{...v16Manifest.featureFamilies.exactBill,semanticsChangedFromV16:false,nonzeroRows:38,featureDigestBefore:exactBefore,featureDigestAfter:digestVectors(outRows,'features')},reviewedApplicability:{names:[...REVIEWED_APPLICABILITY_FEATURE_NAMES],count:REVIEWED_APPLICABILITY_FEATURE_NAMES.length,nonzeroRows:6,previousNonzeroRows:2,netAddedRows:4,previousFeatureDigest:previousReviewedBefore,applicableReviewKeys:review.applicableRows.map((x)=>x.reviewKey).sort()}},coverage:{...cov,netAddedCombinedRowsVsV16:4,exactRowsChangedVsV16:0,reviewedApplicabilityRowsChangedOutsideAdditions:0},applicabilityGate:{candidateReviewGroups:124,candidateClaimPairs:138,decisionCounts:review.review.decisionCounts,finalPairStatusCounts:review.review.finalPairStatusCounts,applicableRows:4},digests:{matrixCanonicalNdjsonSha256:sha(canonical17),matrixGzipSha256:sha(gzip17)},policy:{readOnly:true,outcomeUseDuringFeatureConstruction:'none',strictPreEventAvailability:true,sameDayEvidenceExcluded:true,exactBillEvidenceSemanticsRemainSeparate:true,previousReviewedApplicabilityPreserved:true,pendingOrAmbiguousApplicabilityIncluded:false,productionDatabaseQueried:false,productionWrites:false,vercelUsed:false,modelFitting:'none',servingChanged:false,modelWeightChanged:false}};
  mkdirSync(outDir,{recursive:true}); writeFileSync(resolve(outDir,OUTPUT_MATRIX),gzip17); writeFileSync(resolve(outDir,OUTPUT_MANIFEST),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({historicalFeatureMatrixV17:{coverage:cov,netAdded:4,exactRowsChanged:0,outcomeUse:'none',vercelUsed:false,modelFitting:'none'}},null,2));
}
main();
