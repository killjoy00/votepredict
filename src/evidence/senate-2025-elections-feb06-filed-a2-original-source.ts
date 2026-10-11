/** #864: bounded ORIGINAL filed SF0529 A2 document acquisition, no vote inference. */
import {createHash} from 'node:crypto';

export const FILED_FEB06_A2_SOURCE={
 schemaVersion:'senate-2025-elections-feb06-sf0529-original-filed-a2-binary-v1',
 issue:864,
 hearingDate:'2025-02-06',
 committee:'Elections',
 bill:'SF0529',
 originalDocumentLabel:'sf0529-a2-amendment',
 documentIndexUrl:'https://www.lrl.mn.gov/minutes/comm?commid=10073-0&year=2025',
 originalPdfUrl:'https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250206/Elections_20250206_SF0529-A2-Amendment.pdf',
 originalMinutesPdfSHA256:'054c81c01271e8ef6513f57c29e95cbdb4f3984a8b0676effe6a83f0f812469d',
 originalMinutesExtractedTextSHA256:'99301546122e3bdb2013302b384e4dd3c2bb15d66056efb1888c66c541758750',
 originalMinutesEarlierSuccessfulSourceRun:38098600457,
 originalLuceroA2OralMotionTextOffset:1991,
 originalMathewsA2MotionTextOffset:2250,
 maxPdfBytes:5_000_000
} as const;

export function checkExactFiledA2OriginalPdf(input:{
 requestedUrl:string;finalResponseUrl:string;status:number;contentType:string;
 byteArray:Uint8Array;
}) {
 const {requestedUrl,finalResponseUrl,status,contentType,byteArray:b}=input;
 if(requestedUrl!==FILED_FEB06_A2_SOURCE.originalPdfUrl||
  finalResponseUrl!==requestedUrl)
  throw Error('Unexpected original Minnesota LRL SF0529 A2 URL or redirect');
 if(status!==200||!/^application\/pdf\b/i.test(contentType))
  throw Error('Original SF0529 A2 response HTTP status or content type invalid');
 if(b.byteLength<300||b.byteLength>FILED_FEB06_A2_SOURCE.maxPdfBytes)
  throw Error('Original SF0529 A2 PDF byte bounds invalid');
 if(new TextDecoder('latin1').decode(b.slice(0,5))!=='%PDF-')
  throw Error('Original SF0529 A2 PDF header invalid');
 const tail=new TextDecoder('latin1').decode(b.slice(-1024));
 if(!tail.includes('%%EOF'))
  throw Error('Original SF0529 A2 missing PDF EOF marker');
 return {
  originalPdfSha256:createHash('sha256').update(b).digest('hex'),
  originalPdfBytes:b.byteLength,
  originalPdfHeaderVerified:true,
  originalPdfEofMarkerVerified:true,
  directOfficialResponseOnly:true,
  storedHistoricalAvailabilityNotInferred:true,
  filedAmendmentDoesNotProveDistinctCommitteeVote:true,
  noIndividualYeaNayChoiceEstablished:true,
  noOriginalMinutesVoteParagraphRewritten:true
 };
}
