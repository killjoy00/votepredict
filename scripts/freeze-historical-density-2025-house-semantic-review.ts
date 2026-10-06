import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const COHORT_SCHEMA='historical-density-2025-house-semantic-review-cohort-v1';
const DECISION_SCHEMA='historical-density-2025-house-semantic-decisions-v1';
const PART_SCHEMA='historical-density-2025-house-semantic-decisions-part-v1';
const OUTPUT_SCHEMA='historical-density-2025-house-semantic-review-v1';
const BATCH_ID='EQV1-HISTORICAL-DENSITY-2025-HOUSE-001';
const SESSION='2025-2026';
const RUN_ID=37528487859;
const ARTIFACT_ID=11443187627;
const ARTIFACT_DIGEST='sha256:13aebbf7882adf1e0afef19adc932d0109b56b8b331c052680b1586937b001c5';
const SELECTION_SHA='984c1d1128968c0b22079421cbcdbf2580459622728efb01a030c461b99d3d62';
const EXPECTED_NON=[16,28,29,31];

type AnyObject=Record<string,any>;
function env(name:string){const v=process.env[name]?.trim();if(!v)throw new Error(`${name} is required`);return v;}
function readJson(path:string){return JSON.parse(readFileSync(path,'utf8')) as AnyObject;}

function main(){
  const cohort=readJson(env('VOTEPREDICT_2025_HOUSE_SEMANTIC_COHORT_PATH'));
  const decisionDir=resolve(env('VOTEPREDICT_2025_HOUSE_SEMANTIC_DECISION_DIR'));
  const output=resolve(env('VOTEPREDICT_2025_HOUSE_SEMANTIC_REVIEW_OUTPUT'));
  const manifest=readJson(resolve(decisionDir,'manifest.json'));
  const parts=(manifest.parts as string[]).map((name)=>readJson(resolve(decisionDir,name)));
  const decisions=parts.flatMap((part)=>part.decisions as AnyObject[]);

  if(cohort.schemaVersion!==COHORT_SCHEMA||cohort.issue!==718||cohort.session!==SESSION||cohort.documents?.length!==50
    ||cohort.selection?.recoveredBodies!==1340||cohort.selection?.parsedArticleOwnedBodies!==1310||cohort.selection?.uniqueArticleOwnedBodies!==1290
    ||cohort.selection?.strongSignalDocuments!==400||cohort.selection?.strongSignalMembers!==123||cohort.selection?.selectedDocuments!==50
    ||cohort.selection?.selectedMembers!==50||cohort.selection?.maximumDocumentsPerMember!==1||cohort.selection?.selectionKeySha256!==SELECTION_SHA
    ||cohort.selection?.targetBillTextUsed||cohort.selection?.targetBillIdentifiersUsedForSelection||cohort.selection?.targetVoteOutcomesUsed
    ||cohort.selection?.targetEventIdentityUsedForSelection||!cohort.selection?.strictFutureEventCountUsedForTieBreakOnly
    ||!cohort.policy?.outcomeBlind||cohort.policy?.outcomeUse!=='none'||!cohort.policy?.sourceBodiesAreOfficialHouseMemberPrimary
    ||!cohort.policy?.articleOwnedTextOnlyForSignalSelection||!cohort.policy?.memberIssueOnlyAtThisStage||cohort.policy?.billInference
    ||!cohort.policy?.candidateBillIdentifiersRequiredEmpty||cohort.policy?.targetBillApplicabilityInferred||!cohort.policy?.publicLlrIdentityOnly
    ||cohort.policy?.internalMembershipIdentityResolved||cohort.policy?.productionDatabaseQueried||cohort.policy?.productionWrites||cohort.policy?.vercelUsed
    ||cohort.policy?.sameDayEligible||!cohort.policy?.contextOnly||cohort.policy?.mechanicallyActionable||cohort.policy?.modelWeight!==0
    ||cohort.policy?.featureRowsWritten||cohort.policy?.modelFitting!=='none'||cohort.policy?.servingChanged){
    throw new Error('Frozen 2025 House semantic cohort identity/policy drifted');
  }

  if(manifest.schemaVersion!==DECISION_SCHEMA||manifest.batchId!==BATCH_ID||manifest.issue!==718
    ||manifest.frozenCohort?.runId!==RUN_ID||manifest.frozenCohort?.artifactId!==ARTIFACT_ID||manifest.frozenCohort?.digest!==ARTIFACT_DIGEST
    ||manifest.frozenCohort?.selectionKeySha256!==SELECTION_SHA||manifest.parts?.length!==5||manifest.policy?.candidateBillIdentifiers?.length!==0
    ||manifest.policy?.targetBillApplicabilityInferred||manifest.policy?.outcomeUse!=='none'||!manifest.policy?.memberIssueOnly||manifest.policy?.billInference
    ||manifest.policy?.internalMembershipIdentityResolved||!manifest.policy?.contextOnly||manifest.policy?.mechanicallyActionable||manifest.policy?.modelWeight!==0
    ||manifest.policy?.productionDatabaseQueried||manifest.policy?.productionWrites||manifest.policy?.vercelUsed||manifest.policy?.modelFitting!=='none'
    ||manifest.policy?.servingChanged){throw new Error('2025 House semantic-decision manifest drifted');}

  if(parts.some((part,index)=>part.schemaVersion!==PART_SCHEMA||part.part!==index+1||part.decisions?.length!==10
    ||part.rows?.[0]!==index*10+1||part.rows?.[1]!==(index+1)*10)){throw new Error('Semantic decision part identity drifted');}
  if(decisions.length!==50||JSON.stringify(decisions.map((x)=>x.row))!==JSON.stringify(Array.from({length:50},(_,i)=>i+1))){
    throw new Error('Semantic decisions must cover rows 1..50 exactly once');
  }

  const directional=decisions.filter((x)=>x.decision==='directional');
  const non=decisions.filter((x)=>x.decision==='non_directional');
  if(directional.length!==46||non.length!==4||new Set(directional.map((x)=>x.semanticKey)).size!==46
    ||JSON.stringify(non.map((x)=>x.row))!==JSON.stringify(EXPECTED_NON)||directional.some((x)=>x.crossBatchDuplicateOf?.length!==0)){
    throw new Error(`Semantic review counts drifted directional=${directional.length} non=${non.length}`);
  }

  const documentReviews=decisions.map((decision)=>{
    const doc=cohort.documents[decision.row-1];
    if(!doc||doc.row!==decision.row||doc.publicMemberKey!==`public-lrl:${SESSION}:${doc.lrlId}`||!doc.memberName?.trim()
      ||!doc.articleUrl?.startsWith('https://www.house.mn.gov/')||doc.candidateBillIdentifiers?.length!==0||doc.strictFutureTargetEventCount<1
      ||!(doc.publishedOn<doc.earliestStrictFutureTargetDate)||!(doc.publishedOn<doc.latestStrictFutureTargetDate)){
      throw new Error(`Frozen cohort row invalid: ${decision.row}`);
    }
    const base={row:decision.row,publicMemberKey:doc.publicMemberKey,lrlId:doc.lrlId,memberName:doc.memberName,sourceUrl:doc.articleUrl,
      sourceTitle:doc.articleTitle,sourceContentSha256:doc.contentSha256,articleOwnedTextSha256:doc.articleOwnedTextSha256,publishedOn:doc.publishedOn,
      candidateBillIdentifiers:[] as string[]};
    if(decision.decision==='non_directional'){
      if(!decision.reasonCode?.trim())throw new Error(`Non-directional row ${decision.row} lacks reason`);
      return {...base,decision:'non_directional' as const,reasonCode:decision.reasonCode};
    }
    if(!decision.semanticKey?.trim()||!decision.topics?.length||!decision.normalizedClaim?.trim()||!decision.supportingExcerpt?.trim()
      ||!doc.articleOwnedText.includes(decision.supportingExcerpt))throw new Error(`Directional row ${decision.row} lacks exact grounded fields`);
    return {...base,decision:'directional' as const,semanticKey:decision.semanticKey,districts:doc.districts,parties:doc.parties,
      strictFutureTargetEventCount:doc.strictFutureTargetEventCount,earliestStrictFutureTargetDate:doc.earliestStrictFutureTargetDate,
      latestStrictFutureTargetDate:doc.latestStrictFutureTargetDate,linkage:'member_issue' as const,topics:decision.topics,claimType:decision.claimType,
      stance:decision.stance,specificity:'issue_family' as const,explicitness:decision.explicitness,attributionType:'target_member' as const,
      attributedActor:doc.memberName,normalizedClaim:decision.normalizedClaim,supportingExcerpt:decision.supportingExcerpt,extractionConfidence:0.97,
      crossBatchDuplicateOf:[] as string[],internalMembershipIdentityResolved:false};
  });

  const semanticGroups=documentReviews.filter((x)=>x.decision==='directional').map((x:any)=>({semanticKey:x.semanticKey,publicMemberKey:x.publicMemberKey,
    lrlId:x.lrlId,memberName:x.memberName,sourceRows:[x.row],sourceUrls:[x.sourceUrl],earliestAvailability:x.publishedOn,topics:x.topics,
    claimType:x.claimType,stance:x.stance,explicitness:x.explicitness,normalizedClaim:x.normalizedClaim,supportingExcerpt:x.supportingExcerpt,
    extractionConfidence:0.97,linkage:'member_issue',candidateBillIdentifiers:[],crossBatchDuplicateOf:[],novelForApplicabilityScreen:true,
    internalMembershipIdentityResolved:false})).sort((a:any,b:any)=>a.semanticKey.localeCompare(b.semanticKey));

  const report={schemaVersion:OUTPUT_SCHEMA,batchId:BATCH_ID,generatedAt:new Date().toISOString(),issue:718,session:SESSION,
    frozenCohort:{runId:RUN_ID,artifactId:ARTIFACT_ID,digest:ARTIFACT_DIGEST,selectionKeySha256:SELECTION_SHA},
    summary:{documents:50,directionalDocuments:46,nonDirectionalDocuments:4,uniqueSemanticGroups:46,novelSemanticGroups:46,
      crossBatchDuplicateSemanticGroups:0,candidateBillIdentifiers:0,internalMembershipIdentitiesResolved:0},semanticGroups,documentReviews,
    policy:{outcomeBlind:true,outcomeUse:'none',memberIssueOnly:true,billInference:false,candidateBillIdentifiersRequiredEmpty:true,
      targetBillApplicabilityInferred:false,onlyNovelSemanticGroupsAdvanceToApplicabilityScreen:true,publicLlrIdentityOnly:true,
      internalMembershipIdentityResolved:false,internalIdentityResolutionRequiredBeforeFeatureIntegration:true,productionDatabaseQueried:false,
      productionWrites:false,contextOnly:true,mechanicallyActionable:false,modelWeight:0,modelFitting:'none',vercelUsed:false,servingChanged:false},
    contentSha256WithoutSelfField:null as string|null};
  mkdirSync(dirname(output),{recursive:true});
  const canonical=`${JSON.stringify(report,null,2)}\n`;
  report.contentSha256WithoutSelfField=createHash('sha256').update(canonical).digest('hex');
  writeFileSync(output,`${JSON.stringify(report,null,2)}\n`,'utf8');
  console.log(JSON.stringify({historicalDensity2025HouseSemanticReview:report.summary,policy:{outcomeUse:'none',productionDatabaseQueried:false,vercelUsed:false,modelFitting:'none'}},null,2));
}
main();
