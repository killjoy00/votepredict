import test from 'node:test';
import assert from 'node:assert/strict';
import old from '../docs/evaluation/senate-media-2024-hawj-hf5247-official-journals-20261012.json' with {type:'json'};
import {VERSION,SOURCES,FRAGMENTS,proofAnchor,validateAllowlist,inspectText,probeOne,run}
 from '../scripts/probe-senate-media-hf5247-may7-may19-bilingual-versions.mjs';
const [house,unofficial,conference,sf]=SOURCES;
const html=(x,t='3rd Engrossment')=>'<!doctype html><html><head><script>qualifying language</script></head><body>HF 5247, '+t+', 93rd Legislature (2023 - 2024).<p>'+x+'</p><footer>'+'X'.repeat(11000)+'</footer></body></html>';
const allDvs='DRIVER AND VEHICLE SERVICES; MATERIALS IN A LANGUAGE OTHER THAN ENGLISH. Equivalent materials, qualifying language, deputy registrar, driver\'s license agent.';
test('correct independently proven Hawj March24 source and 3 actual official individual YES omnibus votes',()=>{
 assert.equal(VERSION,'track-d-hawj-2024-hf5247-actual-versions-bilingual-crosswalk-v1');
 const a=proofAnchor();assert.equal(a.historicalSenator,'Foung Hawj');
 assert.equal(a.firstOriginalVerifiedUtc,'2024-03-24T19:01:09Z');
 assert.equal(a.originalHtmlSha256,'aa6da6e8722e33f2f692ba31bfd6699cf97768e74c788dbdb0786a75a3ad5743');
 assert.equal(a.knownOfficialMay7AndMay19Hf5247YesVotes,3);
 assert.deepEqual(a.namedStandaloneBills,['SF 4056','SF 3257','SF 3250']);
 assert.throws(()=>proofAnchor({...structuredClone(old),counts:{currentAsOfRelevantBillTextSectionsIndependentlyAuthenticated:1,distinctHF5247IndividualRollCallsPersonallyListingHawjYes:3}}));
});
test('source allowlist fixes 93rd Legislature exact 4 document versions, no later fourth-engrossment backdating',()=>{
 assert.equal(validateAllowlist(),true);
 assert.deepEqual(SOURCES.map(s=>s.id),[
  'hf5247-house-third-engrossment','hf5247-first-unofficial-senate-engrossment',
  'hf5247-conference-committee-report-may19','sf3257-original-2023-proposal']);
 assert.ok(SOURCES.every(s=>s.url.startsWith('https://www.revisor.mn.gov/bills/93/')));
 assert.equal(house.listedPostedDay,'2024-05-03');
 assert.equal(house.htmlDisplayedTimestamp,'2024-05-07 19:29');
 assert.equal(unofficial.htmlDisplayedTimestamp,'2024-05-07 17:36');
 assert.equal(conference.listedPostedDay,'2024-05-19');
 assert.throws(()=>validateAllowlist(SOURCES.map(s=>({...s}))));
});
test('absence of EXACT full DVS translated materials within May7 full visible bill is distinct from generic language mention',()=>{
 const x=inspectText('HF No. 5247. A bill for an act relating to transportation policy, languages and deputy registrars.',house,false);
 assert.equal(x.exactBillAndSessionIdentified,true);
 assert.equal(x.allFourSpecificDvsLanguageMarkersInExactDocument,false);
 assert.equal(x.shortSourcePolicyFragments.find(z=>z.id==='qualifying_nonenglish_languages').shortSourceCuePresent,false);
 const y=inspectText('HF No. 5247. A bill for an act. '+allDvs,house,false);
 assert.equal(y.allFourSpecificDvsLanguageMarkersInExactDocument,true);
 assert.ok(y.shortSourcePolicyFragments.filter(z=>z.shortSourceCuePresent).length>=4);
 assert.equal(y.publicationClockBeforeRollNotIndependentlyProven,true);
});
test('hidden script and someone else on a 94th session cannot supply original source bilingual matches',()=>{
 const content=html('Some local tax measure, no DVS provisions')+'<script>'+allDvs+'</script>';
 const x=inspectText(content,unofficial,true);
 assert.equal(x.allFourSpecificDvsLanguageMarkersInExactDocument,false);
 const different=inspectText(html('HF 5247, 94th Legislature (2025 - 2026), '+allDvs)
 .replace('93rd Legislature (2023 - 2024)','not 2024'),unofficial,true);
 assert.equal(different.exactBillAndSessionIdentified,false);
});
test('conference committee PDF text parser confirms DVS specific composite marker but cannot prove timestamp before May19 vote',()=>{
 const pdf='HF No. 5247, Conference Committee Report - 93rd Legislature (2023-2024) 05/19/24 10:47 PM. '+allDvs;
 const x=inspectText(pdf,conference,false);
 assert.equal(x.exactBillAndSessionIdentified,true);
 assert.equal(x.allFourSpecificDvsLanguageMarkersInExactDocument,true);
 assert.equal(x.publicationClockBeforeRollNotIndependentlyProven,true);
 assert.equal(x.noIndividualHawjVoteOnThisSpecificSFProven,true);
});
test('SF3257 bilingual original does not mechanically equate SF to omnibus yes vote or guarantee exact same legislative section',()=>{
 const x=inspectText('SF3257 AS INTRODUCED. A bill for an act requiring bilingual services from deputy registrar. '+allDvs,sf,false);
 assert.equal(x.exactBillAndSessionIdentified,true);
 assert.equal(x.shortSourcePolicyFragments.find(k=>k.id==='original_SF3257_bilingual_services').shortSourceCuePresent,true);
 assert.equal(x.noIndividualHawjVoteOnThisSpecificSFProven,true);
});
test('redirect, wrong MIME, wrong source body and source outage never become false positive absent or present',async()=>{
 for(const [f,status] of [
  [async()=>new Response('unavailable',{status:503}),'http_unavailable_unknown'],
  [async()=>new Response('',{status:302,headers:{location:'https://unrelated.example'}}),'original_redirect_unknown'],
  [async()=>new Response('not a bill',{headers:{'content-type':'text/plain'}}),'unexpected_content_type_unknown'],
  [async()=>new Response('<!doctype html>'+('z'.repeat(11000)),{headers:{'content-type':'text/html'}}),'unexpected_content_type_unknown']
 ]){
  const x=await probeOne(house,f);
  assert.equal(x.status,status);
  assert.equal(x.exactDocumentFragmentProof===null||x.exactDocumentFragmentProof.exactBillAndSessionIdentified===false,true);
 }
});
test('malformed but full length HTML bill must still fail exact 93rd session identity',async()=>{
 const result=await probeOne(unofficial,async()=>new Response('<html>'+('unrelated 94th legislature bill '.repeat(600))+'</html>',{headers:{'content-type':'text/html'}}));
 assert.equal(result.status,'source_identity_mismatch_unknown');
 assert.equal(result.exactDocumentFragmentProof.exactBillAndSessionIdentified,false);
});
test('all public sources unavailable leaves May7 negatives and May19 positives UNKNOWN, not signed legislative forecasts',async()=>{
 let i=0;
 const r=await run(async(_url,opt)=>{i++;assert.equal(opt.redirect,'manual');return new Response('error',{status:504});});
 assert.equal(i,4);
 assert.equal(r.publicSourceVersionsAttempted,4);
 assert.equal(r.primaryOfficialBillTextSourcesVerified,0);
 assert.equal(r.may7TwoExactDocumentVersionsSuccessfullyReviewedForSpecificDvsLanguage,false);
 assert.equal(r.specificFullDvsBilingualMaterialProvisionAbsentFromBothExaminedMay7DocumentVersions,false);
 assert.equal(r.specificFullDvsBilingualMaterialProvisionPresentInMay19ConferenceReport,false);
 assert.equal(r.exactStandaloneSF3257IntroducedOriginalPdfRetrieved,false);
 assert.equal(r.may19ConferenceOriginalClockBeforeActualRollsNotCertified,true);
 assert.equal(r.datedMay20FinalEngrossmentNotUsableAsEarlierMay19PrevoteProof,true);
 assert.equal(r.unrelatedOmnibusYeaDoesNotLabelStandaloneSF3257Yea,true);
 assert.equal(r.noForecastEligibilityOrProductionLabelApproved,true);
 assert.equal(r.noPrivateVotePredictRowsReviewed,true);
 assert.equal(r.noOriginalFullPdfHtmlTextCommitted,true);
 assert.equal(r.noCollectorModelDbIngestionServingForecastChanges,true);
});
