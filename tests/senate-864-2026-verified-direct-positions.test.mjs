import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifiedSenate864,APPLY_COMMENT,assertVerifiedSenate864Ledger,
  quotedPassageMatches,strictOriginalUrl,originalUrlVariants,
  buildSenate864ReconciliationPlan,safeSenate864Summary,fullBillIdentifiers,
} from '../src/evidence/senate-864-2026-verified-positions.mjs';
import {
  buildStatementRecord,requireReviewedOwnerApply,
} from '../scripts/reconcile-senate-864-2026-verified-positions.mjs';

const claims=verifiedSenate864.claims;
const memberships=claims.map(c=>({district:c.district,name:c.senator,membershipId:'member-'+c.district}));
const bills=fullBillIdentifiers().map(identifier=>({identifier,billId:'bill-'+identifier}));
const plan=(existingEvidence=[],members=memberships,billRows=bills)=>
  buildSenate864ReconciliationPlan({members,existingEvidence,bills:billRows});
function previous(c,options={}){
  return {
    sourceUrl:c.sourceUrl,
    sourceSha:options.sha??c.verifiedWholePublisherHtmlSha256,
    sourceFetchedAt:c.firstIndependentlyObservedPublicAtUtc,
    sourceDocumentId:'old-source-doc',
    evidenceId:'old-evidence',
    membershipId:options.membershipId??'member-'+c.district,
    billId:null,
    evidenceKind:options.kind??'direct_statement',
    stance:options.stance??c.stance,
    excerpt:options.excerpt??c.quote,
    claim:'previous quote evidence',
    publishedAt:options.publishedAt??c.firstIndependentlyObservedPublicAtUtc,
    metadata:options.metadata??{},
  };
}

test('immutable original receipts certify exactly 13 independent original pages',()=>{
  const result=assertVerifiedSenate864Ledger();
  assert.equal(result.length,13);
  assert.equal(new Set(result.map(c=>c.district)).size,13);
  assert.deepEqual(result.map(c=>c.district),[1,2,5,11,13,15,20,21,24,26,31,32,54]);
});

test('use first original-HTML observation on Oct 14, NEVER the earlier displayed publisher day',()=>{
  for(const c of claims){
    assert.equal(c.firstIndependentlyObservedPublicAtUtc.slice(0,10),'2026-10-14');
    assert.ok(c.displayedPublisherDay<'2026-10-14');
    assert.ok(Date.parse(c.firstIndependentlyObservedPublicAtUtc)>Date.parse(c.displayedPublisherDay));
  }
});

test('15 DFL 403 originals, one unmatched downloaded quote and 3 person gaps are excluded',()=>{
  assert.equal(verifiedSenate864.excluded.originalPublisherHttp403Urls.length,15);
  assert.equal(verifiedSenate864.excluded.downloadedOriginalButLiteralQuoteNotMatchedUrls.length,1);
  assert.deepEqual(verifiedSenate864.excluded.otherSittingSenatorsWithoutPersonQuotedSpecificPolicyStatements,[37,49,52]);
  assert.ok(claims.every(c=>c.sourceUrl.startsWith('https://www.mnsenaterepublicans.com/')));
});

test('source allowlist rejects blocked DFL sources and handles only exact spelling aliases',()=>{
  const first=claims[0];
  assert.equal(strictOriginalUrl(first.sourceUrl),first.sourceUrl);
  assert.equal(originalUrlVariants(first.sourceUrl).length,8);
  assert.throws(()=>strictOriginalUrl('https://senatedfl.mn/a-quote/'));
  assert.throws(()=>strictOriginalUrl('https://www.mnsenaterepublicans.com/position/?fake=1'));
  assert.throws(()=>strictOriginalUrl('https://www.mnsenaterepublicans.com/position/../../etc/'));
});

test('normalization allows typographic apostrophes and spaces without accepting wrong claims',()=>{
  assert.equal(quotedPassageMatches("They said  it’s  a  good  bill.","They said it's a good bill."),true);
  assert.equal(quotedPassageMatches("They said something unrelated","They said it's a good bill."),false);
  assert.equal(quotedPassageMatches("hi","hi"),false);
});

test('without existing database rows all 13 statements are candidates for one idempotent insert',()=>{
  const p=plan();
  assert.equal(p.length,13);
  assert.ok(p.every(x=>x.status==='INSERT_VERIFIED_QUOTE'));
  assert.equal(p.filter(x=>x.billId!==null).length,3);
  assert.equal(safeSenate864Summary(p).statuses.INSERT_VERIFIED_QUOTE,13);
});

test('an existing article CONTEXT quotation is not mistaken for a reviewed senator direct position',()=>{
  const c=claims[0];
  const p=plan([previous(c,{kind:'context',stance:'neutral'})]);
  assert.equal(p.find(x=>x.claim.id===c.id)?.status,'INSERT_VERIFIED_QUOTE');
});

test('an existing exact person quote with correct stance is reused rather than duplicated',()=>{
  const c=claims[0];
  const p=plan([previous(c)]);
  assert.equal(p.find(x=>x.claim.id===c.id)?.status,'EXISTING_QUOTE');
  assert.equal(p.filter(x=>x.status==='INSERT_VERIFIED_QUOTE').length,12);
});

test('older unproven date on the pinned same original SHA gets an explicit timestamp repair',()=>{
  const c=claims[0];
  const p=plan([previous(c,{publishedAt:'2026-03-02T12:00:00.000Z'})]);
  assert.equal(p.find(x=>x.claim.id===c.id)?.status,'REPAIR_EXISTING_VERIFIED_TIMESTAMP');
});

test('a genuinely independently authenticated earlier version is not erased',()=>{
  const c=claims[0];
  const p=plan([previous(c,{publishedAt:'2026-03-02T12:00:00.000Z',
    metadata:{originalArchiveCaptureAuthenticated:true}})]);
  assert.equal(p.find(x=>x.claim.id===c.id)?.status,'EXISTING_EARLIER_INDEPENDENT_PROOF');
});

test('earlier date on a DIFFERENT original source hash remains HOLD, not silently rewritten',()=>{
  const c=claims[0];
  const p=plan([previous(c,{publishedAt:'2026-03-02T12:00:00.000Z',sha:'1'.repeat(64)})]);
  assert.equal(p.find(x=>x.claim.id===c.id)?.status,'HOLD_PRIOR_DIFFERENT_SOURCE_VERSION_DATE');
});

test('wrong-senator attribution and ambiguous member/bill identities fail closed',()=>{
  const c=claims[0];
  assert.equal(plan([previous(c,{membershipId:'different-person'})])
    .find(x=>x.claim.id===c.id)?.status,'HOLD_EXISTING_SPEAKER_CONFLICT');
  assert.equal(plan([],memberships.filter(m=>m.district!==c.district))
    .find(x=>x.claim.id===c.id)?.status,'HOLD_MEMBERSHIP_IDENTITY');
  assert.equal(plan([],memberships,[]).find(x=>x.claim.id==='sd31-20260324-sf3602-nay')?.status,
    'HOLD_BILL_LINK_IDENTITY');
});

test('section-only, failed amendment and old-law commentary cannot impersonate whole-bill support or a vote',()=>{
  assert.deepEqual(fullBillIdentifiers(),['SF5032','SF5101','SF3602']);
  const id=(s)=>claims.find(c=>c.id===s);
  for(const district of [15,24,21]){
    const c=claims.find(x=>x.district===district);
    assert.equal(c.linkToWholeBill,false);
    assert.equal(plan().find(x=>x.claim.id===c.id)?.billId,null);
  }
  assert.equal(id('sd31-20260324-sf3602-nay').linkToWholeBill,true);
});

test('persisted reviewed records have conservative public-by and cannot mechanically change forecasts',()=>{
  for(const item of plan()){
    const row=buildStatementRecord(item);
    assert.equal(row.publishedAt,item.claim.firstIndependentlyObservedPublicAtUtc);
    assert.notEqual(row.publishedAt,item.claim.displayedPublisherDay);
    assert.equal(row.metadata.originalPublisherDisplayedDay,item.claim.displayedPublisherDay);
    assert.equal(row.metadata.verifiedFirstPublicByUtc,row.publishedAt);
    assert.equal(row.metadata.mechanicallyActionable,false);
    assert.equal(row.metadata.contextOnly,true);
    assert.equal(row.metadata.modelWeight,0);
    assert.equal(row.metadata.earlierHistoricalReplayEligible,false);
    assert.equal(row.sourceQuality,'member_primary');
    assert.equal(row.excerpt,item.claim.quote);
  }
});

test('only exact owner-approved reviewed main action permits write; plain dry-run needs no approval',()=>{
  assert.equal(requireReviewedOwnerApply({},false),true);
  assert.throws(()=>requireReviewedOwnerApply({},true));
  const env={
    GITHUB_REPOSITORY:'killjoy00/votepredict',
    GITHUB_EVENT_NAME:'issue_comment',
    GITHUB_REF:'refs/heads/main',
    GITHUB_RUN_ATTEMPT:'1',
    GITHUB_SHA:'a'.repeat(40),
    VOTEPREDICT_864_13_APPROVAL:APPLY_COMMENT,
    VOTEPREDICT_864_13_INDEPENDENT_CI:'true',
    VOTEPREDICT_864_13_EXACT_OWNER_COMMENT:'true',
  };
  assert.equal(requireReviewedOwnerApply(env,true),true);
  assert.throws(()=>requireReviewedOwnerApply({...env,GITHUB_RUN_ATTEMPT:'2'},true));
  assert.throws(()=>requireReviewedOwnerApply({...env,GITHUB_REF:'refs/pull/999/merge'},true));
  assert.throws(()=>requireReviewedOwnerApply({...env,VOTEPREDICT_864_13_INDEPENDENT_CI:'false'},true));
});
