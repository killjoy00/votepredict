import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {validateCfbIssueSourceManifest}
 from '../src/evidence/cfb-issue-source-observation-v1.mjs';
import {validateCfbIssueDiscoveryPolicy,discoverCfbIssueFirstPartyPages}
 from '../src/evidence/cfb-issue-first-party-discovery-v3.mjs';
import {literalBillMentionLeads}
 from '../src/evidence/cfb-issue-pac-original-attestations-v2.mjs';

const manifest=validateCfbIssueSourceManifest(JSON.parse(readFileSync(
 'data/evidence/cfb-issue-finance-source-observation-manifest-v1.json','utf8')));
const policy=JSON.parse(readFileSync(
 'data/evidence/cfb-issue-first-party-discovery-v3.json','utf8'));
const idx='https://educationminnesota.org/news/media-resources/';
const base='/news/press-release/';
function snapshot(body){
 const rawHtmlBytes=Buffer.from('<!doctype html><html><body>'+
  '<p>Publisher news archive with pinned first-party provenance.</p>'+
  body+'</body></html>');
 return {
  sourceId:'education-mn-media-releases-index',
  sourceUrl:idx,finalUrl:idx,
  sourceRole:'first_party_historical_context',
  organizationGroup:'Education Minnesota',
  rawHtmlBytes,
  htmlSha256:createHash('sha256').update(rawHtmlBytes).digest('hex'),
  observedAt:'2026-10-18T09:01:13Z',
  claimStatus:'unverified_raw_observation',
  historicalAsOfEligible:false,mechanicallyActionable:false,modelWeight:0
 };
}
function discover(s,override={}){
 return discoverCfbIssueFirstPartyPages({
  indexSnapshots:[s],manifest,policy,...override
 });
}
test('only the explicitly pinned Education Minnesota first-party archive can discover',()=>{
 const conf=validateCfbIssueDiscoveryPolicy(policy,manifest);
 assert.equal(conf.maxArticlesPerRun,8);
 assert.throws(()=>validateCfbIssueDiscoveryPolicy({
  ...policy,discoverySources:[{...policy.discoverySources[0],
   indexUrl:'https://attacker.example/news'}]
 },manifest),/Unreviewed/);
 assert.throws(()=>validateCfbIssueDiscoveryPolicy({
  ...policy,discoverySources:[{...policy.discoverySources[0],
   maxArticlesPerRun:500}]
 },manifest),/Unreviewed/);
});
test('literal current release links only; strip comments, scripts and cross-origin links',()=>{
 const p=base+'school-employees-demand-hearing/';
 const other=base+'education-finance-goals/';
 const html=[
  '<script>const fake=\'<a href="/news/press-release/evil-script/">bad</a>\'</script>',
  '<!-- <a href="/news/press-release/hidden-comment/">no</a> -->',
  '<a href="'+p+'">Publisher release</a>',
  '<a href="https://educationminnesota.org'+p+'">duplicate</a>',
  '<a href="'+other+'">Second</a>',
  '<a href="https://evil.example'+base+'unsafe/">No</a>',
  '<a href="https://educationminnesota.org.evil.example'+base+'bad/">No</a>',
  '<a href="https://educationminnesota.org'+base+'search/?page=1">No</a>',
  '<a href="https://educationminnesota.org'+base+'hidden/#fragment">No</a>',
  '<a href="https://educationminnesota.org'+base+'encoded%2fpath/">No</a>',
  '<a href="http://educationminnesota.org'+base+'http/">No</a>',
  '<a href="https://educationminnesota.org/advocacy/edmnvotes/">No</a>',
  '<a data-href="'+base+'fake-attribute/">Ignore</a>'
 ].join('');
 const pages=discover(snapshot(html));
 assert.deepEqual(pages.map(x=>x.url),[
  'https://educationminnesota.org'+p,
  'https://educationminnesota.org'+other
 ]);
 assert.ok(pages.every(x=>x.role==='first_party_issue_publication'));
 assert.ok(pages.every(x=>x.id.startsWith('education-mn-release-')));
 assert.equal(new Set(pages.map(x=>x.id)).size,2);
});
test('bounded to first eight archive entries with stable URL identities',()=>{
 const links=Array.from({length:25},(_,i)=>
  '<a href="'+base+'released-item-'+(i+1)+'/">release</a>').join('');
 const p=discover(snapshot(links));
 assert.equal(p.length,8);
 assert.deepEqual(p,discover(snapshot(links)));
 assert.notDeepEqual(p,discover(snapshot(links.replace('released-item-1',
  'updated-item-1'))));
});
test('hold invalid original/hash/group/role, do not use old or forged index',()=>{
 const s=snapshot('<a href="'+base+'valid-press-release/">Release</a>');
 assert.throws(()=>discover({...s,htmlSha256:'0'.repeat(64)}),
  /Unsafe original/);
 assert.throws(()=>discover({...s,organizationGroup:'Minnesota AFL-CIO'}),
  /Unsafe original/);
 assert.throws(()=>discover({...s,sourceRole:'first_party_issue_publication'}),
  /Unsafe original/);
 assert.throws(()=>discover(s,{indexSnapshots:[s,s]}),/Unsafe original/);
 assert.deepEqual(discover(s,{indexSnapshots:[]}),[]);
});
test('source discovery supplies RAW observation candidates, never classified positions',()=>{
 const s=snapshot('<a href="'+base+'what-we-are-working-on/">New</a>');
 const p=discover(s)[0];
 assert.deepEqual(Object.keys(p).sort(),['id','organizationGroup','role','url']);
 assert.equal(p.organizationGroup,'Education Minnesota');
 assert.ok(!JSON.stringify(p).includes('support'));
 assert.ok(!JSON.stringify(p).includes('historicalAsOfEligible'));
});

test('discovered original may generate neutral HF/SF tokens, never a stance',()=>{
 const discovered=discover(snapshot(
  '<a href="/news/press-release/educator-insurance-hearing/">Release</a>'))[0];
 const original=snapshot('Publisher mentioned S.F. 2909 / H.F. 2904 in a bill discussion.');
 const linked={
  ...original,sourceId:discovered.id,sourceUrl:discovered.url,
  finalUrl:discovered.url,sourceRole:'first_party_issue_publication'
 };
 const leads=literalBillMentionLeads([linked],[...manifest,discovered]);
 assert.deepEqual(leads.map(x=>x.billIdentifier),['SF2909','HF2904']);
 assert.ok(leads.every(x=>x.groupVotePosition===null));
 assert.ok(leads.every(x=>x.historicalAsOfEligible===false));
 assert.ok(leads.every(x=>x.modelWeight===0));
});
