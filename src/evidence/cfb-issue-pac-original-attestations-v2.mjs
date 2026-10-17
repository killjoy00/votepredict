/**
 * #864 research-only contemporary PAC identity attestation. Do not infer a
 * historical pre-vote affiliation, legislative stance or serving feature.
 */
import {createHash} from 'node:crypto';
import {sourceDate} from './cfb-issue-financial-relationships-shadow.mjs';
export const CFB_PAC_ATTESTATION_SCHEMA='cfb-issue-pac-attestation-candidates-v2';
const HEX=/^[a-f0-9]{64}$/;
const REG=/^[0-9]{3,8}$/;
const UTC=/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;
const ALLOWED=new Set(['Minnesota Chamber of Commerce','Education Minnesota','Minnesota AFL-CIO']);
const HOSTS=new Set(['register.cfb.mn.gov','www.mnchamber.com','educationminnesota.org','mnaflcio.org']);
const MIN_OBSERVED='2026-10-17';
const OFFICIAL_SOURCE='cfb-political-fund-registration-index';
function escapeRegex(s){return s.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');}
function visibleText(html){
 return html.replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(?:script|style|noscript)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript)\s*>/gi,' ')
  .replace(/<[^>]*>/g,' ').replace(/&(nbsp|#160|#xA0);/gi,' ')
  .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();
}
function safeUri(s){
 try{
  const u=new URL(s);
  return u.protocol==='https:'&&HOSTS.has(u.hostname)&&
   !u.username&&!u.password&&!u.port;
 }catch{return false;}
}
function validSnapshot(s,manifest){
 if(!s||!Buffer.isBuffer(s.rawHtmlBytes)||
  s.rawHtmlBytes.length<100||s.rawHtmlBytes.length>800000||
  !HEX.test(s.htmlSha256??'')||!UTC.test(s.observedAt??'')||
  !sourceDate(s.observedAt.slice(0,10))||
  s.observedAt.slice(0,10)<MIN_OBSERVED||
  s.claimStatus!=='unverified_raw_observation'||
  s.historicalAsOfEligible!==false||
  s.mechanicallyActionable!==false||Number(s.modelWeight)!==0||
  !safeUri(s.sourceUrl)||!safeUri(s.finalUrl)||
  createHash('sha256').update(s.rawHtmlBytes).digest('hex')!==s.htmlSha256)
  return false;
 const expected=manifest.find(x=>x.id===s.sourceId);
 return !!expected&&expected.url===s.sourceUrl&&
  expected.role===s.sourceRole&&
  expected.organizationGroup===s.organizationGroup;
}
export function validatePacCandidates(config){
 if(config?.schemaVersion!==CFB_PAC_ATTESTATION_SCHEMA||
  !Array.isArray(config.candidates)||config.candidates.length!==3)
  throw Error('Expected exactly three pinned CFB source candidates');
 const regs=new Set();
 return config.candidates.map(x=>{
  if(!REG.test(x?.contributorRegistrationNumber??'')||
   regs.has(x.contributorRegistrationNumber)||
   x.officialSourceId!==OFFICIAL_SOURCE||
   !ALLOWED.has(x.organizationGroup)||
   typeof x.officialRegisteredName!=='string'||
   x.officialRegisteredName.length<8||
   !/^[a-z0-9-]+$/.test(x.publisherSourceId??'')||
   (x.exactFirstPartyPacPhrase!==null&&
    (typeof x.exactFirstPartyPacPhrase!=='string'||
     x.exactFirstPartyPacPhrase.length<15))||
   !['exact_two_source_current_pac_identity',
     'held_no_explicit_first_party_pac_legal_affiliation']
     .includes(x.originalSourceProofRequirement)||
   ((x.exactFirstPartyPacPhrase===null)!==
    (x.originalSourceProofRequirement===
     'held_no_explicit_first_party_pac_legal_affiliation')))
   throw Error('Unapproved PAC attestation configuration');
  regs.add(x.contributorRegistrationNumber);
  return Object.freeze({...x});
 });
}
function registeredNameAndNumberOnSameRow(visible,name,reg){
 // Exact CFB printed registration name - ID, not two uncorrelated tokens.
 const n=escapeRegex(name).replace(/\s+/g,'\\s+');
 return new RegExp('(?:^|\\s)'+n+'\\s*[-:\u2013\u2014]\\s*'+reg+'\\b','i')
  .test(visible);
}
function firstPartyExplicitPacName(visible,phrase){
 return new RegExp('(?:^|\\W)'+escapeRegex(phrase).replace(/\s+/g,'\\s+')+
  '(?=\\W|$)','i').test(visible);
}
function latest(id,snapshots,manifest){
 const rows=snapshots.filter(s=>s.sourceId===id);
 // Corrupt or contradictory later source versions may not be hidden.
 if(rows.some(s=>!validSnapshot(s,manifest)))return null;
 rows.sort((a,b)=>b.observedAt.localeCompare(a.observedAt)||
  b.htmlSha256.localeCompare(a.htmlSha256));
 if(rows.length>1&&rows[0].observedAt===rows[1].observedAt&&
  rows[0].htmlSha256!==rows[1].htmlSha256)return null;
 return rows[0]??null;
}
export function attestCurrentPacSourcePairs({snapshots,manifest,config,cutoffOn}){
 if(!Array.isArray(snapshots)||snapshots.length>100||
  !Array.isArray(manifest)||manifest.length<2||manifest.length>12||
  !sourceDate(cutoffOn))throw Error('Bounded originals and cutoff date required');
 const entries=validatePacCandidates(config),statuses=[],affiliations=[];
 for(const c of entries){
  const reg=c.contributorRegistrationNumber;
  if(!c.exactFirstPartyPacPhrase){
   statuses.push({registration:reg,status:'held_no_explicit_first_party_pac_proof'});
   continue;
  }
  const official=latest(c.officialSourceId,snapshots,manifest);
  const publisher=latest(c.publisherSourceId,snapshots,manifest);
  if(!official||!publisher||official.sourceRole!=='cfb_registry_index'||
   publisher.sourceRole!=='first_party_pac_affiliation'||
   publisher.organizationGroup!==c.organizationGroup){
   statuses.push({registration:reg,status:'missing_or_invalid_original_source'});
   continue;
  }
  const officialText=visibleText(official.rawHtmlBytes.toString('utf8'));
  const publisherText=visibleText(publisher.rawHtmlBytes.toString('utf8'));
  if(!registeredNameAndNumberOnSameRow(officialText,c.officialRegisteredName,reg)){
   statuses.push({registration:reg,status:'official_registration_row_not_demonstrated'});
   continue;
  }
  if(!firstPartyExplicitPacName(publisherText,c.exactFirstPartyPacPhrase)){
   statuses.push({registration:reg,status:'first_party_pac_identity_not_demonstrated'});
   continue;
  }
  // Two original-source observation dates establish a conservative current
  // seen-by bound; they do NOT recover original 2021-25 public availability.
  const observedOn=[official.observedAt,publisher.observedAt].sort().at(-1).slice(0,10);
  statuses.push({registration:reg,status:'current_dual_original_source_attested',
   observedByOn:observedOn,retrospectivelyUsable:false});
  if(observedOn>=cutoffOn)continue; // exclude same-day date-only replay
  affiliations.push({
   contributorRegistrationNumber:reg,groupName:c.organizationGroup,
   relationship:'verified_organizational_affiliation',
   officialCfbUrl:official.sourceUrl,
   firstPartyAffiliationUrl:publisher.sourceUrl,
   officialCfbSha256:official.htmlSha256,
   firstPartySha256:publisher.htmlSha256,
   validatedOn:observedOn,
   relationshipPublicByOn:observedOn,
   affiliationEffectiveOn:observedOn,
   relationshipOriginalProof:true,
   originalSourceIdentityScope:'contemporary_observed_on_or_after_2026_10_17'
  });
 }
 return {schema:CFB_PAC_ATTESTATION_SCHEMA,cutoffOn,statuses,affiliations,
  newHistoricalEligibility:0,modelWeight:0,contemporaneousEvidenceOnly:true};
}
const BILL=/(?:^|\W)(H\.?\s*F\.?|S\.?\s*F\.?|House\s+File|Senate\s+File)\s*#?\s*([1-9]\d{0,4})\b/gi;
export function literalBillMentionLeads(snapshots,manifest){
 if(!Array.isArray(snapshots)||snapshots.length>100)
  throw Error('Bounded source pages required');
 const result=[],seen=new Set();
 for(const page of snapshots){
  if(page.sourceRole!=='first_party_issue_publication'||
   !validSnapshot(page,manifest))continue;
  const text=visibleText(page.rawHtmlBytes.toString('utf8'));
  for(const m of [...text.matchAll(BILL)].slice(0,100)){
   const bill=(/^h/i.test(m[1])?'HF':'SF')+String(Number(m[2]));
   const key=page.sourceId+'|'+page.htmlSha256+'|'+bill;
   if(seen.has(key))continue;
   seen.add(key);
   result.push({sourceId:page.sourceId,sourceSha256:page.htmlSha256,
    organizationGroup:page.organizationGroup,billIdentifier:bill,
    observedOn:page.observedAt.slice(0,10),
    classification:'literal_bill_mention_only',
    groupVotePosition:null,historicalAsOfEligible:false,modelWeight:0});
  }
 }
 return result;
}
