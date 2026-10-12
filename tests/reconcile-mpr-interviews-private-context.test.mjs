import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {expectedPublicOriginals,reconcilePrivateContextRows,parsePrivateJsonl,RECEIPT_FILE} from '../scripts/reconcile-mpr-interviews-private-context.mjs';
const receipt=JSON.parse(readFileSync(RECEIPT_FILE,'utf8'));
const originals=expectedPublicOriginals(receipt);
const context=(x,i=1,patch={})=>({
 evidenceId:'synthetic-evidence-'+i,sourceDocumentId:'synthetic-source-'+i,
 sourceKind:'wayback_local_trade_news',sourceUrl:x.archiveUrl,sourceSha256:x.sha,
 seedId:'mpr-news-story-archive',publisher:'MPR News',originalUrl:x.originalUrl,
 archiveUrl:x.archiveUrl,archiveCapturedAt:x.capture,archiveDigest:x.archiveSha1,
 publisherPublishedAt:'2024-10-22T10:00:00Z',evidencePublishedAt:x.capture,
 evidenceKind:'context',stance:'neutral',contextOnly:true,sameDayEligible:false,
 modelWeight:0,articleInfersLegislativeStance:false,mentionedMembers:['Synthetic Senator'],...patch
});
test('five exact independently pinned historical bodies, only three unique MPR article URLs',()=>{
 assert.equal(originals.length,5);
 assert.equal(new Set(originals.map(x=>x.originalUrl)).size,3);
 assert.equal(originals.filter(x=>x.leadId==='mpr-2024-kunesh-charter-school-oversight').length,2);
 assert.ok(originals.every(x=>x.archiveUrl.includes('/web/20')));
});
test('empty authorized bounded export means unknown broader production coverage, never missing records',()=>{
 const out=reconcilePrivateContextRows([],receipt);
 assert.equal(out.authenticatedPublicOriginalsExamined,5);
 assert.equal(out.notObservedInExport,5);assert.equal(out.matchedExactOriginalsWithinExport,0);
 assert.equal(out.noClaimAboutAbsenceInOtherIngestionPipelines,true);
 assert.equal(out.originalPrivateRowsOrIdsOrSHAInReport,false);
 assert.equal(JSON.stringify(out).includes('synthetic-source'),false);
});
test('one exact archive URL and SHA match counts an exact source-document within this export only',()=>{
 const out=reconcilePrivateContextRows([context(originals[0])],receipt);
 assert.equal(out.matchedExactOriginalsWithinExport,1);
 assert.equal(out.notObservedInExport,4);
 assert.equal(out.originalStatuses[0].exactPrivateSourceDocumentCount,1);
 assert.equal(out.originalStatuses[0].exactPrivateContextItemCount,1);
 assert.equal(out.originalStatuses[0].individualSenatorFullSpeechVerified,false);
});
test('same source with multiple neutral senator-context mentions counts one original source, two items',()=>{
 const a=context(originals[2],1);
 const b={...a,evidenceId:'synthetic-evidence-2',mentionedMembers:['Different Synthetic Senator']};
 const out=reconcilePrivateContextRows([a,b],receipt);
 assert.equal(out.totalContextRowsInSuppliedExport,2);
 assert.equal(out.distinctSourceDocumentsInExport,1);
 assert.equal(out.matchedExactOriginalsWithinExport,1);
 assert.equal(out.originalStatuses[2].exactPrivateContextItemCount,2);
});
test('same publisher original URL different historical capture is not exact byte match',()=>{
 const a=originals[3],b=originals[4];
 assert.equal(a.originalUrl,b.originalUrl);
 const out=reconcilePrivateContextRows([context(a)],receipt);
 assert.equal(out.originalStatuses[3].status,'exact_private_source_record_in_this_export');
 assert.equal(out.originalStatuses[4].status,'same_original_publisher_url_other_archived_version_only');
});
test('same archived URL but different raw body SHA is provenance conflict, not accepted',()=>{
 const out=reconcilePrivateContextRows([context(originals[0],1,{sourceSha256:'a'.repeat(64)})],receipt);
 assert.equal(out.originalStatuses[0].status,'conflicting_or_invalid_private_provenance');
 assert.equal(out.matchedExactOriginalsWithinExport,0);
});
test('same document ID with incompatible source SHA across evidence items is conflicting and fails closed',()=>{
 const a=context(originals[0]),b=context(originals[0],2,{sourceDocumentId:a.sourceDocumentId,sourceSha256:'f'.repeat(64)});
 const out=reconcilePrivateContextRows([a,b],receipt);
 assert.equal(out.ambiguousSharedSourceDocumentIds,1);
 assert.equal(out.matchedExactOriginalsWithinExport,0);
 assert.equal(out.originalStatuses[0].status,'conflicting_or_invalid_private_provenance');
});
test('archive timestamp mismatch cannot silently qualify an exact source match',()=>{
 const out=reconcilePrivateContextRows([context(originals[0],1,{archiveCapturedAt:'2021-01-12T00:00:00Z'})],receipt);
 assert.equal(out.matchedExactOriginalsWithinExport,0);
 assert.equal(out.originalStatuses[0].status,'conflicting_or_invalid_private_provenance');
});
test('an original URL alone without exact historical archive identity is not enough',()=>{
 const out=reconcilePrivateContextRows([context(originals[0],1,{archiveUrl:'https://web.archive.org/web/20210114235959id_/'+originals[0].originalUrl,
 archiveCapturedAt:'2021-01-14T23:59:59Z',sourceUrl:'https://web.archive.org/web/20210114235959id_/'+originals[0].originalUrl})],receipt);
 assert.equal(out.originalStatuses[0].status,'same_original_publisher_url_other_archived_version_only');
 assert.equal(out.matchedExactOriginalsWithinExport,0);
});
test('private export errors never echo identifiers, strings, paths, or raw SHA into a result',()=>{
 const confidential='private-secret-source-should-not-appear';
 const out=reconcilePrivateContextRows([context(originals[0],1,{sourceDocumentId:confidential})],receipt);
 assert.equal(JSON.stringify(out).includes(confidential),false);
 assert.equal(JSON.stringify(out).includes(originals[0].sha),false);
 assert.equal(JSON.stringify(out).includes(originals[0].archiveUrl),false);
 assert.equal(out.noDataBaseOrNetworkAccess,true);
});
test('malformed JSONL, oversized row count, invalid SHA and missing IDs reject input',()=>{
 assert.throws(()=>parsePrivateJsonl(''),/empty|large/);
 assert.throws(()=>parsePrivateJsonl('{bad}'),/Invalid/);
 assert.throws(()=>reconcilePrivateContextRows([context(originals[0],1,{sourceSha256:'bad'})],receipt));
 assert.throws(()=>reconcilePrivateContextRows([context(originals[0],1,{sourceDocumentId:''})],receipt));
 assert.throws(()=>reconcilePrivateContextRows(new Array(50001),receipt));
});
test('public receipts cannot add fake non-MPR or wrong SHA originals without detection',()=>{
 const altered=structuredClone(receipt);
 altered.urls[0].originals[0].sha256='bad';
 assert.throws(()=>expectedPublicOriginals(altered));
 const altered2=structuredClone(receipt);
 altered2.urls[0].url='https://evil.example/contents';
 assert.throws(()=>expectedPublicOriginals(altered2));
});
