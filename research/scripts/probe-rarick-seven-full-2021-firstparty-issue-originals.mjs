/**
 * Issue #864: recovered high-value 2021 historical Rarick issue subpage originals.
 * Reopen exact full previously independent 32-row Wayback CDX and original official
 * LRL 105-person service source, never infer first post date or official votes.
 * No production evidence/model/forecast/database/scheduler writes.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const expectedLRL='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const expectedCdx='c0f0bece80b238cd4a92583823e6d96e72f191de164e43d88a9dbe3327dc60bb';
const ar=process.argv.slice(2);
function opt(k){const i=ar.indexOf(k);assert.ok(i>=0&&ar[i+1]&&!ar[i+1].startsWith('--'),'Missing '+k);return resolve(ar[i+1]);}
function source(p,min=100,max=6000000){const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,p);return readFileSync(p);}
const gov=source(opt('--official-html'),9000),audit=JSON.parse(source(opt('--official-receipt')).toString());
const swear=source(opt('--official-special-swearing-html'),9000),out=opt('--out-dir');
assert.equal(sha(gov),expectedLRL);
assert.equal(audit.source.sourceBytesSha256,expectedLRL);
assert.equal(sha(swear),audit.supplementalSwearingSource.sourceBytesSha256);
const official=parseOfficialMnSenateServiceDirectory(gov,audit.source.observedAt,
 swear,audit.supplementalSwearingSource.observedAt);
assert.equal(official.senators.length,105);
const actual=validateActualSenateServiceForElection(official,'Jason Rarick','11',2022);
assert.equal(actual.status,'verified_senate_service');
assert.equal(actual.serviceForThisElectionFollowingYearVerified,true);
assert.equal(actual.officialName,'Jason Rarick');
const dir=opt('--previous-first20-original-dir');
const manifest=JSON.parse(source(join(dir,'first-20-senators-historical-candidate-site-originals-manifest.json')).toString());
assert.equal(manifest.schema,'mn-2021-25-first-batch-20-uncovered-actual-senators-26-original-archive-search-windows-v1');
assert.equal(manifest.independentGovernmentLRLSourceSha256,expectedLRL);
assert.equal(manifest.actualServingStateSenatorsVerifiedAgainstGovernmentBeforeArchiveNetwork,20);
const window=manifest.originalSourceWindows.find(w=>w.person==='Jason Rarick'&&w.originalCandidateDomainLead==='jasonrarick.com');
assert.ok(window);
assert.equal(window.indexHttpStatus,200);
assert.equal(window.indexError,null);
assert.equal(window.indexRows,32);
assert.equal(window.fullOriginalCdxResponseSha256,expectedCdx);
const indexOriginal=source(join(dir,'10-jason-rarick-2022-entire-original-cdx.json'),3000);
assert.equal(sha(indexOriginal),expectedCdx);
const rows=JSON.parse(indexOriginal.toString());
assert.deepEqual(rows[0],['timestamp','original','mimetype','statuscode','digest','length']);
assert.equal(rows.length-1,32);
const targeted=[
 ['second_amendment','20210616114222','https://www.jasonrarick.com/2nd-amendment','5JQIDF5D6XIXBIRYN2ZZ6JFCONRN7Z5B'],
 ['family_values','20210616111111','https://www.jasonrarick.com/family-values','WXMYTISTHLT5EKFWCDCECDRZATNFYPMY'],
 ['rural_economy','20210616094345','https://www.jasonrarick.com/growing-rural-minnesota-s-economy','LG52EVT4RFQ764HZ6GB6A4GMSAMZH2QK'],
 ['higher_education','20210616110639','https://www.jasonrarick.com/higher-education','CLYJNV55UNGE6JXKJI6N3KVKTXZ3KRCA'],
 ['k12_education','20210308182416','https://www.jasonrarick.com/k-12-education','R55CQVNWBUM52JGXR2WEV3O7G7YMK45Y'],
 ['seniors','20210512114113','https://www.jasonrarick.com/seniors','XIZBVYOXZMOZP2GNEFK7VUBIQ6T2OGCN'],
 ['transportation','20210512101723','https://www.jasonrarick.com/transportaion','5APACAZ7YDSVX2TRLHRCJHURALOTS7PA']
];
assert.equal(targeted.length,7);
assert.equal(new Set(targeted.map(v=>v[2])).size,7);
for(const [topic,timestamp,url,digest] of targeted){
 assert.ok(timestamp<'20221108000000');
 assert.equal(rows.slice(1).filter(v=>v[0]===timestamp&&v[1]===url&&v[2]==='text/html'&&v[3]==='200'&&v[4]===digest).length,1);
}
mkdirSync(out,{recursive:true});
async function getOne(url){
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const r=await fetch(url,{headers:{'User-Agent':'Minnesota-Senate-2021-Historical-Original-Source-Audit/1.0'},
    signal:AbortSignal.timeout(35000)});
   const bytes=Buffer.from(await r.arrayBuffer());
   assert.ok(bytes.length<4000000);
   if((r.status===429||r.status===502||r.status===503||r.status===504)&&attempt<3)
    continue;
   return {status:r.status,bytes,attempt,actualResponseUrl:r.url,contentType:r.headers.get('content-type')};
  }catch(e){
   if(attempt===3)return {status:null,bytes:Buffer.alloc(0),attempt,error:String(e).slice(0,200)};
  }
 }
 throw Error('unreachable');
}
const result=await Promise.all(targeted.map(async([topic,timestamp,url,digest])=>{
 const archiveReplay='https://web.archive.org/web/'+timestamp+'id_/'+url;
 const r=await getOne(archiveReplay);
 const originalUtc=timestamp.replace(/^(....)(..)(..)(..)(..)(..)$/,'$1-$2-$3T$4:$5:$6.000Z');
 const item={topic,originalCandidateUrl:url,archiveCaptureUtc:originalUtc,archiveUrl:archiveReplay,
  sha1IndexedInIndependentOriginal32RowCdx:digest,archiveReplayedHttpStatus:r.status,
  archiveReplayAttempts:r.attempt,archiveResponseUrl:r.actualResponseUrl||null,
  completeResponseBytesSha256:r.bytes.length?sha(r.bytes):null,
  originalFullHtmlFile:null,verifiedOriginalHtmlSha1AgainstOriginalCdx:false,
  visibleCandidateName:false,visibleSenateCampaignFooter:false,originalVisibleFirst6000:null,
  originalPolicyKeywordWindows:[],noAutomatedOfficialVoteOrPersonalPolicyInferences:true,
  missingArchiveIsUnknownNotAbsence:true};
 if(r.status===200&&r.bytes.length>=500){
  const digestValid=historicalArchiveSha1Base32(r.bytes)===digest;
  item.verifiedOriginalHtmlSha1AgainstOriginalCdx=digestValid;
  if(digestValid){
   const v=originalCampaignVisibleText(r.bytes);
   item.visibleCandidateName=/Jason Rarick|Rarick for/i.test(v);
   item.visibleSenateCampaignFooter=/Prepared and Paid for by Rarick for Senate/i.test(v);
   if(item.visibleCandidateName&&item.visibleSenateCampaignFooter){
    item.originalFullHtmlFile='rarick-'+topic+'-'+timestamp+'-full-original.html';
    writeFileSync(join(out,item.originalFullHtmlFile),r.bytes,{flag:'wx'});
    item.originalVisibleFirst6000=v.slice(0,6000);
    const match=/\b(education|tax|schools?|college|farmers|rural|roads?|infrastructure|broadband|energy|students|firearms|guns|seniors|transportation|business)\b/ig;
    item.originalPolicyKeywordWindows=[...v.matchAll(match)].slice(0,12).map(m=>v.slice(Math.max(0,m.index-90),Math.min(v.length,m.index+160)));
   }
  }
 }
 console.log('RARICK EXACT ORIGINAL '+JSON.stringify({topic,status:item.archiveReplayedHttpStatus,
  CDXShaMatched:item.verifiedOriginalHtmlSha1AgainstOriginalCdx,
  candidateFooter:item.visibleSenateCampaignFooter,fullSource:item.originalFullHtmlFile}));
 return item;
}));
const report={schema:'mn-senate-rarick-seven-2021-issue-subpage-originals-from-previous-complete-32-row-cdx-v1',
 issue:864,previousOriginalSourceRun:38175993447,previousOriginalSourceArtifact:11716126718,
 originalLRLGovernmentSha256:sha(gov),originalWholeCdxSha256:sha(indexOriginal),
 actualSenatorServing2021to2025:'Jason Rarick',
 candidateElectionDistrict:'11',targetedOriginalIssuePages:7,
 exactCDXIndexedOriginalsPriorTo2022Election:7,
 independentlyAuthenticatedCandidatePaidFullHTML:result.filter(x=>x.originalFullHtmlFile).length,
 archivalCaptureUTCNotFirstAuthoredDate:true,notEntireOriginalSiteCensus:true,
 originalSourceQuotedPositionsAutomaticallyAdded:0,productionDatabaseWritesOrForecastTrainingOrSchedulerChanges:0,
 sourcePages:result};
writeFileSync(join(out,'rarick-seven-2021-full-original-issues-recovery-manifest.json'),
 JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('RARICK SEVEN SOURCE ORIGINALS '+JSON.stringify({targeted:7,
 fullFirstPartyOriginalHtml:report.independentlyAuthenticatedCandidatePaidFullHTML,production:0}));
