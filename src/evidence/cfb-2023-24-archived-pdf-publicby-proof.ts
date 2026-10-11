/**
 * #864 FINANCE original public-date research. Historical Wayback CDX
 * captures are leads only. A 2024/25 timestamp alone, even an archived
 * *viewer page*, cannot prove a particular PDF version was public.
 *
 * Independently prove only when archived exact PDF's binary SHA256 equals
 * an authentic original CFB source-ledger PDF SHA256, archive URL explicitly
 * matches registration, report year, type, period, segment and amendment,
 * and the capture is after original statutory 8am release date.
 * Never promote HOLD or duplicate aliases, current site or CFB receipt day.
 */
import {createHash} from 'node:crypto';
export const ORIGINAL_CFB_ARCHIVE_PUBLICBY_VERSION=
 'cfb-2023-24-wayback-exact-original-version-archived-pdf-hash-strict-v1' as const;
const VERIFIED71_BLOB='bfa1c1eff6a095a3a0d03aa49a34e1d929d6a388';
const SHA=/^[a-f0-9]{64}$/;
const idRe=/^(\d+):(23|24):([a-z]+):(YE):(\d+):(\d+)$/;
const blob=(s:string)=>createHash('sha1')
 .update('blob '+Buffer.byteLength(s,'utf8')+'\0').update(s,'utf8').digest('hex');
export interface ArchivedCfbExactVersionTarget{
 versionId:string;committeeRegistration:string;reportYear:2023|2024;
 type:string;period:'YE';segment:string;amendment:number;
 originalCfbPdfSha256:string;authenticOriginalPDF:boolean;
 expectedEarliestPublicByUtc:string;sourceStatus:string;
 sourceSnapshotCfbReportUrl:string;
}
export const FOUR_EXACT_ARCHIVE_PILOT_IDS=[
 '18430:23:pcc:YE:0:0', // Putnam 2023 authentic original
 '18430:23:pcc:YE:0:1', // Putnam original amended held
 '17919:23:pcc:YE:0:0', // Frentz 2023 original authentic
 '16964:24:pcc:YE:0:3', // Housley 2024 amended after Oct 2025
] as const;
export function selectFourRealOriginalArchiveAuditTargets(psv:string):ArchivedCfbExactVersionTarget[]{
 if(blob(psv)!==VERIFIED71_BLOB)throw Error('CFB original 71 genuine 2023-24 version source changed');
 const rows=psv.trimEnd().split('\n').filter(Boolean).map(s=>s.split('|'));
 if(rows.length!==71||rows.some(r=>r.length!==21))
  throw Error('71 original reported CFB version lines must be pinned');
 const all=new Map<string,string[]>();
 for(const row of rows){
  const key=row[0]!;
  const m=idRe.exec(key);
  if(!m||key!==[row[3],m[2],m[3],m[4],m[5],m[6]].join(':')
   ||!SHA.test(row[7]??'')||row[4]!==('20'+m[2]))
   throw Error('Source candidate report version identity/year/source SHA invalid');
  if(all.has(key))throw Error('Duplicate historical version identity');
  all.set(key,row);
 }
 return FOUR_EXACT_ARCHIVE_PILOT_IDS.map(id=>{
  const row=all.get(id);
  if(!row)throw Error('Original CFB pilot version missing '+id);
  const m=idRe.exec(id)!;
  const sourceStatus=row[8]!;
  const authenticOriginalPDF=sourceStatus==='original_pdf_first_page_authenticated'
    ||sourceStatus==='distinct_authenticated_amended_pdf';
  // Date from historical original state §10A.20 and original archived Board calendar.
  const lawReleaseFloor=m[2]==='23'?'2024-02-01T14:00:00Z':'2025-02-01T14:00:00Z';
  // For Board receipt dates after the statutory release day, exact receipt
  // CLOCK time is unknown. A capture dated the following UTC day might still
  // precede the original local-day receipt. Require the day AFTER the full
  // original receipt day has safely elapsed; this deliberately loses some
  // potentially true matches rather than backdating publication.
  const boardDate=row[10]!;
  const localReleaseDay=lawReleaseFloor.slice(0,10);
  let earliest=lawReleaseFloor;
  if(/^\d{4}-\d{2}-\d{2}$/.test(boardDate)&&boardDate>localReleaseDay){
    const after=new Date(boardDate+'T00:00:00Z');
    after.setUTCDate(after.getUTCDate()+2);
    earliest=after.toISOString();
  }
  const url=new URL('https://cfb.mn.gov/rptViewer/Main.php');
  url.searchParams.set('do','viewPDF');
  url.searchParams.set('downloadpdf','false');
  url.searchParams.set('year',m[2]!);
  url.searchParams.set('type',m[3]!);
  url.searchParams.set('period',m[4]!);
  url.searchParams.set('se',m[5]!);
  url.searchParams.set('regnum',m[1]!);
  url.searchParams.set('amend',m[6]!);
  return{
   versionId:id,committeeRegistration:m[1]!,
   reportYear:m[2]==='23'?2023:2024,
   type:m[3]!,period:'YE',segment:m[5]!,
   amendment:Number(m[6]),originalCfbPdfSha256:row[7]!,
   authenticOriginalPDF,expectedEarliestPublicByUtc:earliest,
   sourceStatus,sourceSnapshotCfbReportUrl:url.toString(),
  };
 });
}
function utcFromCdx(timestamp:string):string{
 if(!/^\d{14}$/.test(timestamp))throw Error('Archived capture timestamp not 14 digit UTC');
 const iso=timestamp.slice(0,4)+'-'+timestamp.slice(4,6)+'-'+timestamp.slice(6,8)
  +'T'+timestamp.slice(8,10)+':'+timestamp.slice(10,12)+':'+timestamp.slice(12,14)+'Z';
 const date=new Date(iso);
 if(Number.isNaN(date.getTime())||date.toISOString()!==iso)
  throw Error('Archived capture timestamp is not real date');
 return iso;
}
function exactOriginalViewerLinkMatches(archived:string,target:ArchivedCfbExactVersionTarget):boolean{
 try{
  const u=new URL(archived);
  if(!['http:','https:'].includes(u.protocol)||u.hostname!=='cfb.mn.gov'
    ||u.pathname!=='/rptViewer/Main.php')return false;
  const q=u.searchParams;
  return q.get('do')==='viewPDF'&&q.get('regnum')===target.committeeRegistration
    &&q.get('year')===String(target.reportYear).slice(2)
    &&q.get('type')===target.type&&q.get('period')===target.period
    &&q.get('se')===target.segment&&q.get('amend')===String(target.amendment);
 }catch{return false;}
}
export interface CdxValidCapture{
 timestamp:string;archivedOriginalUrl:string;archiveCaptureUtc:string;
 digest:string;
}
export function strictCdxReportVersionCaptures(input:{
 target:ArchivedCfbExactVersionTarget;rawCdxJson:unknown;
}):CdxValidCapture[]{
 const v=input.rawCdxJson;
 if(!Array.isArray(v)||!Array.isArray(v[0]))
  throw Error('Internet Archive CDX JSON data rows absent');
 const header=(v[0] as unknown[]).map(String);
 const expected=['timestamp','original','statuscode','mimetype','digest'];
 if(expected.some((x,i)=>header[i]!==x))throw Error('CDX capture columns missing or reordered');
 const found=[] as CdxValidCapture[];
 for(const row of v.slice(1)){
  if(!Array.isArray(row)||row.length!==5)
   throw Error('Malformed official archive capture response');
  const [stamp,original,code,mimetype,digest]=row.map(String);
  if(code!=='200'||mimetype!=='application/pdf'
   ||!exactOriginalViewerLinkMatches(original,input.target))continue;
  const iso=utcFromCdx(stamp);
  if(iso<input.target.expectedEarliestPublicByUtc)continue;
  if(!/^[A-Z2-7]{20,60}$/.test(digest))continue;
  found.push({timestamp:stamp,archivedOriginalUrl:original,
   archiveCaptureUtc:iso,digest});
 }
 return found.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
export function classifyExactArchivePdfBinaryProof(input:{
 target:ArchivedCfbExactVersionTarget;
 capture:CdxValidCapture;
 archiveHttpStatus:number;
 archivePdfBytes:Uint8Array|null;
}){
 const observed=input.capture.archiveCaptureUtc;
 if(!exactOriginalViewerLinkMatches(input.capture.archivedOriginalUrl,input.target))
  throw Error('Archive capture source URL refers to a different original report version');
 const date=utcFromCdx(input.capture.timestamp);
 if(observed!==date)throw Error('CDX timestamp contradicted capture UTC');
 const header=input.archivePdfBytes?
  new TextDecoder('ascii').decode(input.archivePdfBytes.subarray(0,5)):'';
 const bodyValid=input.archiveHttpStatus===200&&header==='%PDF-'
  &&(input.archivePdfBytes?.byteLength??0)>1000
  &&(input.archivePdfBytes?.byteLength??0)<3_000_000;
 const sha=bodyValid?createHash('sha256').update(input.archivePdfBytes!).digest('hex'):null;
 const shaExactlyAuthenticated=bodyValid&&sha===input.target.originalCfbPdfSha256;
 const afterLegalEarliest=observed>=input.target.expectedEarliestPublicByUtc;
 const historicPubBy=shaExactlyAuthenticated&&input.target.authenticOriginalPDF
  &&afterLegalEarliest?observed:null;
 return{
  versionId:input.target.versionId,
  archiveSourceCaptureTimestamp:observed,
  archiveBinaryHasValidOriginalPdfSignature:bodyValid,
  archiveBinarySha256:sha,
  identicalSourceAuthenticatedVersionBinarySha256:shaExactlyAuthenticated,
  originalCfBVersionWasAlreadyAuthenticated:input.target.authenticOriginalPDF,
  originalHistoricalVersionPublicBy:historicPubBy,
  legallyOwedYearEndReportStatus:null,
  duplicateOrHoldMayNotBecomeHistoricallyEligible:true,
 };
}
