import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
 VERSION,LEADS,validateLeads,probeLead,runMprAndCaucusSenateEvidenceBreadth
} from '../scripts/probe-senate-media-2022-25-mpr-caucus-breadth-originals.mjs';
import {parseWaybackCdx,parseCommonCrawlIndex} from '../../scripts/probe-senate-media-mpr-five-year-commoncrawl-originals.mjs';
const BASE32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32(raw){let v=0,b=0,o='';for(const k of createHash('sha1').update(raw).digest()){
 v=v<<8|k;b+=8;while(b>=5){b-=5;o+=BASE32[(v>>>b)&31];}v&=(1<<b)-1;}if(b)o+=BASE32[(v<<(5-b))&31];return o;}
const cols=['timestamp','original','mimetype','statuscode','digest','length'];
test('nine selected direct publisher URLs across 2022–25 with four new individual MPR senator voices, no federal senators',()=>{
 const leads=validateLeads();
 assert.equal(VERSION,'senate-media-mpr-caucus-ten-senator-breadth-source-proof-v1');
 assert.equal(leads.length,9);
 assert.equal(new Set(leads.map(x=>x.url)).size,9);
 assert.equal(new Set(leads.flatMap(x=>x.namedIndividualSenators)).size,10);
 assert.deepEqual(leads.map(x=>x.date.slice(0,4)),['2022','2022','2023','2023','2024','2025','2025','2025','2025']);
 assert.equal(leads.filter(x=>x.priorKnownSourceLead).length,2);
 assert.equal(leads.filter(x=>x.url.startsWith('https://www.mprnews.org/episode/')).length,6);
 assert.equal(leads.filter(x=>x.url.startsWith('https://senatedfl.mn/')).length,2);
 assert.equal(leads.filter(x=>x.url.startsWith('https://www.mnsenaterepublicans.com/')).length,1);
 assert.throws(()=>validateLeads(leads.slice(1)),/Unexpected/);
 assert.throws(()=>validateLeads([LEADS[1],LEADS[0],...LEADS.slice(2)]),/Unapproved/);
});
test('accurate 2022 Benson and Kunesh record: MPR attribution describes interview, not authenticated full audio or transcript',()=>{
 assert.deepEqual(LEADS[0].namedIndividualSenators,['Michelle Benson','Mary Kunesh']);
 assert.equal(LEADS[0].attributionClass,'host_describes_named_state_senator_interviews_audio_without_individual_full_speaker_turn');
 assert.equal(LEADS[0].historicalQuoteCandidate,false);
 assert.equal(LEADS[0].postEvent,false);
 assert.equal(LEADS[1].historicalQuoteCandidate,false);
 assert.equal(LEADS[1].namedIndividualSenators.length,0);
 assert.equal(LEADS[1].storyType,'potential_same_day_audio_program_or_alias_not_verified');
 assert.equal(LEADS[1].url.startsWith('https://www.mprnews.org/episode/2022/02/23/'),true);
});
test('Pha original direct March release is not same as April 2025 collective three-senator caucus quote',()=>{
 const direct=LEADS[6],joint=LEADS[7];
 assert.equal(direct.namedIndividualSenators.length,1);
 assert.equal(direct.namedIndividualSenators[0],'Susan Pha');
 assert.equal(direct.attributionClass,'individual_named_senator_original_party_caucus_published_direct_statement');
 assert.deepEqual(joint.namedIndividualSenators,['Susan Pha','Tou Xiong','Foung Hawj']);
 assert.equal(joint.attributionClass,'collective_three_senator_named_caucus_statement_not_individual_susan_pha_quote');
 assert.equal(joint.historicalQuoteCandidate,false);
 assert.equal(joint.postEvent,true);
 assert.equal(direct.postEvent,true);
});
test('Coleman first-party Aug 2025 signed statement differs from Sep 11 MPR transcript and cannot backdate before shooting',()=>{
 const c=LEADS[8];
 assert.equal(c.date,'2025-08-27');
 assert.equal(c.namedIndividualSenators[0],'Julia Coleman');
 assert.match(c.url,/mnsenaterepublicans.com/);
 assert.equal(c.attributionClass,'individual_named_senator_original_party_caucus_published_direct_statement');
 assert.equal(c.postEvent,true);
});
test('exact indexed original first-party Wayback URL digest must not accept another URL, HTML MIME or 2026',()=>{
 const s=LEADS[8],stamp='20250829112600';
 const data=[cols,[stamp,s.url,'text/html','200','A'.repeat(32),'20300']];
 assert.equal(parseWaybackCdx(data,s).length,1);
 assert.throws(()=>parseWaybackCdx([cols,[stamp,'https://evil.example/o','text/html','200','A'.repeat(32),'20300']],s));
 assert.throws(()=>parseWaybackCdx([cols,[stamp,s.url,'application/pdf','200','A'.repeat(32),'20300']],s));
 assert.throws(()=>parseWaybackCdx([cols,['20260829112600',s.url,'text/html','200','A'.repeat(32),'20300']],s));
});
test('original Senate Caucus statement SHA1 index plus fetched original body SHA256 verifies source, not signed quotation approval',async()=>{
 const l=LEADS[8],html=Buffer.from('<html><body><h1>Sen. Coleman statement</h1>Senator Julia Coleman said Now is the time to make school security funding a priority.</body></html>'+ ' '.repeat(5000));
 const stamp='20250829112600',digest=b32(html),sha256=createHash('sha256').update(html).digest('hex');
 const fake=async(url,opts)=>{
  assert.equal(opts.redirect,'manual');
  if(url.startsWith('https://web.archive.org/cdx/search/')){
   const q=new URL(url).searchParams;assert.equal(q.get('url'),l.url);
   return new Response(JSON.stringify([cols,[stamp,l.url,'text/html','200',digest,''+html.length]]),{headers:{'content-type':'application/json'}});
  }
  if(url.startsWith('https://web.archive.org/web/')){
   assert.equal(url,'https://web.archive.org/web/'+stamp+'id_/'+l.url);
   return new Response(html,{headers:{'content-type':'text/html'}});
  }
  if(url.startsWith('https://index.commoncrawl.org/'))return new Response('not indexed',{status:404});
  assert.equal(url,l.url);
  return new Response(html,{headers:{'content-type':'text/html'}});
 };
 const r=await probeLead(l,fake);
 assert.equal(r.current.status,'current_publisher_html_sha256_observed');
 assert.equal(r.wayback.status,'index_candidates');
 assert.equal(r.wayback.originals[0].originalStatus,'sha1_authenticated_original_publisher_html');
 assert.equal(r.wayback.originals[0].originalBodySha256,sha256);
 assert.equal(r.wayback.originals[0].originalBodyBytes,html.length);
 assert.equal(r.wayback.originals[0].selectedCues[0].foundSomewhereOnOriginalPage,true);
 assert.equal(r.wayback.originals[0].selectedCues[0].directSpeakerTurnVerified,false);
 assert.equal(r.historicallySha1AuthenticatedOriginalHtmlCaptures,1);
 assert.equal(r.acceptedWholePersonalQuotes,0);
 assert.equal(r.noFirstPublicAtPublisherDayOrSenateVotePredictionCertified,true);
});
test('archive index unavailable for all nine selected exact URLs means UNKNOWN not global missed evidence',async()=>{
 const failed=async()=>new Response('temporarily unavailable',{status:503});
 const r=await runMprAndCaucusSenateEvidenceBreadth(failed);
 assert.equal(r.publicFirstPartyUrlsTested,9);
 assert.equal(r.newlyDiscoveredFirstPartyUrlLeads,7);
 assert.equal(r.distinctNamedStateSenatorsInSelectedPages,10);
 assert.equal(r.independentlySha1AuthenticatedOriginalHtmlCaptures,0);
 assert.ok(r.sourcePages.every(x=>x.wayback.status==='index_unavailable_unknown'));
 assert.ok(r.sourcePages.every(x=>x.commonCrawl.collections.every(c=>c.indexStatus==='index_unavailable_unknown')));
 assert.equal(r.senatorWholeVerbatimQuotesHumanApproved,0);
 assert.equal(r.memberVotesAuthenticated,0);
 assert.equal(r.noPrivateDatabaseCollectorIngestionOrForecastChanges,true);
 assert.equal(r.noFullRawHtmlAudioPdfWarcSaved,true);
});
test('untrusted original 2025 Common Crawl URL alias, compressed source or dates are not authenticated',()=>{
 const l=LEADS[6],cc=l.ccCollections[0];
 const row={url:l.url,timestamp:'20250323000000',digest:'A'.repeat(32),status:'200',mime:'text/html',filename:'crawl-data/'+cc+'/segments/17420.1/warc/crawl.warc.gz',offset:'122',length:'5000'};
 assert.equal(parseCommonCrawlIndex(JSON.stringify(row),l,cc).length,1);
 assert.throws(()=>parseCommonCrawlIndex(JSON.stringify({...row,url:'https://evil.example/' }),l,cc));
 assert.throws(()=>parseCommonCrawlIndex(JSON.stringify({...row,filename:'crawl-data/'+cc+'/../evil.warc.gz'}),l,cc));
 assert.throws(()=>parseCommonCrawlIndex(JSON.stringify({...row,timestamp:'20260101000000'}),l,cc));
});
