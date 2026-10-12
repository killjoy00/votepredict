import test from 'node:test';
import assert from 'node:assert/strict';
import prior from '../docs/evaluation/senate-media-2022-parents-rights-gop-wcco-archive-20261012.json' with {type:'json'};
import {VERSION,JOURNALS,TEXT_VERSIONS,PUBLISHER,validateOriginalContext,allowlist,
 inspectIndividualPrintedQuoteBoundaries,inspectOfficialRolls,inspectJournalOriginal,run}
 from '../scripts/probe-senate-media-2022-standalone-parents-bills-primary.mjs';
const MAR03=JOURNALS[0],MAR10=JOURNALS[1];
const rolls=(sf,y,n,yesNames,noNames='',prefix='S.F. No. '+sf+' was read the third time and placed on its final passage.')=>
 prefix+'\nThe question was taken on the passage of the bill.\n'+
 'The roll was called, and there were yeas '+y+' and nays '+n+', as follows:\n'+
 'Those who voted in the affirmative were:\n'+yesNames+'\n'+
 (n?'Those who voted in the negative were:\n'+noNames+'\n':'')+
 'So the bill was passed and its title was agreed to.\n';
const article=['Justin Eichorn','Michelle Benson','Paul Gazelka','Roger Chamberlain'].map((name,i)=>{
 const q=validateOriginalContext().memberNameToCue[name],last=name.split(' ').at(-1);
 return '<p>Senator '+name+' announced the proposal. "'+q+' and they support transparent schools," '+last+' said.</p>';
}).join('\n');
const safeArticle='<html><head><script>"not real" Benson said</script></head><body>'+article+'</body></html>';
test('read-only provenance strictly pins contemporary Feb14 original article and two archive hashes',()=>{
 assert.equal(VERSION,'track-d-2022-parents-education-three-standalone-primary-journal-v1');
 const a=validateOriginalContext();
 assert.equal(a.earliestOriginalArticleCapturedUtc,'2022-02-14T23:24:11Z');
 assert.equal(a.sourceArticleOriginalCaptureSha256,'0bf05a87365ca09a6a85114fe867995c4bfe0531a35adf61641454ed322e7696');
 assert.equal(a.humanApprovedVerbatimWholeStatements,0);
 assert.equal(PUBLISHER.originalCaptures.length,2);
 assert.equal(allowlist(),true);
 assert.deepEqual(JOURNALS.map(x=>[x.day,x.date]),[[73,'2022-03-03'],[76,'2022-03-10']]);
 assert.deepEqual(JOURNALS.flatMap(x=>x.events.map(e=>[e.sf,e.yeas,e.nays,e.senator])),[
  [2575,37,30,'Paul Gazelka'],[2729,67,0,'Roger Chamberlain'],[2666,36,31,'Michelle Benson']
 ]);
});
test('wrong previous archived timestamp, public HTML SHA or prior incorrectly approved quote blocks current audit',()=>{
 for(const modify of [
  d=>d.sourceOriginals[0].independentlyAuthenticatedHistoricalOriginals[0].captureUtc='2022-03-07T02:18:03Z',
  d=>d.sourceOriginals[0].independentlyAuthenticatedHistoricalOriginals[1].downloadedOriginalHtmlRawSha256='0'.repeat(64),
  d=>d.counts.approvedWholeQuotedIndividualStatements=1
 ]){
  const x=structuredClone(prior);modify(x);assert.throws(()=>validateOriginalContext(x));
 }
});
test('closed attributed source-quote boundaries must link full senator and matching cue on historical original',()=>{
 const out=inspectIndividualPrintedQuoteBoundaries(safeArticle,PUBLISHER.originalCaptures[0]);
 assert.equal(out.firstBoundedQuoteDirectAttributionCandidates,4);
 assert.deepEqual(out.visibleBoundedSpeakerOpeningQuotes.map(x=>x.senator),[
  'Justin Eichorn','Michelle Benson','Paul Gazelka','Roger Chamberlain']);
 assert.ok(out.visibleBoundedSpeakerOpeningQuotes.every(x=>
   x.exactIssuerSurnameImmediatelyAfterClosedOriginalQuote&&
   x.fullIndividualSenatorNameInPrecedingOriginalContext&&
   x.distinctValidatedMatchingQuotedSegments===1&&
   x.originalBoundedFirstQuotedSentenceOrPassageChars>40&&
   /^[a-f0-9]{64}$/.test(x.quoteSegmentSha256)&&
   !x.completeSenatorStatementAcrossFollowingPublisherParagraphsHumanApproved));
});
test('false surname proximity, script content, no actual quote close, duplicate turns remain unapproved',()=>{
 const cue=validateOriginalContext().memberNameToCue['Michelle Benson'];
 const variants=[
  '<p>Senator Michelle Benson introduced it.</p><script>"'+cue+'" Benson said</script>',
  '<p>Senator Michelle Benson introduced it; '+cue+' Benson said.</p>',
  '<p>Senator Michelle Benson introduced it. "'+cue+'" Gazelka said.</p>',
  '<p>Senator Michelle Benson introduced it. "'+cue+'" Benson said. "'+cue+'" Benson said.</p>'
 ];
 for(const x of variants){
  const out=inspectIndividualPrintedQuoteBoundaries(x,PUBLISHER.originalCaptures[0]);
  assert.equal(out.visibleBoundedSpeakerOpeningQuotes.find(v=>v.senator==='Michelle Benson').exactIssuerSurnameImmediatelyAfterClosedOriginalQuote,false);
 }
});
test('March3 Gazelka 37-30 and Chamberlain 67-0 must be different attached bill-roll sections, not bill sponsor proxies',()=>{
 const t=rolls(2729,67,0,'Chamberlain Benson Gazelka Eichorn')+
  rolls(2575,37,30,'Gazelka Chamberlain Eichorn','López Franzen Bigham');
 const x=inspectOfficialRolls(t,MAR03);
 assert.equal(x.everyTargetBillIndividualVoteCertified,true);
 assert.deepEqual(x.matchedExpectedAggregateRolls.map(v=>[v.bill,v.senator,v.certifiedPersonalVote,v.chamberYesCount,v.chamberNoCount]),[
  ['SF2729','Roger Chamberlain','yea',67,0],
  ['SF2575','Paul Gazelka','yea',37,30]]);
 assert.ok(x.matchedExpectedAggregateRolls.every(v=>v.currentBillAnchorIsClosestPrecedingSenateFile&&v.currentBillThirdReadingPassageContext));
});
test('March10 official Benson third reading 36-31 and personally in affirmative section proves one standalone bill roll only',()=>{
 const t=rolls(2666,36,31,'Abeler Benson Chamberlain Eichorn Gazelka','Bigham Cwodzinski Eken');
 const x=inspectOfficialRolls(t,MAR10);
 assert.equal(x.everyTargetBillIndividualVoteCertified,true);
 assert.equal(x.matchedExpectedAggregateRolls.length,1);
 const v=x.matchedExpectedAggregateRolls[0];
 assert.equal(v.bill,'SF2666');assert.equal(v.senator,'Michelle Benson');
 assert.equal(v.certifiedPersonalVote,'yea');
 assert.equal(v.personallyInNegativeVoterList,false);
});
test('negative votes must be marked NAY; absent name, wrong bill, same tally and pre-vote motion never invented positive',()=>{
 const no=inspectOfficialRolls(rolls(2666,36,31,'Abeler Gazelka','Benson Bigham'),MAR10);
 assert.equal(no.matchedExpectedAggregateRolls[0].certifiedPersonalVote,'nay');
 const abs=inspectOfficialRolls(rolls(2666,36,31,'Abeler Gazelka','Bigham'),MAR10);
 assert.equal(abs.matchedExpectedAggregateRolls[0].certifiedPersonalVote,'UNKNOWN');
 const wrong=inspectOfficialRolls(rolls(9999,36,31,'Benson','Bigham')+'\n'+rolls(2666,2,1,'Benson','Bigham'),MAR10);
 assert.equal(wrong.everyTargetBillIndividualVoteCertified,false);
 const motion=inspectOfficialRolls(rolls(2666,36,31,'Benson','Bigham','S.F. No. 2666 was moved to another committee.'),MAR10);
 assert.equal(motion.everyTargetBillIndividualVoteCertified,false);
});
test('no-member vote with zero nays is not evidence of YES, even if surname appears only in later unrelated senate narrative',()=>{
 const bad=rolls(2729,67,0,'Abeler Bigham Cwodzinski')+
 'Senator Chamberlain announced a press conference.';
 const r=inspectOfficialRolls(bad,MAR03);
 assert.equal(r.matchedExpectedAggregateRolls[0].certifiedPersonalVote,'UNKNOWN');
});
test('bounded source failure is UNKNOWN, never not-voted or reason to promote a production label',async()=>{
 const f=async(_url,options)=>{assert.equal(options.redirect,'manual');return new Response('offline',{status:503});};
 const j=await inspectJournalOriginal(MAR03,f);
 assert.equal(j.status,'official_journal_unavailable_or_unparsed_unknown');
 assert.equal(j.rollResults,null);
 const o=await run(f);
 assert.equal(o.officialJournalOriginalPDFsAuthenticated,0);
 assert.equal(o.originalFirstPartyArticleVersionsReauthenticated,0);
 assert.equal(o.governmentBillPDFVersionDocumentsAuthenticated,0);
 assert.equal(o.verifiedTargetIndividualYesVotes,0);
 assert.equal(o.authenticatedNamedOriginalFirstBoundedQuotationSegments,0);
 assert.ok(o.primaryAndControlDirectStandaloneCandidates.length===0);
 assert.equal(o.noProductionsSourceRowReadOrTrainingLabelApproved,true);
 assert.equal(o.noOriginalJournalPdfBillPdfRawHtmlOrFullQuotePersisted,true);
 assert.equal(o.noCollectorDatabaseIngestionModelServingScoringOrForecastChanged,true);
});
