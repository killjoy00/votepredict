import test from 'node:test';
import assert from 'node:assert/strict';
import {VERSION,LEADS,JOURNAL,allowed,recognizeRoll,archivalStatus,quarantineUnselectedArchiveDigestMismatches,proveSpeakerBoundedTurn,checkBoundedArchivedOriginal,inspectJournal,run}
 from '../scripts/probe-senate-media-2023-hf100-no-originals.mjs';

function vote(yea='Boldon Carlson Champion Cwodzinski Dibble',nay='Abeler Anderson Bahr Coleman Dahms Gruenhagen'){
 return 'H.F. No. 100 was read the third time, as amended.\n'+
  'The question was taken on the final passage of H.F. No. 100, as amended.\n'+
  'The roll was called, and there were yeas 34 and nays 33, as follows:\n'+
  'Those who voted in the affirmative were:\n'+yea+'\n'+
  'Pursuant to Rule 40, Senator Morrison cast the affirmative vote on behalf of Senator Kunesh.\n'+
  'Those who voted in the negative were:\n'+nay+'\n'+
  'Pursuant to Rule 40, Senator Rasmusson cast the negative vote on behalf of Senator Howe.\n'+
  'So the bill, as amended, was passed and its title was agreed to.\n';
}
test('immutable candidate exact URLs, true April 28 HF100 Senate Journal and SF73 distinction',()=>{
 assert.equal(VERSION,'track-d-2023-hf100-individual-no-public-original-audit-v1');
 assert.equal(allowed(),true);assert.equal(LEADS.length,2);
 assert.deepEqual(LEADS.map(x=>x.senator),['Gary Dahms','Glenn Gruenhagen']);
 assert.equal(JOURNAL.roll.join('-'),'34-33');
 assert.equal(JOURNAL.date,'2023-04-28');
 assert.equal(JOURNAL.printedPage,6890);
 assert.equal(JOURNAL.pdfPageOneBased,290);
 assert.equal(JOURNAL.url,'https://www.senate.mn/journals/2023-2024/20230428059.pdf');
 assert.equal(JOURNAL.companion,'SF73');
});
test('names in personally printed negative final-passage roster prove two official NAY outcomes',()=>{
 const x=recognizeRoll(vote());
 assert.equal(x.status,'official_named_no_roster_2of2');
 assert.equal(x.qualified,true);
 assert.equal(x.bill,'HF100');assert.equal(x.companionNotVotedOnDirectly,'SF73');
 assert.deepEqual(x.personallyNamedVotes.map(y=>[y.senator,y.vote]),[
  ['Gary Dahms','nay'],['Glenn Gruenhagen','nay']]);
});
test('incorrect number of votes, wrong Senate File, wrong House File, not passage all rejected',()=>{
 for(const x of [
 vote().replace('yeas 34 and nays 33','yeas 33 and nays 34'),
 vote().replace('final passage of H.F. No. 100','final passage of H.F. No. 101'),
 vote().replace('final passage of H.F. No. 100','final passage of S.F. No. 73'),
 vote().replace('final passage of H.F. No. 100','adoption of the motion on H.F. No. 100'),
 vote().replace('The question was taken on the final passage of','The question was taken on the motion regarding')
 ])assert.equal(recognizeRoll(x).qualified,false);
});
test('matching aggregate final passage total without individual negative roster membership must not manufacture NO',()=>{
 const a=vote('Boldon Dahms Gruenhagen','Abeler Anderson Bahr');
 const x=recognizeRoll(a);
 assert.equal(x.qualified,false);
 assert.deepEqual(x.personallyNamedVotes.map(v=>v.vote),['UNKNOWN','UNKNOWN']);
 const none=recognizeRoll(vote('Boldon Carlson','Abeler Anderson Bahr'));
 assert.equal(none.qualified,false);
});
test('a surname only in Rule 40 proxy attribution cannot be treated as personally listed NO',()=>{
 const x=recognizeRoll(vote('Boldon Carlson','Abeler Anderson Bahr\nPursuant to Rule 40, Senator Rasmusson cast a negative vote for Senators Dahms and Gruenhagen.'));
 assert.equal(x.qualified,false);
 assert.ok(x.personallyNamedVotes.every(y=>y.vote==='UNKNOWN'));
});
test('adjacent passed motions, amendments, committee tallies and wrong paper cannot replace true final bill roll',()=>{
 const motion=vote('Dahms Gruenhagen','Boldon Cwodzinski')
   .replace('The question was taken on the final passage of H.F. No. 100, as amended.','The question was taken on the motion to re-refer H.F. No. 100.');
 const right=vote();
 assert.equal(recognizeRoll(motion).qualified,false);
 assert.equal(recognizeRoll(motion+'\n'+right).qualified,true);
 assert.equal(recognizeRoll(right+'\n'+right).qualified,false);
});
test('missing final outcome or affirmative/negative section must fail closed',()=>{
 for(const s of [vote().replace('So the bill, as amended, was passed and its title was agreed to.','The motion prevailed.'),
  vote().replace('Those who voted in the negative were:',''),
  vote().replace('Those who voted in the affirmative were:','')]){
  assert.equal(recognizeRoll(s).qualified,false);
 }
 assert.throws(()=>recognizeRoll(11));
});
test('historic source cue only if indexed original body is re-downloaded and captured before floor vote',()=>{
 const lead=LEADS[0];
 const c={captureUtc:'2023-03-09T21:12:00Z',indexedOriginalSha1:'A'.repeat(32),
  rawOriginalSha256:'b'.repeat(64),originalBytes:75432,
  status:'sha1_authenticated_original_publisher_html',
  shortCues:[{senator:lead.senator,cueFound:true}]};
 assert.equal(archivalStatus(c,lead).qualifiesAsAuthenticatedPrevoteSourceCue,true);
 for(const mutate of [
  x=>x.captureUtc='2023-04-29T00:00:00Z',
  x=>x.indexedOriginalSha1='INVALID',
  x=>x.rawOriginalSha256='bad',
  x=>x.originalBytes=12,
  x=>x.status='original_archive_index_digest_mismatch_unknown',
  x=>x.shortCues[0].cueFound=false
 ]){
  const copy=structuredClone(c);mutate(copy);
  assert.equal(archivalStatus(copy,lead).qualifiesAsAuthenticatedPrevoteSourceCue,false);
 }
});
test('archived timestamp after Apr 28 and current publisher HTML can never be promoted to prior statement',()=>{
 const s=archivalStatus({
  captureUtc:'2023-05-01T02:00:00Z',indexedOriginalSha1:'C'.repeat(32),
  rawOriginalSha256:'c'.repeat(64),originalBytes:34000,
  status:'sha1_authenticated_original_commoncrawl_warc_html',
  shortCues:[{senator:'Glenn Gruenhagen',cueFound:true}]
 },LEADS[1]);
 assert.equal(s.historicOriginalPublicBeforeApril28,false);
 assert.equal(s.qualifiesAsAuthenticatedPrevoteSourceCue,false);
});
test('503 official original and archive outage produce UNKNOWN: no named vote, no historical original',async()=>{
 const offline=async()=>new Response('service unavailable',{status:503,
  headers:{'content-type':'text/plain'}});
 const x=await inspectJournal(offline);
 assert.equal(x.namedFinalPassageBallot,null);
 assert.equal(x.rawPdfSha256,null);
 assert.equal(x.status,'official_original_journal_unknown');
 const r=await run(offline);
 assert.equal(r.officialPersonallyNamedFinalPassageNOCount,0);
 assert.equal(r.authenticatedPreVoteOriginalCueCount,0);
 assert.equal(r.fullyQualifiedHistoricalQuoteVotePairs,0);
 assert.equal(r.holds.SF73WasCompanionNotRecordedFinalPassageBill,true);
 assert.equal(r.holds.noProductionChanges,true);
 assert.equal(r.sources.length,2);
});

test('bounded Dahms source must carry closed quote immediately attributed to the correct full senator name',()=>{
 const h='<p>“The are many glaring issues with the Democrats’ proposal to legalize recreational marijuana in Minnesota,” said Senator Gary Dahms (R). “This legislation is far too broad, and its language leads to countless questions.”</p>';
 const v=proveSpeakerBoundedTurn(h,LEADS[0]);assert.equal(v.verified,true);
 assert.match(v.boundedSegmentNormalizedSha256,/^[0-9a-f]{64}$/);
 assert.ok(v.boundedSegmentCharacters>60);
 assert.equal(proveSpeakerBoundedTurn(h.replace('said Senator Gary Dahms','a campaign aide said'),LEADS[0]).verified,false);
 assert.equal(proveSpeakerBoundedTurn(h.replace('This legislation is far too broad','This different bill is far too broad'),LEADS[0]).verified,false);
});
test('bounded Gruenhagen source requires signed first-person policy item, not a generic nearby citation',()=>{
 const h='<h1>Gruenhagen: the destructiveness of legal marijuana</h1><p>Friends and neighbors – One of the hot items on their to-do list is legalizing marijuana.</p><p>The Democrat effort to legalize it here is taking us down a dangerous and destructive path.</p><p>It is a privilege to serve you. God Bless. Glenn</p>';
 const v=proveSpeakerBoundedTurn(h,LEADS[1]);assert.equal(v.verified,true);
 assert.match(v.boundedSegmentNormalizedSha256,/^[0-9a-f]{64}$/);
 assert.equal(proveSpeakerBoundedTurn(h.replace('God Bless. Glenn','God Bless. Someone else'),LEADS[1]).verified,false);
 assert.equal(proveSpeakerBoundedTurn(h.replace('Gruenhagen: the destructiveness','Anonymous: the destructiveness'),LEADS[1]).verified,false);
});
test('altered archived source original cannot match independently indexed original bytes',async()=>{
 const c={captureUtc:'2023-03-27T23:22:22Z',indexedOriginalSha1Base32:'A'.repeat(32),
  rawOriginalSha256:'a'.repeat(64),originalBytes:1000,qualifiesAsAuthenticatedPrevoteSourceCue:true};
 const fake=async()=>new Response('<html>'+('text '.repeat(220))+'</html>',{status:200,headers:{'content-type':'text/html'}});
 const v=await checkBoundedArchivedOriginal(LEADS[0],c,fake);
 assert.equal(v.verified,false);assert.equal(v.status,'original_replay_digest_mismatch_fail_closed');
});

test('a separate unselected archive SHA1 mismatch is quarantined UNKNOWN without becoming a third historical original',()=>{
 const pin='2023-03-19T11:54:13Z';
 const rows=[
  {originalRetrievalStatus:'sha1_authenticated_original_publisher_html',
   captureUtc:pin,rawOriginalSha256:'a'.repeat(64),exactOriginalIndexedHashAndRawBodyMatched:true},
  {originalRetrievalStatus:'original_archive_index_digest_mismatch_unknown',
   captureUtc:'2023-04-25T22:47:57Z',rawOriginalSha256:null,exactOriginalIndexedHashAndRawBodyMatched:false}
 ];
 const out=quarantineUnselectedArchiveDigestMismatches(rows,pin);
 assert.equal(out.length,1);
 assert.equal(out[0].captureUtc,'2023-04-25T22:47:57Z');
 assert.equal(out[0].eligibleHistoricalSource,false);
 assert.equal(out[0].doesNotInvalidatePinnedOriginal,true);
});
test('a mismatched PINNED SHA1 or a wrongly promoted mismatched archive is a hard error',()=>{
 const pin='2023-03-19T11:54:13Z';
 const bad={originalRetrievalStatus:'original_archive_index_digest_mismatch_unknown',
  captureUtc:pin,rawOriginalSha256:null,exactOriginalIndexedHashAndRawBodyMatched:false};
 assert.throws(()=>quarantineUnselectedArchiveDigestMismatches([bad],pin),/PINNED/);
 assert.throws(()=>quarantineUnselectedArchiveDigestMismatches([{
  ...bad,captureUtc:'2023-04-25T22:47:57Z',rawOriginalSha256:'f'.repeat(64)
 }],pin),/untrusted archive/);
 assert.throws(()=>quarantineUnselectedArchiveDigestMismatches([{
  ...bad,captureUtc:'2023-04-25T22:47:57Z',exactOriginalIndexedHashAndRawBodyMatched:true
 }],pin),/untrusted archive/);
});
