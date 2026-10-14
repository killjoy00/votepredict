/**
 * #864 current sitting MN senator public statement source QA.
 * Offline testable; optional public URL source-only SHA verifier.
 * NEVER equate displayed publication date to first historical public-by.
 * NEVER ingest evidence, contact people or open private/production DBs.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {normalizeVisibleHtml} from './probe-senate-864-2026-duckworth-dated-original-public-statements.mjs';

const safeHosts=new Set(['senatedfl.mn','www.mnsenaterepublicans.com']);
const ledgerPath='data/evaluation/senate-864-2026-current-legislative-statements-v1.json';
const coveragePath='data/evaluation/senate-864-current-67-senator-public-position-coverage-v1.json';
const canonical=s=>String(s).normalize('NFKC').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim().toLowerCase();
const dayLabel=day=>{assert.match(day,/^2026-\d{2}-\d{2}$/);
 const d=new Date(day+'T12:00:00Z');assert.equal(d.toISOString().slice(0,10),day);
 return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'long',day:'numeric',year:'numeric'}).format(d);
};

export function verifyPositionLedgers(source,coverage){
 assert.equal(source.schema,'mn-senate-864-2026-current-legislative-statements-public-publisher-leads-v1');
 assert.equal(coverage.schema,'mn-senate-864-current-67-sitting-senator-campaign-parity-and-specific-public-leads-v1');
 assert.equal(source.claims.length,15);assert.equal(coverage.senators.length,67);
 assert.deepEqual(coverage.senators.map(x=>x.district),Array.from({length:67},(_,i)=>i+1));
 assert.equal(source.distinctSenators,14);assert.equal(new Set(source.claims.map(x=>x.district)).size,14);
 assert.equal(new Set(source.claims.map(x=>x.url)).size,14);
 assert.equal(new Set(source.claims.map(x=>x.id)).size,15);
 const voters=coverage.senators.filter(x=>x.in49NovemberIncumbentNomineeAudit);
 const omitted=coverage.senators.filter(x=>!x.in49NovemberIncumbentNomineeAudit);
 assert.equal(voters.length,49);assert.equal(omitted.length,18);
 assert.ok(omitted.every(x=>x.currentTermCampaignIssueItemCount===null && !x.evidenceAbsent));
 assert.equal(voters.filter(x=>x.currentTermCampaignIssueItemCount===0).length,18);
 assert.equal(voters.filter(x=>x.currentTermCampaignIssueItemCount>0 && x.currentMemberStored2026CampaignItems===0).length,7);
 assert.equal(voters.filter(x=>x.currentMemberStored2026CampaignItems>0).length,24);
 assert.equal(voters.reduce((n,x)=>n+x.currentTermCampaignIssueItemCount,0),378);
 assert.equal(voters.reduce((n,x)=>n+x.campaignHistoricOriginalExcerptCount,0),716);
 const byId=new Map(source.claims.map(x=>[x.id,x]));
 for(const person of coverage.senators){
  for(const id of person.currentPublisherSpecificStatementLeads)assert.equal(byId.get(id)?.district,person.district);
 }
 for(const c of source.claims){
  assert.equal(coverage.senators[c.district-1].district,c.district);
  assert.equal(c.sourceOriginalBinaryAuthenticated,false);
  assert.equal(c.originalPageRawSha256,null);
  assert.equal(c.archivedExactOriginalCapture,null);
  assert.equal(c.independentlyProvenFirstPublicAt,null);
  assert.equal(c.earliestIndependentlyProvenExactVersionPublicByUtc,null);
  assert.equal(c.historicalBacktestEligibleFromThisLedger,false);
  assert.equal(c.sourceStatementInStoredVotePredictEvidence,'unknown');
  assert.equal(c.verifiedExactVoteRoll,'not_checked');
  assert.ok(c.shortExactPassage.length>=25 && c.shortExactPassage.length<=180);
  assert.ok(c.speakerAttributionCue.length>=8);
  assert.ok(['named_caucus_quote','signed_first_person_newsletter'].includes(c.attributionMode));
  assert.ok(['explicit_support','explicit_opposition','explicit_opposition_self_reported_vote',
   'explicit_support_for_independent_oig','explicit_support_for_state_civil_remedy',
   'explicit_support_for_transparency_neutral_on_construction','explicit_support_for_reimbursement',
   'explicit_support_source_bill_number_conflict_hold','support_targeted_tax_relief_package',
   'conditional_opposition_to_untransparent_funding','qualified_support_insufficient_funding',
   'qualified_support_for_12m_provision'].includes(c.positionAssessment));
  assert.ok(safeHosts.has(new URL(c.url).hostname));
  assert.equal(new URL(c.url).protocol,'https:');
  dayLabel(c.publisherDisplayedDate);
 }
 const atv=source.claims.filter(x=>x.canonicalBillId==='SF1245');
 assert.deepEqual(atv.map(x=>x.district).sort((a,b)=>a-b),[3,8]);
 assert.deepEqual(atv.map(x=>x.positionAssessment).sort(),['explicit_opposition','explicit_support']);
 assert.equal(new Set(atv.map(x=>x.eventDate)).size,1);
 const law=source.claims.find(x=>x.id==='sd56-20260513-egg-sf3891-ambiguous-source-number');
 assert.equal(law.canonicalBillId,'SF3891');
 assert.equal(law.sourceMentionsConflictingBillId,'SF3981');
 assert.equal(law.requiresSourceBillNumberResolution,true);
 assert.equal(law.crosscheckedLegislativeUrl,'https://www.revisor.mn.gov/bills/94/2026/0/SF/3891/');
 const joint=source.claims.filter(x=>x.district===59||x.district===62);
 assert.equal(new Set(joint.map(x=>x.url)).size,1);
 assert.equal(new Set(joint.map(x=>x.speakerAttributionCue)).size,2);
 assert.equal(source.safety.noProductionDatabaseReadsOrWrites,true);
 return source.claims;
}
export function inspectWholeOriginalPublisherBody(bytes,claims,observedAtUtc){
 assert.ok(Buffer.isBuffer(bytes)&&bytes.length>=500&&bytes.length<=4_000_000);
 assert.match(observedAtUtc,/^\d{4}-\d\d-\d\dT/);
 assert.ok(Array.isArray(claims)&&claims.length>0);
 const url=new URL(claims[0].url);
 assert.ok(url.protocol==='https:'&&safeHosts.has(url.hostname));
 assert.ok(claims.every(x=>x.url===claims[0].url));
 const rawVisibleCandidate=bytes.toString('utf8').replace(/<(?:template|noscript|svg)\b[^>]*>[\s\S]*?<\/(?:template|noscript|svg)\s*>/gi,' ');
 const text=canonical(normalizeVisibleHtml(rawVisibleCandidate));
 const sha=createHash('sha256').update(bytes).digest('hex');
 const namedCueLocations=[];
 for(const person of claims.filter(x=>x.attributionMode==='named_caucus_quote')){
  const cue=canonical(person.speakerAttributionCue);
  for(let offset=0;;){const at=text.indexOf(cue,offset);if(at<0)break;
   namedCueLocations.push({claimId:person.id,at});offset=at+Math.max(1,cue.length);}
 }
 const adjudicated=claims.map(c=>{
  const quoteIdx=text.indexOf(canonical(c.shortExactPassage));
  const cue=canonical(c.speakerAttributionCue);
  const bylineMode=c.attributionMode==='signed_first_person_newsletter';
  const rankedAttributions=quoteIdx<0?[]:namedCueLocations
   .map(x=>({...x,distance:Math.abs(x.at-quoteIdx)}))
   .sort((a,b)=>a.distance-b.distance||a.at-b.at);
  const nearest=rankedAttributions[0];
  const namedSpeakerAdjacent=Boolean(nearest&&nearest.claimId===c.id&&nearest.distance<=600);
  const attributionBounded=bylineMode?text.includes(cue)&&quoteIdx>=0:namedSpeakerAdjacent;
  const publishedDayVisible=text.includes(canonical(dayLabel(c.publisherDisplayedDate)));
  const billTokens=text.replace(/\bsf\s+(\d+)\b/g,'sf$1');
  const bothSourceBillIds=c.requiresSourceBillNumberResolution?
   billTokens.includes(canonical(c.canonicalBillId))&&
   billTokens.includes(canonical(c.sourceMentionsConflictingBillId)):false;
  const literalDateSpeakerAndPassage=publishedDayVisible&&quoteIdx>=0&&attributionBounded;
  return {claimId:c.id,foundExactShortPassage:quoteIdx>=0,
   publisherDisplayedDayFoundInLiveHtml:publishedDayVisible,
   individuallyNamedAttributionFoundInBoundedVisibleWindow:attributionBounded,
   currentlyPublisherDisplayedPassageAndSpeakerObserved:literalDateSpeakerAndPassage,
   sourceInternalBillNumberConflictDetected:bothSourceBillIds,
   disposition:bothSourceBillIds?'HOLD_SOURCE_BILL_NUMBER_DISAGREEMENT':
    literalDateSpeakerAndPassage?'CURRENT_SOURCE_SPEAKER_PHRASE_VISIBLE_REQUIRES_ARCHIVE_VERSION':
     'HOLD_NO_BOUNDED_SOURCE_ATTRIBUTION_OR_DATE',
   archivedVersionOriginalBytesAuthenticated:false,firstHistoricalPublicByEstablished:false,
   memberVoteFromStatementInferred:false,productionIngestionAuthorized:false};
 });
 return {url:url.href,rawWholePublisherHtmlSha256:sha,rawBodyBytes:bytes.length,observedAtUtc,
   exactRawHtmlObservedNow:true,originalWaybackCDXDigestVerified:false,
   observedCurrentCopyNotProofOfDisplayedPublicationDay:true,
   firstHistoricallyPublicPublisherCopyUtc:null,
   sourceExcerptNotStored: true, results:adjudicated};
}
export async function acquireSourceWithBoundedFailure(claims,fetchFn=fetch){
 const url=claims[0].url,observedAtUtc=new Date().toISOString();
 try{
  const res=await fetchFn(url,{redirect:'manual',signal:AbortSignal.timeout(18000),
   headers:{'user-agent':'VotePredict-public-senator-statement-proof/1.0 (public offline research)'}});
  if(res.status!==200)return {url,observedAtUtc,status:'HTTP_UNAVAILABLE_UNKNOWN',httpStatus:res.status,originalVerified:false};
  if(!String(res.headers.get('content-type')||'').toLowerCase().includes('text/html'))
   return {url,observedAtUtc,status:'NON_HTML_UNKNOWN',originalVerified:false};
  const declared=Number(res.headers.get('content-length')||0);
  if(declared>4_000_000)return {url,observedAtUtc,status:'OVERSIZE_UNKNOWN',originalVerified:false};
  if(!res.body)return {url,observedAtUtc,status:'EMPTY_BODY_UNKNOWN',originalVerified:false};
  const chunks=[];let total=0;const reader=res.body.getReader();
  for(;;){const r=await reader.read();if(r.done)break;total+=r.value.length;
   if(total>4_000_000)return {url,observedAtUtc,status:'OVERSIZE_UNKNOWN',originalVerified:false};
   chunks.push(r.value);}
  const audit=inspectWholeOriginalPublisherBody(Buffer.concat(chunks),claims,observedAtUtc);
  return {...audit,httpStatus:200,status:'CURRENT_PUBLISHER_BODY_OBSERVED_NEVER_HISTORICAL_ARCHIVE_CERTIFIED',originalVerified:true};
 }catch{return {url,observedAtUtc,status:'NETWORK_OR_SOURCE_FORMAT_UNKNOWN',originalVerified:false};}
}
export async function main(){
 const [flag,outPath]=process.argv.slice(2);
 assert.equal(flag,'--out');assert.ok(outPath&&!outPath.startsWith('--'));
 const source=JSON.parse(readFileSync(ledgerPath,'utf8'));
 const coverage=JSON.parse(readFileSync(coveragePath,'utf8'));
 const claims=verifyPositionLedgers(source,coverage);
 const byUrl=new Map();
 for(const c of claims){if(!byUrl.has(c.url))byUrl.set(c.url,[]);byUrl.get(c.url).push(c);}
 const batches=[];
 for(const records of byUrl.values())batches.push(await acquireSourceWithBoundedFailure(records));
 const receipt={schema:'senate-864-2026-current-67-public-specific-direct-source-receipt-v1',
  auditUtc:new Date().toISOString(),urlsProbed:batches.length,
  rawCurrentOriginalBodiesObserved:batches.filter(x=>x.originalVerified).length,
  originalHistoricalArchivePublicByProven:0,privateOrProductionDatabaseQueries:0,
  copyrightedFullRawPublisherHtmlWritten:false,
  researchOnlyNoAutoIngestion:true,failuresAreUnknownNotAbsent:true,batches};
 const output=resolve(outPath);mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({urlsProbed:receipt.urlsProbed,
  liveBodiesWithFullSha:receipt.rawCurrentOriginalBodiesObserved,
  personallyAttributedPassagesVisible:batches.reduce((n,b)=>n+(b.results||[]).filter(x=>x.currentlyPublisherDisplayedPassageAndSpeakerObserved).length,0),
  historicallyArchivedAndTimelyClaimsAdmitted:0,allErrorsAreUnknown:true}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
 main().catch(e=>{console.error('Source-only evidence audit rejected input: '+e.message);process.exitCode=1;});
