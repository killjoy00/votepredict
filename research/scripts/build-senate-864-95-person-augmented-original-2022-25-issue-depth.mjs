/**
 * Audit #864: annotate the original 95-person 1194-excerpt candidate site census
 * with independently SHA1/CDX-certified 2022-25 same-election original source
 * addendum, without contaminating candidate-owned figures with publishers.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const args=process.argv.slice(2);
function a(key){const i=args.indexOf(key);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing '+key);return resolve(args[i+1]);}
const orig=JSON.parse(readFileSync(a('--baseline-matrix-json'),'utf8'));
const audit=JSON.parse(readFileSync(a('--verified-103-audit-json'),'utf8'));
const add=JSON.parse(readFileSync(resolve('data/evaluation/senate-864-three-sparse-candidate-2022-25-original-site-policy-expansion-v1.json'),'utf8'));
const receipts=JSON.parse(readFileSync(resolve('data/evaluation/senate-864-new-2022-25-deep-original-source-receipts-v1.json'),'utf8'));
assert.equal(orig.summary.actuallyServedSenators,95);
assert.equal(orig.summary.historicalSelectedCampaignSiteExcerptRows,1194);
assert.equal(orig.summary.coveredWithAtLeastOneAuthenticatedHistoricalCandidateSiteExcerpt,92);
assert.equal(audit.exactSpeakerScopedFragmentsAuthenticated,103);
assert.equal(audit.candidateOwnedNewExactFragments,78);
assert.equal(audit.publisherAndCaucusNewExactFragments,25);
assert.equal(audit.authenticatedHistoricalOriginalSourcePages,12);
assert.equal(add.exactCandidateOwnedResearchFragments.length,78);
assert.equal(receipts.pages.length,12);
const page=new Map(receipts.pages.map(p=>[p.id,p]));
function family(s){
 const t=s.toLowerCase();
 if(/education|teacher|school|childcare|student|higher|tuition|special_education|school_hunger|parental_leave/.test(t))return 'education_childcare';
 if(/abortion|reproductive|contraception|maternal|fertility_treatment|sex_education/.test(t))return 'reproductive_rights';
 if(/healthcare|health|substance_use|overdose|harm_reduction|universal_healthcare/.test(t))return 'healthcare';
 if(/housing|eviction|homeownership|homeless/.test(t))return 'housing';
 if(/climate|environment|mining|decarbonization/.test(t))return 'climate_environment_energy';
 if(/polic|gun|firearm|cash_bail|traffic_enforcement|safety/.test(t))return 'public_safety_justice';
 if(/election|democracy|democra|voting|redistrict|ballots|campaign_finance|registration|gerrymandering|voter/.test(t))return 'elections_government';
 if(/worker|wages|economy|inflation|corporate|labor|business|jobs|care_worker/.test(t))return 'jobs_labor_economy';
 if(/transport|highway|transit|infrastructure/.test(t))return 'transport_infrastructure';
 if(/veteran/.test(t))return 'veterans_defense';
 if(/civil|intersex|immigra|disability|privacy|equal_rights|transgender/.test(t))return 'civil_rights_equity';
 if(/tax/.test(t))return 'taxes_budget';
 return 'other_tagged_issue';
}
const byPerson=new Map();
for(const r of add.exactCandidateOwnedResearchFragments){
 const p=page.get(r.pageId);assert.ok(p&&p.category==='owned');
 if(!byPerson.has(p.officialName))byPerson.set(p.officialName,[]);
 byPerson.get(p.officialName).push({family:r.issueFamily,broader:family(r.issueFamily),pageId:p.id,
  capturedUtc:p.capturedUtc,sourceElection:p.id==='clark25'?'2025-01-28':'2022-11-08',
  sourceCurrentVersionNotUsed:true});
}
assert.equal([...byPerson.values()].reduce((a,x)=>a+x.length,0),78);
const all=orig.byActuallyServedSenator.map(old=>{
 const addenda=byPerson.get(old.officialName)||[];
 const allAreas=[...new Set([...old.broadIssueAreas,...addenda.map(x=>x.broader)])].sort();
 return {...old,baselinePreviouslySelectedCandidateSiteResearchRows:old.campaignSiteResearchExcerpts,
  newActuallyVerifiedContemporaneousCandidateSiteResearchRows:addenda.length,
  campaignSiteResearchExcerptsAfterAddendum:old.campaignSiteResearchExcerpts+addenda.length,
  combinedDistinctExplicitResearchIssueFamilies:[...new Set([...old.issueTags,...addenda.map(x=>x.family)])].sort(),
  broadIssueAreasAfterAddendum:allAreas,broadIssueAreaCountAfterAddendum:allAreas.length,
  newlyVerifiedOriginalSiteSpecificIssueContexts:addenda,
  contemporaneousCaptureIsNotFirstPublicationDate:true,forecastsOrVoteStancesNotInferred:true};
}).sort((x,y)=>x.campaignSiteResearchExcerptsAfterAddendum-y.campaignSiteResearchExcerptsAfterAddendum||
 x.broadIssueAreaCountAfterAddendum-y.broadIssueAreaCountAfterAddendum||x.officialName.localeCompare(y.officialName));
assert.equal(all.length,95);
assert.equal(all.reduce((s,m)=>s+m.campaignSiteResearchExcerptsAfterAddendum,0),1272);
assert.equal(all.filter(x=>x.campaignSiteResearchExcerptsAfterAddendum>0).length,92);
assert.equal(all.filter(x=>x.campaignSiteResearchExcerptsAfterAddendum<=5).length,12);
const summary={actualServingSenators:95,authenticatedOriginalSitePeople:92,
 previousSiteResearchFragments:1194,siteAddendumShortFragments:78,
 totalSelectedAuthenticatedCandidateSiteResearchFragments:1272,
 separatePublisherOrCaucusNewDirectShortResearchFragments:25,
 weakerFiveOrFewerAfterAddendum:12,
 originallyFiveOrFewerBeforeAddendum:15,distinctAuthenticated2022_25OriginalSourcePages:12,
 historicalWebsiteGaps:["Sr., Charles W. Wiger","David J. Tomassoni","Thomas M. Bakk"],
 noAutomaticVoteForecasts:true,noNewOriginalSitePeople:true,productionReadsWrites:0};
const result={schema:'senate-864-95-person-2022-25-augmented-source-authenticated-issue-depth-v1',
 originalBaselineSchema:orig.schema,sourceAuditSchema:audit.schema,issue:864,
 summary,provenanceCaveats:[
 'This is a 95-person candidate-site *selected short excerpt* matrix, not exhaustive same-election programs.',
 'The 25 new publisher hosted direct candidate statements are excluded from 1272 candidate site denominator.',
 'The newly verified 2025 Doron priorities were publicly captured January 16, after January 14 primary and before January 28 special general.',
 'A candidate statement about authoring or passing a bill is not an official verified roll call or vote.',
 'Historical archive capture is latest-known observation, not guaranteed date of original authorship.',
 'The three 2020 senators with no authenticated historical owned campaign site must remain UNKNOWN.'
 ],byActuallyServedSenator:all};
const out=a('--out-dir');mkdirSync(out,{recursive:true});
writeFileSync(join(out,'senate-864-95-person-augmented-issue-depth.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
const lines=['# Minnesota Senate 2021–25: 95-person historical issue depth including verified original 2022–25 addendum',
 '', '**95** serving senators, **92** with any authenticated historic candidate-owned website evidence.',
 'Original separately audited baseline: **1,194** short original-site fragments. New independently SHA1/CDX verified first-party addendum: **78**. Combined: **1,272** selected site research fragments.',
 '**25** additional direct original candidate responses from third-party publisher interviews and caucus sources remain **separate**.',
 'Website records with five or fewer selected fragments fell from **15** to **12**. This does not establish exhaustive issue coverage or same-election authorship dates.',
 '', '| Actually-serving senator | Prior selected site excerpts | New original site excerpts | Total selected | Broad tagged issue areas (including addendum) |',
 '| --- | ---: | ---: | ---: | --- |',
 ...all.map(p=>'| '+p.officialName+' | '+p.baselinePreviouslySelectedCandidateSiteResearchRows+' | '+p.newActuallyVerifiedContemporaneousCandidateSiteResearchRows+
  ' | '+p.campaignSiteResearchExcerptsAfterAddendum+' | '+(p.broadIssueAreasAfterAddendum.join(', ')||'not observed')+' |'),
 '', 'No automatic political positions, certainty, first-authorship date, roll-call votes or predictions may be inferred.'];
writeFileSync(join(out,'senate-864-95-person-augmented-issue-depth.md'),lines.join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify({summary,addendaByPerson:Object.fromEntries([...byPerson].map(([k,v])=>[k,v.length]))},null,2));
