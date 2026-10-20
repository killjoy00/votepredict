/** Reuse exact retained acquisitions; no new crawl, no DB or outcome access. */
import {mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {RECOVERY_ARTIFACTS,recoveryDocuments,recoveredWebsitePlan,walkObjects} from '../src/evidence/senate-864-website-metadata-recovery.mjs';
import {verifyWitnessBytes,VERIFIED,sha1Base32} from './verify-senate-864-72-original-artifact-bytes.mjs';
import {visibleLiteralText} from '../src/evidence/senate-864-website-expansion.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const value=(o,keys)=>keys.map(k=>o[k]).find(v=>typeof v==='string'&&v)||null;
const fields={file:['originalHtmlFile','originalSourceFile','file','originalFile','rawHtmlFile','sourceFile','pageFile','originalHtmlFileName','retainedRawOriginalHtml','originalFullHtmlFile'],
 sha:['originalHtmlSha256','actualOriginalBodySha256','originalHtmlResponseSha256','htmlSha256','sha256','originalHTMLSHA256','fullResponseSha256','completeResponseBytesSha256'],
 url:['originalUrl','url','originalSiteUrl','originalCandidateUrl'],
 capture:['archiveCaptureUtc','archivePublicByUtc','publicByUtc','captureUtc','sourceArchiveCaptureAt','originalArchiveCaptureAtUtc','archivedOriginalCapturedAtUtc','capturedAtUtc'],
 cdx:['originalArchiveCdxSha1Base32','originalHistoricalCdxIndexBase32Sha1','originalCdxIndexedSha1Base32','sha1IndexedInIndependentOriginal32RowCdx']};
function metadata(o){return Object.fromEntries(Object.entries(fields).map(([k,keys])=>[k,value(o,keys)]))}
function indexedSources(indexes,digest,capture){
 const matches=[];
 for(const idx of indexes){if(!Array.isArray(idx)||!Array.isArray(idx[0]))continue;const h=idx[0];
  if(!['timestamp','original','digest','statuscode','mimetype'].every(k=>h.includes(k)))continue;
  for(const r of idx.slice(1))if(Array.isArray(r)&&r[h.indexOf('digest')]===digest&&String(r[h.indexOf('statuscode')])==='200'&&['text/html','application/xhtml+xml'].includes(r[h.indexOf('mimetype')])){
   const t=String(r[h.indexOf('timestamp')]);if(!/^\d{14}$/.test(t)||capture&&t!==capture.replace(/\D/g,'').slice(0,14))continue;
   matches.push({url:r[h.indexOf('original')],capture:t.replace(/^(....)(..)(..)(..)(..)(..)$/,'$1-$2-$3T$4:$5:$6.000Z')});
  }
 }return [...new Map(matches.map(r=>[JSON.stringify(r),r])).values()];
}
export async function verifyMetadataRecovery(){
 if(process.env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||!process.env.GH_TOKEN)throw Error('Same repository read token required');
 const temp=mkdtempSync(join(tmpdir(),'senate864-metadata-')),archives=new Map(),docs=recoveryDocuments();
 try{
  for(const id of new Set(Object.values(RECOVERY_ARTIFACTS).flat())){
   try{
    const r=await fetch('https://api.github.com/repos/killjoy00/votepredict/actions/artifacts/'+id+'/zip',{headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(45000)});
    if(!r.ok||Number(r.headers.get('content-length'))>25000000)throw Error('Unavailable');
    const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>25000000||bytes[0]!==80||bytes[1]!==75)throw Error('Invalid archive');
    const zip=join(temp,id+'.zip');writeFileSync(zip,bytes,{mode:0o600});
    const names=execFileSync('unzip',['-Z1',zip],{maxBuffer:300000,timeout:8000}).toString().trim().split('\n');
    if(names.length>2000||names.some(n=>n.startsWith('/')||n.includes('..')||n.includes('\\')))throw Error('Unsafe archive');
    const read=n=>execFileSync('unzip',['-p',zip,n],{maxBuffer:3000000,timeout:10000});
    const json=[];for(const n of names.filter(n=>/\.json$/i.test(n)).slice(0,120))try{json.push(JSON.parse(read(n)))}catch{}
    archives.set(id,{names,read,json,zipSha:sha(bytes)});
   }catch{archives.set(id,null)}
  }
  const bodyCache=new Map(),sourceReceipts=[];
  for(const [filename,ids] of Object.entries(RECOVERY_ARTIFACTS)){
   const path='data/evaluation/'+filename,doc=docs.get(path),available=ids.map(id=>archives.get(id)).filter(Boolean),indexes=available.flatMap(a=>a.json);
   walkObjects(doc,o=>{
    const p=metadata(o);if(!p.file||!p.file.endsWith('.html'))return;
    const bodies=available.flatMap(a=>a.names.filter(n=>basename(n)===p.file).map(n=>({a,n})));
    if(bodies.length!==1)return;const bytes=bodies[0].a.read(bodies[0].n);
    const meta=[];for(const a of available)for(const j of a.json)walkObjects(j,r=>{const x=metadata(r);if(x.file===p.file&&x.sha&&x.capture&&x.url)meta.push(x)});
    const exact=[...new Map(meta.map(x=>[JSON.stringify(x),x])).values()];
    if(!p.sha&&exact.length===1){p.sha=exact[0].sha;p.capture=exact[0].capture;p.url=exact[0].url;p.cdx=exact[0].cdx;}
    if(!p.sha||sha(bytes)!==p.sha)return;
    const digest=sha1Base32(bytes);if(p.cdx&&p.cdx!==digest)return;
    if(!p.capture)return;const cdx=indexedSources(indexes,digest,p.capture).filter(r=>!p.url||r.url===p.url);
    if(cdx.length!==1)return;p.url=cdx[0].url;p.cdx=digest;
    const w={recoveryState:'READY_FOR_INDEPENDENT_BYTE_VERIFICATION',originalHtmlSha256:p.sha,originalArchiveCdxSha1Base32:digest,originalUrl:p.url,originalArchiveCapturedAtUtc:p.capture};
    if(verifyWitnessBytes(w,bytes,indexes)!==VERIFIED)return;
    Object.assign(o,{originalHtmlSha256:p.sha,originalUrl:p.url,originalArchiveCaptureAtUtc:p.capture,originalArchiveCdxSha1Base32:digest});
    bodyCache.set(p.sha,bytes);sourceReceipts.push({ledger:path,file:p.file,...w,artifactIds:ids});
   });
  }
  // The final 35 have literal text and explicit people but no page locator.
  // Search only the exact candidate-owned originals declared by their source
  // ledgers, and require literal containment in an independently verified body.
  // This is a text-to-source join, never a name-only source assignment.
  const additional=docs.get('data/evaluation/senate-original-campaign-additional-35-statement-excerpts-v1.json');
  const candidates=docs.get('data/evaluation/senate-authenticated-campaign-issue-excerpt-leads-2024-25-v1.json').candidates;
  const bound=new Map(candidates.map(c=>[c.candidateName,[c.originalHtmlSource.originalHtmlResponseSha256]]));
  bound.set('Carla Nelson',docs.get('data/evaluation/senate-carla-nelson-2022-dated-original-platform-excerpts-v1.json').verifiedOriginals.map(p=>p.originalHtmlSha256));
  bound.set('Nicole Mitchell',docs.get('data/evaluation/senate-nicole-mitchell-2022-original-priorities-excerpts-v1.json').originals.map(p=>p.actualOriginalBodySha256));
  additional.recoveredOriginalReceipts=[];
  for(const row of additional.rows){
   const matches=sourceReceipts.filter(p=>(bound.get(row.person)||[]).includes(p.originalHtmlSha256)&&bodyCache.has(p.originalHtmlSha256)&&visibleLiteralText(bodyCache.get(p.originalHtmlSha256).toString('utf8')).includes(visibleLiteralText(row.exactShortExcerpt)));
   const unique=[...new Map(matches.map(p=>[[p.originalHtmlSha256,p.originalUrl,p.originalArchiveCapturedAtUtc].join('|'),p])).values()]
    .sort((a,b)=>a.originalArchiveCapturedAtUtc.localeCompare(b.originalArchiveCapturedAtUtc)||a.originalHtmlSha256.localeCompare(b.originalHtmlSha256));
   if(!unique.length)continue;
   const p=unique[0],id='literal-contained-'+p.originalHtmlSha256;
   row.pageId=id;
   if(!additional.recoveredOriginalReceipts.some(p=>p.id===id))additional.recoveredOriginalReceipts.push({id,person:row.person,...p});
  }
  const plan=recoveredWebsitePlan(docs),verified=[],held=[];
  for(const row of plan.added){const bytes=bodyCache.get(row.sourceSha);
   if(!bytes){held.push({id:row.id,reason:'exact_original_body_index_verification_missing'});continue}
   if(!visibleLiteralText(bytes.toString('utf8')).includes(visibleLiteralText(row.literal))){held.push({id:row.id,reason:'literal_not_contained_in_original_visible_text'});continue}
   verified.push(row);
  }
  const receipt={schema:'senate864-website-metadata-recovery-v1',observedAt:new Date().toISOString(),reviewedCommit:process.env.GITHUB_SHA,
   existingStoredExcerpts:668,metadataReady:plan.current.ready.length,newMetadataReady:plan.added.length,newOriginalVerifiedExcerpts:verified.length,
   remainingSourceHolds:526-verified.length,knownScopeExclusions:3,unknownPeople:0,sourceReceipts,verified,held,
   metadataHoldCounts:plan.current.holdCounts,archiveDownloads:[...archives].map(([id,a])=>({id,available:!!a,zipSha256:a?.zipSha||null})),
   noDatabaseAccess:true,noOutcomeAccess:true,noFrozenProtocolChange:true};
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/senate864-website-metadata-recovery.json',JSON.stringify(receipt,null,2)+'\n');
  console.log('SENATE864_WEBSITE_METADATA_RECOVERY='+JSON.stringify({metadataReady:receipt.metadataReady,newOriginalVerifiedExcerpts:verified.length,remainingSourceHolds:receipt.remainingSourceHolds,literalHolds:held.filter(r=>r.reason==='literal_not_contained_in_original_visible_text').length,artifactDownloads:receipt.archiveDownloads}));
  // Public original-source metadata and already committed literals only.
  console.log('SENATE864_WEBSITE_METADATA_PUBLIC_RECEIPT='+JSON.stringify(receipt));return receipt;
 }finally{rmSync(temp,{recursive:true,force:true})}
}
if(process.argv[1]?.endsWith('/verify-senate-864-metadata-recovery.mjs'))verifyMetadataRecovery().catch(()=>{console.error('SENATE864_WEBSITE_METADATA_RECOVERY_FAILED');process.exitCode=1});
