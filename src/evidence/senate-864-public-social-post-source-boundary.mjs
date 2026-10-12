/**
 * Research-only source boundary for #864 candidate/senator public social posts.
 * A research mirror with an old displayed post date is not a historically
 * authenticated original post body and never a candidate-owned campaign site.
 * This module has no IO, network, database, forecast, or production side effects.
 */
import assert from 'node:assert/strict';

const SNOWFLAKE_EPOCH=1288834974657n;
const handlePattern=/^@[A-Za-z0-9_]{1,15}$/;
const postPattern=/^https:\/\/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{1,15})\/status\/([1-9][0-9]{14,19})(?:\/)?$/i;
const day=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !Number.isNaN(Date.parse(s+'T00:00:00.000Z'));
export function decodeTwitterSnowflakeDate(id){
 if(!/^[1-9][0-9]{14,19}$/.test(String(id)))return null;
 try{
  const time=(BigInt(id)>>22n)+SNOWFLAKE_EPOCH;
  if(time<1262304000000n||time>4102444800000n)return null;
  return new Date(Number(time)).toISOString();
 }catch{return null;}
}
export function inspectPublicSocialStatementLead({
 accountHandle,displayedCalendarDay,mirroredText,originalStatusUrl=null,
 accountIdentityIndependentlyProven=false,originalPostWholeBodyIndependentlyVerified=false
}){
 assert.equal(typeof accountHandle,'string');
 assert.ok(handlePattern.test(accountHandle),'Require explicit valid public account handle');
 assert.ok(day(displayedCalendarDay),'Require displayed platform calendar date, not an inferred publication time');
 assert.equal(typeof mirroredText,'string');
 assert.ok(mirroredText.length<=2800,'Bound the research mirror text; never retain full copyrighted corpora');
 const isRepost=/^\s*(?:RT\s+@|Repost(?:ed)?\s+(?:from|by)\s+@)/i.test(mirroredText);
 const hasText=mirroredText.trim().length>0;
 const match=typeof originalStatusUrl==='string'?originalStatusUrl.match(postPattern):null;
 const exactAccountInStatusURL=!!match&&match[1].toLowerCase()===accountHandle.slice(1).toLowerCase();
 const snowflakeUtc=exactAccountInStatusURL?decodeTwitterSnowflakeDate(match[2]):null;
 const dateDelta=snowflakeUtc?Math.abs(Date.parse(snowflakeUtc)-Date.parse(displayedCalendarDay+'T12:00:00.000Z')):null;
 // Allow a one-day civil-time shift without interpreting the mirror's date as
 // an original UTC publication timestamp. A Snowflake only proves an ID time,
 // NOT that the candidate authored the mirrored words.
 const snowflakeConsistent=Number.isFinite(dateDelta)&&dateDelta<=36*3600*1000;
 const originalSourceTextProven=!!originalPostWholeBodyIndependentlyVerified && snowflakeConsistent && !!accountIdentityIndependentlyProven;
 let sourceStatus='mirror_only_original_post_not_authenticated';
 if(isRepost)sourceStatus='repost_of_other_speaker_not_candidate_own_words';
 else if(!hasText)sourceStatus='no_source_text';
 else if(originalStatusUrl&&!match)sourceStatus='malformed_or_untrusted_original_post_url';
 else if(match&&!exactAccountInStatusURL)sourceStatus='original_status_account_mismatch';
 else if(match&&!snowflakeConsistent)sourceStatus='original_post_id_date_mismatch';
 else if(originalSourceTextProven)sourceStatus='original_post_identifier_and_source_body_needs_human_speech_review';
 else if(snowflakeConsistent)sourceStatus='original_post_id_only_source_body_not_proven';
 return Object.freeze({
  sourceStatus,displayedCalendarDay,
  recordIsRepost:isRepost,potentiallyOwnAuthoredAccountPost:hasText&&!isRepost,
  sourcePostIdValidatedAgainstAccountAndDisplayedDay:!!snowflakeConsistent,
  originalPlatformPostCreatedAtUtc:snowflakeConsistent?snowflakeUtc:null,
  originalPostBodyIndependentlyAuthenticated:originalSourceTextProven,
  historicalPublicByIndependentlyEstablished:originalSourceTextProven,
  candidateOwnedCampaignWebsiteEvidence:false,
  originalIssueStatementAutomaticallyAdmitted:false,
  legislatureVoteOrPositionAutomaticallyInferred:false,
  researchMirrorDateAloneDoesNotEstablishOriginalPublicBy:true
 });
}
