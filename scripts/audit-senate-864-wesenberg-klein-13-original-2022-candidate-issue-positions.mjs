/**
 * #864 candidate-owned pre-election Minnesota Senate 2022 sources.
 * Validate three COMPLETE original HTML bodies against independent full CDX
 * SHA256 / indexed SHA1 and scope 13 short, literal candidate policy excerpts.
 * Reconcile with prior 1272 authenticated original site rows. Research ONLY.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const argv=process.argv.slice(2);
function arg(k){const i=argv.indexOf(k);assert.ok(i>=0&&argv[i+1]&&!argv[i+1].startsWith('--'),'Missing '+k);return resolve(argv[i+1]);}
function source(p,min=30,max=8000000){const s=statSync(p);assert.ok(s.isFile()&&s.size>=min&&s.size<=max,'Missing original '+p);return readFileSync(p);}
const sha=b=>createHash('sha256').update(b).digest('hex');
const dir={wesenberg:arg('--wesenberg-original-dir'),klein:arg('--klein-original-dir')};
const out=arg('--out-dir');mkdirSync(out,{recursive:true});
const receipts=JSON.parse(source(resolve('data/evaluation/senate-864-wesenberg-klein-new-2022-original-issue-source-receipts-v1.json')).toString());
const ledger=JSON.parse(source(resolve('data/evaluation/senate-864-wesenberg-klein-13-original-2022-firstparty-issue-positions-v1.json')).toString());
assert.equal(receipts.schema,'senate-864-five-thin-two-actual-senators-three-full-original-pages-digest-receipts-v1');
assert.equal(ledger.schema,'senate-864-five-thin-13-new-2022-firstparty-candidate-issue-site-excerpt-leads-v1');
assert.equal(receipts.issue,864);assert.equal(ledger.issue,864);
assert.equal(receipts.pages.length,3);
assert.equal(receipts.baselineOriginalSiteShortExcerpts,1272);
assert.equal(receipts.baselineActualServedSenators,95);
assert.equal(receipts.baselineCandidateOwnedSitePersons,92);
assert.equal(receipts.sourceEvidenceAcquisitionRun,38259653886);
assert.equal(ledger.originalSiteExcerptCountBefore,1272);
assert.equal(ledger.newOriginalSiteExcerptCount,13);
assert.equal(ledger.expectedNewSiteExcerptCount,1285);
assert.equal(ledger.exactShortResearchPositions.length,13);
assert.equal(ledger.productionDbReadWrites,0);
assert.equal(ledger.modelOrForecastChanges,0);
const gov=source(arg('--official-html'),9000),audit=JSON.parse(source(arg('--official-receipt')).toString()),swear=source(arg('--official-special-swearing-html'),9000);
assert.equal(sha(gov),receipts.immutableOriginalServiceSha256);
assert.equal(audit.source.sourceBytesSha256,sha(gov));
assert.equal(audit.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(audit.supplementalSwearingSource.sourceBytesSha256,sha(swear));
const service=parseOfficialMnSenateServiceDirectory(gov,audit.source.observedAt,swear,audit.supplementalSwearingSource.observedAt);
assert.equal(service.senators.length,105);
const base=JSON.parse(source(arg('--augmented-matrix-json'),10000).toString());
assert.equal(base.summary.actualServingSenators,95);
assert.equal(base.summary.authenticatedOriginalSitePeople,92);
assert.equal(base.summary.totalSelectedAuthenticatedCandidateSiteResearchFragments,1272);
assert.equal(base.byActuallyServedSenator.length,95);
const govPerson=new Map(base.byActuallyServedSenator.map(x=>[x.officialName,x]));
const norm=s=>String(s).normalize('NFKC').toLowerCase()
 .replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,'-')
 .replace(/\s+/g,' ').trim();
const byId=new Map();
for(const p of receipts.pages){
 assert.ok(!byId.has(p.id),'Repeated original full HTML source id');
 assert.equal(p.historicalElectionYear,2022);
 assert.equal(p.sourceOffice,'Minnesota Senate');
 assert.equal(p.noNewCandidateSitePerson,true);
 assert.ok(p.archiveCaptureUtc<'2022-11-08T00:00:00.000Z','Post election evidence '+p.id);
 assert.match(p.sourceOriginalSha256,/^[a-f0-9]{64}$/);
 assert.match(p.independentCdxSha256,/^[a-f0-9]{64}$/);
 assert.match(p.originalCdxIndexedSha1Base32,/^[A-Z2-7]{32}$/);
 const actual=validateActualSenateServiceForElection(service,p.person,p.district,p.historicalElectionYear);
 assert.equal(actual.status,'verified_senate_service');
 assert.equal(actual.officialName,p.officialName);
 assert.equal(actual.serviceForThisElectionFollowingYearVerified,true);
 assert.ok(govPerson.has(p.officialName),'Not in original actually serving 95 senator cohort');
 const raw=source(join(dir[p.sourceGroup],p.sourceOriginalFile),1000);
 assert.equal(sha(raw),p.sourceOriginalSha256,'Original entire candidate-owned site SHA256 mismatch '+p.id);
 assert.equal(historicalArchiveSha1Base32(raw),p.originalCdxIndexedSha1Base32,'Original entire SHA1/CDX mismatch '+p.id);
 const cdx=source(join(dir[p.sourceGroup],p.independentCdxFile),100);
 assert.equal(sha(cdx),p.independentCdxSha256,'Original independent complete CDX body SHA256 mismatch '+p.id);
 const index=JSON.parse(cdx.toString());
 assert.deepEqual(index[0],['timestamp','original','mimetype','statuscode','digest','length']);
 const ts=p.archiveCaptureUtc.replace(/[^0-9]/g,'').slice(0,14);
 assert.equal(index.slice(1).filter(r=>r[0]===ts&&r[1]===p.url&&r[2]==='text/html'&&r[3]==='200'&&r[4]===p.originalCdxIndexedSha1Base32).length,1,'Index does not authenticate entire HTML '+p.id);
 const visible=norm(originalCampaignVisibleText(raw));
 assert.ok(visible.includes(norm(p.candidateAttributionCue)),'No claimed real candidate identity '+p.id);
 assert.ok(visible.includes(norm(p.campaignFooterCue)),'No candidate committee owned-page notice '+p.id);
 const begin=visible.indexOf(norm(p.speakerSectionStart));
 assert.ok(begin>=0,'No candidate own policy section start '+p.id);
 const end=visible.indexOf(norm(p.speakerSectionEnd),begin+norm(p.speakerSectionStart).length);
 assert.ok(end>begin+100,'No policy section closing boundary '+p.id);
 const candidateOwnedPolicyRegion=visible.slice(begin,end);
 byId.set(p.id,{p,candidateOwnedPolicyRegion,totalOriginalPageChars:visible.length});
}
const oldNathan=JSON.parse(source(resolve('data/evaluation/senate-capture-dated-original-2020-22-campaign-issue-excerpts-v1.json'),1000).toString());
const oldKlein=JSON.parse(source(resolve('data/evaluation/senate-last16-five-new-original-site-policy-excerpts-v1.json'),1000).toString());
const existing=new Map([
 ['Nathan Wesenberg',oldNathan.statements.filter(q=>q.senator==='Nathan Wesenberg').map(q=>norm(q.exactShortExcerpt))],
 ['Matt D. Klein',oldKlein.excerpts.filter(q=>q.pageId==='klein-home').map(q=>norm(q.exactShortExcerpt))]
]);
assert.equal(existing.get('Nathan Wesenberg').length,4);
assert.equal(existing.get('Matt D. Klein').length,4);
const seen=new Set(),proofs=[],increments=new Map();
for(const q of ledger.exactShortResearchPositions){
 const doc=byId.get(q.pageId);assert.ok(doc,'Unknown archived original '+q.id);
 const p=doc.p;
 assert.ok(typeof q.issueFamily==='string'&&/^[a-z0-9_]+$/.test(q.issueFamily));
 assert.ok(typeof q.exactShortExcerpt==='string'&&q.exactShortExcerpt.length>=6&&q.exactShortExcerpt.length<=125);
 assert.ok(typeof q.conservativeMeaning==='string'&&q.conservativeMeaning.length>12);
 assert.equal(q.notAutomaticForecastEvidence,true);
 assert.equal(q.firstAuthoredDateUnknown,true);
 const quote=norm(q.exactShortExcerpt);
 assert.ok(!seen.has(p.officialName+'|'+quote),'Duplicate new research site excerpt '+q.id);
 seen.add(p.officialName+'|'+quote);
 assert.ok(!existing.get(p.officialName).includes(quote),'Previously counted quote duplicated '+q.id);
 assert.ok(doc.candidateOwnedPolicyRegion.includes(quote),'NEW EXACT SHORT ISSUE FRAGMENT ABSENT FROM CANDIDATE-SCOPED ORIGINAL '+q.id+' '+p.id+' '+JSON.stringify(q.exactShortExcerpt));
 increments.set(p.officialName,(increments.get(p.officialName)||0)+1);
 proofs.push({id:q.id,originalPage:p.id,originalHtmlSha256:p.sourceOriginalSha256,
  independentWholeCDXSha256:p.independentCdxSha256,originalIndexedSha1Base32:p.originalCdxIndexedSha1Base32,
  originalCapturedAtUtc:p.archiveCaptureUtc,exactOriginalSenateCandidateOwnedPolicyExcerptMatched:true,
  selectedNewShortWordsOnly:true,notOfficialVoteOrPromiseFirstDateProof:true});
}
assert.equal(proofs.length,13);
assert.deepEqual(Object.fromEntries(increments),{'Nathan Wesenberg':6,'Matt D. Klein':7});
const issueAreas=x=>{
 if(/abortion/.test(x))return 'reproductive_rights';
 if(/education/.test(x))return 'education_childcare';
 if(/health/.test(x))return 'healthcare';
 if(/employment/.test(x))return 'jobs_labor_economy';
 if(/environment|clean_air/.test(x))return 'climate_environment_energy';
 if(/tax/.test(x))return 'taxes_budget';
 if(/vehicle/.test(x))return 'transport_infrastructure';
 if(/firearm/.test(x))return 'public_safety_justice';
 if(/public_health_emergency|bipartisan/.test(x))return 'elections_government';
 return 'other_tagged_issue';
};
const extraByPerson=new Map();
for(const q of ledger.exactShortResearchPositions){
 const p=byId.get(q.pageId).p;
 const arr=extraByPerson.get(p.officialName)||[];
 arr.push({id:q.id,originalPage:q.pageId,issueTag:q.issueFamily,broadIssueArea:issueAreas(q.issueFamily),
  archivedPublicByUtc:p.archiveCaptureUtc,firstAuthorshipDateUnproven:true,
  sameElectionPeriodCandidateOwnedSite:true,automaticallyForecastEligible:false});
 extraByPerson.set(p.officialName,arr);
}
const rows=base.byActuallyServedSenator.map(x=>{
 const added=extraByPerson.get(x.officialName)||[];
 const total=x.campaignSiteResearchExcerptsAfterAddendum+added.length;
 return {...x,prior1272SelectedHistoricalOriginalSiteResearchExcerpts:x.campaignSiteResearchExcerptsAfterAddendum,
  currentRoundNewIndependentlyVerified2022OriginalSiteResearchExcerpts:added.length,
  selectedCandidateOwnedOriginalSiteExcerptsThroughCurrentRound:total,
  broaderIssueAreasThroughCurrentRound:[...new Set([...x.broadIssueAreasAfterAddendum,...added.map(r=>r.broadIssueArea)])].sort(),
  newestVerifiedElectionEraFirstPartyIssueExcerpts:added,
  firstAuthoredDateAndLegislativeVotesNotProven:true};
}).sort((x,y)=>x.selectedCandidateOwnedOriginalSiteExcerptsThroughCurrentRound-y.selectedCandidateOwnedOriginalSiteExcerptsThroughCurrentRound||x.officialName.localeCompare(y.officialName));
assert.equal(rows.length,95);
assert.equal(rows.reduce((s,x)=>s+x.selectedCandidateOwnedOriginalSiteExcerptsThroughCurrentRound,0),1285);
assert.equal(rows.filter(x=>x.selectedCandidateOwnedOriginalSiteExcerptsThroughCurrentRound>0).length,92);
assert.equal(rows.filter(x=>x.selectedCandidateOwnedOriginalSiteExcerptsThroughCurrentRound<=5).length,10);
const result={schema:'senate-864-95-person-five-thin-original-research-site-depth-1285-v1',
 issue:864,summary:{actualServingSenators:95,peopleWithAnyAuthenticatedOriginalSiteExcerpt:92,
 priorSelectedCandidateOwnedWebsiteOriginalResearchExcerpts:1272,additionalIndependentlyVerifiedOriginalResearchExcerpts:13,
 combinedSelectedOriginalCandidateOwnedSiteResearchExcerpts:1285,
 newOriginalSiteResearchExcerptsByPerson:Object.fromEntries(increments),
 previouslyFiveOrFewerOriginalSiteResearchExcerpts:12,nowFiveOrFewerOriginalSiteResearchExcerpts:10,
 publisherDirectStatementsThisRun:0,governmentDirectorySha256:sha(gov),
 noProductionReadsWrites:0,noForecastFeaturesOrTrainingChanges:0},
 constraints:{archiveObservationNotDateOfFirstAuthorship:true,sourceKindFirstPartyOwnedCandidateSite2022:true,
 candidatePreviousLegislativeVotesNotVerified:true,older2012SourceNo2022AuthoringInference:true,
 provider200NonCDXAndParkedDomainsNotEvidenceAbsence:true,thirdPartyPublisherStatementsExcluded:true,
 noPolicyAbsenceClaimFromMissingTopics:true},byActuallyServedSenator:rows,
 originalExactQuoteIndependentAudit:proofs};
writeFileSync(join(out,'senate-864-95-person-historical-candidate-issue-depth-1285.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
const md=['# Senate #864 — independently original-audited 2022 issue depth across 95 actual-serving senators','',
 '**12 -> 10** actual senators with <=5 selected first-party site policy snippets; baseline 1272 + **13 verified new** = **1285** exact short research excerpts; candidate-site people remains **92/95**.',
 '', 'New independently verified 2022 owned-site excerpts: **6** for Nathan Wesenberg, **7** for Matt D. Klein.',
 'The 2022 versions of these pages have indexed original CDX SHA1, whole HTML SHA256, named candidate, paid-for committee identity, exact issue text and date before Nov8 election.',
 'No automatic model features, votes, 2022 authorship claims or inferred missing-position data. Publisher-hosted interviews never enter this count.',
 '', '| Senator | Original site excerpts before | New verified 2022 | Total selected | Explicit topic areas (not exhaustive) |',
 '|---|---:|---:|---:|---|',
 ...rows.map(r=>'| '+r.officialName+' | '+r.prior1272SelectedHistoricalOriginalSiteResearchExcerpts+
  ' | '+r.currentRoundNewIndependentlyVerified2022OriginalSiteResearchExcerpts+' | '+r.selectedCandidateOwnedOriginalSiteExcerptsThroughCurrentRound+
  ' | '+(r.broaderIssueAreasThroughCurrentRound.join(', ')||'unobserved')+' |'),
 '', 'Parked/mutable website copies and CDX provider non-index errors do not imply no campaign issue position.'];
writeFileSync(join(out,'senate-864-95-person-historical-candidate-issue-depth-1285.md'),md.join('\n')+'\n',{flag:'wx'});
const auditResult={schema:'senate-864-wesenberg-klein-13-exact-historic-pre-election-speaker-original-audit-v1',
 issue:864,sourcePagesAuthenticated:byId.size,quotesAudited:proofs.length,
 newPeopleCovered:0,newOriginalSiteExcerpts:13,
 baselineOriginalSiteExcerpts:1272,totalOriginalSiteExcerpts:1285,
 originalWebsiteCoveragePeople:92,sourceShaAndNamedCandidateProof:proofs,
 originalGovernmentSha256:sha(gov),researchOnly:true,productionReadsWrites:0,modelOrPredictionChanges:0};
writeFileSync(join(out,'senate-864-wesenberg-klein-13-original-cdx-html-exact-quote-proof.json'),JSON.stringify(auditResult,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sources:byId.size,verifiedLiteralPositions:proofs.length,byPerson:Object.fromEntries(increments),
  finalSiteShortExcerpts:1285,sparseFiveOrLess:10,siteCoveredPeople:92,noModelChanges:true},null,2));
