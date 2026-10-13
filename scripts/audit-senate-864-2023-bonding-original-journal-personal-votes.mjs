/**
 * #864 offline primary-source check: 2023 bonding speech versus DIFFERENT
 * recorded Senate HF669/670 individual third-reading ballots. Research ONLY.
 * No raw PDFs, journal page text, private DB rows, or model labels persisted.
 */
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export const ROLL_TARGETS=Object.freeze([
 Object.freeze({bill:'HF669',day:'2023-03-16',n:37,yes:33,no:32,
   source:'https://www.senate.mn/journals/2023-2024/20230316037.pdf',
   finalResult:'failed',role:'third_reading_after_amendment'}),
 Object.freeze({bill:'HF669',day:'2023-05-22',n:77,yes:56,no:11,
   source:'https://www.senate.mn/journals/2023-2024/20230522077.pdf',
   finalResult:'passed',role:'third_reading_as_amended'}),
 Object.freeze({bill:'HF670',day:'2023-05-22',n:77,yes:35,no:14,
   source:'https://www.senate.mn/journals/2023-2024/20230522077.pdf',
   finalResult:'passed',role:'third_reading_as_amended'})
]);
export const MEMBERS=Object.freeze(['Mark T. Johnson','Karin Housley','Bill Weber','Nathan Wesenberg']);
const MAX=24_000_000,TXT=6_000_000,sha=b=>createHash('sha256').update(b).digest('hex');
export function allowOriginalSources(targets=ROLL_TARGETS) {
 if(targets.length!==3||targets[0].bill!=='HF669'||targets[1].bill!=='HF669'||
   targets[2].bill!=='HF670'||MEMBERS.length!==4)throw Error('original third reading scope drift');
 for(const t of targets){
  const u=new URL(t.source),stamp=t.day.replace(/-/g,'')+'0'+t.n;
  if(u.protocol!=='https:'||u.hostname!=='www.senate.mn'||
     u.pathname!==('/journals/2023-2024/'+stamp+'.pdf')||
     u.search||u.hash||u.username||u.password||u.port||t.yes<1||t.no<1)
    throw Error('untrusted government exact original journal');
 }
 return true;
}
export function memberRollFromOriginalText(text,target){
 if(typeof text!=='string'||text.length>TXT||
   !ROLL_TARGETS.some(t=>t.bill===target.bill&&t.day===target.day&&
      t.yes===target.yes&&t.no===target.no))throw Error('unapproved vote target');
 const roll=/The\s+roll\s+was\s+called,?\s+and\s+there\s+were\s+yeas\s+(\d+)\s+and\s+nays\s+(\d+),?\s+as\s+follows:?/gi;
 const candidates=[];
 for(const m of text.matchAll(roll)){
  if(Number(m[1])!==target.yes||Number(m[2])!==target.no)continue;
  const before=text.slice(Math.max(0,m.index-12000),m.index);
  const billMatches=[...before.matchAll(/\b([HS])\s*\.\s*F\s*\.\s*No\s*\.\s*(\d+)/gi)];
  const closest=billMatches.at(-1);
  const nearest=closest?(closest[1].toUpperCase()+'F'+Number(closest[2])):null;
  const distance=closest?before.length-(closest.index+closest[0].length):null;
  const near=before.slice(-1800).replace(/\s+/g,' ').toLowerCase();
  const explicitlyFinalPassage=/\b(?:passage\s+of\s+the\s+bill|the\s+bill(?:,?\s+as\s+amended)?\s+(?:was\s+)?(?:read\s+the\s+third\s+time|placed\s+on\s+its\s+final\s+passage))\b/i.test(near);
  const following=text.slice(m.index+m[0].length,m.index+m[0].length+14000);
  const yh=/Those\s+who\s+voted\s+in\s+the\s+affirmative\s+were:/i.exec(following);
  const nh=/Those\s+who\s+voted\s+in\s+the\s+negative\s+were:/i.exec(following);
  let positive='',negative='';
  let sectionsClean=false;
  if(yh&&nh&&nh.index>yh.index+20&&yh.index<2300&&nh.index<11000){
   const after=following.slice(nh.index+nh[0].length);
   const end=after.search(/(?:So\s+the\s+(?:bill|motion)|The\s+motion\s+(?:did\s+not\s+)?prevail|The\s+question\s+recurred|H\s*\.\s*F\s*\.\s*No\s*\.\s*\d+\s+was\s+read|MEMBERS\s+EXCUSED)/i);
   positive=following.slice(yh.index+yh[0].length,nh.index);
   negative=after.slice(0,end<0?Math.min(after.length,5200):end);
   const stop=/Pursuant\s+to\s+Rule\s+40/i;
   positive=positive.split(stop)[0];
   negative=negative.split(stop)[0];
   sectionsClean=true;
  }
  const named=MEMBERS.map(name=>{
   const last=name.split(' ').at(-1);
   const re=new RegExp('(?:^|\\s)'+last+'(?:\\s|$)','i');
   const presentYes=re.test(positive),presentNo=re.test(negative);
   const fullContext=nearest===target.bill&&distance!==null&&distance<8500&&
     explicitlyFinalPassage&&sectionsClean;
   const personal=fullContext&&(presentYes!==presentNo)?(presentYes?'YEA':'NAY'):'UNKNOWN';
   return {senator:name,personalRecordedThirdReadingChoice:personal,
     appearsInPrintedAffirmativeRoster:presentYes,
     appearsInPrintedNegativeRoster:presentNo,
     absentNameIsNotNayOrAbstention:true,
     aggregateTotalNotProxyOrPersonalVoteProof:true};
  });
  candidates.push({bill:target.bill,eventDay:target.day,officialLegislativeDay:target.n,
    expectedAggregateYea:target.yes,expectedAggregateNay:target.no,
    exactOriginalPrintedBillAnchor:nearest,anchorDistanceChars:distance,
    thirdReadingFinalPassageContext:explicitlyFinalPassage,distinctVotingSectionsIdentified:sectionsClean,
    originalPdfPageOneBased:text.slice(0,m.index).split('\f').length,
    members:named,
    eligibleDirectPersonalVoteVerified:nearest===target.bill&&distance<8500&&explicitlyFinalPassage&&sectionsClean,
    notInferringPersonalVoteFromSponsorshipOrProceduralMotion:true
  });
 }
 const anchored=candidates.filter(c=>c.eligibleDirectPersonalVoteVerified);
 // Prove the bill's third-reading roll independently of whether every one
 // of our four sampled people had their name printed. Other voters' choices
 // cannot substitute for an absent senator. If two same-bill/tally rolls
 // appear, the event remains ambiguous rather than picking either.
 const unique=anchored.length===1?anchored[0]:null;
 const direct=unique?unique.members.filter(m=>m.personalRecordedThirdReadingChoice!=='UNKNOWN')
   .map(m=>({senator:m.senator,choice:m.personalRecordedThirdReadingChoice,
     exactPrintedBillAnchor:target.bill,originalPdfPageOneBased:unique.originalPdfPageOneBased,
     proof:'uniquely_anchored_third_reading_printed_affirmative_or_negative_name',
     sponsorOrPartyIsNotVoteEvidence:true})): [];
 const complete=unique&&direct.length===MEMBERS.length?unique:null;
 return {target:{bill:target.bill,date:target.day,finalResult:target.finalResult,
     expectedYes:target.yes,expectedNo:target.no},
   aggregateRollCandidatesForThisTally:candidates,
   uniquelyIdentifiedBillSpecificThirdReadingRoll:unique,
   uniquelyIdentifiedBillSpecificThirdReadingRollCount:unique?1:0,
   independentlyCertifiedNamedMemberChoices:direct,
   certifiedDirectMemberChoiceCount:direct.length,
   countOfSampledMembersWhosePersonalChoiceRemainsUnknown:MEMBERS.length-direct.length,
   certifiedUniqueDirectPersonalRoll:complete,
   certifiedUniqueDirectPersonalRollCount:complete?1:0,
   ambiguousOrMissingRollCannotBecomeVote:true};
}
async function fetchBytes(url,f,cap){
 const r=await f(url,{method:'GET',redirect:'manual',
  headers:{accept:'application/pdf','accept-encoding':'identity'},signal:AbortSignal.timeout(110000)});
 if(r.status!==200)throw Error('official_original_http_'+r.status);
 const mt=(r.headers.get('content-type')||'').split(';')[0].toLowerCase().trim();
 if(mt!=='application/pdf'&&mt!=='application/octet-stream')throw Error('wrong original PDF MIME');
 if(!r.body)throw Error('missing original PDF response');
 let n=0,parts=[];const reader=r.body.getReader();
 while(true){const x=await reader.read();if(x.done)break;n+=x.value.byteLength;
  if(n>cap){await reader.cancel().catch(()=>{});throw Error('original journal too large');}
  parts.push(Buffer.from(x.value));
 }
 const all=Buffer.concat(parts,n);
 if(all.length<20000||!all.subarray(0,8).toString('latin1').startsWith('%PDF-'))throw Error('not original PDF');
 return all;
}
export async function extractPageOrder(pdf){
 const {PDFParse}=await import('pdf-parse');
 const parser=new PDFParse({data:pdf});
 try{
  const x=await parser.getText({lineEnforce:true,cellSeparator:' '});
  if(!Number.isInteger(x.total)||x.total<3||x.total>2200||
     x.pages.length!==x.total||x.pages.some((p,i)=>p.num!==i+1||typeof p.text!=='string'))
    throw Error('PDF partial extraction or page identity unavailable');
  const t=x.pages.map(p=>p.text).join('\f');
  if(t.length<1000||t.length>TXT)throw Error('journal PDF parsed text invalid');
  return {text:t,pages:x.total};
 }finally{await parser.destroy();}
}
export async function auditJournal(targets=ROLL_TARGETS,f=fetch,extract=extractPageOrder){
 allowOriginalSources(targets);
 const docs=[],all=[];
 const urls=[...new Set(targets.map(t=>t.source))];
 for(const url of urls){
  const record={originalOfficialJournalUrl:url,wholeOriginalPdfSha256:null,
   originalPdfBytes:null,totalOriginalPdfPages:null,
   status:'UNKNOWN',exactVotes:[],noPdfBodyOrExtractedTextPersisted:true};
  try{
   const raw=await fetchBytes(url,f,MAX);
   record.wholeOriginalPdfSha256=sha(raw);record.originalPdfBytes=raw.length;
   const doc=await extract(raw);record.totalOriginalPdfPages=doc.pages;
   const relevant=targets.filter(t=>t.source===url);
   for(const t of relevant){
    const q=memberRollFromOriginalText(doc.text,t);
    record.exactVotes.push(q);
    all.push(q);
   }
   record.status='SHA256_PINNED_OFFICIAL_PDF_AND_NAMED_ROLL_PARSER_RUN';
  }catch(e){record.status='ORIGINAL_PDF_OR_EXTRACTION_UNAVAILABLE_UNKNOWN';record.failureClass=String(e.message||e).slice(0,110);}
  docs.push(record);
 }
 return {schema:'senate-864-2023-hf669-hf670-original-exact-member-floor-ballots-v1',
  issue:864,primaryOriginalOfficialSenateJournalPdfs:docs,
  expectedThirdReadingEvents:targets.map(x=>({bill:x.bill,date:x.day,yes:x.yes,no:x.no,result:x.finalResult})),
  provenThirdReadingEventCount:all.filter(x=>x.uniquelyIdentifiedBillSpecificThirdReadingRollCount===1).length,
  fullyCoveredFourSenatorEventCount:all.filter(x=>x.certifiedUniqueDirectPersonalRollCount===1).length,
  senatorDecisionRowsEstablished:all.reduce((n,x)=>n+x.certifiedDirectMemberChoiceCount,0),
  sampledNamedMemberVoteUnknownRows:all.reduce((n,x)=>n+x.countOfSampledMembersWhosePersonalChoiceRemainsUnknown,0),
  noAllOrNothingMemberGateOnOtherwiseAuthenticatedRoll:true,
  noOriginalPdfOrPageTextCommitted:true,
  noBillVersionIdentityAssumedFromAggregateOrSponsorship:true,
  noProductionDbModelOrServingChanges:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const out=resolve(process.argv[2]||'/tmp/senate-864-2023-hf669-hf670-journal-rolls.json');
 const r=await auditJournal();
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(r,null,2)+'\n');
 console.log(JSON.stringify({out,primaryOriginalOfficialSenateJournalPdfs:r.primaryOriginalOfficialSenateJournalPdfs.map(x=>({url:x.originalOfficialJournalUrl,status:x.status,sha:x.wholeOriginalPdfSha256,pages:x.totalOriginalPdfPages})),
   provenEvents:r.provenThirdReadingEventCount,senatorVoteRows:r.senatorDecisionRowsEstablished}));
}
