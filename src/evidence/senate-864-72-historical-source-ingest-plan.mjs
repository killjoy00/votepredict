/** #864 historically verified source records, no forecast promotion. */
import {createHash} from 'node:crypto';
import {assertManifest,canonicalKey} from './senate-864-95-historical-source-neon-parity.mjs';
export const VERSION='senate-864-72-original-html-context-v1';
const SHA=/^[0-9a-f]{64}$/i,CDX=/^[A-Z2-7]{32}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const YEAR=['2021-2022','2023-2024','2025-2026'];
function validUrl(value){
 if(typeof value!=='string'||value.length>2200)return false;
 try{const x=new URL(value);return ['http:','https:'].includes(x.protocol)&&!x.username&&!x.password;}catch{return false;}
}
export function sourcePlan(manifest,witnesses,roster){
 assertManifest(manifest);
 if(!Array.isArray(witnesses)||witnesses.length!==72||!Array.isArray(roster)||roster.length<95||roster.length>1000)
  throw Error('Missing fixed 72 originals or historic Senate roster');
 const index=new Map();
 for(const r of roster){
  if(!UUID.test(r.legislatorId||'')||!UUID.test(r.membershipId||'')||!YEAR.includes(r.sessionSlug))
   throw Error('Malformed official Senate membership');
  const k=canonicalKey(r.name);
  if(!k)continue;
  const a=index.get(k)||[];a.push(r);index.set(k,a);
 }
 const members=new Map();
 for(let i=0;i<95;i++){
  const official=manifest.people[i],hits=index.get(canonicalKey(official.officialName))||[];
  if(!hits.length||new Set(hits.map(r=>r.legislatorId)).size!==1
   ||new Set(hits.map(r=>r.membershipId)).size!==hits.length)
   throw Error('Serving legislator identity ambiguity');
  hits.sort((a,b)=>a.sessionSlug.localeCompare(b.sessionSlug)||a.membershipId.localeCompare(b.membershipId));
  members.set(i+1,hits);
 }
 const seen=new Set(),people=new Set(),rows=[];
 for(const w of witnesses){
  if(!Number.isSafeInteger(w.senatorOrdinal)||w.senatorOrdinal<1||w.senatorOrdinal>95
   ||w.officialName!==manifest.people[w.senatorOrdinal-1].officialName
   ||!validUrl(w.originalUrl)||!SHA.test(w.originalHtmlSha256||'')
   ||!CDX.test(w.originalArchiveCdxSha1Base32||'')
   ||w.recoveryState!=='READY_FOR_INDEPENDENT_BYTE_VERIFICATION'
   ||!Number.isSafeInteger(w.historicalSourceArtifactId)
   ||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(w.originalArchiveCapturedAtUtc||'')
   ||new Date(w.originalArchiveCapturedAtUtc).toISOString()!==w.originalArchiveCapturedAtUtc
   ||!/^data\/evaluation\/senate-[\w-]+\.json$/.test(w.originalResearchLedgerPath||'')
   ||! /^[A-Za-z0-9._-]+\.html$/.test(w.originalHtmlArtifactFile||''))
   throw Error('Archived page proof HOLD');
  const identity=w.senatorOrdinal+'|'+w.originalUrl+'|'+w.originalHtmlSha256;
  if(seen.has(identity))throw Error('Duplicate historic page proof');
  seen.add(identity);people.add(w.senatorOrdinal);
  const memberships=members.get(w.senatorOrdinal);
  const year=Number(w.originalArchiveCapturedAtUtc.slice(0,4));
  const capturedSession=year>=2021&&year<=2022?'2021-2022':
   year>=2023&&year<=2024?'2023-2024':
   year>=2025&&year<=2026?'2025-2026':null;
  // Link to observed service session where possible. Archive capture date is
  // NOT asserted to be first publication, and older captures remain context only.
  const membershipId=(memberships.find(r=>r.sessionSlug===capturedSession)
   ||memberships[0]).membershipId;
  const key=createHash('sha256').update(VERSION+'|'+identity+'|'+membershipId).digest('hex');
  const stamp=w.originalArchiveCapturedAtUtc.replace(/\D/g,'').slice(0,14);
  const originalSha=w.originalHtmlSha256.toLowerCase();
  const provenance={
   senatorOrdinal:w.senatorOrdinal,originalUrl:w.originalUrl,
   archiveUrl:'https://web.archive.org/web/'+stamp+'id_/'+w.originalUrl,
   archiveCapturedAtUtc:w.originalArchiveCapturedAtUtc,
   originalHtmlSha256:originalSha,originalCdxSha1Base32:w.originalArchiveCdxSha1Base32,
   originalHtmlArtifactId:w.historicalSourceArtifactId,
   originalHtmlFile:w.originalHtmlArtifactFile,
   independentCdxArtifactId:w.independentCdxArtifactId??null,
   researchLedger:w.originalResearchLedgerPath,
   originalFirstAuthoredDateKnown:false,officialVoteVerified:false,
   pageVerified:true,contextOnly:true,mechanicallyActionable:false,
   asOfEligible:false,sameDayEligible:false,modelWeight:0
  };
  rows.push({membershipId,originalSha,originalUrl:w.originalUrl,
   ordinal:w.senatorOrdinal,key,provenance,
   claim:'Independently verified original historical candidate campaign page for '+
    w.officialName+', archived '+w.originalArchiveCapturedAtUtc.slice(0,10)+
    '. Source context only, not a proven Senate vote or forecast feature.'});
 }
 if(people.size!==34||seen.size!==72||new Set(rows.map(r=>r.key)).size!==72)
  throw Error('Historic 34-person 72-page recovery cohort drift');
 return rows;
}
