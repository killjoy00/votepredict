/**
 * Track D #987: three 2022 standalone SF parents-rights bill votes linked
 * to actual independently archived Feb 14 first-party senator statements.
 * No vote is inferred from being bill author; direct official Senate Journal
 * affirmative/negative named voter list required. Exact primary PDFs and
 * publisher HTML are transient only; all outputs are metadata-only.
 */
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import prior from '../docs/evaluation/senate-media-2022-parents-rights-gop-wcco-archive-20261012.json' with {type:'json'};
import {ORIGINALS} from './probe-senate-media-2022-parental-rights-four-caucus-audacy-originals.mjs';
export const VERSION='track-d-2022-parents-education-three-standalone-primary-journal-v1';
export const PUBLISHER=Object.freeze({
 url:'https://www.mnsenaterepublicans.com/senate-republicans-propose-parents-bill-of-rights/',
 originalCaptures:Object.freeze([
  Object.freeze({stamp:'20220214232411',utc:'2022-02-14T23:24:11Z',sha1:'QKCIZE6CX4AZ2ZUOT6JNUNDKNYRYLEGP',sha256:'0bf05a87365ca09a6a85114fe867995c4bfe0531a35adf61641454ed322e7696',bytes:91008}),
  Object.freeze({stamp:'20220307021803',utc:'2022-03-07T02:18:03Z',sha1:'LWJGXK62GLCLUFK3ELND7PJLHIV6LLXW',sha256:'858c8ee8fdf1b5fb2dee03cf1d5740066dac1476ec5006541f700f3803844cbd',bytes:91648})
 ])});
export const JOURNALS=Object.freeze([
 Object.freeze({id:'2022-senate-day73-mar03',date:'2022-03-03',day:73,
  url:'https://www.senate.mn/journals/2021-2022/20220303073.pdf',
  events:Object.freeze([
   Object.freeze({sf:2575,yeas:37,nays:30,senator:'Paul Gazelka',issue:'parental_curriculum_review',role:'primary'}),
   Object.freeze({sf:2729,yeas:67,nays:0,senator:'Roger Chamberlain',issue:'school_board_contact_privacy',role:'supporting_control'})
  ])}),
 Object.freeze({id:'2022-senate-day76-mar10',date:'2022-03-10',day:76,
  url:'https://www.senate.mn/journals/2021-2022/20220310076.pdf',
  events:Object.freeze([
   Object.freeze({sf:2666,yeas:36,nays:31,senator:'Michelle Benson',issue:'class_syllabi_parent_access',role:'primary'})
  ])})
]);
export const TEXT_VERSIONS=Object.freeze([
 Object.freeze({sf:2575,version:0,postedDay:'2022-01-27',topic:['parental curriculum review','instructional materials'],url:'https://www.revisor.mn.gov/bills/92/2022/0/SF/2575/versions/0/pdf/'}),
 Object.freeze({sf:2729,version:1,postedDay:'2022-02-17',topic:['school district board meetings','address or other contact information'],url:'https://www.revisor.mn.gov/bills/92/2022/0/SF/2729/versions/1/pdf/'}),
 Object.freeze({sf:2666,version:1,postedDay:'2022-02-17',topic:['class syllab','parent'],url:'https://www.revisor.mn.gov/bills/92/2022/0/SF/2666/versions/1/pdf/'})
]);
const MAXPDF=33_000_000,MAXHTML=600_000,MAXTXT=4_000_000;
export function validateOriginalContext(ledger=prior){
 if(ledger?.version!=='track-d-2022-caucus-four-senators-audacy-two-source-historical-original-receipts-v1'||
  ledger.counts?.originalPublisherUrlsWithSha1AndSha256AuthenticatedHistoricalHtml!==1||
  ledger.counts?.distinctHistoricalOriginalHtmlBodyVersionsShaAuthenticated!==2||
  ledger.counts?.approvedWholeQuotedIndividualStatements!==0||
  ledger.counts?.recordedLegislativeMemberVotesProvedByThisResearch!==0||
  ledger.sourceOriginals?.[0]?.exactPublisherUrl!==PUBLISHER.url||
  ledger.sourceOriginals?.[0]?.independentlyAuthenticatedHistoricalOriginals?.length!==2||
  ORIGINALS[0].url!==PUBLISHER.url)throw Error('wrong prior verified contemporary caucus source');
 for(const [i,x] of PUBLISHER.originalCaptures.entries()){
  const y=ledger.sourceOriginals[0].independentlyAuthenticatedHistoricalOriginals[i];
  if(y.captureUtc!==x.utc||y.indexedOriginalSha1Base32!==x.sha1||
   y.downloadedOriginalHtmlRawSha256!==x.sha256||y.rawOriginalHtmlBytes!==x.bytes)
   throw Error('original 2022 source capture digest drift');
 }
 return {earliestOriginalArticleCapturedUtc:PUBLISHER.originalCaptures[0].utc,
  policyStatementSourceArticle:PUBLISHER.url,
  sourceArticleOriginalCaptureSha256:PUBLISHER.originalCaptures[0].sha256,
  memberNameToCue:Object.fromEntries(ORIGINALS[0].quoted.map(q=>[q.senator,q.cue])),
  humanApprovedVerbatimWholeStatements:0};
}
export function allowlist(){
 if(JOURNALS.length!==2||TEXT_VERSIONS.length!==3||PUBLISHER.originalCaptures.length!==2)throw Error('source-count drift');
 for(const j of JOURNALS){
  const u=new URL(j.url),expect='/journals/2021-2022/202203'+(j.day===73?'03':'10')+'0'+j.day+'.pdf';
  if(u.protocol!=='https:'||u.hostname!=='www.senate.mn'||u.pathname!==expect||
   u.search||u.hash||u.username||u.password||u.port||![73,76].includes(j.day))
   throw Error('journal session/day mismatch');
 }
 for(const b of TEXT_VERSIONS){
  const u=new URL(b.url);
  if(u.protocol!=='https:'||u.hostname!=='www.revisor.mn.gov'||u.pathname!==('/bills/92/2022/0/SF/'+b.sf+'/versions/'+b.version+'/pdf/')||
   u.search||u.hash||u.username||u.password||u.port)throw Error('wrong 92nd bill text');
 }
 return true;
}
function sha(buf,alg='sha256'){return createHash(alg).update(buf).digest('hex');}
function sha1Base32(b){
 const d=createHash('sha1').update(b).digest(),alpha='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0,out='';
 for(const byte of d){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=alpha[(value>>>(bits-5))&31];bits-=5;}value&=(1<<bits)-1;}
 if(bits)out+=alpha[(value<<(5-bits))&31];return out;
}
function docVisible(html){
 const aliases={ldquo:'"',rdquo:'"',quot:'"',lsquo:"'",rsquo:"'",apos:"'",nbsp:' ',amp:'&',hellip:'…'};
 return html.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|head|template|svg|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
  .replace(/<[^>]*>/g,' ').replace(/&([a-z]+);/gi,(m,e)=>aliases[e.toLowerCase()]??' ')
  .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_m,x,n)=>String.fromCodePoint(Math.min(1114111,x?parseInt(x,16):Number(n))))
  .replace(/[\u201c\u201d]/g,'"').replace(/[\u2018\u2019]/g,"'").replace(/\u00ad/g,'')
  .normalize('NFKC').replace(/\s+/g,' ').trim();
}
export function inspectIndividualPrintedQuoteBoundaries(rawHtml,original){
 if(typeof rawHtml!=='string'||rawHtml.length>MAXHTML||!PUBLISHER.originalCaptures.includes(original))throw Error('invalid historical original source body');
 const t=docVisible(rawHtml),out=[];
 const cited=ORIGINALS[0].quoted;
 // First complete, closed "..." immediately followed by SURNAME said, not a
 // proximate surname elsewhere. No entire quoted text or transcript stored.
 const matches=[...t.matchAll(/"([^"]{15,1050})"\s*,?\s*(Eichorn|Benson|Gazelka|Chamberlain)\s+said\b/gi)];
 for(const q of cited){
  const last=q.senator.split(' ').at(-1),eligible=matches.filter(m=>{
   const inside=m[1].toLowerCase().replace(/\s+/g,' ');
   const before=t.slice(Math.max(0,m.index-900),m.index);
   return m[2].toLowerCase()===last.toLowerCase()&&
     inside.includes(q.cue.toLowerCase())&&
     before.toLowerCase().includes(q.senator.toLowerCase());
  });
  out.push({senator:q.senator,quoteCue:q.cue,
   exactIssuerSurnameImmediatelyAfterClosedOriginalQuote:eligible.length===1,
   fullIndividualSenatorNameInPrecedingOriginalContext:eligible.length===1,
   distinctValidatedMatchingQuotedSegments:eligible.length,
   quoteSegmentSha256:eligible.length===1?sha(Buffer.from(eligible[0][1])):null,
   originalBoundedFirstQuotedSentenceOrPassageChars:eligible.length===1?eligible[0][1].length:null,
   completeSenatorStatementAcrossFollowingPublisherParagraphsHumanApproved:false,
   notOriginalRecordedAudio:true
  });
 }
 return {captureUtc:original.utc,sourceTextChars:t.length,visibleBoundedSpeakerOpeningQuotes:out,
  firstBoundedQuoteDirectAttributionCandidates:out.filter(x=>x.exactIssuerSurnameImmediatelyAfterClosedOriginalQuote).length,
  noFullCopyrightedPublisherQuotationPersisted:true};
}
export function inspectOfficialRolls(text,journal){
 if(typeof text!=='string'||text.length>MAXTXT||!JOURNALS.includes(journal))throw Error('unapproved extracted government journal');
 const roll=/The\s+roll\s+was\s+called,?\s+and\s+there\s+were\s+yeas\s+(\d+)\s+and\s+nays\s+(\d+),?\s+as\s+follows:?/gi,found=[];
 for(const m of text.matchAll(roll)){
  const yes=Number(m[1]),no=Number(m[2]),expected=journal.events.find(x=>x.yeas===yes&&x.nays===no);
  if(!expected)continue;
  const pre=text.slice(Math.max(0,m.index-12000),m.index);
  const billMentions=[...pre.matchAll(/\b([SH])\.\s*F\.\s*No\.\s*(\d+)/gi)];
  const nearest=billMentions.at(-1);
  const correctNearest=!!nearest&&nearest[1].toUpperCase()==='S'&&Number(nearest[2])===expected.sf;
  const distance=nearest?pre.length-(nearest.index+nearest[0].length):null;
  const preceding=nearest?pre.slice(nearest.index):'';
  const thirdReading=/\bthird\s+time\b/i.test(preceding)||/\bfinal\s+passage\b/i.test(preceding);
  const after=text.slice(m.index+m[0].length,m.index+m[0].length+12500);
  const yh=/Those\s+who\s+voted\s+in\s+the\s+affirmative\s+were:/i.exec(after);
  const nh=/Those\s+who\s+voted\s+in\s+the\s+negative\s+were:/i.exec(after);
  const end=/\b(?:So\s+the\s+bill|So\s+the\s+motion|S\.\s*F\.\s*No\.\s*\d+\s+was\s+read|The\s+motion\s+(?:did\s+not\s+)?prevail|The\s+question\s+recurred|The\s+roll\s+was\s+called)\b/i;
  let yesNames='',noNames='',correctSections=false;
  if(yh&&yh.index<2200){
   const from=yh.index+yh[0].length;
   if(no>0&&nh&&nh.index>from&&nh.index<9000){
    yesNames=after.slice(from,nh.index);
    const following=after.slice(nh.index+nh[0].length);
    const stop=following.search(end);
    noNames=following.slice(0,stop<0?Math.min(4200,following.length):stop);
    correctSections=true;
   }else if(no===0){
    const following=after.slice(from);
    const stop=following.search(end);
    yesNames=following.slice(0,stop<0?Math.min(9000,following.length):stop);
    noNames='';
    correctSections=!nh||nh.index>from+yesNames.length;
   }
  }
  const member=expected.senator.split(' ').at(-1);
  const memberYea=new RegExp('\\b'+member+'\\b','i').test(yesNames);
  const memberNay=new RegExp('\\b'+member+'\\b','i').test(noNames);
  const certified=correctNearest&&distance!==null&&distance<4800&&thirdReading&&correctSections&&(memberYea!==memberNay);
  const withinPage=text.slice(0,m.index).split('\f').length;
  found.push({bill:'SF'+expected.sf,senator:expected.senator,role:expected.role,policyTopic:expected.issue,
   journalDate:journal.date,officialLegislativeDay:journal.day,chamberYesCount:yes,chamberNoCount:no,
   currentBillAnchorIsClosestPrecedingSenateFile:correctNearest,
   currentBillThirdReadingPassageContext:thirdReading,nearestBillAnchorDistance:distance,
   separateOriginalAffirmativeAndNegativeVotingSectionsParsed:correctSections,
   personallyInAffirmativeVoterList:memberYea,personallyInNegativeVoterList:memberNay,
   certifiedPersonalVote:certified?(memberYea?'yea':'nay'):'UNKNOWN',
   wholeOriginalJournalPDFPageOneBased:withinPage,
   unknownIsNotNegativeOrEvidenceOfAbsence:true,
   noMemberVoteInferredFromBillSponsorshipOrRollTotals:true
  });
 }
 return {requiredStandaloneBills:journal.events.map(x=>'SF'+x.sf),matchedExpectedAggregateRolls:found,
  everyTargetBillIndividualVoteCertified:journal.events.every(x=>found.some(v=>v.bill==='SF'+x.sf&&v.certifiedPersonalVote!=='UNKNOWN'))};
}
async function download(url,type,cap,f){
 const r=await f(url,{method:'GET',redirect:'manual',
  headers:{accept:type==='pdf'?'application/pdf':'text/html','accept-encoding':'identity',
   'user-agent':'VotePredict/2.0 2022-standalone-primary-source-rolls'},
  signal:AbortSignal.timeout(105000)});
 if(r.status!==200)throw Error(r.status>=300&&r.status<400?'official_original_redirect_unknown':'official_original_http_unknown');
 const mime=(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(type==='pdf'&&!['application/pdf','application/octet-stream'].includes(mime)||
  type==='html'&&mime!=='text/html')throw Error('wrong source MIME');
 const ln=r.headers.get('content-length');if(ln!==null&&(!/^\d+$/.test(ln)||Number(ln)>cap))throw Error('bad source length');
 if(!r.body)throw Error('no source body');const reader=r.body.getReader(),chunks=[];let size=0;
 for(;;){const n=await reader.read();if(n.done)break;size+=n.value.byteLength;
  if(size>cap){await reader.cancel().catch(()=>{});throw Error('source size cap');}chunks.push(Buffer.from(n.value));}
 if(size<(type==='pdf'?15000:5000))throw Error('source body too short');
 const b=Buffer.concat(chunks);
 if(type==='pdf'&&(!b.subarray(0,5).equals(Buffer.from('%PDF-'))||!b.subarray(-2048).toString('latin1').includes('%%EOF')))
  throw Error('original PDF signature missing');
 return b;
}
export async function ephemeralPDFText(pdf){
 const dir=await mkdtemp(join(tmpdir(),'vp-track-d-2022-vote-'));
 try{
  const p=join(dir,'source.pdf');await writeFile(p,pdf,{flag:'wx'});
  const info=execFileSync('pdfinfo',[p],{encoding:'utf8',timeout:45000,maxBuffer:100000});
  const pages=Number(info.match(/^Pages:\s*(\d+)/m)?.[1]);
  if(!Number.isSafeInteger(pages)||pages<1||pages>2200)throw Error('unknown PDF page count');
  const text=execFileSync('pdftotext',['-layout','-enc','UTF-8',p,'-'],{encoding:'utf8',maxBuffer:MAXTXT,timeout:120000});
  if(text.length<1000||text.length>=MAXTXT)throw Error('unusable journal text size');
  return {pages,text};
 }finally{await rm(dir,{recursive:true,force:true});}
}
export async function inspectJournalOriginal(j,f=fetch,extract=ephemeralPDFText){
 allowlist();const o={date:j.date,day:j.day,exactOfficialOriginalPdfUrl:j.url,
  status:'official_original_journal_unknown',rawPdfSha256:null,rawPdfBytes:null,pages:null,
  rollResults:null,rawJournalOrTextPersisted:false};
 try{
  const b=await download(j.url,'pdf',MAXPDF,f);
  o.rawPdfSha256=sha(b);o.rawPdfBytes=b.length;
  const ex=await extract(b);o.pages=ex.pages;o.rollResults=inspectOfficialRolls(ex.text,j);
  o.status='official_original_pdf_sha256_and_exact_member_rolls_inspected';
 }catch(e){o.status='official_journal_unavailable_or_unparsed_unknown';o.errorClass=String(e?.message||'error').slice(0,110);}
 return o;
}
export async function inspectArchivedPublisherOriginal(c,f=fetch){
 const u='https://web.archive.org/web/'+c.stamp+'id_/'+PUBLISHER.url;
 const o={captureUtc:c.utc,originalPublisherArticleUrl:PUBLISHER.url,exactArchiveReplayUrl:u,
  indexedOriginalSha1Base32:c.sha1,status:'archived_first_party_html_unknown',
  rawOriginalHtmlSha256:null,bytes:null,observedQuotedSpeakerBoundaries:null,
  wholePublisherHtmlPersisted:false};
 try{
  const b=await download(u,'html',MAXHTML,f);
  const first=sha1Base32(b),digest=sha(b);
  if(first!==c.sha1||digest!==c.sha256||b.length!==c.bytes)throw Error('archived original digest/byte identity mismatch');
  o.rawOriginalHtmlSha256=digest;o.bytes=b.length;
  o.observedQuotedSpeakerBoundaries=inspectIndividualPrintedQuoteBoundaries(b.toString('utf8'),c);
  o.status='original_first_party_html_SHA1_SHA256_authenticated_quote_boundaries_inspected';
 }catch(e){o.status='archived_first_party_original_missing_or_mismatch_unknown';o.errorClass=String(e?.message||'error').slice(0,110);}
 return o;
}
export async function inspectBillTextVersion(b,f=fetch,extract=ephemeralPDFText){
 const o={bill:'SF'+b.sf,version:b.version,url:b.url,versionIndexDate:b.postedDay,
  status:'current_official_historic_bill_version_unknown',rawPdfSha256:null,bytes:null,pdfPages:null,
  officialBillAndPolicyTermsFound:null,originalVersionPublicBeforeVoteUtcNotEstablished:true,
  identicalToAmendedFloorVoteVersionNotProved:true,noBillPdfTextPersisted:true};
 try{
  const data=await download(b.url,'pdf',MAXPDF,f);o.rawPdfSha256=sha(data);o.bytes=data.length;
  const ex=await extract(data);o.pdfPages=ex.pages;
  const t=ex.text.toLowerCase().replace(/\s+/g,' ');
  const exactBill=new RegExp('s\\.?\\s*f\\.?\\s*(?:no\\.?\\s*)?'+b.sf+'\\b','i').test(t);
  const checks=b.topic.map(x=>({shortPolicyCue:x,present:t.includes(x)}));
  o.officialBillAndPolicyTermsFound={billIdentity:exactBill,termChecks:checks,allSelectedIssueTermsInDocument:checks.every(x=>x.present)};
  o.status=exactBill?'current_exact_92nd_bill_version_sha256_and_text_inspected':'original_version_identity_mismatch_unknown';
 }catch(e){o.status='official_bill_pdf_unavailable_or_unparsed_unknown';o.errorClass=String(e?.message||'error').slice(0,110);}
 return o;
}
export async function run(f=fetch,extract=ephemeralPDFText){
 validateOriginalContext();allowlist();
 const journals=[];for(const j of JOURNALS)journals.push(await inspectJournalOriginal(j,f,extract));
 const archived=[];for(const c of PUBLISHER.originalCaptures)archived.push(await inspectArchivedPublisherOriginal(c,f));
 const texts=[];for(const b of TEXT_VERSIONS)texts.push(await inspectBillTextVersion(b,f,extract));
 const named=journals.flatMap(x=>x.rollResults?.matchedExpectedAggregateRolls||[]);
 const first=archived[0]?.observedQuotedSpeakerBoundaries?.visibleBoundedSpeakerOpeningQuotes||[];
 const qualified=named.map(x=>{
  const quote=first.find(q=>q.senator===x.senator);
  return {bill:x.bill,senator:x.senator,role:x.role,journalDate:x.journalDate,
   archiveCaptureBeforeVoteDay:PUBLISHER.originalCaptures[0].utc.slice(0,10)<x.journalDate,
   originalStatementFirstClosedQuotedSegmentNamedAttribution:quote?.exactIssuerSurnameImmediatelyAfterClosedOriginalQuote===true,
   individualOfficialJournalVote:x.certifiedPersonalVote,
   officialBillTextVersionIssueCuesIdentified:texts.some(z=>z.bill===x.bill&&z.officialBillAndPolicyTermsFound?.allSelectedIssueTermsInDocument),
   strongResearchSourceToStandaloneMemberVoteCandidate:quote?.exactIssuerSurnameImmediatelyAfterClosedOriginalQuote===true&&x.certifiedPersonalVote==='yea',
   automaticProductionPredictionLabelApproved:false};
 });
 return {version:VERSION,researchDateLocal:'2026-10-12',
  previouslyAuthenticatedWrittenOriginal:validateOriginalContext(),
  officialJournalOriginalUrlsAttempted:2,officialJournalOriginalPDFsAuthenticated:journals.filter(x=>x.status==='official_original_pdf_sha256_and_exact_member_rolls_inspected').length,
  originalFirstPartyArchivedArticleVersionsAttempted:2,originalFirstPartyArticleVersionsReauthenticated:archived.filter(x=>x.status==='original_first_party_html_SHA1_SHA256_authenticated_quote_boundaries_inspected').length,
  selectedExactOriginalGovernmentBillPDFVersionsAttempted:3,governmentBillPDFVersionDocumentsAuthenticated:texts.filter(x=>x.status==='current_exact_92nd_bill_version_sha256_and_text_inspected').length,
  primaryAndControlDirectStandaloneCandidates:qualified,
  verifiedTargetIndividualYesVotes:named.filter(x=>x.certifiedPersonalVote==='yea').length,
  authenticatedNamedOriginalFirstBoundedQuotationSegments:archived[0]?.observedQuotedSpeakerBoundaries?.firstBoundedQuoteDirectAttributionCandidates||0,
  noVoteInferredFromSponsorshipOrChamberTotals:true,
  noOriginalPublisherFirstPublicPostingMinuteProved:true,
  noMprBensonKunesh2022RecordedInterviewUsed:true,
  noProductionsSourceRowReadOrTrainingLabelApproved:true,
  noOriginalJournalPdfBillPdfRawHtmlOrFullQuotePersisted:true,
  noCollectorDatabaseIngestionModelServingScoringOrForecastChanged:true,journals,archived,texts};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 const i=process.argv.indexOf('--output'),dest=process.argv[i+1];
 if(i<0||!/^artifacts\/[a-z0-9._-]+\.json$/i.test(dest||''))throw Error('safe public metadata output required');
 const r=await run();mkdirSync('artifacts',{recursive:true});writeFileSync(dest,JSON.stringify(r,null,2)+'\n');
 console.log('TRACK_D_2022_STANDALONE_BILLS_PRIMARY='+JSON.stringify({
  journalPdfOriginals:r.officialJournalOriginalPDFsAuthenticated,
  firstPartyOriginalReplays:r.originalFirstPartyArticleVersionsReauthenticated,
  billVersionOriginals:r.governmentBillPDFVersionDocumentsAuthenticated,
  statementBoundaries:r.authenticatedNamedOriginalFirstBoundedQuotationSegments,
  targetVotes:r.primaryAndControlDirectStandaloneCandidates,
  journals:r.journals.map(x=>({date:x.date,status:x.status,sha256:x.rawPdfSha256,bytes:x.rawPdfBytes,pages:x.pages,rolls:x.rollResults?.matchedExpectedAggregateRolls,error:x.errorClass||null})),
  article:r.archived.map(x=>({captured:x.captureUtc,status:x.status,sha256:x.rawOriginalHtmlSha256,bytes:x.bytes,
    boundary:x.observedQuotedSpeakerBoundaries?.visibleBoundedSpeakerOpeningQuotes,error:x.errorClass||null})),
  billText:r.texts.map(x=>({bill:x.bill,version:x.version,status:x.status,sha256:x.rawPdfSha256,bytes:x.bytes,pages:x.pdfPages,
    issue:x.officialBillAndPolicyTermsFound,error:x.errorClass||null}))
 }));
}
