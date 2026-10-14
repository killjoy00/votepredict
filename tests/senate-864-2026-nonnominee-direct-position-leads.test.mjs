import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyNonNomineeClaims} from '../scripts/audit-senate-864-2026-nonnominee-direct-position-leads.mjs';
import {inspectWholeOriginalPublisherBody,acquireSourceWithBoundedFailure}
 from '../scripts/audit-senate-864-2026-current-direct-position-leads.mjs';

const leads=JSON.parse(readFileSync(new URL('../data/evaluation/senate-864-2026-current-nonnominee-legislative-position-leads-v1.json',import.meta.url)));
const matrix=JSON.parse(readFileSync(new URL('../data/evaluation/senate-864-current-67-senator-public-position-coverage-v1.json',import.meta.url)));
const claims=verifyNonNomineeClaims(leads,matrix);
const get=d=>claims.find(x=>x.district===d);
const html=(quote,cue,day)=>Buffer.from('<!doctype html><html><body><h2>'+day+'</h2><h3>Bill statement</h3>'+
 '<p>'+cue+' '+quote+'</p>'+('Broad procedure and public explanatory context. '.repeat(16))+
 '</body></html>');
const utc='2026-10-14T02:36:50.000Z';

test('all 18 nonnominee current senators searched; 15 have primary quoted bill or policy leads and 3 stay explicit holds',()=>{
 assert.equal(claims.length,15);assert.equal(leads.unresolved.length,3);
 assert.equal(new Set(claims.map(x=>x.url)).size,15);
 assert.deepEqual(leads.unresolved.map(x=>x.senator),
  ['Warren E. Limmer','Steve A. Cwodzinski','Jim Carlson']);
 assert.equal(matrix.senators.filter(x=>!x.in49NovemberIncumbentNomineeAudit).length,18);
 assert.ok(matrix.senators.filter(x=>!x.in49NovemberIncumbentNomineeAudit)
  .every(x=>x.currentTermCampaignIssueItemCount===null));
});

test('Utke preserves his distinction between some supported HHS provisions and opposing the overall 2026 package',()=>{
 const x=get(5);
 assert.equal(x.positionAssessment,'oppose_omnibus_despite_specific_provisions_supported');
 assert.equal(x.canonicalBillId,null);
 assert.equal(x.attributionMode,'signed_first_person_newsletter');
 const result=inspectWholeOriginalPublisherBody(html(x.shortExactPassage,x.speakerAttributionCue,'May 6, 2026'),[x],utc);
 assert.equal(result.results[0].currentlyPublisherDisplayedPassageAndSpeakerObserved,true);
 assert.equal(result.results[0].firstHistoricalPublicByEstablished,false);
});

test('Dahms and Pappas preserve failed amendment versus conditional future vote',()=>{
 const d=get(15),p=get(65);
 assert.equal(d.canonicalBillId,'SF4188');
 assert.match(d.qualification,/NOT adopted/);
 assert.equal(p.canonicalBillId,null);
 assert.equal(p.positionAssessment,'conditional_future_yes_not_actual_vote');
 assert.equal(p.individualOfficialNamedVoteVerified,false);
 const source=inspectWholeOriginalPublisherBody(html(p.shortExactPassage,p.speakerAttributionCue,'May 14, 2026'),[p],utc);
 assert.equal(source.results[0].currentlyPublisherDisplayedPassageAndSpeakerObserved,true);
 assert.equal(source.results[0].memberVoteFromStatementInferred,false);
});

test('Xiong amendment support, Mann named policy and Klein narrowly scoped section are not omnibus blanket labels',()=>{
 const x=get(44),m=get(50),k=get(53);
 assert.equal(x.canonicalBillId,'SF4555');
 assert.match(x.issueTopic,/amendments/);
 assert.equal(m.canonicalBillId,'HF3453');
 assert.equal(k.canonicalBillId,'HF2027');
 assert.match(k.positionAssessment,/section/);
 for(const p of [x,m,k]){
  assert.ok(p.attributionMode==='named_caucus_quote');
  assert.equal(p.historicalBacktestEligible,false);
 }
});

test('fake attributed quote on a hidden script and 403 original must fail safely instead of creating positions',async()=>{
 const x=get(24),cue=x.speakerAttributionCue;
 const fake=Buffer.from('<h2>April 21, 2026</h2><script>'+cue+' '+x.shortExactPassage+'</script>'+
 ('Real publication about something unrelated. '.repeat(25)));
 const r=inspectWholeOriginalPublisherBody(fake,[x],utc);
 assert.equal(r.results[0].currentlyPublisherDisplayedPassageAndSpeakerObserved,false);
 const denied=await acquireSourceWithBoundedFailure([x],async()=>new Response('Access denied',{status:403}));
 assert.equal(denied.status,'HTTP_UNAVAILABLE_UNKNOWN');
 assert.equal(denied.originalVerified,false);
});


test('first distinct original-source whole-HTML receipts preserve eight strong quotes, one literal mismatch and six 403 unknowns',()=>{
 const p=JSON.parse(readFileSync(new URL('../data/evaluation/senate-864-2026-nonnominee-current-publisher-observation-receipts-v1.json',import.meta.url)));
 assert.equal(p.schema,'mn-senate-864-2026-current-nonnominee-live-publisher-original-observation-receipts-v1');
 assert.equal(p.originalGitHubActionsRun,38502764093);
 assert.deepEqual([
  p.summary.personallyQuotedPolicyOriginalPublisherLeadPages,
  p.summary.unresolvedWithoutSpecificDirectQuote,
  p.summary.rawLiveWholeHtmlDownloaded,
  p.summary.rawHtmlNamedQuotationDateMatched,
  p.summary.downloadedButQuoteNotMatchedHolds,
  p.summary.originalPublisherHttp403Holds],[15,3,9,8,1,6]);
 assert.equal(p.rows.length,15);
 const idSet=new Set();
 for(const r of p.rows){
  const c=get(r.district);assert.equal(r.claimId,c.id);assert.equal(r.originalPublisherUrl,c.url);
  assert.ok(!idSet.has(r.claimId));idSet.add(r.claimId);
  assert.equal(r.independentlyProvenFirstPublicBy,false);
  assert.equal(r.archived2026HistoricPublisherVersionShaAuthenticated,false);
  assert.equal(r.claimEligibleForHistoricBacktest,false);
  assert.match(r.observedAtUtc,/^2026-10-14T02:46:/);
  if(r.httpStatus===200){
   assert.match(r.liveWholeOriginalRawHtmlSha256,/^[a-f0-9]{64}$/);
   assert.ok(r.liveWholeOriginalRawHtmlBytes>100_000);
   assert.ok(r.originalPublisherUrl.startsWith('https://www.mnsenaterepublicans.com/'));
  }else{
   assert.equal(r.httpStatus,403);
   assert.equal(r.liveWholeOriginalRawHtmlSha256,null);
   assert.equal(r.liveWholeOriginalRawHtmlBytes,null);
   assert.ok(r.originalPublisherUrl.startsWith('https://senatedfl.mn/'));
  }
 }
 const d=p.rows.find(x=>x.district===22);
 assert.equal(d.httpStatus,200);
 assert.equal(d.directPhraseAndSpeakerAndDisplayedDayMatched,false);
 assert.equal(d.qaDisposition,'HOLD_LIVE_HTML_PRESENT_DATE_MATCH_BUT_EXACT_PHRASE_NOT_FOUND');
 assert.equal(p.summary.historicalOriginal2026EarlyCaptureVersionsAuthenticated,0);
 assert.equal(p.summary.productionEvidenceRowsJoined,0);
});
