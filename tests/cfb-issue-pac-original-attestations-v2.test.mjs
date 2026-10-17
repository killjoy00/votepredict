import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 attestCurrentPacSourcePairs,validatePacCandidates,literalBillMentionLeads
} from '../src/evidence/cfb-issue-pac-original-attestations-v2.mjs';
import {validAffiliation} from '../src/evidence/cfb-issue-financial-relationships-shadow.mjs';

const cfg=JSON.parse(readFileSync(
 'data/evidence/cfb-issue-pac-attestation-candidates-v2.json','utf8'));
const manifest=JSON.parse(readFileSync(
 'data/evidence/cfb-issue-finance-source-observation-manifest-v1.json','utf8')).sources;
const body=text=>'<!doctype html><html><body>'+
 'Synthetic test page content; never an original public finance filing.'+
 text+'</body></html>';
function snap(id,html,override={}){
 const ref=manifest.find(x=>x.id===id);
 assert.ok(ref);
 const bytes=Buffer.from(html);
 return {sourceId:ref.id,sourceRole:ref.role,
  organizationGroup:ref.organizationGroup,sourceUrl:ref.url,
  finalUrl:ref.url,rawHtmlBytes:bytes,
  htmlSha256:createHash('sha256').update(bytes).digest('hex'),
  observedAt:'2026-10-17T03:00:00Z',
  claimStatus:'unverified_raw_observation',
  historicalAsOfEligible:false,mechanicallyActionable:false,modelWeight:0,
  ...override};
}
const registry=snap('cfb-political-fund-registration-index',
 body('<p>Political Committee/Fund</p><p>MN Chamber of Commerce Leadership Fd - 70001</p>'+
 '<p>Education Minn PAC - 30558</p><p>MN AFL-CIO - 30025</p>'));
const chamber=snap('mn-chamber-leadership-fund-pac',
 body('The Minnesota Chamber Leadership Fund PAC endorses candidates. '+
 'Minnesota Chamber of Commerce political election programs.'));
const education=snap('education-minnesota-pac',
 body('The Education Minnesota Political Action Committee (PAC) is a group '+
 'of educators governing the union political program.'));
const afl=snap('mn-aflcio-first-party-news',
 body('Minnesota AFL-CIO news and legislative priorities; PAC relationship unproved.'));
const release=snap('education-mn-2026-hf2904-original-release',
 body('<h1>Educators call on Legislature to approve the proposal</h1>'+
 '<p>House File 2904 establishes an educator insurance pool.</p>'+
 '<p>Education Minnesota urged passage of HF 2904.</p>'+
 '<script>var unrelated="SF 9999";</script>'));
const scorecard=snap('mn-chamber-legislative-voting-record',
 body('<p>2023-24 voting record: SF 3852 Chamber opposed post-vote.</p>'));
const originals=[registry,chamber,education,afl,release,scorecard];
test('exactly three source-defined, non-arbitrary original PAC leads',()=>{
 assert.equal(manifest.length,9);
 const leads=validatePacCandidates(cfg);
 assert.equal(leads.length,3);
 assert.equal(leads.filter(x=>x.exactFirstPartyPacPhrase===null).length,1);
 assert.throws(()=>validatePacCandidates({...cfg,candidates:cfg.candidates.slice(0,2)}));
 assert.throws(()=>validatePacCandidates({...cfg,candidates:[
  cfg.candidates[0],cfg.candidates[0],cfg.candidates[2]]}));
});
test('two independently anchored original sources produce current-only affiliations',()=>{
 const attested=attestCurrentPacSourcePairs({
  snapshots:originals,manifest,config:cfg,cutoffOn:'2026-10-18'
 });
 assert.equal(attested.statuses.filter(
  x=>x.status==='current_dual_original_source_attested').length,2);
 assert.equal(attested.statuses.filter(
  x=>x.status==='held_no_explicit_first_party_pac_proof').length,1);
 assert.equal(attested.affiliations.length,2);
 for(const a of attested.affiliations){
  assert.equal(a.relationshipPublicByOn,'2026-10-17');
  assert.equal(a.affiliationEffectiveOn,'2026-10-17');
  assert.equal(a.relationshipOriginalProof,true);
  assert.equal(validAffiliation(a),true);
 }
 assert.equal(attested.modelWeight,0);
 assert.equal(attested.newHistoricalEligibility,0);
});
test('same-day or past replay never uses contemporary sources',()=>{
 for(const day of ['2023-12-01','2026-10-16','2026-10-17']){
  const a=attestCurrentPacSourcePairs({
   snapshots:originals,manifest,config:cfg,cutoffOn:day});
  assert.equal(a.affiliations.length,0);
 }
});
test('missing or corrupt original bytes, source role, CFB ID or PAC phrase all fail closed',()=>{
 for(const variant of [
  {...chamber,htmlSha256:'f'.repeat(64)},
  {...chamber,sourceRole:'retrospective_scorecard_index'},
  {...chamber,sourceUrl:'https://evil.example/story'},
  snap('mn-chamber-leadership-fund-pac',body('No PAC identity attested')),
  snap('mn-chamber-leadership-fund-pac',body(
   '<script>Minnesota Chamber Leadership Fund PAC</script> unrelated prose'))
 ]){
  const a=attestCurrentPacSourcePairs({
   snapshots:[registry,variant,education,afl],manifest,config:cfg,
   cutoffOn:'2026-10-19'});
  assert.equal(a.affiliations.length,1);
  assert.equal(a.affiliations[0].contributorRegistrationNumber,'30558');
 }
 const registryTampered=snap('cfb-political-fund-registration-index',
  body('MN Chamber of Commerce Leadership Fd - 77777 '+
   'Education Minn PAC - 30558'));
 const a=attestCurrentPacSourcePairs({
  snapshots:[registryTampered,chamber,education],manifest,config:cfg,
  cutoffOn:'2026-10-19'});
 assert.equal(a.affiliations.length,1);
 assert.equal(a.affiliations[0].contributorRegistrationNumber,'30558');
});
test('separate nearby ID alone cannot certify an original CFB registration',()=>{
 const registryWithoutAdjacent=snap('cfb-political-fund-registration-index',
  body('MN Chamber of Commerce Leadership Fd</p><div>Unrelated entity</div>'+
   '<div>70001</div><p>Education Minn PAC - 30558'));
 const a=attestCurrentPacSourcePairs({
  snapshots:[registryWithoutAdjacent,chamber,education],
  manifest,config:cfg,cutoffOn:'2026-10-19'});
 assert.equal(a.affiliations.length,1);
});
test('publisher literal HF2904 mention is a neutral lead, not inferred support',()=>{
 const a=literalBillMentionLeads(originals,manifest);
 assert.deepEqual(a.map(x=>x.billIdentifier),['HF2904']);
 assert.equal(a[0].groupVotePosition,null);
 assert.equal(a[0].classification,'literal_bill_mention_only');
 assert.equal(a[0].historicalAsOfEligible,false);
 assert.equal(a[0].modelWeight,0);
});
test('unsafe historical source capture may not supply present-day attestation',()=>{
 const old={...chamber,observedAt:'2023-02-01T00:00:00Z'};
 const a=attestCurrentPacSourcePairs({
  snapshots:[registry,old,education],manifest,config:cfg,
  cutoffOn:'2026-10-19'});
 assert.equal(a.affiliations.length,1);
});

test('production summary contains aggregate-only donor overlaps and zero stance inference',async()=>{
 const {safePacAttestationSummary}=await import(
  '../scripts/audit-cfb-pac-original-attestations-readonly.mjs');
 const a={
  statuses:[
   {registration:'70001',status:'current_dual_original_source_attested'},
   {registration:'30558',status:'current_dual_original_source_attested'},
   {registration:'30025',status:'held_no_explicit_first_party_pac_proof'}
  ],
  affiliations:[{registration:'70001'},{registration:'30558'}]
 };
 const m=[{billIdentifier:'HF2904'},{billIdentifier:'HF2904'}];
 const rows=[{reg:'70001',distinct_rows:12},{reg:'30558',distinct_rows:19},
  {reg:'30025',distinct_rows:5}];
 const s=safePacAttestationSummary(a,m,rows,9);
 assert.equal(s.sourceAnchoredCurrentPacIdentities,2);
 assert.equal(s.currentAsOfDateOnlyEligibleRegisteredEntities,2);
 assert.equal(s.historicalSenateContributionRowsBySourceAttestedContemporaryEntities,31);
 assert.equal(s.historicalSenateContributionRowsByHeldIdentityEntity,5);
 assert.equal(s.distinctLiteralBillNumbersInOriginalFirstPartyIssuePublications,1);
 assert.equal(s.literalBillMentionsCertifiedAsPublisherVoteStances,0);
 assert.equal(s.historicalPreVotePublisherPositionsCertified,0);
 assert.equal(s.servingChanged,false);
 assert.ok(!JSON.stringify(s).includes('70001'));
 assert.ok(!JSON.stringify(s).includes('30558'));
 assert.ok(!JSON.stringify(s).includes('2904'));
 assert.ok(!JSON.stringify(s).includes('original HTML'));
});
