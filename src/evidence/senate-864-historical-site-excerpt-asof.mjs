/**
 * #864: Candidate-owned website words are data, not proven personal convictions or votes.
 * No stance classifier: mechanical excerpt, original URL/hash, and archived observation clock.
 */
import {createHash} from 'node:crypto';
import {SOURCE_LEDGER_FILES,assertManifest,canonicalKey} from './senate-864-95-historical-source-neon-parity.mjs';
const SHA=/^[a-f0-9]{64}$/i,CDX=/^[A-Z2-7]{32}$/;
const strings=values=>values.filter(x=>typeof x==='string'&&x.trim());
function take(o,keys){
 if(!o||typeof o!=='object'||Array.isArray(o))return null;
 const lower=new Map(Object.entries(o).map(([k,v])=>[k.toLowerCase(),v]));
 for(const k of keys){const v=lower.get(k.toLowerCase());if(typeof v==='string'&&v.trim())return v.trim()}
 return null;
}
const URLS=['originalUrl','sourceOriginalUrl','originalURL','originalPageUrl','originalSiteUrl','archivedOriginalSiteUrl','originalSiteURL','originalPageURL','originalSourceUrl','originalPageUrl','url','sourceURL'];
const HASHES=['originalHtmlSha256','actualOriginalHtmlSha256','originalHTMLSHA256','originalFullHtmlSHA256','originalRawHtmlSha256','fullHTMLSHA256','fullHtmlSha256','originalBodySha256','actualOriginalBodySha256','originalHtmlResponseSha256','htmlSha256','sourceSHA256','sha256','sha'];
const DATES=['archiveCaptureUtc','archiveCapturedAtUtc','archiveCaptureUTC','archivePublicByUtc','archivePublicByUTC','captureUtc','capturedAtUtc','sourceArchiveCaptureAt','originalArchiveCaptureAtUtc','originalCampaignSiteCaptureAtUtc','originalArchiveCaptureUtc','archiveCapturePublicByUTC','capture','capturedUtc','observedUTC','publicByUtc','originalCandidateWebsiteTextPublicByUtc','archivedOriginalCapturedAtUtc','originalFullArchiveCapturedAtUtc','actualArchiveCaptureUtc','originalHistoricalArchivedUTC','historicOriginalArchivedUTC','originalArchiveCapturedAtUtc'];
const DIGESTS=['originalArchiveCdxSha1Base32','originalCdxSha1Base32','originalCdxSHA1Base32','originalCDXSHA1','originalCdxSHA1','originalCdxIndexedSha1Base32','archiveOriginalCdxDigestSha1Base32','independentlyIndexedCdxPayloadSha1Base32','originalHistoricalCdxIndexBase32Sha1','independentIndexedCDXSHA1Base32','originalIndexedSha1Base32','originalCdxSha1','cdxSha1','sha1','digest'];
const FILES=['originalHtmlFile','originalSourceFile','originalFile','htmlFile','rawHtmlFile','originalRawHtmlFile','originalHtmlArtifactFile','originalHtmlFileName','file','sourceFile','pageFile','originalHTMLFile','originalFullPageFile','sourceEntireHtmlFilename'];
const NAMES=['officialSenateDirectoryName','officialSenatorName','person','servingSenator','senator','attributedTo','candidateName','actualSenator','name'];
const ROWREFS=['pageId','sourcePageId','page','originalPageSectionId','section','sourceSection','part','sourcePage','sourceSnapshotToBeRecheckedByOfflineAudit'];
const EXCERPTS=['exactShortExcerptFromOriginalArchivedPage','exactCandidateOwnedOriginalHTMLExcerpt','exactVisibleFirstPartyCampaignExcerpt','exactOriginalVisibleText','exactOriginalShortExcerpt','exactCandidateSiteShortExcerpt','exactShortExcerpt','exactExcerpt','quotedExcerpt','exactVisibleCandidatePolicyExcerpt','quote','excerpt'];
function stamp(v){
 if(typeof v!=='string'||!v.trim())return null;
 const t=Date.parse(v);
 if(!Number.isFinite(t)||t<Date.UTC(2000,0,1)||t>Date.UTC(2026,9,16))return null;
 return new Date(t).toISOString();
}
function origin(v){
 if(typeof v!=='string')return null;
 try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&!u.hostname.endsWith('web.archive.org')?v:null}catch{return null}
}
function hash(v){return typeof v==='string'&&SHA.test(v)?v.toLowerCase():null}
function evidenceText(o){
 for(const k of EXCERPTS){const v=take(o,[k]);if(v&&v.length>=5&&v.length<=1600)return v}
 const generic=Object.entries(o).filter(([k,v])=>typeof v==='string'&&v.length>=5&&v.length<=1600&&/^(exact|quoted|quote)/i.test(k)&&/(excerpt|quote|literal|text)/i.test(k));
 return generic.length===1?generic[0][1].trim():null;
}
function allCandidates(doc){
 const sourceArrays=[];
 for(const [k,v] of Object.entries(doc))if(Array.isArray(v)&&v.length&&v[0]&&typeof v[0]==='object'){
  if(k==='candidates')continue;
  if(!/excerpt|statement|quote|shortIssues|^issues$|^rows$/i.test(k))sourceArrays.push([k,v]);
 }
 return sourceArrays.flatMap(([key,arr])=>arr.map(o=>({key,...o})));
}
function excerptsFor(doc,path){
 if(Array.isArray(doc.candidates)&&doc.candidates.every(c=>Array.isArray(c.excerpts)))
  return doc.candidates.flatMap(c=>c.excerpts.map(x=>({...x,_candidate:c.candidateName,_page:c.originalHtmlSource,_sourceCandidate:c})));
 const sets=Object.entries(doc).filter(([k,v])=>Array.isArray(v)&&v.length&&v[0]&&typeof v[0]==='object'
   &&(/excerpt|statement|quote|^shortIssues$|^issues$|^rows$/i.test(k))
   &&!/^unresolved|excluded|zero|^source|^originalCandidateIssueSourcePages$/i.test(k));
 if(sets.length!==1)throw Error('Ambiguous research excerpt set '+path+': '+sets.map(x=>x[0]).join(','));
 return sets[0][1];
}
function sourceFrom(o,more={}){
 return {
  url:origin(take(o,URLS))||more.url||null,
  sha:hash(take(o,HASHES))||more.sha||null,
  capture:stamp(take(o,DATES))||more.capture||null,
  cdx:CDX.test(take(o,DIGESTS)||'')?take(o,DIGESTS):more.cdx||null,
  file:take(o,FILES)||more.file||null,
  name:take(o,NAMES)||more.name||null,
  id:take(o,['id','pageId'])||more.id||null,
 };
}
const key=r=>[r.url,r.sha,r.capture].join('|');
function consolidate(list){
 const result={};
 for(const field of ['url','sha','capture','cdx','file','name','id']){
  const vals=[...new Set(strings(list.map(x=>x[field])))];
  if(vals.length>1)return null;
  result[field]=vals[0]||null;
 }
 return result;
}
function merge(a,b){
 if(!a)return b;
 if(!b)return a;
 const out={};
 for(const field of ['url','sha','capture','cdx','file','name','id']){
  if(a[field]&&b[field]&&a[field]!==b[field])return null;
  out[field]=a[field]||b[field]||null;
 }
 return out;
}
export const MIN_REPLAY_VERSION='senate-864-website-literal-asof-v1';
export function websiteExcerptPlan(manifest,docs,knownOriginals=[]){
 assertManifest(manifest);
 const byPerson=new Map(manifest.people.map((p,i)=>[canonicalKey(p.officialName),i+1]));
 const indexSha=new Map(),pageCounts=new Map();
 const ledgers=[];
 for(const path of SOURCE_LEDGER_FILES){
  const d=docs.get(path);
  if(!d||typeof d!=='object')throw Error('Missing pinned historical research ledger');
  const pages=allCandidates(d);
  pageCounts.set(path,pages.length);
  const sources=pages.filter(p=>sourceFrom(p).sha).map(sourceFrom);
  ledgers.push({path,doc:d,pages,rows:excerptsFor(d,path),sources});
  for(const src of sources){
   const a=indexSha.get(src.sha)||[];a.push(src);indexSha.set(src.sha,a);
  }
 }
 for(const p of knownOriginals){
  const s=sourceFrom(p,{
   url:p.originalUrl,sha:p.originalHtmlSha256,
   capture:p.originalArchiveCapturedAtUtc,cdx:p.originalArchiveCdxSha1Base32,
   name:p.officialName,file:p.originalHtmlArtifactFile
  });
  if(s.sha){const a=indexSha.get(s.sha)||[];a.push(s);indexSha.set(s.sha,a)}
 }
 const status={},ready=[],holds=[],seen=new Set();
 for(const {path,doc,pages,rows,sources} of ledgers){
  const byId=new Map(),byFile=new Map();
  for(const p of pages){
   const s=sourceFrom(p);
   if(s.id){const arr=byId.get(s.id)||[];arr.push(s);byId.set(s.id,arr)}
   if(s.file){const arr=byFile.get(s.file)||[];arr.push(s);byFile.set(s.file,arr)}
  }
  const scopeName=take(doc.scope,['person','senator','officialName'])||
   take(doc,['person','actualSenator','senator'])||null;
  for(const row of rows){
   const ref=take(row,ROWREFS);
   let candidate=ref?consolidate(byId.get(ref)||[]):null;
   if(candidate?.file&&!candidate.sha){
    const refs=byFile.get(candidate.file)||[];
    const match=refs.filter(x=>x.sha);
    if(match.length===1)candidate=merge(candidate,match[0])||candidate;
   }
   if(row._page)candidate=merge(candidate,sourceFrom(row._page,{name:row._candidate}))||candidate;
   const person=take(row,NAMES)||row._candidate||candidate?.name||scopeName||
    (pages.length===1?sourceFrom(pages[0]).name:null);
   const ordinal=byPerson.get(canonicalKey(person));
   const value=evidenceText(row);
   if(!candidate){
    const personPages=pages.map(sourceFrom).filter(p=>p.name&&canonicalKey(p.name)===canonicalKey(person));
    if(personPages.length===1)candidate=personPages[0];
    else if(pages.length===1)candidate=sourceFrom(pages[0]);
   }
   if(candidate?.file){
    const same=byFile.get(candidate.file)||[];
    const richer=same.filter(p=>p.sha||p.url||p.capture);
    if(richer.length===1)candidate=merge(candidate,richer[0])||candidate;
   }
   // Never infer a timestamp from a filename or a current/live website.
   if(candidate?.sha){
    const peers=indexSha.get(candidate.sha)||[];
    for(const field of ['url','capture','cdx']){
     if(candidate[field])continue;
     const vals=[...new Set(strings(peers.map(p=>p[field])))];
     if(vals.length===1)candidate[field]=vals[0];
    }
   }
   const statusKey=!ordinal?'unresolved_official_person':!value?'missing_literal_website_excerpt':
    !candidate?.sha?'missing_original_page_sha':!candidate.url?'missing_original_page_url':
    !candidate.capture?'missing_archived_capture':!candidate.cdx?'missing_original_cdx_digest':
    'ready';
   status[statusKey]=(status[statusKey]||0)+1;
   const recordId=String(row.id||'');
   const id=path+'|'+(recordId||String(rows.indexOf(row)));
   if(seen.has(id))throw Error('Historical excerpt duplicate identity');
   seen.add(id);
   const basic={id,ordinal:ordinal||null,issueTag:take(row,['issueFamily','issue','family','policyArea','topic','category'])||null};
   if(statusKey==='ready'){
    const sha=createHash('sha256').update(MIN_REPLAY_VERSION+'|'+id+'|'+value+'|'+key(candidate)).digest('hex');
    ready.push({...basic,literal:value,sourceUrl:candidate.url,sourceSha:candidate.sha,
     archiveCapturedAt:candidate.capture,originalCdxSha1:candidate.cdx,
     ingestionIdentityKey:sha});
   }else holds.push({...basic,reason:statusKey});
  }
 }
 if(ready.length+holds.length!==1197||seen.size!==1197)
  throw Error('Pinned candidate-site ledger row tally mismatch: '+(ready.length+holds.length)+' / '+seen.size+' versus 1197 literal records');
 return {version:MIN_REPLAY_VERSION,sourceLedgers:ledgers.length,selectedExcerpts:seen.size,manifestAggregateResearchCount:1285,countOnlyNotMaterialized:1285-seen.size,
  sourcePagesIndexed:[...indexSha.keys()].length,ready,holds,holdCounts:status};
}
export function observedBeforeVote(archiveCapturedAt,voteAt){
 const a=stamp(archiveCapturedAt),v=Date.parse(voteAt);
 return Boolean(a&&Number.isFinite(v)&&v<Date.UTC(2100,0,1)&&Date.parse(a)<v);
}
