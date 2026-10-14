/**
 * #864 2022-25 ONLY. Separately publicly discovered archived 2022 Senate
 * Housing Finance and Policy original meeting Minutes PDF; the LRL official
 * electronic minutes meeting index has this hearing with NO LINKED PDF.
 *
 * Official original URL is an exact allowlist, not guessed from committee date.
 * This source proves two motions being made to lay over SF4170 and SF3994,
 * NOT a passed/failed vote, named YEA/NAY or individual senator side.
 */
import {createHash} from 'node:crypto';
export const ORIGINAL_HOUSING_PDF='https://www.lrl.mn.gov/archive/minutes/senate/2022/Finhousing/20220324/FinHousing_20220324_Minutes032422.pdf';
export const ORIGINAL_HOUSING_SCHEMA='senate-864-original-2022-03-24-housing-lrl-orphan-pdf-v1';
export const digest=(r:string|Uint8Array)=>createHash('sha256').update(r).digest('hex');
const bills=['SF4170','SF3994'] as const;
export function inspectMarch24HousingOfficialOriginalPdfText(
 sourcePdfText:string,wholeRawSha256:string,pdfBytes:number,pages:number,
 sourcePdfFirstPageText:string,retrievedAt:string
){
 if(!/^[a-f0-9]{64}$/.test(wholeRawSha256)||!Number.isSafeInteger(pdfBytes)||
  pdfBytes<3500||pdfBytes>6_000_000||
  !Number.isSafeInteger(pages)||pages<1||pages>8||
  !Number.isFinite(Date.parse(retrievedAt))||
  sourcePdfText.length<900||sourcePdfText.length>300000)
  throw Error('Official 2022 Senate Housing original PDF immutable-source bounds failed');
 const normalized=(s:string)=>s.replace(/\s+/g,' ').trim();
 const text=normalized(sourcePdfText),page=normalized(sourcePdfFirstPageText);
 for(const s of [text,page]){
  if(!/\bMinnesota State Senate\b/i.test(s)||
   !/\bHousing Finance and Policy Committee\b/i.test(s)||
   !/\bThursday, March 24, 2022\b/i.test(s)||!/\bMinutes\b/i.test(s)||
   !/\bmeeting was adjourned\b/i.test(s))
   throw Error('Official 2022 Housing original PDF meeting-date/committee/title/footer mismatch');
 }
 const matches=bills.map(bill=>{
  const number=bill.slice(2);
  const billRx=new RegExp('\\bS\\s*\\.?\\s*F\\s*\\.?\\s*'+number+'\\b','giu');
  const references=[...page.matchAll(billRx)];
  const motionRx=new RegExp('\\bSenator\\s+(?:[\\p{L}\\p{M}.\\x27-]+\\s+){1,6}moved\\s+that\\s+S\\s*\\.?\\s*F\\s*\\.?\\s*'+number+'\\s*,?\\s*be\\s+laid\\s+over\\b','iu');
  if(references.length<2||!motionRx.test(page))
   throw Error('Original 2022 Housing date PDF lacks separately anchored bill-specific layover motion');
  return {billReference:bill,sourcePdfPage:1,
   actionType:'recorded_proposal_to_lay_over',
   officialActionOutcome:null,recordedYeaCount:null,recordedNayCount:null,
   namedIndividualYeaNayVotesProven:false,
   independentHistoricPdfFirstPublicBy:null,
   motionOriginalPageSha256:digest(sourcePdfFirstPageText),
   sourceMotionIdentityProvenFromOriginalOfficialPage:true
  };
 });
 return {
  schemaVersion:ORIGINAL_HOUSING_SCHEMA,issue:864,
  hearingDate:'2022-03-24',committeeName:'Housing Finance and Policy',
  originalLrlOfficialMeetingIndexMinutesPdfLinked:false,
  originalPublicGovPdfUrl:ORIGINAL_HOUSING_PDF,
  originalPdfRawSha256:wholeRawSha256,originalPdfBytes:pdfBytes,originalPdfPages:pages,
  originalPdfTextSha256:digest(sourcePdfText),originalPdfFirstPageTextSha256:digest(sourcePdfFirstPageText),
  originalPdfRetrievedAt:retrievedAt,
  motionObservations:matches,
  originalNamedYeaNayRollsProven:0,
  sourceActionCountNotAllOfficialMotionDenominator:true,
  no2021CommitteeRecordsUsed:true,
  noSourceToStoredMemberVoteJoin:true,
  noProductionDatabaseOperations:true,
  sourceOriginalPdfPublishedByDateIndependentlyProven:false
 };
}
