/**
 * #864 read-only issue-coverage MATRIX, not an issue position/prediction classifier.
 * Reconcile every original-candidate-site research row against the separately
 * source-authenticated 95-person government-roster coverage report.
 * Issue categories are derived exclusively from existing ledger ISSUE TAGS,
 * never inferred from a person's vote, a source quote, or silence.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2);
function flag(name){const i=args.indexOf(name);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing '+name);return resolve(args[i+1]);}
const inFile=flag('--coverage-json'),out=flag('--out-dir');
const coverage=JSON.parse(readFileSync(inFile,'utf8'));
assert.equal(coverage.summary.actualServingStateSenators,95);
assert.equal(coverage.summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt,92);
assert.equal(coverage.summary.totalExactResearchExcerptRowsForVerifiedSenators,1194);
assert.equal(coverage.summary.sourceOriginalGovernmentSHA256,'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51');
assert.equal(coverage.byActuallyServedSenator.length,95);
const aliases=new Map([['jen mcewen','jennifer mcewen'],['rob kupec','robert kupec'],['ron latz','ronald latz'],['sandy pappas','sandra pappas'],['scott dibble','d dibble'],['tom bakk','thomas bakk']]);
const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const fl=s=>{const w=norm(s).split(' ');return w[0]+' '+w.at(-1);};
const byShort=new Map();
const members=coverage.byActuallyServedSenator.map(p=>{
 const key=fl(p.officialName);assert.ok(!byShort.has(key));byShort.set(key,p.officialName);
 return {...p,issueLabels:new Set(),issueAreas:new Set(),sourceContext:new Set(),archiveYears:new Set(),siteRowRecencyContexts:[],issueTaggedResearchRows:0,untaggedResearchRows:0,reconciledResearchRows:0};
});
const byPerson=new Map(members.map(m=>[m.officialName,m]));
const leds=[...new Set(members.flatMap(m=>m.ledgersWithFirstPartyOriginalIssueExcerpts))].sort();
assert.equal(leds.length,29,'Expected original 29 separately audited campaign-site ledgers');
const sourceKinds=new Map();
let totalRecords=0,excluded=[];
const singlePerson={
 'senate-carla-nelson-2022-dated-original-platform-excerpts-v1.json':'Carla Nelson',
 'senate-kent-eken-2020-original-13-capture-dated-platform-excerpts-v1.json':'Kent Eken',
 'senate-nick-frentz-2022-podcast-site-26-original-capture-dated-policy-excerpts-v1.json':'Nick Frentz',
 'senate-nicole-mitchell-2022-original-priorities-excerpts-v1.json':'Nicole Mitchell',
 'senate-bill-ingebrigtsen-27-exact-historical-first-party-issues-2010-2012-v1.json':'Bill Ingebrigtsen',
 'senate-justin-eichorn-2016-original-12-capture-dated-exact-issues-v1.json':'Justin Eichorn',
 'senate-roger-chamberlain-2016-original-10-economic-issue-excerpts-and-domain-review-v1.json':'Roger Chamberlain'
};
const arrays=['excerpts','statements','shortIssues','exactVisibleCandidatePolicyExcerpts',
 'exactOriginalCandidateSiteIssueExcerpts','exactCandidateCampaignPolicyExcerpts',
 'exactOriginalShortExcerpts','exactCandidateOriginalPlatformShortExcerpts',
 'exactSourceCandidateIssueExcerpts','rows','candidateOriginalLiteralResearchStatements',
 'exactCandidateOwnedHistoricPolicyExcerpts','shortExactCandidateOwnedExcerpts',
 'exactShortCandidateIssueExcerpts','exactCandidateSiteShortPolicyExcerpts',
 'exactCandidateOriginalPlatformShortExcerpts','exactVisibleCandidatePolicyExcerpts',
 'exactOriginalShortExcerpts','exactCandidateSiteShortPolicyExcerpts',
 'exactCandidateOwnedOriginalHTMLExcerpts','exactCandidateOwnedOriginalSiteExcerpts',
 'exactCandidateOriginalIssueExcerpts','exactCandidateSiteExactStatements',
 'tenCandidateSiteExactStatements','exactCandidateSiteShortPolicyExcerpts',
 'exactShortCandidateIssueExcerpts','exactAttributablePolicyExcerpts',
 'exactCandidateCampaignPolicyExcerpts','exactOriginalCandidateSiteIssueExcerpts',
 'exactOriginalShortExcerpts','candidateOriginalLiteralResearchStatements',
 'exactCandidateSiteShortPolicyExcerpts','exactVisibleCandidatePolicyExcerpts',
 'exactCandidateOwnedHistoricPolicyExcerpts','exactCandidateSiteShortPolicyExcerpts',
 'exactCandidateOriginalPlatformShortExcerpts','exactSourceCandidateIssueExcerpts',
 'exactCandidateSiteShortPolicyExcerpts','exactOriginalCandidateSiteIssueExcerpts',
 'exactCandidateSiteExactStatements','exactCandidateOriginalPlatformShortExcerpts',
 'exactCandidateSiteShortPolicyExcerpts','candidateOriginalLiteralResearchStatements',
 'exactCandidateCampaignPolicyExcerpts','exactOriginalShortExcerpts',
 'exactCandidateSiteShortPolicyExcerpts','exactCandidateOwnedHistoricPolicyExcerpts',
 'exactCandidateSiteShortPolicyExcerpts','exactOriginalCandidateSiteIssueExcerpts',
 'exactCandidateSiteShortPolicyExcerpts','exactCandidateSiteShortPolicyExcerpts',
 'exactCandidateSiteShortPolicyExcerpts','exactCandidateSiteShortPolicyExcerpts',
 'exactCandidateSiteShortPolicyExcerpts','exactCandidateSiteShortPolicyExcerpts'];
const pageArrays=['pages','policyPages','policySections','sourcePages','sourceSections','originalCandidateIssueSourcePages',
 'candidatePolicyPageSections','candidateOwnedOriginalIssueSourceSections','selectedOriginalCandidatePolicySections',
 'selectedOriginalCandidateIssueSections','selectedCandidateIssuesPages','selectedCandidatePolicySections','originals',
 'verifiedOriginals','originalFullPageSourceReceipts','originalFullHTMLReceipts','originalAuthenticatedPageReceipts'];
function area(s){
 const x=norm(s);
 if(!x||x==='unknown')return 'untagged';
 if(/abortion|reproduc|birth control|family planning/.test(x))return 'reproductive_rights';
 if(/health|medical|insurance|medicaid|prescription|pharma|nursing|mental/.test(x))return 'healthcare';
 if(/education|school|teacher|literacy|college|university|student|tuition|childcare|early childhood/.test(x))return 'education_childcare';
 if(/housing|homeless|rent|landlord|zoning/.test(x))return 'housing';
 if(/tax|revenue|budget|spend|fiscal|inflation|debt|social security|government finance/.test(x))return 'taxes_budget';
 if(/employment|labor|worker|union|wage|econom|jobs|business|workforce|development/.test(x))return 'jobs_labor_economy';
 if(/polic|crime|safety|gun|firearm|justice|courts|law enforcement|security/.test(x))return 'public_safety_justice';
 if(/climate|energy|environ|mining|pipeline|conservation|water|forest|pollution|natural resource/.test(x))return 'climate_environment_energy';
 if(/agricult|rural|farm|food|biofuel/.test(x))return 'agriculture_rural';
 if(/transport|roads|transit|highway|infrastructure|broadband/.test(x))return 'transport_infrastructure';
 if(/election|voting|campaign finance|democra|transparen|governance|government|redistrict|constitution/.test(x))return 'elections_government';
 if(/veteran|military|defense/.test(x))return 'veterans_defense';
 if(/immigra|race|equity|civil right|lgbt|human right|discrimin/.test(x))return 'civil_rights_equity';
 return 'other_tagged_issue';
}
function date(s){if(!s)return null;const m=String(s).match(/\b(19[0-9]{2}|20[0-9]{2})[-/][0-9]{2}[-/][0-9]{2}/);return m?m[1]:null;}
function context(page,row,filename){
 const keys=['historicalPageAttribution','pageKind','siteChronologyLabel','historicalCampaignContext','originalCampaignScope','sourceOffice','historicSourceOffice',
 'originalSourceElectionContext','electionSourceCycle','campaignCycleContext','sourceKind','historicalClass','context','candidateCampaignScope','sourceStatementCharacter','attributionClass'];
 const details=keys.map(k=>page?.[k]??row[k]??'').filter(Boolean).join(' ').toLowerCase();
 const observed=page?.archiveCaptureUtc||page?.archiveCaptureUTC||page?.archivePublicByUTC||page?.archivePublicByUtc||page?.originalArchiveCaptureUtc||
 page?.archiveCapturedAtUtc||page?.captureUtc||page?.capturedAtUtc||page?.historicOriginalArchivedUTC||page?.originalCampaignSiteCaptureAtUtc||
 page?.attributablePublicByUtc||page?.observedUTC||page?.archiveCapturedUTC||row.attributablePublicByUtc||row.sourceFirstAttestedPublicByNoLaterThanUtc||null;
 const yr=date(observed);
 if(/2004|2007|2008|2009|2010|2012|2013|2014|2016|2018|older|legacy|pre.redistrict|retained|stale|house|congress|school.board|secretary.of.state/.test(details)||
  (!yr&&/2004|2008|2010|2012|2013|2016/.test(filename)))return ['older_or_different_office_copy',yr];
 if(yr&&Number(yr)<2019)return ['older_archive_prior_to_2020',yr];
 if((yr==='2020'||yr==='2022'||yr==='2025')&&/senate|candidate|campaign/.test(details))return ['in_cycle_archived_candidate_site_not_authored_date_certified',yr];
 return ['source_cycle_unresolved',yr];
}
for(const filename of leds){
 assert.match(filename,/^data\/evaluation\/senate-[a-z0-9-]+\.json$/);
 const d=JSON.parse(readFileSync(resolve(filename),'utf8')),n=basename(filename);
 const pageMap=new Map();
 for(const k of pageArrays)if(Array.isArray(d[k])){
  for(const p of d[k])if(p&&typeof p==='object'&&typeof p.id==='string')pageMap.set(p.id,p);
 }
 let rows=[];
 if(n==='senate-authenticated-campaign-issue-excerpt-leads-2024-25-v1.json'){
  rows=d.candidates.flatMap(c=>c.excerpts.map(q=>({...q,_candidate:c.candidateName,_page:c})));
 }else{
  const found=[...new Set(arrays)].filter(k=>Array.isArray(d[k])&&d[k].length&&d[k][0]&&typeof d[k][0]==='object');
  assert.equal(found.length,1,'Ambiguous or unknown excerpt key '+n+': '+found.join(','));
  rows=d[found[0]];
 }
 sourceKinds.set(filename,rows.length);
 for(const row of rows){
  totalRecords++;
  const pageKey=row.pageId??row.sourcePageId??row.page??row.originalPageSectionId??row.section??row.sourceSection??row.part;
  const page=pageMap.get(String(pageKey))||row._page||null;
  const person=row.senator||row.servingSenator||row.person||row.attributedTo||row.candidateName||row._candidate||
    page?.senator||page?.person||singlePerson[n];
  assert.ok(person,'No attributable senator '+n+' '+JSON.stringify(row).slice(0,150));
  const key=fl(person),member=byPerson.get(byShort.get(aliases.get(key)||key));
  if(!member){excluded.push({name:String(person),source:n});continue;}
  member.reconciledResearchRows++;
  const tag=row.issueFamily??row.issue??row.family??row.policyArea??row.topic??row.category??row.keyIssue??null;
  if(typeof tag==='string'&&tag.trim()){
   member.issueLabels.add(norm(tag));member.issueAreas.add(area(tag));member.issueTaggedResearchRows++;
  }else member.untaggedResearchRows++;
  const [quality,year]=context(page,row,n);
  member.sourceContext.add(quality);
  if(year)member.archiveYears.add(year);
  if(!member.siteRowRecencyContexts.some(x=>x.file===n&&x.quality===quality))member.siteRowRecencyContexts.push({file:n,quality,observedArchiveYear:year});
 }
}
const result=members.map(m=>{
 assert.equal(m.reconciledResearchRows,m.originalSiteQuoteLeadCount,'Candidate-site row ledger reconciliation mismatch for '+m.officialName+': '+m.reconciledResearchRows+' vs '+m.originalSiteQuoteLeadCount);
 const labels=[...m.issueLabels].sort(),areas=[...m.issueAreas].sort(),cycles=[...m.sourceContext].sort();
 return {officialName:m.officialName,yearsActuallyServed:m.yearsActuallyServed,campaignSiteResearchExcerpts:m.reconciledResearchRows,
 explicitTaggedResearchExcerpts:m.issueTaggedResearchRows,untaggedResearchExcerpts:m.untaggedResearchRows,
 distinctExplicitLedgerIssueTags:labels.length,issueTags:labels,broadIssueAreas:areas,broadAreaCount:areas.length,
 evidenceCycleContexts:cycles,archivedObservationYears:[...m.archiveYears].sort(),sourceLedgers:m.ledgersWithFirstPartyOriginalIssueExcerpts,
 sourceContextByLedger:m.siteRowRecencyContexts,
 completenessNotProven:true,absenceOfIssueTagNeverEstablishesNoPolicy:true,originalFirstAuthoredDateNotEstablished:true,
 officialVotesFromCampaignCopyNotVerified:true,automaticForecastEligibility:false};
}).sort((a,b)=>a.campaignSiteResearchExcerpts-b.campaignSiteResearchExcerpts||a.broadAreaCount-b.broadAreaCount||a.officialName.localeCompare(b.officialName));
assert.equal(result.filter(r=>r.campaignSiteResearchExcerpts>0).length,92);
assert.equal(result.reduce((a,b)=>a+b.campaignSiteResearchExcerpts,0),1194);
const summary={sourceGovernmentSha256:coverage.summary.sourceOriginalGovernmentSHA256,actuallyServedSenators:95,
 coveredWithAtLeastOneAuthenticatedHistoricalCandidateSiteExcerpt:92,zeroSelectedFirstPartySiteExcerpts:3,
 historicalSelectedCampaignSiteExcerptRows:1194,contributingCandidateSiteLedgers:leds.length,
 explicitlyIssueTaggedRows:result.reduce((a,b)=>a+b.explicitTaggedResearchExcerpts,0),
 rowsMissingExplicitIssueTags:result.reduce((a,b)=>a+b.untaggedResearchExcerpts,0),
 senatorsWithFiveOrFewerSiteExcerpts:result.filter(r=>r.campaignSiteResearchExcerpts<=5).length,
 sourceIsResearchOnly:true,notSameElectionFullPlatforms:true,tagSignalsTopicNotSupportOpposition:true,
 noPredictionEligibility:true,productionReadsWrites:0};
const report={schema:'mn-senate-864-actual-serving-95-person-original-site-issue-depth-matrix-v1',issue:864,
 generatedFrom:'source-authenticated 95-person original government and 29 independently audited candidate-site ledgers',
 constraints:{issueTaxonomyUsesOnlyExplicitPriorResearchLedgerTags:true,otherTaggedIssueIsNotNoIssue:true,
 archivesObservationNotFirstAuthoredDate:true,olderOtherOfficeSourcesNot2022SenatePromises:true,
 additionalPublisherMaterialNotAddedToOriginalCandidateSiteCounts:true},summary,
 weakTargets:result.filter(r=>r.campaignSiteResearchExcerpts<=5).map(r=>r.officialName),
 byActuallyServedSenator:result,excludedRowsThatDoNotMatchOfficial95:excluded};
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'senate-95-issue-depth-matrix.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const md=['# Senate #864 — audited historical candidate-site policy topic coverage across all 95 actually-serving people','',
 'Read-only issue-tag depth inventory. **Neither an exhaustive platform census nor proof of a candidate position, fresh authorship, or official legislative vote.**','',
 'Senators: **95**. Original-site research excerpts: **1,194** across **92** people. No selected originals for **3**.','',
 'Issue topic tags are taken from the **existing audited excerpt-ledger metadata only**. A blank is **unknown**, not opposition or absence.','',
 '| Senator | Site excerpts | Tagged rows | Issue topic areas | Distinct original tags | Original-source temporal/office context |',
 '| --- | ---: | ---: | --- | ---: | --- |',
 ...result.map(r=>'| '+r.officialName.replace(/\|/g,'/')+' | '+r.campaignSiteResearchExcerpts+
 ' | '+r.explicitTaggedResearchExcerpts+' | '+(r.broadIssueAreas.join(', ')||'unobserved')+' | '+
 r.distinctExplicitLedgerIssueTags+' | '+(r.evidenceCycleContexts.join('; ')||'no selected site')+' |'),
 '', '## Research prioritization',
 '', 'Five or fewer site excerpts in source ledgers: '+summary.senatorsWithFiveOrFewerSiteExcerpts+'.',
 '', 'This matrix does not automatically attach statements to a 2020/2022/2025 race just because the named senator served then.',
 'Consult per-person sourceContextByLedger and archive dates before assigning election-cycle meaning.',
 'Publisher interviews and candidate-filled questionnaires are separate from the candidate-owned site denominator.',
 ''];
writeFileSync(join(out,'senate-95-issue-depth-matrix.md'),md.join('\n'),{flag:'wx'});
console.log(JSON.stringify({summary,weakTargets:report.weakTargets,nonMatchingRows:excluded,extractedLedgerRawRows:totalRecords,ledgerCounts:[...sourceKinds]},null,2));
