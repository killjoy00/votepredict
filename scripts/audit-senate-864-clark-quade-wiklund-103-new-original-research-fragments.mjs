/**
 * #864 original source reconstruction and short fragment audit.
 * Seven candidate-owned original election-period pages plus five separately
 * typed publisher / caucus direct-answer originals, 103 short research excerpts.
 * Never convert candidate words into roll call votes, stance predictions or
 * 2020 campaign sites for Bakk/Tomassoni/Wiger.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
  from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const av=process.argv.slice(2);
function arg(name){const i=av.indexOf(name);assert.ok(i>=0&&av[i+1]&&!av[i+1].startsWith('--'),'Required '+name);return resolve(av[i+1]);}
const base=resolve('data/evaluation'),dir={clark2025:arg('--clark-original-dir'),low2022:arg('--low-original-dir')};
const out=arg('--out-dir');mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
function get(p,min=10,max=8000000){const s=statSync(p);assert.ok(s.isFile()&&s.size>=min&&s.size<=max,'Missing evidence '+p);return readFileSync(p);}
const receipt=JSON.parse(get(join(base,'senate-864-new-2022-25-deep-original-source-receipts-v1.json')).toString());
const campaign=JSON.parse(get(join(base,'senate-864-three-sparse-candidate-2022-25-original-site-policy-expansion-v1.json')).toString());
const publisher=JSON.parse(get(join(base,'senate-864-low-covered-2022-original-publisher-candidate-questionnaires-issue-fragments-v1.json')).toString());
assert.equal(receipt.issue,864);assert.equal(campaign.issue,864);assert.equal(publisher.issue,864);
assert.equal(receipt.pages.length,12);assert.equal(campaign.addedCandidateOwnedRows,78);
assert.equal(publisher.addedPublisherDirectShortResearchRows,25);
assert.equal(campaign.exactCandidateOwnedResearchFragments.length,78);
assert.equal(publisher.exactPublisherCandidateShortResearchFragments.length,25);
assert.equal(receipt.originalOwnedSiteCoveragePeople,92);
assert.equal(receipt.originalOwnedSiteResearchRows,1194);
assert.equal(receipt.sourceGovernmentSha256,'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51');
const gov=get(arg('--official-html'),9000);
const govReceipt=JSON.parse(get(arg('--official-receipt')).toString());
const swear=get(arg('--official-special-swearing-html'),9000);
assert.equal(sha(gov),receipt.sourceGovernmentSha256);
assert.equal(govReceipt.source.sourceBytesSha256,sha(gov));
assert.equal(govReceipt.supplementalSwearingSource.sourceBytesSha256,sha(swear));
const coverage=JSON.parse(get(arg('--coverage-json'),9000).toString());
assert.equal(coverage.summary.actualServingStateSenators,95);
assert.equal(coverage.summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt,92);
assert.equal(coverage.summary.totalExactResearchExcerptRowsForVerifiedSenators,1194);
assert.equal(coverage.summary.sourceOriginalGovernmentSHA256,sha(gov));
const people=new Map(coverage.byActuallyServedSenator.map(x=>[x.officialName,x]));
const clean=s=>String(s).normalize('NFKC').toLowerCase().replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,'-').replace(/\s+/g,' ').trim();
function findSegment(s,initial,final){
 const start=s.indexOf(clean(initial));assert.ok(start>=0,'Cannot locate speaker START: '+initial);
 const finish=s.indexOf(clean(final),start+clean(initial).length);
 assert.ok(finish>start,'Cannot locate END: '+final);
 return s.slice(start,finish);
}
const doc=new Map();
for(const p of receipt.pages){
 assert.ok(!doc.has(p.id),'duplicate source ID');
 assert.ok(people.has(p.officialName),'Non-actual serving senator '+p.officialName);
 const raw=get(join(dir[p.archiveArtifactGroup],p.originalHtmlFile),1000);
 const cdx=get(join(dir[p.archiveArtifactGroup],p.originalCdxFile),100);
 assert.equal(sha(raw),p.originalHtmlSHA256,'Wrong entire original HTML '+p.id);
 assert.equal(sha(cdx),p.entireOriginalCdxSHA256,'Wrong original complete CDX '+p.id);
 assert.equal(historicalArchiveSha1Base32(raw),p.indexedOriginalSHA1Base32,'Original index digest mismatch '+p.id);
 const parsed=JSON.parse(cdx.toString());
 assert.deepEqual(parsed[0],['timestamp','original','mimetype','statuscode','digest','length']);
 const timestamp=p.capturedUtc.replace(/\D/g,'').slice(0,14);
 const matching=parsed.slice(1).filter(r=>r[0]===timestamp&&r[4]===p.indexedOriginalSHA1Base32&&r[3]==='200');
 assert.ok(matching.length>=1,'Original timestamp/digest absent in *complete* CDX '+p.id);
 assert.ok(new Date(p.capturedUtc).getTime()<new Date(p.id==='clark25'?'2025-01-28T00:00:00Z':'2022-11-08T00:00:00Z').getTime(),'Post-election capture is inadmissible');
 const visible=clean(originalCampaignVisibleText(raw));
 assert.ok(visible.length>=280,'Empty or placeholder original body '+p.id);
 const last=p.officialName.split(' ').at(-1);assert.ok(visible.includes(clean(last)),'No candidate identity '+p.id);
 if(p.category==='owned'){
  assert.ok(visible.includes(p.id.startsWith('quade22')?'erin maye quade for mn state senate':p.id==='clark25'?'doron clark for senate':'wiklund for senate'),'Campaign title identity anchor missing '+p.id);
  if(p.id.startsWith('quade22'))assert.ok(visible.includes('prepared and paid for by the erin maye quade for senate committee'),'Missing original paid for attribution '+p.id);
  if(p.id==='wiklund22')assert.ok(visible.includes('as the 2022 campaign season gets underway'),'No election-year anchor on Wix site');
 }else if(p.id==='weber22')assert.ok(visible.includes('billl weber (r) district 21'),'Bill Weber Q&A identity missing');
 else if(p.id==='klein22-reader')assert.ok(visible.includes('candidates for senate district 53'),'Reader source speaker missing');
 else if(p.id==='klein22-guide')assert.ok(visible.includes('minnesota senate district 53'),'East Metro voter guide missing office');
 else if(p.id==='quade22-interview')assert.ok(visible.includes('how would you briefly summarize your platform'),'Direct interview questions missing');
 else if(p.id==='dziedzic22-caucus')assert.ok(visible.includes('by senator kari dziedzic'),'Direct caucus statement attribution missing');
 let speaker=visible;
 if(p.id==='weber22')speaker=findSegment(visible,'billl weber (r) district 21','gene dornink (r) district 23');
 if(p.id==='klein22-reader')speaker=findSegment(visible,'candidates for senate district 53','chris rausch');
 if(p.id==='klein22-guide')speaker=visible.slice(visible.lastIndexOf('candidate bio'));
 if(p.id==='quade22-interview')speaker=findSegment(visible,'why did you choose this seat?','where can we find out more about you?');
 if(p.id==='dziedzic22-caucus')speaker=findSegment(visible,'in the wake of the leaked draft','senator kari dziedzic senate district 60');
 if(p.id==='wiklund22')speaker=findSegment(visible,'dear friends and neighbors','about deep roots in our communities');
 doc.set(p.id,{p,speaker,originalFullVisibleChars:visible.length});
}
const byPerson=new Map(),byPage=new Map(),byIssue=new Map(),fragments=new Set();
const site=campaign.exactCandidateOwnedResearchFragments,pub=publisher.exactPublisherCandidateShortResearchFragments;
function verify(r,expected){
 const match=doc.get(r.pageId);assert.ok(match,'Unknown page '+r.id+' '+r.pageId);
 const p=match.p;assert.equal(p.category==='owned'?'owned':'publisher',expected,'Source category contamination '+r.id);
 assert.ok(/^[a-z0-9_]+$/.test(r.issueFamily));
 assert.ok(typeof r.cautiousMeaning==='string'&&r.cautiousMeaning.length>=8);
 assert.ok(typeof r.exactShortExcerpt==='string'&&r.exactShortExcerpt.length>=6&&r.exactShortExcerpt.length<=125);
 assert.equal(r.automaticallyForecastEligible,false,'Must not opt into model');
 const exact=clean(r.exactShortExcerpt);
 assert.ok(!fragments.has(p.officialName+'|'+exact),'Duplicate new excerpt '+p.officialName+' '+r.id);
 fragments.add(p.officialName+'|'+exact);
 assert.ok(match.speaker.includes(exact),'EXACT CANDIDATE-SCOPED FRAGMENT NOT FOUND '+r.id+' '+p.id+' '+JSON.stringify(r.exactShortExcerpt));
 byPerson.set(p.officialName,(byPerson.get(p.officialName)||0)+1);
 byPage.set(p.id,(byPage.get(p.id)||0)+1);
 const issueKey=p.officialName+'|'+r.issueFamily;
 byIssue.set(issueKey,(byIssue.get(issueKey)||0)+1);
 return {id:r.id,page:p.id,originalWholeHTMLVerified:true,originalCDXSHA1Verified:true,candidateSpeakerScoped:true,
  previousLegislativeVoteNotVerified:true,originalTimestampNotAuthorshipTime:true};
}
const checked=[...site.map(r=>verify(r,'owned')),...pub.map(r=>verify(r,'publisher'))];
assert.equal(checked.length,103);
assert.equal([...doc.values()].filter(x=>x.p.category==='owned').length,7);
assert.equal([...doc.values()].filter(x=>x.p.category!=='owned').length,5);
for(const p of receipt.pages)assert.ok(byPage.get(p.id)>0,'No selected source excerpt from '+p.id);
assert.equal(byPerson.get('Doron Clark'),36);
assert.equal(byPerson.get('Melissa Halvorson Wiklund'),12);
assert.equal(byPerson.get('Erin K. Maye Quade'),35);
assert.equal(byPerson.get('Matt D. Klein'),14);
assert.equal(byPerson.get('Bill Weber'),3);
assert.equal(byPerson.get('Kari Dziedzic'),3);
const report={schema:'senate-864-103-candidate-original-indexed-full-html-and-scoped-quote-independent-audit-v1',
 issue:864,authenticatedHistoricalOriginalSourcePages:doc.size,
 sourceTypes:{candidateOwnedSite:7,publisherOrCaucusDirectStatements:5},
 candidateOwnedNewExactFragments:site.length,publisherAndCaucusNewExactFragments:pub.length,
 exactSpeakerScopedFragmentsAuthenticated:checked.length,
 historicFirstPartyWebsitePeopleRemain:92,priorOriginalSiteExcerptRows:1194,
 newCandidateOwnedSiteExcerptResearchRowsAdditive:site.length,
 cumulativeIndependentlySelectedSiteExcerptsAfterAddendum:1194+site.length,
 sourceCoverageNotCandidateOwnedPublisherMaterial:pub.length,
 senatorBySenatorCount:Object.fromEntries(byPerson),sourceBySourceCount:Object.fromEntries(byPage),
 verifiedIssueFamilyCountBySenator:Object.fromEntries(byIssue),
 originalSourceReceiptReference:'data/evaluation/senate-864-new-2022-25-deep-original-source-receipts-v1.json',
 proofs:checked,sourceQuotesAreNotVerifiedVotes:true,firstAuthorshipDateUnknown:true,
 clark2025OriginalAfterJan14PrimaryButBeforeJan28General:true,notProductionReadOrWrite:true,
 noTrainingForecastVotingPredictionChanges:true,olderServiceRetained:true};
writeFileSync(join(out,'senate-864-original-103-scoped-short-research-fragment-audit.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const lines=['# Senate #864: 103 independently original-source-audited short research positions','',
 'Original candidate-owned historical campaign site: **'+site.length+'** additional excerpts across Doron Clark, Melissa Wiklund, and Erin Maye Quade.',
 'Original publisher candidate Q&As and caucus direct statement: **'+pub.length+'** separately sourced excerpts across Bill Weber, Matt Klein, Erin Maye Quade and Kari Dziedzic.',
 'No new senator website *person* coverage; remains **92/95**. Selected candidate-owned excerpts are **1194 baseline + '+site.length+' additive = '+(1194+site.length)+'**.',
 '', '**Caveats:** This is an indexed SHA1-and-SHA256 whole-original audit with source-local literal candidate quote scope, not claim of 2022 original authorship day or a certified roll call. Clark was captured January 16, 2025 after the January 14 primary and before January 28 general. No Doron January 2025 PDF version has been certified.',
 '', '| Actually-serving senator | New original site excerpts | New publisher/caucus excerpts |',
 '|---|---:|---:|'];
for(const name of [...byPerson.keys()].sort()){
 const c=site.filter(r=>doc.get(r.pageId).p.officialName===name).length;
 const q=pub.filter(r=>doc.get(r.pageId).p.officialName===name).length;
 lines.push('| '+name+' | '+c+' | '+q+' |');
}
lines.push('', '## Verified source captures');
for(const p of receipt.pages)lines.push('- '+p.officialName+' — '+p.category+' — original public by '+p.capturedUtc+' — '+p.url);
lines.push('','Published source quote fragments are intentionally not reproduced in this brief. Exact short research fragments live in the committed typed ledger with archive SHA256+SHA1 evidence in the separate receipt register.','','## Still unresolved','- Tom Bakk, David Tomassoni and Charles Wiger original historic candidate-owned campaign site body bytes remain unobserved; earlier third-party direct evidence is separate.','- Doron candidate-completed Jan2025 DFL questionnaire current PDF body was not proven to match its historical version.');
writeFileSync(join(out,'senate-864-103-new-2022-25-original-issue-fragments-summary.md'),lines.join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify({verifiedPages:doc.size,newSiteFragments:site.length,
 newPublisherFragments:pub.length,candidateSitePeople:92,totalAdditiveSiteResearchRows:1194+site.length,byPerson:Object.fromEntries(byPerson)},null,2));
