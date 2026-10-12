/**
 * #864: verify six whole original public Senate caucus HTML sources and 16
 * exact, speaker-scoped short research fragments, including two explicitly
 * two-person joint statements. CAUCUS speech != candidate-owned website != vote.
 * Strict SHA1 original CDX, whole HTML SHA256, whole CDX SHA256, Senate service,
 * election cutoff, publication display and literal quote scope.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const av=process.argv.slice(2);
function arg(k){const i=av.indexOf(k);assert.ok(i>=0&&av[i+1]&&!av[i+1].startsWith('--'),'Missing '+k);return resolve(av[i+1]);}
function read(p,min=20,max=7500000){const s=statSync(p);assert.ok(s.isFile()&&s.size>=min&&s.size<=max,'Original source missing '+p);return readFileSync(p);}
const sha=b=>createHash('sha256').update(b).digest('hex');
const dir={kari:arg('--kari-original-dir'),weber:arg('--weber-original-dir'),newman:arg('--newman-original-dir')};
const out=arg('--out-dir');mkdirSync(out,{recursive:true});
const receipts=JSON.parse(read(resolve('data/evaluation/senate-864-kari-weber-newman-six-original-2020-22-caucus-source-receipts-v1.json'),1500).toString());
const ledger=JSON.parse(read(resolve('data/evaluation/senate-864-kari-weber-newman-16-new-original-caucus-remarks-v1.json'),1400).toString());
const target=JSON.parse(read(resolve('data/evaluation/senate-864-three-sparse-senator-original-caucus-and-2022-questionnaire-targets-v1.json'),3000).toString());
assert.equal(receipts.schema,'senate-864-three-sparse-six-original-2020-22-caucus-direct-and-joint-remarks-receipts-v1');
assert.equal(ledger.schema,'senate-864-three-sparse-16-new-caucus-original-named-or-joint-research-excerpts-v1');
assert.equal(target.schema,'senate-864-three-sparse-served-senators-independent-original-2020-2022-caucus-publisher-research-v1');
for(const s of [receipts,ledger,target])assert.equal(s.issue,864);
assert.equal(receipts.authenticatedPublisherCaucusOriginalWholeSources,6);
assert.equal(receipts.pages.length,6);
assert.equal(receipts.sourceRunId,38264756956);
assert.equal(receipts.baselineShortHistoricalCandidateSiteFragments,1285);
assert.equal(receipts.baselineAuthenticatedCandidateOwnedWebsites,92);
assert.equal(receipts.historical2022QuestionnaireNotAdmitted,true);
assert.equal(receipts.websiteCountIncrement,0);
assert.equal(ledger.exactShortResearchExcerpts.length,16);
assert.equal(ledger.addedTotalResearchExcerpts,16);
assert.equal(ledger.addedCaucusIndividualSourceResearchFragments,14);
assert.equal(ledger.addedTwoNamedSenatorsJointNotSoleExcerptFragments,2);
assert.equal(ledger.candidateSiteBaseline1285Unchanged,true);
assert.equal(ledger.originalCandidateWebsiteCoveredPersons92Unchanged,true);
assert.equal(ledger.productionDatabaseReadsWrites,0);
assert.equal(ledger.automaticForecastOrTrainingChanges,0);
const gov=read(arg('--official-html'),9000),govReceipt=JSON.parse(read(arg('--official-receipt'),500).toString()),swear=read(arg('--official-special-swearing-html'),9000);
assert.equal(sha(gov),receipts.originalOfficialGovSha256);
assert.equal(govReceipt.source.sourceBytesSha256,sha(gov));
assert.equal(govReceipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(govReceipt.supplementalSwearingSource.sourceBytesSha256,sha(swear));
const svc=parseOfficialMnSenateServiceDirectory(gov,govReceipt.source.observedAt,swear,govReceipt.supplementalSwearingSource.observedAt);
assert.equal(svc.senators.length,105);
const baseline=JSON.parse(read(arg('--prior-1285-matrix'),20000).toString());
assert.equal(baseline.issue,864);assert.equal(baseline.summary.actualServingSenators,95);
assert.equal(baseline.summary.peopleWithAnyAuthenticatedOriginalSiteExcerpt,92);
assert.equal(baseline.summary.combinedSelectedOriginalCandidateOwnedSiteResearchExcerpts,1285);
assert.equal(baseline.byActuallyServedSenator.length,95);
const normalize=s=>String(s).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const page=new Map();
for(const p of receipts.pages){
 assert.ok(!page.has(p.id),'Duplicated original page ID');
 assert.ok(dir[p.artifactGroup],'Unknown original archive artifact group');
 const t=target.tracks[p.artifactGroup];
 assert.ok(t&&['kari','weber','newman'].includes(p.artifactGroup));
 assert.equal(p.officialName,t.officialName);
 assert.ok(t.sources.some(x=>x.id===p.id&&x.url===p.originalUrl));
 assert.ok(p.originalArchivedAtUtc<t.electionDate+'T00:00:00.000Z','Original postdates relevant Senate general election');
 assert.ok(p.publisherDisplayedDate<=t.electionDate,'Source displayed date after election');
 assert.equal(p.originalVersionCapturedBeforeRelevantGeneralElection,true);
 assert.equal(p.provesOriginalFirstPublicationDate,false);
 assert.equal(p.campaignOwnedWebsite,false);
 assert.equal(p.approvedForForecasting,false);
 const person=validateActualSenateServiceForElection(svc,t.person,t.district,t.electionYear);
 assert.equal(person.status,'verified_senate_service');
 assert.equal(person.officialName,p.officialName);
 assert.equal(person.serviceForThisElectionFollowingYearVerified,true);
 assert.ok(baseline.byActuallyServedSenator.some(x=>x.officialName===p.officialName));
 const html=read(join(dir[p.artifactGroup],p.originalRawHtmlFile),1000);
 assert.equal(sha(html),p.completeOriginalHtmlSHA256,'Raw whole original HTML SHA256 mismatch '+p.id);
 assert.equal(historicalArchiveSha1Base32(html),p.originalIndexedSha1Base32,'Independent original CDX SHA1 mismatch '+p.id);
 const cdxBytes=read(join(dir[p.artifactGroup],p.originalWholeCdxFile),100);
 assert.equal(sha(cdxBytes),p.originalWholeCdxSHA256,'Independent whole original CDX index SHA256 mismatch '+p.id);
 const cdx=JSON.parse(cdxBytes.toString());
 assert.deepEqual(cdx[0],['timestamp','original','mimetype','statuscode','digest','length']);
 const timestamp=p.originalArchivedAtUtc.replace(/[^0-9]/g,'').slice(0,14);
 assert.equal(cdx.slice(1).filter(r=>r[0]===timestamp&&r[1]===p.originalUrl&&r[2]==='text/html'&&r[3]==='200'&&r[4]===p.originalIndexedSha1Base32).length,1,'Original complete HTML absent from exact indexed source '+p.id);
 const visible=normalize(originalCampaignVisibleText(html));
 const date=new Date(p.publisherDisplayedDate+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'long',day:'numeric',year:'numeric'});
 assert.ok(visible.includes(normalize(date)),'Original displayed publisher day absent '+p.id+' '+date);
 const begin=visible.indexOf(normalize(p.candidateSpecificQuoteRegionStart));
 assert.ok(begin>0,'No candidate-specific quoted speech start '+p.id);
 const end=visible.indexOf(normalize(p.candidateSpecificQuoteRegionEnd),begin+normalize(p.candidateSpecificQuoteRegionStart).length);
 assert.ok(end>begin+80,'No speaker-safe candidate speech region end '+p.id);
 const scope=visible.slice(begin,end);
 if(p.id==='kari22-tax-student-loan')assert.ok(scope.includes('said sen. dziedzic'),'Ann Rest quote MUST NOT be misattributed as Kari personal speech');
 if(p.id==='kari22-housing')assert.ok(scope.includes('said senator dziedzic'),'Melisa Franzen / industry quotes MUST NOT be misattributed as Kari speech');
 if(p.id==='kari22-joint'){
  assert.equal(p.speakerTurnKind,'caucus_two_named_senators_joint_quote_not_single_person_verbatim');
  assert.ok(visible.slice(Math.max(0,begin-550),begin).includes('senators kari dziedzic and bobby joe champion'));
 }
 if(p.id==='weber22-jul28-energy')assert.ok(scope.includes('senator weber said'),'Coalition director remarks MUST NOT be attributed to Weber');
 if(p.id==='newman20-mar17-covid'){
  assert.ok(visible.slice(Math.max(0,begin-300),begin).includes('senator scott newman'));
  assert.ok(visible.slice(Math.max(0,begin-220),begin).includes('issued the following statement'));
 }
 if(p.id==='newman20-mar03-vote-admin')assert.ok(scope.includes('asked senator scott newman'),'Other named senators MUST NOT be attributed as Newman');
 page.set(p.id,{p,scope});
}
const olderDirect=JSON.parse(read(resolve('data/evaluation/senate-864-low-covered-2022-original-publisher-candidate-questionnaires-issue-fragments-v1.json'),1000).toString());
assert.equal(olderDirect.exactPublisherCandidateShortResearchFragments.length,25);
const oldExact=new Set(olderDirect.exactPublisherCandidateShortResearchFragments.map(x=>normalize(x.exactShortExcerpt)));
const proof=[],seen=new Set(),counts=new Map(),kinds=new Map();
for(const x of ledger.exactShortResearchExcerpts){
 const info=page.get(x.pageId);assert.ok(info,'Unknown original source for quote '+x.id);
 assert.equal(x.person,info.p.officialName);
 assert.equal(x.candidateOwnedCampaignWebsite,false);
 assert.equal(x.sameGeneralElectionEraCapturedBeforePollDate,true);
 assert.equal(x.firstAuthorshipDateProven,false);
 assert.equal(x.officialSenateVoteOrBillActionProven,false);
 assert.equal(x.modelForecastEligibility,false);
 assert.match(x.issueFamily,/^[a-z0-9_]+$/);
 assert.ok(x.exactShortExcerpt.length>=12&&x.exactShortExcerpt.length<=125,'Research quote length must be limited '+x.id);
 assert.ok(x.conservativeMeaning.length>10);
 const q=normalize(x.exactShortExcerpt),key=info.p.officialName+'|'+q;
 assert.ok(!seen.has(key),'Duplicate new speaker scoped quote '+x.id);
 assert.ok(!oldExact.has(q),'Old 25 authenticated short quoted source fragments may not be counted again '+x.id);
 seen.add(key);
 assert.ok(info.scope.includes(q),'Literal short speaker-scoped quote missing from full original '+x.id+': '+JSON.stringify(x.exactShortExcerpt));
 if(info.p.speakerTurnKind==='caucus_two_named_senators_joint_quote_not_single_person_verbatim'){
  assert.equal(x.sourceStatementKind,'joint_candidate_and_colleague_statement_not_solo');
 }else assert.equal(x.sourceStatementKind,'individual_named_attributable_caucus_quote');
 kinds.set(x.sourceStatementKind,(kinds.get(x.sourceStatementKind)||0)+1);
 counts.set(x.person,(counts.get(x.person)||0)+1);
 proof.push({fragmentId:x.id,officialName:x.person,originalPageId:x.pageId,
  originalCaptureUtc:info.p.originalArchivedAtUtc,originalWholeHtmlSHA256:info.p.completeOriginalHtmlSHA256,
  originalWholeCdxSHA256:info.p.originalWholeCdxSHA256,originalIndexedSHA1Base32:info.p.originalIndexedSha1Base32,
  sourceSpeechKind:x.sourceStatementKind,verifiedExactSourceAndSpeakerTurn:true,
  old25PublisherExcerptNotDuplicated:true,candidateOwnedCampaignSite:false,
  firstOriginallyPublishedDateNotProven:true,noOfficialSenateVoteProven:true});
}
assert.equal(proof.length,16);
assert.deepEqual(Object.fromEntries(counts),ledger.byNamedPerson);
assert.equal(kinds.get('joint_candidate_and_colleague_statement_not_solo'),2);
assert.equal(kinds.get('individual_named_attributable_caucus_quote'),14);
const report={schema:'senate-864-three-sparse-16-2020-22-original-caucus-direct-research-short-fragments-proof-v1',
 issue:864,sourceAcquisitionRunId:receipts.sourceRunId,
 summary:{verifiedOriginalPages:page.size,independentlyVerifiedNewLiteralResearchExcerpts:16,
 individualNamedQuotedResearchExcerpts:14,jointNotSoleNamedResearchExcerpts:2,personCounts:Object.fromEntries(counts),
 previousOriginalCandidateOwnedSiteShortExcerpts:1285,originalCandidateOwnedWebsitePersonCoverage:92,
 publisherSiteFragmentsAreCountedInOriginalCandidateOwnedWebsiteBaseline:false,
 unverifiedIvo2022QuestionnaireQuotationsAccepted:0,firstAuthoredDayInferred:0,verifiedOfficialVoteRowsFromCaucusQuotes:0,
 officialFullLRLSenateDirectorySha256:sha(gov),productionDatabaseReadsWrites:0,automaticForecastOrModelTrainingChanges:0},
 sourceProofs:proof,cautions:{onlyActual2021to2025Senators:true,
 sameElectionEraArchivalObservationOnly:true,
 separateFromCandidateCampaignSiteAndOfficialRollCall:true,
 noAutomaticPredictionUse:true,sharedJointStatementNotIndividualVerbatimClaim:true,
 historicalIndexProviderErrorsNotNoPolicyProof:true,
 directStatementPublicationDateOnlyDisplayUnlessOriginalWholeProof:true}};
writeFileSync(join(out,'senate-864-three-sparse-16-original-caucus-short-remarks-proof.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const lines=['# VotePredict #864 — six original 2020/22 caucus pages, 16 exact named short issue remarks','','The following are historically authenticated caucus-published direct statements **not campaign-owned websites**, **not official roll-call vote verifications**, and **not automatic prediction inputs**.','',
 '- **2022 Kari Dziedzic:** 7 new exact excerpts across three original caucus pages; two excerpts are an explicitly **joint** statement with Bobby Joe Champion and **not sole Kari verbatim speech**. Source types housing stability, student loan tax relief, community trust.','- **2022 Bill Weber:** 4 new exact excerpts from original 2022 energy comments; all-of-the-above energy and cost/reliability.','- **2020 Scott J. Newman:** 5 exact original excerpts across two caucus originals on business restrictions, executive/legislative powers, election administration and misuse of public resources.','',
 '**Historical cutoff:** all six full original source pages are SHA1/CDX and HTML SHA256 matched and captured before their respective November general elections; archival timestamp **cannot prove author-first-published day**. The original 2022 iVoterGuide questionnaire was **NOT authenticated**; current mutable page must not be backdated. Three other caucus original source leads could not be authenticated (provider non-CDX errors), not no-position evidence.','',
 '**Unchanged candidate-owned site baseline:** 92/95 actual-serving senators, 1,285 selected source-audited first-party site policy snippets. The 16 caucus research remarks are an additional **separate publisher/caucus category**, and did not increment either campaign-site denominator.','',
 '| Senator | New verified individual short remarks | New verified joint short remarks | Original full sources |',
 '|---|---:|---:|---:|',
 '| Kari Dziedzic | 5 | 2 | 3 |',
 '| Bill Weber | 4 | 0 | 1 |',
 '| Scott J. Newman | 5 | 0 | 2 |',
 '', '**Audit guardrails:** named actual-service government roster, whole original CDX SHA1, whole HTML SHA256, date before election, per-speaker boundaries and no duplicate from prior 25 questionnaire fragments; zero DB writes or reads and zero model changes.',''];
writeFileSync(join(out,'senate-864-three-sparse-16-original-caucus-short-remarks-summary.md'),lines.join('\n'),{flag:'wx'});
console.log(JSON.stringify({wholeAuthenticatedOriginalPages:page.size,newResearchFragments:proof.length,
 perPerson:Object.fromEntries(counts),byStatementType:Object.fromEntries(kinds),
 candidateWebsitePersonsUnchanged:92,candidateWebsiteExcerptRowsUnchanged:1285,modelChanges:0},null,2));
