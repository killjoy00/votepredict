/** Fixed public-ledger regression receipt. No network, database, model or outcome access. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {websiteExcerptPlan,websiteExcerptPlanV1} from '../src/evidence/senate-864-historical-site-excerpt-asof.mjs';
import {SOURCE_LEDGER_FILES} from '../src/evidence/senate-864-95-historical-source-neon-parity.mjs';
import {buildRecoveryPlan} from './build-senate-864-95-missing-original-recovery-plan.mjs';
const OUT='docs/evaluation/source-proof/senate-864-website-person-resolution-20261019.json';
const sha=s=>createHash('sha256').update(s).digest('hex');
const m=JSON.parse(readFileSync('data/evaluation/senate-864-95-served-historical-candidate-research-manifest-v1.json'));
const docs=new Map(SOURCE_LEDGER_FILES.map(path=>[path,JSON.parse(readFileSync(path))]));
const witnesses=buildRecoveryPlan().witnesses;
const old=websiteExcerptPlanV1(m,docs,witnesses),current=websiteExcerptPlan(m,docs,witnesses);
const oldIds=new Set(old.ready.map(r=>r.id)),added=current.ready.filter(r=>!oldIds.has(r.id));
const now=new Map(current.ready.map(r=>[r.id,r]));
if(old.ready.some(r=>JSON.stringify(now.get(r.id))!==JSON.stringify(r)))throw Error('Frozen website evidence drift');
const people=[...new Set(added.map(r=>r.ordinal))].map(ordinal=>({officialName:m.people[ordinal-1].officialName,
 resolvedExcerpts:added.filter(r=>r.ordinal===ordinal).length,
 publicSourceLedger:[...new Set(added.filter(r=>r.ordinal===ordinal).map(r=>r.id.split('|')[0]))]}));
const excluded=current.holds.filter(r=>r.reason==='outside_served_senate_cohort');
const report={version:'senate864-website-person-resolution-v2',sourceReviewedMain:'599f237211f925cad67d9c6b21b023dc82d17ef4',
 sourceLedgerCount:29,materializedExcerpts:1197,legacyPersonHoldLabels:55,resolvedFromExistingExplicitMetadata:added.length,
 resolvedPeople:people,knownPersonOutsideStudy:excluded.map(r=>({candidateName:r.knownCandidateName,publicExcerptId:r.id.split('|')[1]})),
 unknownPersonExcerpts:current.holdCounts.unresolved_official_person??0,sourceReadyExcerpts:current.ready.length,
 remainingSourceMetadataHolds:current.holds.filter(r=>r.reason!=='outside_served_senate_cohort').length,
 correctedHoldCounts:current.holdCounts,sourceReadyPeople:new Set(current.ready.map(r=>r.ordinal)).size,
 sourceReadyUniqueBodies:new Set(current.ready.map(r=>r.sourceSha)).size,
 frozenV1:{ready:old.ready.length,held:old.holds.length,exactAll616RecordsAndIngestionKeysPreserved:true,
 readyPlanSha256:sha(JSON.stringify(old.ready)),protocolSha256:sha(readFileSync('docs/evaluation/senate-864-website-experiment-protocol-v1.json'))},
 originalArchiveClockAndSourceGatesUnchanged:true,personNameNotInferredFromSurnameOrDistrict:true,
 databaseReadByThisCheck:false,databaseWritesByThisChange:0,additionalExcerptsImportedByThisChange:0,
 lastDatabaseReceipt:'docs/evaluation/source-proof/senate-864-completion-readback-20261019.json',
 lastVerifiedStoredLiteralExcerpts:616,frozenPreparedMemberBillTargets:11514,
 current668IsSourceReadinessNotStoredCount:true,noOutcomesModelsServingWeightsTrainingOrFreezeChanges:true};
if(added.length!==52||excluded.length!==3||current.ready.length!==668||current.holds.length!==529||report.unknownPersonExcerpts!==0)throw Error('Person resolution scope changed');
const body=JSON.stringify(report,null,2)+'\n';
if(process.argv.length!==3||!['--write','--check'].includes(process.argv[2]))throw Error('Fixed --write or --check mode required');
if(process.argv[2]==='--write')writeFileSync(OUT,body);
else if(readFileSync(OUT,'utf8')!==body)throw Error('Committed person correction receipt drift');
console.log('SENATE864_PERSON_CORRECTION='+JSON.stringify({resolved:added.length,knownOutsideStudy:excluded.length,unknown:0,sourceReady:668,storedReceipt:616,additionalDatabaseImports:0,frozenV1Preserved:true}));
