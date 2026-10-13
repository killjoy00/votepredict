import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import c from '../data/evaluation/senate-864-2026-49-incumbent-public-source-reference-crosswalk-v1.json' with {type:'json'};
import d from '../data/evaluation/senate-864-2026-incumbent-duckworth-exact-speaker-leads-v1.json' with {type:'json'};
import {
 auditPublic2026IncumbentSourceManifest,publicUrlVariants,urlFingerprint,
 compare49IncumbentSources
} from '../src/evidence/senate-864-2026-incumbent-source-parity.mjs';
import {
 ONE_SHOT_COMMENT,REQUIRED,MEMBERSHIPS_SQL,PUBLIC_SOURCE_SQL,
 IDENTITY_SQL,CATALOG_SQL,sourceVariants,assertOwnerCommentEvent,
 auditExistingVotePredict49SourceParity,validateSanitizedReport
} from '../scripts/audit-senate-864-2026-49-incumbent-existing-neon-parity.mjs';

const baselineMemberships=c.rows.map(r=>({
 district:String(r.district),senatorName:r.senator,membershipId:'member-'+String(r.district).padStart(4,'0')
}));
const src=(district,opts={})=>{
 const r=c.rows.find(p=>p.district===district);
 return {
  sourceDocumentId:opts.sourceDocumentId||'source-doc-'+district,
  sourceUrl:opts.sourceUrl||r.researchSourceUrl,
  sourceKind:'campaign_site_page',
  contentSha256:opts.contentSha256===undefined?'a'.repeat(64):opts.contentSha256,
  sourceEvidenceId:opts.sourceEvidenceId===undefined?'evidence-item-'+district:opts.sourceEvidenceId,
  membershipId:opts.membershipId===undefined?'member-'+String(district).padStart(4,'0'):opts.membershipId,
  excerpt:opts.excerpt===undefined?'named testimony':opts.excerpt,
 };
};
test('49 real named public incumbents, district set, original-site 716 and four Duckworth sources locked',()=>{
 assert.equal(auditPublic2026IncumbentSourceManifest(c,d),true);
 assert.equal(c.rows.length,49);
 assert.equal(c.rows.reduce((sum,r)=>sum+r.selectedOlderOriginalSiteExcerpts,0),716);
 assert.equal(d.duckworth.original2022CaptureUtc,'2022-01-18T02:14:14.000Z');
 assert.equal(d.duckworth.newDated2026SourceLeads.length,4);
 assert.equal(sourceVariants().length>=53,true);
 assert.ok(sourceVariants().every(x=>typeof x==='string'&&!x.includes('web.archive.org')));
});
test('strict direct URL, slash, www and scheme spellings, but NEVER an unrelated path or query',()=>{
 const u=c.rows[0].researchSourceUrl;
 assert.equal(urlFingerprint(u),urlFingerprint(u.replace('https://www.','http://')));
 assert.ok(publicUrlVariants(u).includes(u));
 assert.notEqual(urlFingerprint(u),urlFingerprint(u+'/unrelated-story'));
 for(const bad of ['file:///etc/passwd','https://user:secret@sample.org/x',
   'https://sample.org/x?token=1234','https://sample.org/a#b','javascript:alert(1)']){
  assert.throws(()=>publicUrlVariants(bad));
 }
});
test('zero bounded public URL observations is UNKNOWN, not zero candidate policy evidence',()=>{
 const r=compare49IncumbentSources(c,d,baselineMemberships,[]);
 assert.equal(r.researchCandidateCount,49);
 assert.equal(r.sourceUrlStatusByDistrict.length,49);
 assert.ok(r.sourceUrlStatusByDistrict.every(x=>x.status==='source_url_not_observed_in_bounded_lookup'));
 assert.equal(r.groupedStatusCounts.source_url_not_observed_in_bounded_lookup,49);
 assert.equal(r.duckworth.sourceUrlsObserved,0);
 assert.equal(r.deployedProductionDbBindingProven,false);
 assert.equal(r.currentSourceOriginalHtmlRawShaParityProven,false);
 assert.equal(r.outputContainsPrivateSourceRows,false);
 assert.doesNotMatch(JSON.stringify(r),/member-0001|evidence-item|source-doc-1|https?:\/\//);
});
test('same literal public URL + matching official current Senate membership is a bounded URL/evidence link',()=>{
 const r=compare49IncumbentSources(c,d,baselineMemberships,[src(1)]);
 assert.equal(r.groupedStatusCounts.matched_exact_url_with_named_senator_evidence,1);
 assert.equal(r.groupedStatusCounts.source_url_not_observed_in_bounded_lookup,48);
 assert.equal(r.sourceUrlStatusByDistrict[0].district,1);
 assert.equal(r.sourceUrlStatusByDistrict[0].status,'matched_exact_url_with_named_senator_evidence');
 assert.equal(r.currentSourceOriginalHtmlRawShaParityProven,false);
});
test('www/slash/protocol alias counts separately, never as exact source bytes',()=>{
 const u=c.rows[1].researchSourceUrl;
 const aliases=publicUrlVariants(u).filter(x=>x!==u);
 assert.ok(aliases.length);
 const r=compare49IncumbentSources(c,d,baselineMemberships,[src(2,{sourceUrl:aliases[0]})]);
 assert.equal(r.sourceUrlStatusByDistrict[1].status,'matched_url_alias_with_named_senator_evidence');
 assert.equal(r.currentSourceOriginalHtmlRawShaParityProven,false);
});
test('stored public URL without a CURRENT senator evidence item is doc-only or wrong-person, not attributed stance',()=>{
 const r=compare49IncumbentSources(c,d,baselineMemberships,
  [src(3,{sourceEvidenceId:null,membershipId:null,excerpt:null,contentSha256:null}),
   src(4,{membershipId:'member-9999'})]);
 assert.equal(r.sourceUrlStatusByDistrict[2].status,'source_url_present_but_no_named_senator_evidence');
 assert.equal(r.sourceUrlStatusByDistrict[3].status,'source_url_present_but_no_named_senator_evidence');
});
test('one unmatched senator district+name cannot be treated as matching by district alone',()=>{
 const members=baselineMemberships.filter(x=>x.district!=='9');
 members.push({district:'9',senatorName:'Unrelated Othername',membershipId:'member-0009'});
 const r=compare49IncumbentSources(c,d,members,[src(9)]);
 assert.equal(r.sourceUrlStatusByDistrict.find(x=>x.district===9).status,
  'senator_membership_identity_unresolved');
 assert.equal(r.groupedStatusCounts.senator_membership_identity_unresolved,1);
});
test('four Duckworth individually attributed source candidates remain separate from the older 2022 site',()=>{
 const duckSource=d.duckworth.newDated2026SourceLeads[2];
 const row={
  ...src(57,{sourceDocumentId:'current-duckworth-03',
   sourceUrl:duckSource.url,excerpt:'In a news story Duckworth says: '+duckSource.shortIssueCue}),
 };
 const r=compare49IncumbentSources(c,d,baselineMemberships,[row]);
 assert.equal(r.duckworth.comparedDatedPublicSources,4);
 assert.equal(r.duckworth.sourceUrlsObserved,1);
 assert.equal(r.duckworth.senatorEvidenceLinked,1);
 assert.equal(r.duckworth.literalShortCueObserved,1);
 assert.equal(r.duckworth.perSource[2].sourceOrdinal,3);
 assert.equal(r.duckworth.perSource[2].originalRawPublisherBodyShaProvenSame,false);
 assert.equal(r.duckworth.historic2022WebsiteStillIndependent,true);
});
test('fail-closed on any private URL not among exact input variants; no accidental full-record export',()=>{
 assert.throws(()=>compare49IncumbentSources(c,d,baselineMemberships,[{
  ...src(1),sourceUrl:'https://private.example.net/other'}]));
 assert.throws(()=>compare49IncumbentSources(c,d,baselineMemberships,
  Array.from({length:1201},(_,i)=>({...src(1),sourceDocumentId:'doc-'+i,
   sourceEvidenceId:'evi-'+i}))));
 assert.throws(()=>compare49IncumbentSources(c,d,baselineMemberships,
  [src(1),{...src(2),sourceDocumentId:'source-doc-1'}]));
});
test('SQL read-only window includes explicit person/service identity and only exact public URL list',()=>{
 assert.match(MEMBERSHIPS_SQL,/s.slug='2025-2026'/);
 assert.match(MEMBERSHIPS_SQL,/COALESCE\(m.starts_on,s.starts_on\)/);
 assert.match(MEMBERSHIPS_SQL,/m.district::text=ANY\(\$1::text\[\]\)/);
 assert.match(PUBLIC_SOURCE_SQL,/FROM source_documents sd/);
 assert.match(PUBLIC_SOURCE_SQL,/sd.source_url=ANY\(\$1::text\[\]\)/);
 assert.match(PUBLIC_SOURCE_SQL,/LEFT JOIN evidence_items ei/);
 assert.match(PUBLIC_SOURCE_SQL,/LIMIT 1201/);
 assert.doesNotMatch(PUBLIC_SOURCE_SQL,/INSERT INTO|UPDATE|DELETE|TRUNCATE|DROP|CREATE/);
 assert.deepEqual(REQUIRED,['source_documents','evidence_items','memberships','legislators','chambers','legislative_sessions']);
 assert.match(IDENTITY_SQL,/transaction_read_only/);
 assert.match(CATALOG_SQL,/has_table_privilege/);
});
test('owner-triggered read-only gate rejects missing owner and PR/push/replay instead of directly using protected secrets',()=>{
 const good={
  GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_EVENT_NAME:'issue_comment',
  GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'a'.repeat(40),
  VOTEPREDICT_864_2026_APPROVAL:ONE_SHOT_COMMENT,
  VOTEPREDICT_864_2026_CI_PASSED:'true',
 };
 assert.doesNotThrow(()=>assertOwnerCommentEvent(good));
 for(const [k,v]of Object.entries({
  GITHUB_EVENT_NAME:'pull_request',GITHUB_RUN_ATTEMPT:'2',GITHUB_REF:'refs/heads/other',
  GITHUB_REPOSITORY:'attacker/fork',VOTEPREDICT_864_2026_CI_PASSED:'false',
  VOTEPREDICT_864_2026_APPROVAL:'[different-command]',
 })){
  assert.throws(()=>assertOwnerCommentEvent({...good,[k]:v}));
 }
});
test('one protected Neon connection, READ ONLY transaction, identity checks, fixed 49+4 SQL, ROLLBACK and redaction',async()=>{
 const seen=[];const phases=[];let release=0;let close=0;
 const pool=options=>{
  assert.equal(options.database,'neondb');
  assert.equal(options.password,'TOP-SECRET-PASSWORD');
  assert.match(options.options,/default_transaction_read_only=on/);
  return {connect:async()=>({query:async(sql,params)=>{
   seen.push(sql);
   if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return {rows:[]};
   if(sql===IDENTITY_SQL)return{rows:[{db:'neondb',role:'neondb_owner',ro:'on'}]};
   if(sql===CATALOG_SQL){
    assert.deepEqual(params,[REQUIRED]);
    return{rows:REQUIRED.map(name=>({table_name:name,present:true,readable:true}))};
   }
   if(sql===MEMBERSHIPS_SQL){
    assert.equal(params[0].length,49);
    return {rows:baselineMemberships};
   }
   if(sql===PUBLIC_SOURCE_SQL){
    assert.ok(params[0].length>=53&&params[0].length<=500);
    return{rows:[src(1),{...src(57,{
     sourceDocumentId:'direct-duckworth-quote',sourceUrl:d.duckworth.newDated2026SourceLeads[3].url,
     excerpt:'Duckworth said '+d.duckworth.newDated2026SourceLeads[3].shortIssueCue
    })}]};
   }
   throw Error('Unexpected SQL');
  },release:()=>{release++}}),end:async()=>{close++}};
 };
 const r=await auditExistingVotePredict49SourceParity(
  {apiKey:'TEST-NEON-KEY',projectId:'test-project'},
  async()=>({host:'test.neon.tech',port:5432,role:'neondb_owner',
   password:'TOP-SECRET-PASSWORD',database:'neondb'}),
  pool,step=>phases.push(step));
 assert.equal(seen[0],'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 assert.equal(seen.at(-1),'ROLLBACK');
 assert.equal(r.groupedStatusCounts.matched_exact_url_with_named_senator_evidence,1);
 assert.equal(r.duckworth.senatorEvidenceLinked,1);
 assert.equal(r.currentTransactionReadOnly,true);
 assert.equal(r.transactionRollbackCompleted,true);
 assert.equal(r.productionMutations,0);
 assert.equal(release,1);assert.equal(close,1);
 assert.equal(phases.at(-1),'readonly_rollback_succeeded');
 validateSanitizedReport(r);
 assert.doesNotMatch(JSON.stringify(r),/TOP-SECRET-PASSWORD|neondb_owner|test\.neon\.tech|source-doc|evidence-item/);
});
test('invalid SQL identity fails CLOSED, returns zero source classification and rolls back',async()=>{
 let release=0,close=0;const seen=[];
 const pool=()=>({connect:async()=>({
  query:async sql=>{
   seen.push(sql);
   if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return {rows:[]};
   if(sql===IDENTITY_SQL)return {rows:[{db:'WRONG_DB',role:'neondb_owner',ro:'on'}]};
   throw Error('PRIVATE SQL query should never happen');
  },release:()=>{release++}}),end:async()=>{close++}});
 await assert.rejects(()=>auditExistingVotePredict49SourceParity(
  {apiKey:'any',projectId:'any'},
  async()=>({host:'test.neon.tech',port:5432,role:'neondb_owner',
   password:'secret',database:'neondb'}),pool));
 assert.equal(seen.at(-1),'ROLLBACK');
 assert.equal(seen.includes(MEMBERSHIPS_SQL),false);
 assert.equal(release,1);assert.equal(close,1);
});
test('only sanitized bounded district status can pass keyless validation; no URLs/person/source private IDs',()=>{
 const r=compare49IncumbentSources(c,d,baselineMemberships,[]);
 const full={...r,currentTransactionReadOnly:true,transactionRollbackCompleted:true,productionMutations:0};
 assert.doesNotThrow(()=>validateSanitizedReport(full));
 assert.throws(()=>validateSanitizedReport({...full,privateUrl:'https://example.net/internal'}));
 assert.throws(()=>validateSanitizedReport({...full,sourceUrlStatusByDistrict:[...r.sourceUrlStatusByDistrict.slice(0,48)]}));
});
test('workflow source does not authorize arbitrary private SQL export or background schedule',()=>{
 const wf=readFileSync('.github/workflows/senate-864-2026-49-incumbent-existing-neon-parity.yml','utf8');
 assert.match(wf,/issue_comment:/);
 assert.match(wf,/github.event.comment.user.login == 'killjoy00'/);
 assert.match(wf,/github.event.issue.number == 864/);
 assert.match(wf,/evidence-readonly-sandbox/);
 assert.match(wf,/secrets.NEON_API_KEY/);
 assert.match(wf,/needs.public-ci-verify.result == 'success'/);
 assert.match(wf,/npm run check/);
 assert.match(wf,/npm run db:migrate/);
 assert.match(wf,/scripts\/verify-senate-864-2026-incumbent-sql-local.mjs/);
 assert.match(wf,/issues: write/);
 assert.doesNotMatch(wf,/^\s+schedule:/m);
 assert.doesNotMatch(wf,/^\s+workflow_dispatch:/m);
 assert.doesNotMatch(wf,/actions\/upload-artifact/);
 const report=wf.split('  issue-keyless-report:')[1];
 assert.ok(report);
 assert.doesNotMatch(report,/secrets.NEON_API_KEY|environment: evidence-readonly-sandbox/);
});


test('four 2026 Duckworth publisher first-party original HTML SHA receipts were actually fetched on October 13',()=>{
 const receipt=JSON.parse(readFileSync('data/evaluation/senate-864-2026-duckworth-four-live-publisher-original-sha-receipts-v1.json','utf8'));
 assert.equal(receipt.expectedDistinctSourceBodies,4);
 assert.equal(receipt.successfulHttpHtmlFetches,4);
 assert.equal(receipt.completeRawHtmlSha256SourceBodies,4);
 assert.equal(receipt.publicSourceAcquisitionRun,'https://github.com/killjoy00/votepredict/actions/runs/38358491766');
 assert.deepEqual(receipt.sourcePages.map(s=>s.id),d.duckworth.newDated2026SourceLeads.map(s=>s.id));
 assert.deepEqual(receipt.sourcePages.map(s=>s.displayedDate),
  ['2026-01-25','2026-01-26','2026-03-17','2026-05-16']);
 assert.equal(new Set(receipt.sourcePages.map(s=>s.rawWholeHtmlSha256)).size,4);
 for(const [i,r]of receipt.sourcePages.entries()){
  assert.equal(r.url,d.duckworth.newDated2026SourceLeads[i].url);
  assert.match(r.rawWholeHtmlSha256,/^[a-f0-9]{64}$/);
  assert.ok(r.rawWholeHtmlBytes>=40000 && r.rawWholeHtmlBytes<=200000);
  assert.equal(r.originalHttpStatus,200);
  assert.equal(r.visibleDisplayedDate,true);
  assert.equal(r.namedDuckworthSpeakerCueVisible,true);
  assert.equal(r.duckworthWithinSelectedClaimContext,true);
  assert.equal(r.separatelyArchivedHistoricallyIn2026,false);
  assert.equal(r.firstAuthoredOnDisplayedDateProven,false);
  assert.equal(r.exactVotePredictStoredOriginalRawShaParityProven,false);
 }
 assert.equal(receipt.boundaries.productionWritesZero,true);
 assert.equal(receipt.boundaries.privateDatabaseAccessZero,true);
});
