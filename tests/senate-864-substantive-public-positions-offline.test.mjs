import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {ISSUES,verifyCurrentLeadManifest,buildConservativeSenatorYearIssueMatrix}
 from '../scripts/audit-senate-864-substantive-public-positions-offline.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const sample=JSON.parse(readFileSync(join(here,'../data/evaluation/senate-864-substantive-firstparty-current-original-leads-v1.json'),'utf8'));
const clone=x=>structuredClone(x);
const officialPeople=[...new Set(sample.leads.map(l=>l.officialSenatorName))];
function fake95(){
 const names=[...officialPeople,...Array.from({length:95-officialPeople.length},(_,i)=>'Synthetic Senator '+String(i).padStart(3,'0'))];
 const rows=names.map((name,i)=>({officialName:name,yearsActuallyServed:[2021,2022,2023,2024,2025],
  selectedCandidateOwnedOriginalSiteExcerptsThroughCurrentRound:i<92?(i===0?1194:1):0,
  broaderIssueAreasThroughCurrentRound:[]}));
 return {summary:{actualServingSenators:95,peopleWithAnyAuthenticatedOriginalSiteExcerpt:92,
  combinedSelectedOriginalCandidateOwnedSiteResearchExcerpts:1285,
  governmentDirectorySha256:'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'},
  byActuallyServedSenator:rows};
}
const change=fn=>{const m=clone(sample);fn(m);return m};
const count=(c,year,issue)=>c.byActuallyServedSenator.find(x=>x.officialName==='Michael E. Kreun').serviceYears.find(y=>y.year===year).issueCells[issue];

test('current speaker leads validated, but NO original historical source certified by this increment',()=>{
 const r=verifyCurrentLeadManifest(sample);
 assert.equal(r.researchLeadRows,9);
 assert.equal(r.distinctUnderlyingStatements,8);
 assert.equal(r.historicalOriginalsNewlyAuthenticated,0);
 assert.equal(r.predictionUsableRows,0);
});
test('95 actual senators and 1285 selected campaign excerpts reconciled, 15 issue families',()=>{
 const r=buildConservativeSenatorYearIssueMatrix(fake95(),sample);
 assert.equal(r.totals.serviceYearIssueCells,95*5*ISSUES.length);
 assert.equal(r.totals.siteExcerptsSelected,1285);
 assert.equal(r.byActuallyServedSenator.length,95);
 const same=count(r,2023,'transport_infrastructure');
 assert.equal(same.leadIds.length,2);
 assert.equal(same.anyAuthenticHistoricalPublicByProvenInThisIncrement,false);
 assert.equal(same.status,'dated_first_party_named_quote_lead_ARCHIVE_UNKNOWN');
 const other=count(r,2022,'transport_infrastructure');
 assert.equal(other.status,'not_systematically_searched_in_this_increment');
 assert.equal(other.noEvidenceFoundNeverInferred,true);
});
test('reject non-roster person',()=>{
 const c=fake95();c.byActuallyServedSenator[0].officialName='Unknown';
 assert.throws(()=>buildConservativeSenatorYearIssueMatrix(c,sample),/not an actual official serving senator/);
});
test('never project same quoted source into another office/year',()=>{
 const c=fake95();c.byActuallyServedSenator.find(x=>x.officialName==='Michael E. Kreun').yearsActuallyServed=[2025];
 assert.throws(()=>buildConservativeSenatorYearIssueMatrix(c,sample),/Do not project/);
});
test('reject drift in original site total and government SHA',()=>{
 const c=fake95();c.byActuallyServedSenator[0].selectedCandidateOwnedOriginalSiteExcerptsThroughCurrentRound++;
 assert.throws(()=>buildConservativeSenatorYearIssueMatrix(c,sample),/1285/);
 const d=fake95();d.summary.governmentDirectorySha256='0'.repeat(64);
 assert.throws(()=>buildConservativeSenatorYearIssueMatrix(d,sample));
});
test('reject fabricated first-public historical date and archival authentication',()=>{
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads[0].historicalPublicByUtc='2023-01-11T00:00:00Z')));
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads[0].historicalOriginalAuthentication='SOURCE_PROVEN')));
});
test('reject fabricated original SHA-256, indexed SHA-1 or backtest eligibility',()=>{
 for(const [key,value] of [['historicalOriginalRawSha256','a'.repeat(64)],['historicalCdxIndexedSha1Base32','A'.repeat(32)],['automaticallyHistoricallyEligible',true]]){
   assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads[0][key]=value)),key);
 }
});
test('contextual mention is NOT senator quote',()=>{
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads[0].attribution='contextual_mention')));
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads[0].exactCurrentlyVisibleShortQuote=null)));
});
test('same underlying quote referenced by two related Senate bills never double-counted',()=>{
 assert.equal(sample.leads.find(x=>x.id==='lead-2023-kreun-sf862').exactCurrentlyVisibleShortQuote,null);
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads.find(y=>y.id==='lead-2023-kreun-sf862').exactCurrentlyVisibleShortQuote='Repeat same quote')));
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads.find(y=>y.id==='lead-2023-kreun-sf862').underlyingStatementId='lead-2023-weber-pro-act')));
});
test('reject historical display-date/year mismatch and post-vote retroactive interpretation',()=>{
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads[0].publisherDisplayedDay='2022-01-11')));
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads[0].retrospectiveRelativeToThatDecision=false)));
});
test('reject wrong legislative chamber or invalid bill identifier',()=>{
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads[2].bills=['HR551'])));
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads[2].bills=['SF0'])));
});
test('reject HTTP, untrusted mirror and synthetic tracking URLs',()=>{
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads[1].originalPublisherUrl='http://senatedfl.mn/foo')));
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads[1].originalPublisherUrl='https://senatedfl.mn.evil.test/foo')));
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads[1].originalPublisherUrl+='?fake=1')));
});
test('reject duplicate IDs, long copied quotes and production behavior modifications',()=>{
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads[1].id=x.leads[0].id)));
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads[1].exactCurrentlyVisibleShortQuote='A'.repeat(241))));
 assert.throws(()=>verifyCurrentLeadManifest(change(x=>x.leads[2].productionChangeAuthorized=true)));
});
test('unsearched issues never imply absence of views or publications',()=>{
 const r=buildConservativeSenatorYearIssueMatrix(fake95(),sample);
 const row=r.byActuallyServedSenator.find(x=>x.officialName==='Synthetic Senator 010');
 for(const yr of row.serviceYears) for(const c of Object.values(yr.issueCells)){
  assert.equal(c.status,'not_systematically_searched_in_this_increment');
  assert.equal(c.noEvidenceFoundNeverInferred,true);
 }
});
