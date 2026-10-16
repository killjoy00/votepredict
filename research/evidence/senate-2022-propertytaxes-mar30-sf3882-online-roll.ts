/**
 * #864: Actual March30, 2022 MN Senate Property Taxes SUBCOMMITTEE online
 * meeting minutes, SF3882 referral roll: 2-2, motion did NOT prevail.
 * Separate from floor vote, Rule12.10 indexed reports and 2022 printed
 * LRL Senate committee-minute volumes (not yet independently compared).
 * No historical readable senator-by-side lists are committed.
 */
import {createHash} from 'node:crypto';
import {normalizeOfficialMinutesHtml}
 from '../../src/evidence/senate-2023-transportation-apr03-sf3157-source.js';

export const MAR30_2022_SF3882_COMMITTEE_SOURCE={
 version:'mn-senate-2022-property-taxes-sf3882-online-2-2-referral-v1',
 meetingDate:'2022-03-30',bill:'SF3882',
 subcommittee:'Subcommittee on Property Taxes',
 originalOnlineMinutesURL:'https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=16933&ls=92',
 maxOriginalHtmlBytes:900_000,
 originalPrintOnlyAndElectronicLRLCollectionsNotCompared:true,
 originalExpectedYeaSideSHA256:'27ab098d84fc0634afce400ee9e2c6d2e9c22bf4e18a63201c9f9e7019b46902',
 originalExpectedNaySideSHA256:'0dc1e05538f30300e0e340b71f5c79bf3af7eb362d80dcca0d3a33136be0340b'
} as const;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const identity=(side:'yea'|'nay',names:readonly string[])=>
 sha(names.map(n=>sha(side+':'+n.toLowerCase())).sort().join('|'));
const bound=(text:string,start:number,stop:string)=>{
 const slice=text.slice(start,start+4000);
 const end=slice.indexOf(stop);
 if(end<0)throw Error('Original SF3882 motion section boundary missing');
 return slice.slice(0,end);
};
function inspect(html:string,requester:string,allow?:{yea:string;nay:string}){
 if(Buffer.byteLength(html,'utf8')<1200||
  Buffer.byteLength(html,'utf8')>MAR30_2022_SF3882_COMMITTEE_SOURCE.maxOriginalHtmlBytes)
  throw Error('2022 official online subcommittee minutes HTML byte bounds invalid');
 const text=normalizeOfficialMinutesHtml(html);
 if(!/\bSubcommittee\s+on\s+Property\s+Taxes\b/i.test(text)||
  !/\bWednesday,\s+March\s+30,\s+2022\b/i.test(text))
  throw Error('Wrong original property tax subcommittee or hearing day');
 if(!/Present:\s*Senator\b/i.test(text)||!/Absent:\s*Senator\b/i.test(text))
  throw Error('Official 2022 Senate minutes attendance context missing');
 const mention=[...text.matchAll(/\bS\.?\s*F\.?\s*3882\s*:\s*Senator\b/gi)];
 if(mention.length!==1||mention[0]!.index===undefined)
  throw Error('One exact SF3882 original committee bill presentation expected');
 const section=text.slice(mention[0]!.index,mention[0]!.index+4500);
 const rollMarker=new RegExp('\\bSenator\\s+'+requester+'\\s+requested\\s+Roll\\s+call\\s+to\\s+refer\\s+S\\.?\\s*F\\.?\\s*3882\\s+to\\s+Local\\s+Government\\b','gi');
 const roll=[...section.matchAll(rollMarker)];
 if(roll.length!==1||roll[0]!.index===undefined)
  throw Error('Exact SF3882 referral motion and roll requester not uniquely found');
 const motionStart=mention[0]!.index+roll[0]!.index!;
 const following=bound(section,roll[0]!.index!+roll[0]![0].length,'Discussion');
 const named=[...following.matchAll(/\bSenator\s+([\p{L}\p{M} '-]+?)\s+voted\s+(yes|no)\b/giu)];
 const tally=following.match(/\b2\s*-\s*2\s+Motion\s+did\s+not\s+prevail\b/i);
 if(named.length!==4||!tally)
  throw Error('Exact four named individual YES/NO votes and 2-2 failed referral required');
 const yea=named.filter(x=>x[2]!.toLowerCase()==='yes').map(x=>x[1]!.trim());
 const nay=named.filter(x=>x[2]!.toLowerCase()==='no').map(x=>x[1]!.trim());
 if(yea.length!==2||nay.length!==2||
  new Set([...yea,...nay].map(x=>x.toLowerCase())).size!==4)
  throw Error('SF3882 named 2-2 partition has invalid totals or duplicate member');
 const yh=identity('yea',yea),nh=identity('nay',nay);
 if(yh!==(allow?.yea??MAR30_2022_SF3882_COMMITTEE_SOURCE.originalExpectedYeaSideSHA256)||
    nh!==(allow?.nay??MAR30_2022_SF3882_COMMITTEE_SOURCE.originalExpectedNaySideSHA256))
  throw Error('Original SF3882 individual online minute side hash differs');
 const subtext=following.slice(0,(tally.index??0)+tally[0].length);
 const resultAt=motionStart+roll[0]![0].length+(tally.index??0);
 return {
  originalSourceKind:'OFFICIAL_2022_MN_SENATE_SUBCOMMITTEE_ONLINE_MINUTES_NOT_FLOOR',
  originalMeetingDate:MAR30_2022_SF3882_COMMITTEE_SOURCE.meetingDate,
  subcommittee:MAR30_2022_SF3882_COMMITTEE_SOURCE.subcommittee,
  bill:'SF3882',
  originalRequestForRollOnReferral:requester,
  recordedMotion:'refer SF3882 to Local Government',
  sourcePrintedYea:2,sourcePrintedNay:2,sourcePrintedMotionAbsent:null,
  exactOriginalNamedRollMotionCount:roll.length,
  originalRollOutcome:'motion did not prevail',
  motionNormalizedTextOffset:motionStart,
  originalResultNormalizedTextOffset:resultAt,
  originalRollPassageSHA256:sha(subtext),
  originalLocalContextSHA256:sha(text.slice(Math.max(0,motionStart-250),motionStart+roll[0]![0].length+subtext.length+100)),
  individualSenatorSidesSHA256Only:{yea:yh,nay:nh},
  laterSF3882LayoverIsDifferentMotionNotSecondRoll:true,
  meetingAttendanceAbsentDoesNotInferMotionSpecificAbsence:true,
  noLRL2022PrintElectronicEquivalenceClaim:true,
  originalOnlineSourceDayNotIndependentFirstPublicByTime:true,
  noPrivateStoredVoteRowsOrImport:true,
  noStatewideRecordedCommitteeDenominator:true,
  noSenateFloorOrForecastModelsOr2027:true,issue864RemainsOpen:true
 };
}
export const inspectOriginalMar30SF3882SubcommitteeMinutes=(html:string)=>inspect(html,'Klein');
/** Fictional-only regression: real voter choices never present as readable fixtures. */
export function inspectFictionalMar30SF3882OnlineMinutes(
 html:string,requester:string,yea:readonly string[],nay:readonly string[]
){
 if(!/^Fictional[A-Z][a-z]{3,18}$/.test(requester)||
  yea.length!==2||nay.length!==2||
  [...yea,...nay].some(x=>!/^Fictional[A-Z][a-z]{3,18}$/.test(x)))
  throw Error('Four invented voting member identities and fictional requester required');
 return inspect(html,requester,{yea:identity('yea',yea),nay:identity('nay',nay)});
}
