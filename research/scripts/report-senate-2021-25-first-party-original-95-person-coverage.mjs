/**
 * #864 read-only statewide first-party campaign source coverage report.
 * Rebuild from original official MN LRL 2021-2025 actually-served-person
 * source AND already retained, individually source-audited research ledgers.
 * Only an inventory of leads; not a completeness/forecast certificate.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {parseOfficialMnSenateServiceDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
const govHash='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const sha=b=>createHash('sha256').update(b).digest('hex');
const args=process.argv.slice(2);
function arg(k){const i=args.indexOf(k);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing '+k);return resolve(args[i+1]);}
const govPath=arg('--official-html'),auditPath=arg('--official-receipt'),
 swearingPath=arg('--official-special-swearing-html'),outDir=arg('--out-dir');
function file(p,min=100,max=5500000){const s=statSync(p);assert.ok(s.isFile()&&s.size>=min&&s.size<=max,'Missing full original: '+p);return readFileSync(p);}
const source=file(govPath,9000),proof=JSON.parse(file(auditPath).toString());
const swearing=file(swearingPath,9000);
assert.equal(sha(source),govHash);
assert.equal(proof.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(proof.source.sourceBytesSha256,govHash);
assert.equal(sha(swearing),proof.supplementalSwearingSource.sourceBytesSha256);
const directory=parseOfficialMnSenateServiceDirectory(
 source,proof.source.observedAt,swearing,proof.supplementalSwearingSource.observedAt);
assert.equal(directory.senators.length,105);
// The earlier original 2026-10-10 parsing pass missed a Senate continuation:
 // the identical official raw LRL Gary H. Dahms row explicitly reports
 // Senate 2013-2022 SD16; 2023-Present SD15 without repeating "Senate".
 // The current independently rehashed source parser correctly restores SD15.
 // Require the entire original 105-person audit to remain byte-for-byte
 // identical after precisely this verified original-row correction only.
const originalSenatorsWithOneDocumentedParserCorrection=proof.senators.map(p=>
 p.officialName==='Gary H. Dahms'?{
  ...p,senateServiceTerms:[
   ...p.senateServiceTerms,{startsYear:2023,endsYear:null,district:'15'}]}:p);
assert.deepEqual(directory.senators,originalSenatorsWithOneDocumentedParserCorrection,
 'Only the exact source-verified Gary Dahms Senate SD15 continuation may differ from earlier original LRL parser receipt');
const years=[2021,2022,2023,2024,2025];
const normalize=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const firstLast=s=>{const w=normalize(s).split(' ');return w[0]+' '+w[w.length-1];};
const aliases=new Map([
 ['jen mcewen','jennifer mcewen'],['rob kupec','robert kupec'],
 ['ron latz','ronald latz'],['sandy pappas','sandra pappas'],
 ['scott dibble','d dibble'],['tom bakk','thomas bakk']
]);
const roster=directory.senators.filter(p=>p.senateServiceTerms.some(t=>
 years.some(y=>y>=t.startsYear&&(t.endsYear===null||y<=t.endsYear))));
assert.equal(roster.length,95);
assert.equal(directory.senators.length-roster.length,10);
const unique=new Map();
for(const p of roster){const k=firstLast(p.officialName);assert.ok(!unique.has(k),'Official directory ambiguous '+k);unique.set(k,p);}
const reportMap=new Map(roster.map(p=>[p.officialName,{
 officialName:p.officialName,officialServicePeriods:p.senateServiceTerms,
 yearsActuallyServed:years.filter(y=>p.senateServiceTerms.some(t=>y>=t.startsYear&&(t.endsYear===null||y<=t.endsYear))),
 originalSiteQuoteLeadCount:0,ledgersWithFirstPartyOriginalIssueExcerpts:[],
 originalArchivedSiteBodiesInSelectedReceiptLedgers:0,sourceCoverageState:'unobserved_from_selected_research_ledger_not_no_policy',
 documentSourceKinds:[],unverifiedOriginalSOSFiledWebsite2020Or2022:true,
 noCandidateAuthoredDateInvented:true
}]));
const unmatched=[];
function add(person,count,file){
 if(!Number.isInteger(count)||count<0)throw Error('Bad original campaign snippet count '+file);
 if(count===0)return;
 let key=firstLast(person);key=aliases.get(key)||key;
 const member=unique.get(key);
 if(!member){unmatched.push({name:person,count,sourceLedger:file,reason:'not_a_unique_original_official_2021_to_2025_senator_service_match'});return;}
 const entry=reportMap.get(member.officialName);
 entry.originalSiteQuoteLeadCount+=count;
 if(!entry.ledgersWithFirstPartyOriginalIssueExcerpts.includes(file))
  entry.ledgersWithFirstPartyOriginalIssueExcerpts.push(file);
}
function read(name,cb){
 const fileName='data/evaluation/'+name+'.json';
 const obj=JSON.parse(readFileSync(resolve(fileName),'utf8'));cb(obj,fileName);
}
const each=(list,fn,source)=>{assert.ok(Array.isArray(list),source);for(const v of list){const r=fn(v);if(r)add(r[0],r[1],source);}};
read('senate-capture-dated-original-2020-22-campaign-issue-excerpts-v1',
 (d,s)=>each(d.statements,x=>[x.senator,1],s));
read('senate-carla-nelson-2022-dated-original-platform-excerpts-v1',
 (d,s)=>add('Carla Nelson',d.issues.length,s));
read('senate-five-additional-served-2022-capture-dated-candidate-quotes-v1',
 (d,s)=>each(d.people,x=>[x.senator,x.exactExcerptCount],s));
read('senate-five-further-2022-authenticated-capture-dated-original-issue-excerpts-v1',
 (d,s)=>each(d.exactAttributablePolicyExcerpts,x=>[x.senator,1],s));
read('senate-five-new-2022-original-site-capture-dated-policy-excerpts-v1',
 (d,s)=>each(d.exactOriginalCandidateSiteIssueExcerpts,x=>[x.servingSenator,1],s));
read('senate-four-more-2022-original-campaign-policy-excerpts-capture-dated-v1',
 (d,s)=>each(d.exactCandidateCampaignPolicyExcerpts,x=>[x.senator,1],s));
read('senate-four-new-2022-served-original-2022-exact-policy-quotes-v1',
 (d,s)=>{const sections=new Map(d.policySections.map(p=>[p.id,p.senator]));
  each(d.exactOriginalShortExcerpts,x=>[sections.get(x.pageId),1],s);});
read('senate-kent-eken-2020-original-13-capture-dated-platform-excerpts-v1',
 (d,s)=>add('Kent Eken',d.exactCandidateOriginalPlatformShortExcerpts.length,s));
read('senate-nick-frentz-2022-podcast-site-26-original-capture-dated-policy-excerpts-v1',
 (d,s)=>add('Nick Frentz',d.exactSourceCandidateIssueExcerpts.length,s));
read('senate-nicole-mitchell-2022-original-priorities-excerpts-v1',
 (d,s)=>add('Nicole Mitchell',d.shortIssues.length,s));
read('senate-original-campaign-additional-35-statement-excerpts-v1',
 (d,s)=>each(d.rows,x=>[x.person,1],s));
read('senate-ruud-2013-chamberlain-2022-original-26-exact-policy-excerpts-v1',
 (d,s)=>{const sections=new Map(d.candidateOwnedOriginalIssueSourceSections.map(p=>[p.id,p.senator]));
  each(d.candidateOriginalLiteralResearchStatements,x=>[sections.get(x.page),1],s);});
read('senate-three-2022-original-sites-25-short-excerpt-proofs-v1',
 (d,s)=>each(d.statements,x=>[x.person,1],s));
read('senate-two-2021-serving-2020-original-capture-dated-41-policy-excerpts-v1',
 (d,s)=>{const sections=new Map(d.originalCandidateIssueSourcePages.map(p=>[p.id,p.senator]));
  each(d.exactCandidateOwnedHistoricPolicyExcerpts,x=>[sections.get(x.originalPageSectionId),1],s);});
read('senate-two-more-2021-served-2020-original-campaign-dated-policy-excerpts-v1',
 (d,s)=>{const sections=new Map(d.candidatePolicyPageSections.map(p=>[p.id,p.senator]));
  each(d.shortExactCandidateOwnedExcerpts,x=>[sections.get(x.pageId),1],s);});
read('senate-bill-ingebrigtsen-27-exact-historical-first-party-issues-2010-2012-v1',
 (d,s)=>add('Bill Ingebrigtsen',d.exactShortCandidateIssueExcerpts.length,s));
read('senate-justin-eichorn-2016-original-12-capture-dated-exact-issues-v1',
 (d,s)=>add('Justin Eichorn',d.exactCandidateSiteShortPolicyExcerpts.length,s));
read('senate-authenticated-campaign-issue-excerpt-leads-2024-25-v1',
 (d,s)=>each(d.candidates,x=>[x.candidateName,x.excerpts.length],s));
read('senate-six-2020-original-pages-26-new-exact-first-party-excerpts-v1',
 (d,s)=>each(d.statements,x=>[d.sourcePages.find(p=>p.id===x.pageId)?.person,1],s));
read('senate-roger-chamberlain-2016-original-10-economic-issue-excerpts-and-domain-review-v1',
 (d,s)=>{assert.equal(d.tenCandidateSiteExactStatements.length,10);
  add('Roger Chamberlain',d.tenCandidateSiteExactStatements.length,s);});
// Historical original SD24 Julie Rosen site captured March 2004, with
// IE-rendered conditional VML text; NEVER reinterpret as 2020 SD23 platform.
// Source-verified Gene Dornink authentic 2019 pre-2020 SD27 campaign home,
// and original 2022 SD23 platform/home; one senator, 35 short excerpts.
// Archive capture UTC never asserts initial posting date or official vote.
// Three remaining actual senators, FOUR authentic candidate-owned historical
// websites: old Kiffmeyer House 16B and Secretary of State campaigns, 2020
// Newman Senate SD18 broad-issue home, 2021 Kreun SCHOOL BOARD priorities.
// None of the non-Senate pages is a newly authored 2020/22 Senate pledge.
// Entire original Wayback CDX independently sha1-pinned Susan Pha 2022 Senate
// actual SD38 campaign and Doron Clark Jan11 2025 pre-special original ABOUT.
// Pha stale SD40 copyright footer is NOT the 2022 Senate district;
// Doron biographical first-party issue salience is NOT unverified /priorities.
read('senate-pha-doron-2022-25-original-campaign-site-21-short-excerpts-v1',
 (d,s)=>{assert.equal(d.pages.length,3);assert.equal(d.excerpts.length,21);
  assert.equal(new Set(d.pages.map(p=>p.person)).size,2);
  const byPage=new Map(d.pages.map(p=>[p.id,p.person]));
  each(d.excerpts,q=>[byPage.get(q.pageId),1],s);});
read('senate-kiffmeyer-newman-kreun-four-original-historic-site-excerpts-v1',
 (d,s)=>{assert.equal(d.pages.length,4);assert.equal(d.excerpts.length,33);
  assert.equal(new Set(d.pages.map(p=>p.person)).size,3);
  const byId=new Map(d.pages.map(p=>[p.id,p.person]));
  each(d.excerpts,q=>[byId.get(q.pageId),1],s);});
read('senate-dornink-35-2019-2022-original-firstparty-excerpts-v1',
 (d,s)=>{assert.equal(d.pages.length,3);assert.equal(d.excerpts.length,35);
  assert.equal(new Set(d.pages.map(p=>p.person)).size,1);
  const byId=new Map(d.pages.map(p=>[p.id,p.person]));
  each(d.excerpts,q=>[byId.get(q.pageId),1],s);});
read('senate-rosen-old-sd24-2004-legacy-vml-original-12-excerpts-v1',
 (d,s)=>{assert.equal(d.pages.length,1);assert.equal(d.excerpts.length,12);
  each(d.excerpts,q=>[d.pages[0].person,1],s);});
read('senate-bruce-anderson-14-full-original-issues-leads-v1',
 (d,s)=>{assert.equal(d.pages.length,1);assert.equal(d.excerpts.length,14);
  each(d.excerpts,q=>[d.pages[0].person,1],s);});
read('senate-last16-five-new-original-site-policy-excerpts-v1',
 (d,s)=>{assert.equal(d.pages.length,12);assert.equal(d.excerpts.length,73);
 const names=new Map(d.pages.map(p=>[p.id,p.person]));
 assert.equal(new Set(d.pages.map(p=>p.person)).size,5);
 each(d.excerpts,q=>[names.get(q.pageId),1],s);});
// Second distinct twenty uncovered: 137 independently authenticated exact original site
// short research excerpts, 15 new actually served senators. Preserve old 2012/2014/
// 2016 site copy, 2018 US House, 2018/2020 Minnesota House and older SD45
// instead of pretending they were newly authored 2020/22/25 Senate pledges.
read('senate-second20-15-original-serving-senators-issue-excerpts-v1',
 (d,s)=>{assert.equal(d.pages.length,18);assert.equal(d.excerpts.length,137);
  const byId=new Map(d.pages.map(p=>[p.id,p.person]));
  assert.equal(new Set(d.pages.map(p=>p.person)).size,15);
  each(d.excerpts,q=>[byId.get(q.pageId),1],s);});
// First 20-person uncovered cohort: 61 independent original-CDX + HTML audited
// short historical candidate site issues; 9 newly source-covered actual senators.
// Old House-era campaigns and older retained election copy are NOT modern 2022 Senate platforms.
read('senate-first-20-original-nine-actual-senators-61-short-excerpts-v1',
 (d,s)=>{assert.equal(d.pages.length,11);assert.equal(d.excerpts.length,61);
  const persons=new Map(d.pages.map(p=>[p.id,p.person]));
  assert.equal(new Set(d.pages.map(p=>p.person)).size,9);
  each(d.excerpts,q=>[persons.get(q.pageId),1],s);});
// Independently original-CDX + complete-HTML-audited 2020 Carlson and 2022/older Hawj sources.
// 2020 Hawj self-report is older retained website copy, not a fresh 2020 authorship date.
read('senate-carlson-hawj-2020-22-original-first-party-17-issue-excerpts-v1',
 (d,s)=>{assert.equal(d.excerpts.length,17);assert.equal(d.pages.length,3);
   each(d.excerpts,x=>[d.pages.find(p=>p.id===x.pageId)?.person,1],s);});
const receiptName='data/evaluation/senate-original-2020-22-authenticated-68-pages-v1.json';
const r=JSON.parse(readFileSync(resolve(receiptName),'utf8'));
assert.equal(r.pages.length,68);
for(const p of r.pages){
 let key=firstLast(p.senator);key=aliases.get(key)||key;
 const officialMember=unique.get(key);
 if(officialMember)reportMap.get(officialMember.officialName).originalArchivedSiteBodiesInSelectedReceiptLedgers++;
}
const additional='data/evaluation/senate-eight-probed-six-served-original-2022-23-html-receipts-v1.json';
const e=JSON.parse(readFileSync(resolve(additional),'utf8'));
assert.equal(e.allAuthenticatedOriginal2022SourcePages.length,23);
for(const p of e.allAuthenticatedOriginal2022SourcePages){
 let key=firstLast(p.person);key=aliases.get(key)||key;
 const person=unique.get(key);
 if(person)reportMap.get(person.officialName).originalArchivedSiteBodiesInSelectedReceiptLedgers++;
}
const rows=[...reportMap.values()].sort((a,b)=>a.officialName.localeCompare(b.officialName));
for(const m of rows){
 m.ledgersWithFirstPartyOriginalIssueExcerpts.sort();
 m.documentSourceKinds=m.ledgersWithFirstPartyOriginalIssueExcerpts.map(x=>x.split('/').at(-1));
 if(m.originalSiteQuoteLeadCount>0)m.sourceCoverageState='first_party_original_issue_excerpts_in_research_ledger';
 else if(m.originalArchivedSiteBodiesInSelectedReceiptLedgers>0)
  m.sourceCoverageState='archived_original_site_bodies_in_selected_receipts_but_no_site_quote_in_counted_ledgers';
}
const withQuote=rows.filter(m=>m.originalSiteQuoteLeadCount>0);
const withArchiveOnly=rows.filter(m=>m.originalSiteQuoteLeadCount===0&&m.originalArchivedSiteBodiesInSelectedReceiptLedgers>0);
const summary={actualServingStateSenators:rows.length,
 originalGovernmentDirectoryAllHistoricServiceRows:directory.senators.length,
 originalGovernmentDirectoryOutside2021To2025:directory.senators.length-roster.length,sourceOriginalGovernmentSHA256:sha(source),
 independentOriginalSpecialSwearingSHA256:sha(swearing),
 actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt:withQuote.length,
 actuallyServedSenatorsWithOriginalSiteBodiesButNoSelectedQuote:withArchiveOnly.length,
 actuallyServedSenatorsUnobservedInSelectedOriginalSiteSourceLedgers:rows.length-withQuote.length-withArchiveOnly.length,
 totalExactResearchExcerptRowsForVerifiedSenators:rows.reduce((s,m)=>s+m.originalSiteQuoteLeadCount,0),
 nonMatchingRowsExcludedOrNeedsSeparateIdentityProof:unmatched.length,
 sourceCompleteForAllMemberYears:false,originalCampaignSiteFullCensusProven:false,
 originalSOSFiledWebsiteAssignmentsVerified:false,forecastEvidenceAutoEligible:0,
 productionDatabaseReadsWritesOrForecastChanges:0};
const result={schema:'mn-2021-25-95-real-state-senator-original-first-party-research-coverage-v1',
 scope:{issue:864,serviceYears:years,originalMemberGovernmentSource:'https://www.lrl.mn.gov/legdb/senate_dir',
 sourceIsOriginalGovernmentNotElectionWinnerOr2026CurrentOfficeHolderCensus:true,
 researchQuotesCannotProveNoUnobservedPolicy:true,
 archivedByUtcNotFirstAuthoredUtc:true,includesPreviouslyWritten2012And2016SiteContent:true,
 excludesNonServingQuotedCandidatesFromSenatorCount:true,
 noForecastSourceEligibilityOrSenateOfficialVotesInferred:true},
 summary,byActuallyServedSenator:rows,excludedNonMatchingCampaignCandidateLeadRows:unmatched};
mkdirSync(outDir,{recursive:true});
writeFileSync(join(outDir,'95-senators-public-campaign-coverage.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
const md=['# 2021–2025 Minnesota Senate: original first-party historical campaign research inventory',
 '', 'This is a **read-only research coverage inventory** of actual state senators, not a statewide campaign statement completeness certificate.',
 '', '- Original independent Minnesota LRL government service SHA-256: '+govHash,
 '- Original official actual-serving persons in 2021–2025: **'+summary.actualServingStateSenators+'**',
 '- Persons with already verified source-research statement ledgers: **'+summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt+'**',
 '- Archived site body in selected receipts but zero selected quote leads: **'+summary.actuallyServedSenatorsWithOriginalSiteBodiesButNoSelectedQuote+'**',
 '- No matching website excerpt or included page receipt in this bounded inventory: **'+summary.actuallyServedSenatorsUnobservedInSelectedOriginalSiteSourceLedgers+'** (not proof of no policy)',
 '- Historical exact short lead rows for independently matched actual senators: **'+summary.totalExactResearchExcerptRowsForVerifiedSenators+'** (not necessarily distinct promises)',
 '', '| Actual state senator | Served during | Exact site lead rows | Source status |',
 '| --- | --- | ---: | --- |'];
for(const row of rows)md.push('| '+row.officialName+' | '+row.yearsActuallyServed.join(', ')+' | '+row.originalSiteQuoteLeadCount+' | '+row.sourceCoverageState+' |');
md.push('','Excluded/no unique original official service match: '+unmatched.length+
 ' lead observations, detailed in JSON; these are not used to count actual senators.',
 '','Historical old website copy, capped CDX samples, missing original HTML and non-2020 campaign branding all remain explicitly unresolved; no database or model changes.');
writeFileSync(join(outDir,'95-senators-public-campaign-coverage.md'),md.join('\n')+'\n',{flag:'wx'});
console.log('OFFICIAL 95 ACTUALLY SERVED SENATOR SOURCE COVERAGE '+JSON.stringify(summary));
