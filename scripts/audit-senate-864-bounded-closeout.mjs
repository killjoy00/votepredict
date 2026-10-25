/** Final fixed-corpus reconciliation. Offline prepare/verify only; no network,
 * database connection, writes, outcome experiment or source discovery. */
import {readFileSync,writeFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {expansionInputs} from '../src/evidence/senate-864-website-expansion.mjs';
import {walkObjects} from '../src/evidence/senate-864-website-metadata-recovery.mjs';
import {candidateSiteDrafts} from '../src/evidence/senate-864-website-signal-neon.mjs';
import {verifyWebsiteNeonReadback} from '../src/evidence/senate-864-website-signal-readback.mjs';
import {registry830,VERIFY_SQL,REVALIDATE_SQL,safeRevalidation} from '../src/evidence/cfb-864-pdf-registry-eligibility-v48.mjs';
import {FINANCE_CANONICAL_SQL,FINANCE_REGISTRY_SQL,COMMITTEE_YEAR_SQL,MEDIA_CONTEXT_SQL,mediaAccounting} from '../src/evidence/senate-864-completion-audit.mjs';
import {SNAPSHOT_SQL} from './deploy-senate-864-population-row-rolls.mjs';
import {extractRowRollQuestions,resolvePrintedHistoricalChoices} from '../src/evidence/senate-864-population-named-rolls.mjs';
import {priorOriginalQueue,authenticatePriorQuestionOriginals,verifiedPriorQuestionEvents} from '../src/evidence/senate-864-prior-question-bridge.mjs';
import {coalesceQuestionSources,DOC_SQL} from './inventory-senate-864-population.mjs';
import {MEDIA,FINANCE,VERSIONS,CAPTURE} from './audit-senate-864-three-bounded-evidence.mjs';
import {WRITE_MEDIA,WRITE_LINKS,ENTRIES} from './deploy-senate-864-three-bounded.mjs';
import {mediaPlan,financePlan} from '../src/evidence/senate-864-three-bounded-plan.mjs';
import {parseMillerPrintedRows,MEDIA_FRAGMENTS} from '../src/evidence/senate-864-three-bounded-evidence.mjs';
export const BASE_MAIN='e87fdc1ad63cb961e363ce1adbb2d56c2d4778e8';
export const PREVIOUS_COMMITTEE_STATE={readAt:'2026-10-25T14:19:49.580Z',events:221,choices:1950,eventRowsSha256:'0c5d19a2084fd1bc7a04e7398ce21fdc428675960ff3498186fa70e4c4b71e40',choiceRowsSha256:'f12bca75b1478184c729221928c6e726061b3fdef5bf2cd7eb4f7cb5f0a455dc'};
export const INVENTORY='docs/evaluation/source-proof/senate-864-population-original-inventory-20261023-explicit-labels.json';
export const FROZEN_INPUTS={
 'docs/evaluation/senate-864-website-experiment-protocol-v1.json':'ba6b6bddc901fb26f2ea19897bf855a25d9f6b3ca81d9de5b3fedfb78eeff43b',
 'docs/evaluation/senate-864-website-experiment-protocol-v2.json':'e3b57c7c6460e329b73e8acf58e6c9606777db7b75cbd6b4420e0870a7108ac0',
 'docs/evaluation/source-proof/senate-864-website-v2-executed-20261019.json':'2a088ecbddbda8158dba0835adac345efe56dbe9fd9e75fc81cca6f46bd2e0b7'
};
const read=p=>JSON.parse(readFileSync(p));
export const sha=s=>createHash('sha256').update(s).digest('hex');
const sqlJson=v=>{const s=JSON.stringify(v),tag='$votepredict_864_closeout$';if(s.includes(tag))throw Error('SQL literal delimiter collision');return tag+s+tag;};
const sqlArray=a=>'ARRAY['+a.map(s=>"'"+s.replaceAll("'","''")+"'").join(',')+']::text[]';
export function verifyFrozenInputs(readBytes=readFileSync){for(const [path,expected]of Object.entries(FROZEN_INPUTS))if(sha(readBytes(path))!==expected)throw Error('Frozen protocol/result changed');return FROZEN_INPUTS;}
export function finalWebsiteInputs(map=read('docs/evaluation/source-proof/senate-864-website-recovered-source-map.json')){
 const old=expansionInputs(),holds=new Map(old.current.holds.map(h=>[h.id,h])),added=[];
 if(map.bindings.length!==526||map.originals.length!==54)throw Error('Fixed website recovery map changed');
 for(const b of map.bindings){
  const h=holds.get(b.id);if(!h||h.ordinal!==b.ordinal)throw Error('Website bound person changed');
  const doc=read(b.id.split('|')[0]),literals=new Set();
  walkObjects(doc,o=>{for(const [k,v]of Object.entries(o))if(typeof v==='string'&&v.trim().length>=5&&v.trim().length<=1600&&(/excerpt|quote/i.test(k)||/^(exact|quoted|quote)/i.test(k)&&/literal|text/i.test(k)))literals.add(v.trim());});
  const found=[];
  for(const p of map.originals.filter(p=>p.originalHtmlSha256===b.sourceSha&&p.originalArchiveCapturedAtUtc===b.archiveCapturedAt))for(const literal of literals){
   if(sha('senate-864-website-literal-asof-v1|'+b.id+'|'+literal+'|'+[p.originalUrl,b.sourceSha,b.archiveCapturedAt].join('|'))!==b.ingestionIdentityKey)continue;
   found.push({id:b.id,ordinal:b.ordinal,issueTag:h.issueTag,literal,sourceUrl:p.originalUrl,sourceSha:b.sourceSha,archiveCapturedAt:b.archiveCapturedAt,originalCdxSha1:p.originalArchiveCdxSha1Base32,ingestionIdentityKey:b.ingestionIdentityKey});
  }
  const unique=[...new Map(found.map(r=>[JSON.stringify(r),r])).values()];if(unique.length!==1)throw Error('Retained website literal/receipt binding is not unique');added.push(unique[0]);
 }
 const ready=[...old.current.ready,...added],sourcePlanSha256=sha(JSON.stringify(ready));
 if(ready.length!==1194||sourcePlanSha256!==map.sourcePlanSha256||sourcePlanSha256!=='a040c7d1ed699eb207cf36e17e3c90fe40e35b586f5fccc08b99287abd4bbd67')throw Error('Exact executed website plan drift');
 return {...old,current:{...old.current,ready,holds:old.current.holds.filter(h=>!map.bindings.some(b=>b.id===h.id))},sourcePlanSha256};
}
export function closeoutQueries(){
 const registry=registry830(),wp=finalWebsiteInputs();
 const mk=(alias,keys)=>'jsonb_build_object('+keys.map(k=>"'"+k+"',"+alias+"->'"+k+"'").join(',')+')';
 const wm=['ingestionIdentityKey','originalUrl','archiveCapturedAt','observationDateNotFirstAuthorship','publishedAtRepresentsArchiveObservation','experimentalWebsiteTextForHistoricalEvaluation','asOfEligible','sameDayEligible','contextOnly','mechanicallyActionable','modelWeight','durableIngestion','ingestionKey','archiveUrl'];
 const ws=['originalUrl','archiveCapturedAt','originalCdxSha1Base32'];
 const website=`SELECT ei.membership_id::text AS "membershipId",m.legislator_id::text AS "legislatorId",ei.excerpt,ei.published_at AS "publishedAt",ei.evidence_kind AS kind,ei.stance,${mk('ei.metadata',wm)} AS metadata,sd.source_url AS "sourceUrl",sd.content_sha256 AS "sourceSha",${mk('sd.metadata',ws)} AS "sourceMetadata" FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id JOIN memberships m ON m.id=ei.membership_id WHERE ei.metadata->>'experimentalWebsiteTextForHistoricalEvaluation'='true' ORDER BY ei.id LIMIT 1201`;
 const reviewedUrls=['tests/fixtures/senate-864-structured-pair.json','tests/fixtures/senate-864-reviewed-rolls.json'].flatMap(p=>read(p).sourceDocuments.map(d=>d.url));
 const docs=DOC_SQL.replace(/,CASE WHEN [\s\S]+? END AS text FROM/,' FROM').replace("sd.source_kind IN ('senate_committee_minutes','senate_committee_minutes_html')","(sd.source_kind IN ('senate_committee_minutes','senate_committee_minutes_html') OR sd.source_url=ANY("+sqlArray(reviewedUrls)+"))");
 const pins=read('docs/evaluation/source-proof/senate-864-three-bounded-production-originals-20261020.json');
 const media=WRITE_MEDIA.replace('$1::text[]',sqlArray(pins.mediaOriginals.map(p=>p.sha256))).replace('$2::text[]',sqlArray(MEDIA_FRAGMENTS.map(s=>'%'+s+'%')));
 const capturedPdf=`SELECT encode(original_pdf,'base64') AS pdf_base64,encode(sha256(original_pdf),'hex') AS actual_sha,byte_length FROM cfb_finance_pdf_body_captures WHERE pdf_sha256='e5d5d82d46ec7ac2c573c0cc4158541e06d2846e16573d748c0d052f7648b0a3' LIMIT 2`;
 return {names:['identity','documents','events','choices','roster','website','financeRegistryExact','financeCanonical','financeVersionsByYear','financeLegacyDebt','mediaContexts','millerMedia','millerFinance','millerVersions','millerLinks','millerCapture','millerEntries','millerPdf','committeeYears','schema'],statements:[
  'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY',
  "SELECT current_database() AS db,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation,clock_timestamp() AS read_at",
  docs,SNAPSHOT_SQL.events,SNAPSHOT_SQL.choices,SNAPSHOT_SQL.roster.replace('l.name,l.normalized_name','l.id::text AS legislator_id,l.name,l.normalized_name'),website,VERIFY_SQL.replaceAll('$1::jsonb',sqlJson(registry)+'::jsonb'),FINANCE_CANONICAL_SQL,FINANCE_REGISTRY_SQL,REVALIDATE_SQL,MEDIA_CONTEXT_SQL,media,FINANCE,VERSIONS,WRITE_LINKS,CAPTURE,ENTRIES,capturedPdf,COMMITTEE_YEAR_SQL,'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename LIMIT 101','ROLLBACK'],websitePlanSha256:wp.sourcePlanSha256};
}
function docFor(d,s){const matches=s.documents.filter(x=>x.source_url===d.sourceUrl&&x.content_sha256===d.originalSha256&&x.date===d.date&&x.committee===d.committee&&x.session_slug===d.session);return {...d,...(matches.length===1?matches[0]:{}),url:d.sourceUrl,source_url:d.sourceUrl,date:d.date,committee:d.committee,session_slug:d.session,text:d.candidateOriginalExtractedText,sha256:d.originalSha256,authenticated:true};}
export function reconcileCloseout(s){
 const frozenInputsVerified=verifyFrozenInputs();
 if(s.identity.length!==1||s.identity[0].db!=='votepredict'||s.identity[0].ro!=='on'||s.identity[0].isolation!=='repeatable read')throw Error('Read-only snapshot identity hold');
 const migrations=readdirSync('migrations').filter(p=>/^\d{4}_[\w-]+\.sql$/.test(p)).sort().map(filename=>({filename,checksum:sha(readFileSync('migrations/'+filename))}));
 if(JSON.stringify(migrations)!==JSON.stringify(s.schema))throw Error('Schema ledger drift');
 if(s.events.length!==PREVIOUS_COMMITTEE_STATE.events||s.choices.length!==PREVIOUS_COMMITTEE_STATE.choices||sha(JSON.stringify(s.events))!==PREVIOUS_COMMITTEE_STATE.eventRowsSha256||sha(JSON.stringify(s.choices))!==PREVIOUS_COMMITTEE_STATE.choiceRowsSha256)throw Error('Previously verified committee state changed');
 const invBytes=readFileSync(INVENTORY);if(sha(invBytes)!=='685f08e5e3645fa8262d04876102e9dbbf529dcf0e7c33c669c84d67348b71ea')throw Error('Frozen inventory changed');
 const bills=[...new Map(s.events.filter(e=>e.bill_id).map(e=>[e.bill_id,{id:e.bill_id,identifier:e.bill_identifier,session_slug:e.session_slug,session_id:e.session_id,chamber_id:e.chamber_id}])).values()];
 const inv=JSON.parse(invBytes),snapshot={docs:s.documents,events:s.events,choices:s.choices,roster:s.roster,bills};
 if(s.documents.length>=3001||s.events.length>=601||s.choices.length>=4001||s.roster.length>=401||s.website.length>=1201||s.mediaContexts.length>=2001)throw Error('Truncated snapshot');
 const priorDocs=priorOriginalQueue().map(p=>{const d=inv.originals.find(d=>d.sourceUrl===p.officialSourcePdfUrl);return {...docFor(d,s),rawSha:d.originalSha256};});
 snapshot.verifiedPriorQuestions=verifiedPriorQuestionEvents(authenticatePriorQuestionOriginals(priorDocs),snapshot);
 const occurrences=[],held=[],allKeys=new Map();
 for(const d of inv.originals.filter(d=>d.candidateOriginalExtractedText)){
  if(sha(d.candidateOriginalExtractedText)!==d.extractedTextSha256)throw Error('Retained source text drift');
  const doc=docFor(d,s),qs=extractRowRollQuestions(doc.text,doc);
  for(const q of qs){
   if(q.confidence==='source_proven_question'){const o={q,d:doc};occurrences.push(o);const a=allKeys.get(q.questionKey)||[];a.push(o);allKeys.set(q.questionKey,a);}
   else held.push({sourceId:d.sourceId,sourceUrl:d.sourceUrl,date:d.date,committee:d.committee,sourceOffset:q.sourceOffset,holds:q.holds,printedChoiceOccurrences:q.choices.length});
  }
 }
 const baseKeys=new Set(inv.distinctRowQuestions.map(q=>q.questionKey));
 // Preserve the four pre-existing cross-original identity exclusions. No new
 // interpretation or alias is certified by this final snapshot.
 const admitted=[...allKeys].filter(([k])=>baseKeys.has(k)||k===read('docs/evaluation/source-proof/senate-864-population-renewed-question-plan.json').questions[0].questionKey);
 const base=admitted.map(([key,os])=>({questionKey:key,date:os[0].d.date,committee:os[0].d.committee,choices:os[0].q.choices.length,...coalesceQuestionSources(os,snapshot)}));
 const extra=[];
 for(const path of ['tests/fixtures/senate-864-structured-pair.json','tests/fixtures/senate-864-reviewed-rolls.json'])for(const d of read(path).sourceDocuments){
  const stored=s.documents.filter(x=>x.source_url===d.url&&x.content_sha256===d.sha256&&x.date===d.date&&x.session_slug===d.session_slug&&(x.committee===d.committee||d.allowNullStoredCommittee&&x.committee===null));
  if(stored.length!==1)throw Error('Reviewed original provenance changed');
  const doc={...d,...stored[0],committee:d.committee,text:d.text};
  for(const q of extractRowRollQuestions(doc.text,doc).filter(q=>q.confidence==='source_proven_question')){
   const r=coalesceQuestionSources([{q,d:doc}],snapshot);extra.push({questionKey:q.questionKey,date:d.date,committee:d.committee,choices:q.choices.length,...r});
  }
 }
 const questions=[...base,...extra],defects=questions.filter(q=>q.status!=='exact'&&!q.alternateSourceParityVerified);
 if(base.length!==35||extra.length!==17||questions.reduce((n,q)=>n+q.choices,0)!==625||new Set(questions.map(q=>q.questionKey)).size!==52)throw Error('Fixed reviewed cohort changed');
 const wp=finalWebsiteInputs(),roster=s.roster.map(m=>({membershipId:m.membership_id,legislatorId:m.legislator_id,name:m.name,sessionSlug:m.session_slug}));
 // The Senate roster query deliberately includes stable person identity below.
 const plan=candidateSiteDrafts(wp.manifest,roster,wp.current),websiteRows=s.website.map(r=>({...r,publishedAt:new Date(r.publishedAt).toISOString()}));
 verifyWebsiteNeonReadback(websiteRows,plan);
 const lookup=new Map(plan.map(p=>[p.key,p]));
 for(const r of websiteRows){const p=lookup.get(r.metadata.ingestionIdentityKey),m=s.roster.find(m=>m.membership_id===p.membershipId);if(r.legislatorId!==m.legislator_id||r.sourceMetadata.originalCdxSha1Base32!==p.cdx||r.metadata.archiveUrl!==p.sourceUrl)throw Error('Website stable person/CDX mismatch');}
 const byYear={};for(const p of plan){const y=p.observedAt.slice(0,4);byYear[y]=(byYear[y]||0)+1;}
 const pins=read('docs/evaluation/source-proof/senate-864-three-bounded-production-originals-20261020.json'),mediaProof={media:{pins:pins.mediaOriginals,verifiedVersions:pins.mediaVerifiedVersions}};
 const mr=s.roster.map(m=>({...m,legislator_id:m.legislator_id}));
 const miller=mediaPlan(mediaProof,{roster:mr,media:s.millerMedia});
 const pdf=s.millerPdf;if(pdf.length!==1||pdf[0].actual_sha!==pins.financeOriginal.sha)throw Error('Retained exact finance PDF changed');
 const bytes=Buffer.from(pdf[0].pdf_base64,'base64');if(sha(bytes)!==pins.financeOriginal.sha||bytes.length!==pins.financeOriginal.bytes)throw Error('Retained PDF bytes drift');
 const dir=mkdtempSync(join(tmpdir(),'senate864-closeout-'));let printed;
 try{const p=join(dir,'original.pdf');writeFileSync(p,bytes,{mode:0o600});printed=parseMillerPrintedRows(execFileSync('pdftotext',['-layout',p,'-'],{encoding:'utf8',timeout:15000,maxBuffer:200000}));}finally{rmSync(dir,{recursive:true,force:true});}
 const fp=financePlan({finance:{report:pins.financeOriginal,rows:printed}},{finance:s.millerFinance,versions:s.millerVersions,links:s.millerLinks,capture:s.millerCapture,entries:s.millerEntries});
 const media=mediaAccounting(s.mediaContexts,wp.manifest,read('data/sources/local-trade-news-v1.json').sources),legacy=safeRevalidation(s.financeLegacyDebt);
 const registry=s.financeRegistryExact[0];if(s.financeRegistryExact.length!==1||!registry||['stored','indexed','exact'].some(k=>Number(registry[k])!==830)||Number(registry.missing)!==0||Number(registry.distinct_bodies)!==813)throw Error('Exact finance registry drift');
 const repairs=[...defects,...miller.filter(x=>!x.stored).map(()=>({family:'media'})),...fp.filter(x=>!x.stored).map(()=>({family:'finance'}))];
 const report={schemaVersion:'senate864-bounded-closeout-v1',baseMain:BASE_MAIN,auditorSha256:sha(readFileSync('scripts/audit-senate-864-bounded-closeout.mjs')),queryPlanSha256:sha(JSON.stringify(closeoutQueries().statements)),snapshotFingerprintSha256:sha(JSON.stringify(s)),frozenInputsVerified,schemaLedgerEntries:s.schema.length,sourceDocumentsRead:s.documents.length,previousCommitteeStatePreserved:PREVIOUS_COMMITTEE_STATE,readAt:s.identity[0].read_at,verifiedRepeatableReadReadOnlyAndExplicitRollback:true,productionWrites:0,newSourceAcquisitions:0,outcomeExperiments:0,scope:'Existing committed source corpus and exact prior repair cohorts only',committee:{events:s.events.length,choices:s.choices.length,years:s.committeeYears,reviewedQuestions:questions.length,reviewedChoices:625,exactReviewedQuestions:questions.length-defects.length,questions,heldParserOccurrences:held.length,heldOccurrences:held,unadmittedCrossOriginalKeys:[...allKeys.keys()].filter(k=>!admitted.some(([a])=>a===k)),sourceCandidatesReconciled:233,baselineOriginals:2860,officialAllMotionDenominator:'UNKNOWN'},website:{expected:1194,exact:websiteRows.length,sourcePlanSha256:wp.sourcePlanSha256,people:new Set(websiteRows.map(r=>r.legislatorId)).size,originalBodies:new Set(plan.map(p=>p.sourceSha)).size,byObservationYear:byYear,knownScopeExclusions:3,unmaterializedAggregateOnlyRecords:88,wholeSiteDenominator:'UNKNOWN',frozenExperimentsUnchanged:true},finance:{registryExact:registry,canonical:s.financeCanonical,versionsByYear:s.financeVersionsByYear,legacyEligibilityDebt:legacy,legacyEligibleCopies:legacy.reduce((n,r)=>n+Number(r.eligible_copies),0),possibleEarlyDateFlags:legacy.reduce((n,r)=>n+Number(r.before_every_candidate_legal_floor),0),millerExactMechanicalLinks:fp.filter(x=>x.stored).length,millerHeldPurposes:3,owedReportDenominator:'UNKNOWN',historicalPublicationNotInferred:true},media:{...media,millerExactFragments:miller.filter(x=>x.stored).length,millerEarliestObservation:pins.mediaOriginals[0].utc,scope:'Existing 44-seed contexts plus previously verified Miller original fragments; no new attribution'},provenRepairDiscrepancies:repairs,repairBatchNeeded:repairs.length>0,closeoutStatus:repairs.length?'ONE_BOUNDED_REPAIR_BATCH_REQUIRED':'ACTIONABLE_REPAIR_WORK_COMPLETE_ARCHIVAL_DEPENDENCIES_BLOCKED',stoppingRule:'No new collecting, failed-endpoint retries, archive search, parser expansion or experiments. Reopen only as separately scoped work with new exact source evidence or a demonstrated defect.'};
 assertSafeCloseoutReport(report);return report;
}
export function assertSafeCloseoutReport(report){
 const forbidden=new Set(['excerpt','literal','pdf_base64','metadata','sourceMetadata','raw_schedule_line','printed_counterparty','preserved_item','password','membership_id','legislator_id']);
 walkObjects(report,o=>{if(Object.keys(o).some(k=>forbidden.has(k)))throw Error('Private/raw report field rejected');});
 if(JSON.stringify(report).length>400000)throw Error('Oversize public closeout report');return true;
}
if(process.argv[1]?.endsWith('/audit-senate-864-bounded-closeout.mjs')){
 if(process.argv[2]==='--prepare'&&process.argv.length===4){const q=closeoutQueries();writeFileSync(process.argv[3],JSON.stringify(q,null,2)+'\n');console.log('CLOSEOUT_FIXED_READONLY_QUERIES='+q.names.length);}
 else if(process.argv[2]==='--verify'&&process.argv.length===5){const r=reconcileCloseout(read(process.argv[3]));writeFileSync(process.argv[4],JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({status:r.closeoutStatus,committee:[r.committee.events,r.committee.choices],reviewed:[r.committee.exactReviewedQuestions,r.committee.reviewedChoices],website:r.website.exact,financeRegistry:r.finance.registryExact,media:r.media.millerExactFragments,repairBatchNeeded:r.repairBatchNeeded}));}
 else throw Error('Use --prepare private-queries.json or --verify private-snapshot.json report.json');
}
