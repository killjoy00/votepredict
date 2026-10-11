/**
 * Minnesota Senate 2021 COMMITTEE online historical minute source.
 * This is a SOURCE-LEVEL candidate, NOT equivalent to the official 2021
 * print-only LRL collection (which remains unavailable for comparison).
 * #864: hold all member_vote ingestion and official denominator claims.
 */
import {createHash} from 'node:crypto';
import {normalizeOfficialMinutesHtml}
 from './senate-2023-transportation-apr03-sf3157-source.js';

export const MAR10_2021_SF450_SOURCE={
 schemaVersion:'senate-2021-state-government-mar10-sf450-online-5-3-named-roll-v1',
 hearingDate:'2021-03-10',bill:'SF450',
 committee:'State Government Finance and Policy and Elections',
 originalSenateHearingId:16146,
 originalOnlineMinutesURL:'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=16146&ls=92&type=minutes',
 official2021PrintMinutesAuthorityURL:'https://www.lrl.mn.gov/minutes/',
 senate2021PrintOriginalCompared:false,
 onlineMinutesNotEquivalentToOriginal2021PrintedOfficialMinutes:true,
 maxHtmlBytes:1_200_000
} as const;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const REAL=new Set(['Kiffmeyer','Howe','Osmek','Pratt','Koran','Carlson','Clausen','Fateh']);
const list=(s:string)=>s.split(/\s*,\s*/).map(x=>x.trim()).filter(Boolean);
function inspectCore(html:string,roster:ReadonlySet<string>){
 const bytes=Buffer.byteLength(html,'utf8');
 if(bytes<1200||bytes>MAR10_2021_SF450_SOURCE.maxHtmlBytes)
  throw Error('2021 original public HTML original-byte bounds invalid');
 const text=normalizeOfficialMinutesHtml(html);
 if(!/\bState Government Finance and Policy and Elections Committee\b/i.test(text)||
  !/\bWednesday,\s*March\s+10,\s*2021\b/i.test(text))
  throw Error('Exact 2021 Senate committee/date title is missing');
 const start=text.search(/\bS\.\s*F\.\s*450\s*:\s*Senator\b/i);
 if(start<0)throw Error('SF450 original bill section not found');
 const rest=text.slice(start);
 const end=rest.search(/\bS\.\s*F\.\s*1564\s*:/i);
 if(end<=0||end>4500)throw Error('2021 SF450 to SF1564 section boundary changed');
 const section=rest.slice(0,end);
 const moved=[...section.matchAll(
  /\bSenator\s+Osmek\s+moved\s+that\s+S\.?\s*F\.?\s*450\s+be\s+recommended\s+to\s+pass\s+and\s+be\s+rereferred\s+to\s+the\s+Finance\s+Committee\b/gi
 )];
 if(moved.length!==1)throw Error('Original SF450 actual unique mover and recommendation missing');
 const motionAt=start+(moved[0]!.index??0);
 const after=section.slice((moved[0]!.index??0)+moved[0]![0].length);
 const split=[...after.matchAll(
  /\bSenator\s+Carlson\s+requested\s+a\s+roll\s+call\s+vote[.:]?\s+Yay\s+votes:\s*([A-Za-z\s,.'-]+?)\s+Nay\s+votes:\s*([A-Za-z\s,.'-]+?)\s+On\s+a\s+vote\s+of\s+5\s+yays\s+and\s+3\s+nays\s+the\s+motion\s+prevailed\b/gi
 )];
 if(split.length!==1)throw Error('Named original SF450 roll request, 5/3 and prevailing result not uniquely isolated');
 const m=split[0]!,yea=list(m[1]!),nay=list(m[2]!);
 if(yea.length!==5||nay.length!==3||
  new Set([...yea,...nay]).size!==8||
  [...yea,...nay].some(x=>!roster.has(x)))
  throw Error('2021 source YEA/NAY named individual choices do not exactly partition eight senators');
 const nameListEnds=start+(moved[0]!.index??0)+moved[0]![0].length+(m.index??0)+m[0].length;
 const recap=[...section.matchAll(
  /\bSenator\s+Osmek\s+moved\s+that\s+S\.?\s*F\.?\s*450,\s*be\s+recommended\s+to\s+pass\s+and\s+re-referred\s+to\s+the\s+Finance\s+Committee\.\s*-\s*MOTION\s+PREVAILED\b/gi
 )];
 if(recap.length!==1||recap[0]!.index===undefined||
  recap[0]!.index<((moved[0]!.index??0)+moved[0]![0].length))
  throw Error('Expected one post-roll SF450 recommendation recap, not a second vote');
 // Do not treat a separate later voice vote as part of this explicit named
 // SF450 division. This section's independently bounded 5/3 roll is decisive.
 const nearby=text.slice(Math.max(0,motionAt-180),Math.min(text.length,nameListEnds+230));
 const preVote=text.slice(motionAt,motionAt+((moved[0]![0].length)+(m.index??0)));
 const memberHashes={
  yea:yea.map(x=>sha('yea:'+x.toLowerCase())).sort(),
  nay:nay.map(x=>sha('nay:'+x.toLowerCase())).sort(),
  absent:[] as string[]
 };
 return {
  hearingDate:MAR10_2021_SF450_SOURCE.hearingDate,
  committee:MAR10_2021_SF450_SOURCE.committee,
  bill:MAR10_2021_SF450_SOURCE.bill,
  originalIntroducedMotionMover:'Osmek',
  originalRequestForRollBy:'Carlson',
  originalCommitteeRecommendation:'Recommend SF450 pass and re-refer to Finance',
  originalRollResult:'motion prevailed',
  onlineOriginalNamedYeaCount:yea.length,onlineOriginalNamedNayCount:nay.length,
  onlineOriginalNamedAbsentCountPrinted:null,
  onlineFullEightMemberNamedYeaNayPartition:true,
  originalMotionStartTextOffset:motionAt,
  originalResultEndTextOffset:nameListEnds,
  originalNearbySectionSHA256:sha(nearby),
  originalPreRollSectionSHA256:sha(preVote),
  recapPrintedCount:recap.length,
  exactOriginalRollParagraphCount:split.length,
  duplicatePostRollRecapNotIndependentNamedVote:true,
  namedMemberChoiceIdentitySHA256Only:memberHashes,
  noUnhashedNamedMemberSideListStored:true,
  printOriginalCrosscheckCompleted:false,
  historicalFullOfficialVoteCertification:false,
  sourceToPrivateMemberVoteParityVerified:false,
  noNewStatewide2021To2025DenominatorIncrement:true,
  noSameDayForecastWithoutPreciseActionTime:true,
  noAutomaticIndividualVoteImport:true
 };
}
export function inspectSenate2021Mar10SF450OnlineHtml(html:string){
 return inspectCore(html,REAL);
}
/** Fixture ONLY; actual historical source MUST use real official eight-name roster. */
export function inspectSynthetic2021Mar10SF450OnlineHtml(html:string,fictionalRoster:readonly string[]){
 if(fictionalRoster.length!==8||new Set(fictionalRoster).size!==8||
  fictionalRoster.some(x=>REAL.has(x)))
  throw Error('Synthetic fixture requires eight different fully fictional senators');
 return inspectCore(html,new Set(fictionalRoster));
}
