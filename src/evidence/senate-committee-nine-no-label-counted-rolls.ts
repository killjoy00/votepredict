/**
 * #864 -- source-only revisit of exactly nine 2023-24 committee originals
 * where the 100-no-label audit exposed apparent numeric roll-call contexts.
 * This parser is deliberately NOT imported by ingestion or serving.
 */
import { createHash } from 'node:crypto';
import { normalizeMemberName } from '@/sources/minnesota/house-votes';
import {selectOriginalNoLabelRollPdfCandidates} from './senate-committee-100-no-label-roll-review.js';
import type {RollReviewYear} from './senate-committee-unparsed-roll-review.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const originals=[
 [2023,'2023-01-17','elections/20230117/Elections_20230117_Minutes.pdf','35782d185a244fe98a77a2e9c6bd3ec2e37a7591d28d18de5dbe8380b396355a'],
 [2023,'2023-02-07','elections/20230207/Elections_20230207_Minutes.pdf','cffcc4c84bb1c44d4cb8a5238ff02a7ef75dbfe942b46bbdd367f0a5c9664e11'],
 [2023,'2023-02-14','elections/20230214/Elections_20230214_Minutes.pdf','680830e9751ca233ef966dcf3d7ce63a1af65b6160931fc0055cb6576cf5c50b'],
 [2023,'2023-02-21','elections/20230221/Elections_20230221_Minutes.pdf','b534d5d59ff69170a85d8ca2fce0beede2c4b9c8d87c3312c272241f8eb98114'],
 [2023,'2023-03-02','elections/20230302/Elections_20230302_Minutes.pdf','15fccd136330e8a949ca9d16bd7f2e8e263466135316c7cc3d0ce5d56c5b7188'],
 [2023,'2023-03-07','elections/20230307/Elections_20230307_Minutes.pdf','9db4f615f45322c8a419b40daa66b536517937e85ea800e5c867c779ebacad4d'],
 [2023,'2023-03-14','elections/20230314/Elections_20230314_Minutes.pdf','3af993abd7a941d787ddd1076f0c79edece3797852f643fca59bce8c79d97ed6'],
 [2024,'2024-02-20','rules/20240220/Rules_20240220_Minutes.pdf','548770daa6160f199b690d469c6e30c9d594befb2f4e227e56c6c6861a6a3930'],
 [2024,'2024-05-07','rulesethical/20240507/rulesethical_20240507_Minutes.pdf','bf4d6924cd038a0de628e2b4f3287a6b217560b5ce01bc5b90002010bb1e54b2'],
] as const;
export type NineReviewYear=2023|2024;
export function selectNinePinnedSourceRollOriginals(year:NineReviewYear,originalAuditRaw:string){
  const source=selectOriginalNoLabelRollPdfCandidates(year as RollReviewYear,originalAuditRaw);
  const wanted=originals.filter(row=>row[0]===year);
  if(wanted.length!==(year===2023?7:2))throw Error('Nine-source universe drifted');
  const docs=wanted.map(([y,date,path,rawHash])=>{
    const url='https://www.lrl.mn.gov/archive/minutes/senate/'+y+'/'+path;
    const found=source.find(r=>r.originalOfficialPdfUrl===url);
    if(!found||found.originalPdfSha256!==rawHash||found.hearingDate!==date||
      found.parserAyeNayLabels!==0||found.parserRecordedRollCallsDetected!==0)
      throw Error('Exact prior official original source URL/date/hash is not reproducible');
    return found;
  });
  if(new Set(docs.map(d=>d.originalOfficialPdfUrl)).size!==docs.length)
    throw Error('Duplicate official source original');
  return docs;
}
type Side='yea'|'nay'|'absent'|'pass';
type NamedChoice={side:Side;name:string;at:number};
function side(s:string):Side{
  if(/^(?:yeas?|yes|ayes?)$/i.test(s))return 'yea';
  if(/^(?:nays?|no|noes?)$/i.test(s))return 'nay';
  if(/^pass(?:es)?$/i.test(s))return 'pass';
  return 'absent';
}
function tallyFrom(raw:string):{yea:number;nay:number;absent:number|null;pass:number|null}|null{
  const pairs=[...raw.matchAll(/(\d{1,2})\s*(Yeas?|Ayes?|Yes|Nays?|Noes?|Nos?|Absences?|Absent|Pass(?:es)?)\b/gi)];
  let yea:null|number=null,nay:null|number=null,absent:null|number=null,pass:null|number=null;
  for(const m of pairs){
    const kind=side(m[2]!),n=Number(m[1]);
    if(kind==='yea')yea=n;
    else if(kind==='nay')nay=n;
    else if(kind==='absent')absent=n;
    else pass=n;
  }
  return yea!==null&&nay!==null ? {yea,nay,absent,pass}:null;
}
function directionNamedRows(region:string,base:number):NamedChoice[]{
  const rx=/\bSenator\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'-]{1,34}(?:\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'-]{1,34}){0,2})\s*[-–—:]\s*(Yea|Nay|Yes|No|Absent|Absence|Pass)\b/g;
  return [...region.matchAll(rx)].map(m=>({
    at:base+(m.index??0),name:normalizeMemberName(m[1]!.trim()),side:side(m[2]!),
  })).filter(m=>m.name.length>1);
}
function committeeColumnNamedRows(region:string,base:number):NamedChoice[]{
  // Only source-proven AYES/NAYS lists after 'the clerk took the roll',
  // not committee attendance, alphabetical members or subcommittee changes.
  const prefix=/the\s+clerk\s+took\s+the\s+roll\s*:\s*AYES?\b/i.exec(region);
  if(!prefix)return [];
  const start=(prefix.index??0)+prefix[0].length;
  const rest=region.slice(start);
  const next=rest.search(/\bNAYS?\b/i);
  if(next<0||next>550)return [];
  const yea=rest.slice(0,next);
  const no=rest.slice(next).replace(/^\s*NAYS?\b/i,'');
  const stop=no.search(/\bthere\s+being\b/i);
  if(stop<0||stop>600)return [];
  const nay=no.slice(0,stop);
  const parse=(raw:string,side:Side):NamedChoice[]=>{
    const rx=/\b([A-Z][A-Z'-]{2,25})\s*,\s*([A-Za-z][A-Za-z'-]{1,30})(?:\s*[-–—]\s*(?:Ranking\s+Member|Vice\s+Chair|Chair))?/g;
    return [...raw.matchAll(rx)].map(m=>({
      at:base+start+(m.index??0),name:normalizeMemberName(m[2]+' '+m[1]),side,
    }));
  };
  return [...parse(yea,'yea'),...parse(nay,'nay')];
}
export type CandidateNamedRoll={
  sourceOffset:number;sourcePattern:'senator_direction_rows'|'clerk_named_side_columns';
  sourceYeaCount:number;sourceNayCount:number;
  explicitlyNamedYeas:number;explicitlyNamedNays:number;
  explicitlyListedAbsent:number;explicitlyListedPass:number;
  explicitNamesAreUniqueWithinRoll:boolean;
  namedYeaNayTallyMatchesSource:boolean;
  absenceAndPassCategoriesAreNotNaysOrYeas:true;
  sourceChoiceFingerprintSha256:string[];
  sourceRollContextSha256:string;
  billOrAmendmentContextSha256:string;
  candidateNeedsIndependentMotionAndRosterCheck:true;
  committeeEthicsActionNeverBillStance:true|false;
  noAutomaticIndividualVoteImport:true;
};
export function extractNineSourceIndividualRolls(text:string,year:NineReviewYear,committee:string):CandidateNamedRoll[]{
  if(text.length<40||text.length>1_000_000)
    throw Error('Original source text outside fixed review bounds');
  const anchors=[...text.matchAll(/\b(?:by\s+a\s+roll\s+call\s+vote\s+of|with\s+(?:a\s+roll\s+call\s+)?vote\s+of|with\s+\d{1,2}\s*(?:ayes?|yeas?)|there\s+being)\b/gi)];
  const results:CandidateNamedRoll[]=[];
  let previousEnd=0;
  for(const token of anchors){
    const at=token.index??0;
    const following=text.slice(at,Math.min(text.length,at+140));
    const tally=tallyFrom(following);
    if(!tally){previousEnd=at+token[0].length;continue}
    const begin=Math.max(previousEnd,at-1850);
    const before=text.slice(begin,at);
    const lastCall=[...before.matchAll(/\b(?:requested\s+a\s+roll\s+call|roll\s+call\s+is\s+granted|the\s+clerk\s+took\s+the\s+roll)\b/gi)].at(-1);
    if(!lastCall){previousEnd=at+token[0].length;continue}
    const start=begin+(lastCall.index??0);
    const region=text.slice(start,at);
    let choices=directionNamedRows(region,start);
    let pattern:CandidateNamedRoll['sourcePattern']='senator_direction_rows';
    if(!choices.length){
      choices=committeeColumnNamedRows(region,start);
      pattern='clerk_named_side_columns';
    }
    const yes=choices.filter(v=>v.side==='yea'),no=choices.filter(v=>v.side==='nay');
    if(!yes.length&&!no.length){previousEnd=at+token[0].length;continue}
    const absent=choices.filter(v=>v.side==='absent');
    const pass=choices.filter(v=>v.side==='pass');
    const seen=choices.map(v=>v.name.toLowerCase());
    const unique=seen.length===new Set(seen).size;
    const tallyMatches=unique && yes.length===tally.yea&&no.length===tally.nay
      &&(tally.absent===null||absent.length===tally.absent)
      &&(tally.pass===null||pass.length===tally.pass);
    results.push({
      sourceOffset:start,sourcePattern:pattern,
      sourceYeaCount:tally.yea,sourceNayCount:tally.nay,
      explicitlyNamedYeas:yes.length,explicitlyNamedNays:no.length,
      explicitlyListedAbsent:absent.length,explicitlyListedPass:pass.length,
      explicitNamesAreUniqueWithinRoll:unique,
      namedYeaNayTallyMatchesSource:tallyMatches,
      absenceAndPassCategoriesAreNotNaysOrYeas:true,
      sourceChoiceFingerprintSha256:choices.map(v=>sha(v.side+':'+v.name)).sort(),
      sourceRollContextSha256:sha(text.slice(start,at+token[0].length+125)),
      billOrAmendmentContextSha256:sha(text.slice(Math.max(0,start-500),start)),
      candidateNeedsIndependentMotionAndRosterCheck:true,
      committeeEthicsActionNeverBillStance:committee.includes('Ethical Conduct'),
      noAutomaticIndividualVoteImport:true,
    });
    previousEnd=at+token[0].length;
  }
  return results;
}