/**
 * Track D #864: immutable, source-specific 2026 Senate statement cohort.
 * The first verified public-by is the 2026-10-14 ORIGINAL HTML observation,
 * not the publisher-displayed February-May date. Never backdate to a vote.
 * No database connections, source fetches, or model changes in this module.
 */
import assert from 'node:assert/strict';
import reviewed from '../../data/evidence/senate-864-2026-verified-direct-positions-v1.json' with {type:'json'};
import nominee from '../../data/evaluation/senate-864-2026-current-legislative-statements-v1.json' with {type:'json'};
import nonnominee from '../../data/evaluation/senate-864-2026-current-nonnominee-legislative-position-leads-v1.json' with {type:'json'};
import nomineeReceipts from '../../data/evaluation/senate-864-2026-current-publisher-whole-html-observation-receipts-v1.json' with {type:'json'};
import nonnomineeReceipts from '../../data/evaluation/senate-864-2026-nonnominee-current-publisher-observation-receipts-v1.json' with {type:'json'};

export const verifiedSenate864 = reviewed;
export const APPLY_COMMENT = '[senate-864-2026-verified-13-apply-v1-20261014]';
const DISTRICTS = [1,2,5,11,13,15,20,21,24,26,31,32,54];
const CERTIFIED_HOST = 'www.mnsenaterepublicans.com';
const directions = new Set(['supports','opposes','mixed','unclear']);
const billTargets = new Set(['SF3602','SF5032','SF5101']);

const normalize = v => String(v ?? '').normalize('NFKC')
  .replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,'-')
  .replace(/\s+/g,' ').trim().toLowerCase();
export const quotedPassageMatches = (text,quote) =>
  normalize(quote).length >= 20 && normalize(text).includes(normalize(quote));
export function strictOriginalUrl(url){
  const parsed = new URL(url);
  assert.equal(parsed.protocol,'https:');
  assert.equal(parsed.hostname,CERTIFIED_HOST);
  assert.equal(parsed.username,'');assert.equal(parsed.password,'');
  assert.equal(parsed.port,'');assert.equal(parsed.search,'');assert.equal(parsed.hash,'');
  assert.match(parsed.pathname,/^\/[a-z0-9-]+\/$/);
  return parsed.href;
}
export function originalUrlVariants(url){
  const parsed = new URL(strictOriginalUrl(url));
  const path=parsed.pathname.replace(/\/$/,'');
  return [
    'https://www.mnsenaterepublicans.com'+path+'/',
    'https://www.mnsenaterepublicans.com'+path,
    'http://www.mnsenaterepublicans.com'+path+'/',
    'http://www.mnsenaterepublicans.com'+path,
    'https://mnsenaterepublicans.com'+path+'/',
    'https://mnsenaterepublicans.com'+path,
    'http://mnsenaterepublicans.com'+path+'/',
    'http://mnsenaterepublicans.com'+path,
  ];
}
const sourceKey = raw => {
  const u=new URL(raw);
  return u.hostname.replace(/^www\./,'').toLowerCase()+u.pathname.replace(/\/+$/,'');
};
export function assertVerifiedSenate864Ledger(){
  assert.equal(reviewed.schema,'vote-predict-senate-864-2026-original-speaker-verified-prospective-integration-v1');
  assert.equal(reviewed.issue,864);
  assert.equal(reviewed.verificationDateUtc,'2026-10-14');
  assert.equal(reviewed.verifiedStatements,13);
  assert.equal(reviewed.verifiedDistinctSenators,13);
  assert.equal(reviewed.mechanicallyActionable,false);
  assert.equal(reviewed.noSourceBodyStored,true);
  assert.equal(reviewed.claims.length,13);
  assert.deepEqual(reviewed.claims.map(c=>c.district),DISTRICTS);
  assert.equal(new Set(reviewed.claims.map(c=>c.id)).size,13);
  assert.equal(new Set(reviewed.claims.map(c=>c.sourceUrl)).size,13);
  assert.equal(new Set(reviewed.claims.map(c=>c.senator)).size,13);
  const research=[...nominee.claims,...nonnominee.claims];
  const receipts=new Map([
    ...nomineeReceipts.rows.filter(r=>r.httpStatus===200&&r.observationClass==='LIVE_ORIGINAL_HTML_WHOLE_BYTES_SHA256_AND_NAMED_PASSAGE_MATCH').map(r=>[r.primaryClaimId,{
      url:nominee.claims.find(c=>c.id===r.primaryClaimId)?.url,
      sha:r.liveOriginalWholeHtmlSha256,bytes:r.liveOriginalWholeHtmlBytes,
      time:r.observedAtUtc,
    }]),
    ...nonnomineeReceipts.rows.filter(r=>r.httpStatus===200&&r.directPhraseAndSpeakerAndDisplayedDayMatched===true).map(r=>[r.claimId,{
      url:r.originalPublisherUrl,sha:r.liveWholeOriginalRawHtmlSha256,
      bytes:r.liveWholeOriginalRawHtmlBytes,time:r.observedAtUtc,
    }]),
  ]);
  assert.equal(receipts.size,13);
  const blocked=[...nomineeReceipts.rows,...nonnomineeReceipts.rows]
    .filter(r=>r.httpStatus===403)
    .map(r=>r.url??r.originalPublisherUrl).sort();
  const unmatched=nonnomineeReceipts.rows
    .filter(r=>r.httpStatus===200 && r.directPhraseAndSpeakerAndDisplayedDayMatched===false)
    .map(r=>r.originalPublisherUrl);
  assert.equal(blocked.length,15);
  assert.equal(unmatched.length,1);
  assert.deepEqual(reviewed.excluded.originalPublisherHttp403Urls,blocked);
  assert.deepEqual(reviewed.excluded.downloadedOriginalButLiteralQuoteNotMatchedUrls,unmatched);
  assert.deepEqual(reviewed.excluded.otherSittingSenatorsWithoutPersonQuotedSpecificPolicyStatements,[37,49,52]);
  const excludedUrls=new Set([...blocked,...unmatched]);
  for(const c of reviewed.claims){
    const original=research.find(r=>r.id===c.id);
    const receipt=receipts.get(c.id);
    assert.ok(original && receipt,'Unproven verified claim');
    assert.equal(c.sourceUrl,receipt.url);strictOriginalUrl(c.sourceUrl);
    assert.equal(c.sourceUrl,original.url);
    assert.equal(c.verifiedWholePublisherHtmlSha256,receipt.sha);
    assert.match(c.verifiedWholePublisherHtmlSha256,/^[a-f0-9]{64}$/);
    assert.equal(c.verifiedWholePublisherHtmlBytes,receipt.bytes);
    assert.ok(c.verifiedWholePublisherHtmlBytes>1000);
    assert.equal(c.firstIndependentlyObservedPublicAtUtc,receipt.time);
    assert.match(c.firstIndependentlyObservedPublicAtUtc,/^2026-10-14T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(new Date(c.firstIndependentlyObservedPublicAtUtc).toISOString(),receipt.time);
    assert.equal(c.displayedPublisherDay,original.publisherDisplayedDate);
    assert.ok(c.displayedPublisherDay<'2026-10-14');
    assert.equal(c.district,original.district);assert.equal(c.senator,original.senator);
    assert.equal(c.quote,original.shortExactPassage);
    assert.equal(c.speakerAttributionCue,original.speakerAttributionCue);
    assert.equal(c.sourcePositionAssessment,original.positionAssessment);
    assert.equal(c.scopeQualification,original.qualification);
    assert.ok(c.scope.length>=22);
    assert.ok(directions.has(c.stance));
    assert.equal(c.contextOnly,true);assert.equal(c.mechanicallyActionable,false);
    assert.equal(c.originalDisplayedDateIndependentlyAuthenticatedAsFirstPublication,false);
    assert.equal(c.backtestAvailabilityBeforeFirstObservation,false);
    assert.ok(!excludedUrls.has(c.sourceUrl));
    if(c.linkToWholeBill){
      assert.ok(billTargets.has(c.relatedBillIdentifier));
      assert.ok(c.billAssociationType==='whole_proposal'||c.billAssociationType==='self_reported_vote');
    } else {
      assert.ok(!c.relatedBillIdentifier || c.billAssociationType==='section_only'||c.billAssociationType==='failed_amendment');
    }
  }
  return reviewed.claims;
}
export const fullBillIdentifiers = () =>
  [...new Set(verifiedSenate864.claims.filter(c=>c.linkToWholeBill).map(c=>c.relatedBillIdentifier))];

function surname(name){
  return normalize(name).replace(/\b(jr|sr|ii|iii|iv)\.?$/,'')
    .replace(/[^a-z\s-]/g,' ').trim().split(/\s+/).at(-1);
}
function uniqueMember(claim,members){
  const subset=members.filter(m=>Number(m.district)===claim.district);
  if(subset.length!==1)return {status:'HOLD_MEMBERSHIP_IDENTITY',member:null};
  const row=subset[0];
  if(surname(row.name)!==surname(claim.senator) || !row.membershipId)
    return {status:'HOLD_MEMBERSHIP_IDENTITY',member:null};
  return {status:'ok',member:row};
}
function existingForClaim(claim,rows){
  const keys=new Set(originalUrlVariants(claim.sourceUrl).map(sourceKey));
  return rows.filter(r => {
    try{return keys.has(sourceKey(r.sourceUrl))}catch{return false}
  });
}
function priorHistoricalProof(metadata){
  const data=metadata&&typeof metadata==='object'?metadata:{};
  return data.originalArchiveCaptureAuthenticated===true ||
    data.independentlyVerifiedHistoricPublicBy===true ||
    data.historicalSourceVersionVerified===true ||
    data.originalVersionPublicationTimeAuthenticated===true;
}
export function buildSenate864ReconciliationPlan({
  members,existingEvidence,bills,claims=assertVerifiedSenate864Ledger(),
}){
  assert.ok(Array.isArray(members)&&members.length<=150);
  assert.ok(Array.isArray(existingEvidence)&&existingEvidence.length<=1200);
  assert.ok(Array.isArray(bills)&&bills.length<=25);
  const plan=[];
  for(const claim of claims){
    const match=uniqueMember(claim,members);
    if(match.status!=='ok'){
      plan.push({claim,status:match.status,member:null,billId:null});
      continue;
    }
    const person=match.member;
    const available=existingForClaim(claim,existingEvidence);
    const wrongAttribution=available.filter(r=>r.evidenceId &&
      r.membershipId && r.membershipId!==person.membershipId &&
      quotedPassageMatches(r.excerpt,claim.quote));
    if(wrongAttribution.length){
      plan.push({claim,status:'HOLD_EXISTING_SPEAKER_CONFLICT',member:person,billId:null});
      continue;
    }
    const byQuote=available.filter(r=>r.evidenceId && r.membershipId===person.membershipId &&
      (r.metadata?.verifiedStatementId===claim.id || quotedPassageMatches(r.excerpt,claim.quote)));
    if(byQuote.length>1){
      plan.push({claim,status:'HOLD_DUPLICATE_PRIOR_EXACT_QUOTE',member:person,billId:null});
      continue;
    }
    if(byQuote.length===1){
      const stored=byQuote[0];
      const prior=stored.publishedAt?Date.parse(stored.publishedAt):NaN;
      const observation=Date.parse(claim.firstIndependentlyObservedPublicAtUtc);
      if(Number.isFinite(prior)&&prior<observation && priorHistoricalProof(stored.metadata)){
        plan.push({claim,status:'EXISTING_EARLIER_INDEPENDENT_PROOF',member:person,
          billId:stored.billId??null,existing:stored});
        continue;
      }
      if((!Number.isFinite(prior)||prior<observation) &&
        stored.sourceSha===claim.verifiedWholePublisherHtmlSha256){
        plan.push({claim,status:'REPAIR_EXISTING_VERIFIED_TIMESTAMP',member:person,
          billId:stored.billId??null,existing:stored});
        continue;
      }
      if(!Number.isFinite(prior)||prior<observation){
        plan.push({claim,status:'HOLD_PRIOR_DIFFERENT_SOURCE_VERSION_DATE',member:person,
          billId:stored.billId??null});
        continue;
      }
      plan.push({claim,status:'EXISTING_QUOTE',member:person,billId:stored.billId??null});
      continue;
    }
    let billId=null;
    if(claim.linkToWholeBill){
      const found=bills.filter(b=>b.identifier?.toUpperCase()===claim.relatedBillIdentifier);
      if(found.length!==1||!found[0].billId){
        plan.push({claim,status:'HOLD_BILL_LINK_IDENTITY',member:person,billId:null});
        continue;
      }
      billId=found[0].billId;
    }
    plan.push({claim,status:'INSERT_VERIFIED_QUOTE',member:person,billId});
  }
  return plan;
}
export function safeSenate864Summary(plan){
  assert.equal(plan.length,13);
  const statuses={};
  for(const item of plan)statuses[item.status]=(statuses[item.status]??0)+1;
  return {
    schema:'vote-predict-senate-864-2026-13-direct-position-reconciliation-v1',
    conservativeAvailabilityDayUtc:'2026-10-14',
    claims:13,verifiedOriginalPages:13,
    blockedOriginalUrlsExcluded:15,unmatchedQuoteUrlsExcluded:1,
    noQuoteSenatorsExcluded:3,
    statuses,
    perPublicDistrict:plan.map(x=>({district:x.claim.district,
      statementId:x.claim.id,status:x.status})),
    noPrivateIdentifiersOrSourceBodies:true,
  };
}
