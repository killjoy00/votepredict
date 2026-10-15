import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeTwitterSnowflakeDate,inspectPublicSocialStatementLead}
 from '../evidence/senate-864-public-social-post-source-boundary.mjs';

const date='2020-10-16';
const ms=Date.parse('2020-10-16T11:14:00.000Z');
const fabricatedId=(((BigInt(ms)-1288834974657n)<<22n)+7n).toString();
const base={accountHandle:'@SyntheticMN',displayedCalendarDay:date,
 mirroredText:'I am writing about a hypothetical public infrastructure project.',
 originalStatusUrl:null};

test('displayed old research-mirror date without platform ID is not original source proof',()=>{
 const r=inspectPublicSocialStatementLead(base);
 assert.equal(r.sourceStatus,'mirror_only_original_post_not_authenticated');
 assert.equal(r.candidateOwnedCampaignWebsiteEvidence,false);
 assert.equal(r.originalIssueStatementAutomaticallyAdmitted,false);
 assert.equal(r.historicalPublicByIndependentlyEstablished,false);
});
test('other account retweet can never be speaker-scoped as original personal words',()=>{
 const r=inspectPublicSocialStatementLead({...base,mirroredText:'RT @OtherAccount: Support this hypothetical bill'});
 assert.equal(r.recordIsRepost,true);
 assert.equal(r.potentiallyOwnAuthoredAccountPost,false);
 assert.equal(r.sourceStatus,'repost_of_other_speaker_not_candidate_own_words');
 assert.equal(r.originalIssueStatementAutomaticallyAdmitted,false);
});
test('Snowflake yields timestamp only, not authenticated authored text or pre-election source availability',()=>{
 assert.equal(decodeTwitterSnowflakeDate(fabricatedId),'2020-10-16T11:14:00.000Z');
 const originalStatusUrl='https://twitter.com/SyntheticMN/status/'+fabricatedId;
 const r=inspectPublicSocialStatementLead({...base,originalStatusUrl});
 assert.equal(r.sourceStatus,'original_post_id_only_source_body_not_proven');
 assert.equal(r.sourcePostIdValidatedAgainstAccountAndDisplayedDay,true);
 assert.equal(r.originalPlatformPostCreatedAtUtc,'2020-10-16T11:14:00.000Z');
 assert.equal(r.historicalPublicByIndependentlyEstablished,false);
 assert.equal(r.originalIssueStatementAutomaticallyAdmitted,false);
});
test('even independently matched later original body does not certify historical cutoff without capture proof',()=>{
 const r=inspectPublicSocialStatementLead({...base,
  originalStatusUrl:'https://x.com/SyntheticMN/status/'+fabricatedId,
  accountIdentityIndependentlyProven:true,
  originalPostWholeBodyIndependentlyVerified:true});
 assert.equal(r.sourceStatus,'original_post_identifier_and_source_body_needs_human_speech_review');
 assert.equal(r.originalPostBodyIndependentlyAuthenticated,true);
 assert.equal(r.historicalPublicByIndependentlyEstablished,false);
 assert.equal(r.originalIssueStatementAutomaticallyAdmitted,false);
});
test('reject incorrectly attributed handle, invalid post link, and mismatching displayed date',()=>{
 const valid='https://twitter.com/SyntheticMN/status/'+fabricatedId;
 assert.equal(inspectPublicSocialStatementLead({...base,
  originalStatusUrl:'https://twitter.com/WrongAccount/status/'+fabricatedId}).sourceStatus,
  'original_status_account_mismatch');
 assert.equal(inspectPublicSocialStatementLead({...base,
  originalStatusUrl:'https://fake.twitter.example/status/'+fabricatedId}).sourceStatus,
  'malformed_or_untrusted_original_post_url');
 assert.equal(inspectPublicSocialStatementLead({...base,
  displayedCalendarDay:'2021-03-09',originalStatusUrl:valid}).sourceStatus,
  'original_post_id_date_mismatch');
});
test('reject invalid civil date, personal account syntax, and malformed Snowflake',()=>{
 assert.throws(()=>inspectPublicSocialStatementLead({...base,displayedCalendarDay:'2020-02-31'}));
 assert.throws(()=>inspectPublicSocialStatementLead({...base,accountHandle:'candidate@example.com'}));
 assert.equal(decodeTwitterSnowflakeDate('123'),null);
 assert.equal(decodeTwitterSnowflakeDate('x'.repeat(19)),null);
});
test('later party classification, topic model or publisher summary never constitute candidate statement',()=>{
 const r=inspectPublicSocialStatementLead({...base,
  mirroredText:'Historical research mirror describes a statement about education policy.'});
 assert.equal(r.sourceStatus,'mirror_only_original_post_not_authenticated');
 assert.equal(r.legislatureVoteOrPositionAutomaticallyInferred,false);
 assert.equal(r.candidateOwnedCampaignWebsiteEvidence,false);
});
