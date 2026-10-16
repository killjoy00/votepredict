import test from 'node:test';
import assert from 'node:assert/strict';
import {ORIGINALS,VERSION,validateNewLeads,attributableCues,run,auditOne}
 from '../../scripts/probe-senate-media-2022-parental-rights-four-caucus-audacy-originals.mjs';
import {checkCues,parseWaybackCdx} from '../../scripts/probe-senate-media-mpr-five-year-commoncrawl-originals.mjs';

test('two genuine new 2022 exact publisher URLs distinct from previously researched 18/25/six original leads',()=>{
 assert.equal(VERSION,'track-d-2022-four-caucus-senators-distinct-wcco-benson-two-original-source-audit-v1');
 assert.equal(validateNewLeads().length,2);
 assert.equal(ORIGINALS[0].url,'https://www.mnsenaterepublicans.com/senate-republicans-propose-parents-bill-of-rights/');
 assert.equal(ORIGINALS[1].url,'https://www.audacy.com/talk980am/news/national/minnesota-gop-propose-parental-rights-bill-for-the-classroom');
 assert.deepEqual(ORIGINALS.map(x=>x.displayedDay),['2022-02-14','2022-02-15']);
 assert.notEqual(ORIGINALS[0].url,ORIGINALS[1].url);
});
test('FOUR distinct 2022 serving senators, five original publisher candidate/source pairs including repeated Benson without inflating person count',()=>{
 assert.deepEqual(ORIGINALS[0].quoted.map(q=>q.senator),['Justin Eichorn','Michelle Benson','Paul Gazelka','Roger Chamberlain']);
 assert.deepEqual(ORIGINALS[1].quoted.map(q=>q.senator),['Michelle Benson']);
 assert.equal(new Set(ORIGINALS.flatMap(x=>x.quoted.map(y=>y.senator))).size,4);
 assert.equal(ORIGINALS.reduce((n,x)=>n+x.quoted.length,0),5);
 assert.deepEqual(ORIGINALS[0].quoted.map(q=>q.lrl.split('ID=')[1]),['15480','15322','12263','15325']);
 assert.equal(ORIGINALS[1].quoted[0].lrl,ORIGINALS[0].quoted[1].lrl);
 assert.deepEqual(ORIGINALS.map(x=>x.ccCollections),[['CC-MAIN-2022-21','CC-MAIN-2022-49'],['CC-MAIN-2022-21','CC-MAIN-2022-49']]);
});
test('confusable broadcaster, altered URI and unapproved scope cannot join immutable source list',()=>{
 for(const item of [
  [{...ORIGINALS[0],url:'https://www.mprnews.org/episode/2022/02/23/measures-give-parents-more-control-over-instruction-await-votes'},ORIGINALS[1]],
  [ORIGINALS[1],ORIGINALS[0]],
  [{...ORIGINALS[0],url:'https://example.com/fake'},ORIGINALS[1]],
  [ORIGINALS[0],{...ORIGINALS[1],quoted:[]}],
  [ORIGINALS[0],{...ORIGINALS[1],displayedDay:'2024-02-15'}]
 ])assert.throws(()=>validateNewLeads(item));
});
test('quoted issue cues only on visible article: reject script/hidden, wrong speaker attribution and wrong content',()=>{
 const lead=ORIGINALS[0],c=lead.quoted[1].cue;
 const visible='<html><body><p>Senator Michelle Benson said, “'+c+'.”</p></body></html>';
 const good=checkCues(visible,lead);
 assert.equal(good[1].cueFound,true);
 assert.equal(good[1].fullNameInNearbySourceText,true);
 assert.equal(good[1].fullReportedUtteranceApproved,false);
 assert.equal(good[1].authenticatedRecordedAudioQuote,false);
 const hidden=checkCues('<html><head><script>'+c+'</script></head><body><p>Senator Michelle Benson.</p></body></html>',lead);
 assert.equal(hidden[1].cueFound,false);
 const another=checkCues('<p>Senator Roger Chamberlain:</p><p> “'+c+'” </p>',lead);
 assert.equal(another[1].cueFound,true);
 assert.equal(another[1].fullNameInNearbySourceText,false);
});
test('exact published February 2022 originals indexed in Wayback must have date, CDX digest, original URL, HTML 200; current page not historical',()=>{
 const l=ORIGINALS[0],header=['timestamp','original','mimetype','statuscode','digest','length'];
 const sha='A'.repeat(32);
 const good=parseWaybackCdx([header,['20220311021830',l.url,'text/html','200',sha,'1000']],l);
 assert.equal(good.length,1);assert.equal(good[0].captureUtc,'2022-03-11T02:18:30Z');
 assert.throws(()=>parseWaybackCdx([header,['20220210120000',l.url,'text/html','200',sha,'1000']],l));
 assert.throws(()=>parseWaybackCdx([header,['20220311021830','https://www.audacy.com/different','text/html','200',sha,'1000']],l));
 assert.throws(()=>parseWaybackCdx([header,['20220311021830',l.url,'text/plain','200',sha,'1000']],l));
 assert.throws(()=>parseWaybackCdx([header,['20220311021830',l.url,'text/html','301',sha,'1000']],l));
});
test('pre-existing source SHA without approved original written quote boundary cannot approve a verified statement',()=>{
 const lead=ORIGINALS[0],mock=[{
  status:'sha1_authenticated_original_publisher_html',
  shortCues:lead.quoted.map(q=>({cueFound:true,fullNameInNearbySourceText:true,senator:q.senator}))
 }];
 const result=attributableCues(mock,lead);
 assert.equal(result.length,4);
 assert.ok(result.every(x=>x.shortHistoricalIssueCueFoundInAtLeastOneAuthenticatedOriginal));
 assert.ok(result.every(x=>x.fullNameNearbyInAtLeastOneAuthenticatedOriginal));
 assert.ok(result.every(x=>!x.directOriginalWrittenQuoteBoundaryVerified&&!x.firstPersonRecordedAudioAuthenticated&&!x.wholeSenatorUtteranceHumanApproved));
 const wrong=attributableCues(mock.map(x=>({...x,status:'original_archive_redirect_unknown'})),lead);
 assert.ok(wrong.every(x=>!x.shortHistoricalIssueCueFoundInAtLeastOneAuthenticatedOriginal));
});
test('source indexes/fetch blocked means UNKNOWN for each exact URL and not absence or 2022 published-by proof',async()=>{
 let calls=0;
 const data=await run(async (_url,opts)=>{calls++;assert.equal(opts.redirect,'manual');return new Response('unavailable',{status:503});});
 assert.ok(calls>=8);
 assert.equal(data.sources.length,2);
 assert.equal(data.historicalOriginalPublisherUrlsAuthenticated,0);
 assert.equal(data.historicalOriginalHtmlVersionsAuthenticated,0);
 assert.ok(data.sources.every(x=>x.wayback.indexStatus==='index_unavailable_unknown'));
 assert.ok(data.sources.every(x=>x.selectedCommonCrawlCollections.every(c=>c.indexStatus==='index_unavailable_unknown')));
 assert.ok(data.sources.every(x=>x.earliestAuthenticatedOriginalArchiveUtc===null));
 assert.ok(data.sources.every(x=>x.historicalSelectedSpeakerCueChecks.every(c=>!c.shortCueAuthenticatedInOriginal)));
 assert.equal(data.individuallyBoundedHistoricalSenatorQuotedTurnsApproved,0);
 assert.equal(data.historic2022FirstPublisherPostingClockAuthenticated,0);
});
test('separate Feb23 MPR Benson/Kunesh program never aliased to Feb14/15 GOP caucus or WCCO interview publisher',async()=>{
 const one=await auditOne(ORIGINALS[1],async()=>new Response('unavailable',{status:503}));
 assert.equal(one.publisherAttributionCategory,'one_reporter_attributed_named_senator_interview_excerpt_pending_historical_source');
 assert.equal(one.notVerbatimTranscriptOrRecordedVoice,true);
 assert.equal(one.unavailableOrEmptyArchiveIndexesAreUnknownNotGlobalAbsence,true);
 const data=await run(async()=>new Response('unavailable',{status:503}));
 assert.equal(data.oldAdjacentMprBensonKuneshShowNotSubstituted,true);
 assert.equal(data.publisherUrlLeadsNewToPrevious18_25_6UrlCohorts,2);
 assert.equal(data.uniqueHistoricallyServingSenatorsAcrossSelectedUrls,4);
 assert.equal(data.namedSpeakerShortCueSourcePairs,5);
 assert.equal(data.independentSenateVotesOrPredictiveAsOfCutoffsVerified,0);
 assert.equal(data.originalRecordedSpeechMP3Authenticated,0);
 assert.equal(data.noPrivateSourceDocumentRowsQueried,true);
 assert.equal(data.noProductionCollectorModelDatabaseServingForecastChanges,true);
 assert.equal(data.noOriginalHtmlAudioWarcOrTranscriptPersisted,true);
});
