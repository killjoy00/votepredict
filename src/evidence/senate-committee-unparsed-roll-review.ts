/**
 * #864: review only original embedded-text Senate PDFs which contain a
 * roll-call phrase but yielded no supported parsed roll-call observation.
 * Exact original 2022-25 artifacts are hashed, so no new unbounded crawling.
 * Wording signals are NOT proved recorded votes or individual member choices.
 */
import { createHash } from 'node:crypto';

export type RollReviewYear = 2022|2023|2024|2025;
export const SENATE_ROLL_SIGNAL_SOURCE_RUN=38066441841;
export const SENATE_ROLL_SIGNAL_YEAR_PROOFS = {
  2022:{artifactId:11674729430,sourceName:'senate-committee-2022-original-action-source-metadata',
    jsonSha256:'23be57a94c4c9dcb3641dca450b335c81fca9fbd25867d94658d77937b847372',
    expectedPdfs:325,embeddedParsed:204,signaled:17,withAyeNayLabels:2},
  2023:{artifactId:11674568363,sourceName:'senate-committee-2023-original-action-source-metadata',
    jsonSha256:'ee719ddc1b6ce7aad631d6d4d9ca635c49e607bb69cf5cdbd17c4725d4698974',
    expectedPdfs:454,embeddedParsed:432,signaled:74,withAyeNayLabels:14},
  2024:{artifactId:11675315164,sourceName:'senate-committee-2024-original-action-source-metadata',
    jsonSha256:'c461c82a8f3be64b863783b1c4d02bc2b055f37fc0ecb39ec542ee5560ec4085',
    expectedPdfs:258,embeddedParsed:245,signaled:26,withAyeNayLabels:13},
  2025:{artifactId:11675014092,sourceName:'senate-committee-2025-original-action-source-metadata',
    jsonSha256:'e611f2b7a7225d7c62e8bbae960db60c50793ffca7cb3928e62d578a809c5dea',
    expectedPdfs:415,embeddedParsed:364,signaled:24,withAyeNayLabels:12},
} as const;
export interface ReviewCandidate {
  year:RollReviewYear;
  committeeName:string;
  hearingDate:string;
  originalOfficialPdfUrl:string;
  originalPdfSha256:string;
  extractedTextSha256:string;
  parserRollCallPhrases:number;
  parserAyeNayLabels:number;
  parserVoiceVotePhrases:number;
  parserMotionOutcomePhrases:number;
  parserRecordedRollCallsDetected:0;
  riskTier:'yea_nay_label_plus_roll_cue'|'repeated_roll_call_phrase'|'single_roll_call_phrase';
  riskScore:number;
  possibleUnparsedRollCallNotConfirmedAsVote:true;
}
const sha=(raw:string)=>createHash('sha256').update(raw).digest('hex');

export function extractOriginalRollSignalCandidates(year:RollReviewYear,raw:string):ReviewCandidate[]{
  const cfg=SENATE_ROLL_SIGNAL_YEAR_PROOFS[year];
  if(sha(raw)!==cfg.jsonSha256)throw Error('Original Senate roll review source artifact hash differs');
  const source=JSON.parse(raw) as {
    auditedYear:number;
    originalPdfsFetchedAndParsed:number;
    independentlyDiscoveredOriginalMinutesPdfLinks:number;
    documentProofs:Array<{
      document:{year:number;committeeName:string;meetingDate:string;sourceUrl:string;
        originalRawPdfSha256:string;extractedTextSha256:string};
      missingness:{possibleUnparsedRollCallSignal:boolean};
      sourceSignalHints:{rollCallPhrase:number;ayeOrNayLabel:number;
        voiceVotePhrase:number;motionOutcomePhrase:number};
      sourceParserTotals:{recordedVoteObservations:number};
    }>;
  };
  if(source.auditedYear!==year
    ||source.independentlyDiscoveredOriginalMinutesPdfLinks!==cfg.expectedPdfs
    ||source.originalPdfsFetchedAndParsed!==cfg.embeddedParsed
    ||!Array.isArray(source.documentProofs)
    ||source.documentProofs.length!==cfg.embeddedParsed)
    throw Error('Original source-year parsed PDF population does not match');
  const flagged=source.documentProofs.filter(x=>x.missingness.possibleUnparsedRollCallSignal);
  if(flagged.length!==cfg.signaled)throw Error('Original source flagged roll-call count changed');
  const rows:ReviewCandidate[]=flagged.map((x)=>{
    const d=x.document,h=x.sourceSignalHints;
    const u=new URL(d.sourceUrl);
    const date=d.meetingDate.replaceAll('-','');
    if(d.year!==year||!d.committeeName.trim()
      ||u.hostname!=='www.lrl.mn.gov'||u.protocol!=='https:'
      ||u.search||u.hash
      ||!u.pathname.startsWith('/archive/minutes/senate/'+year+'/')
      ||!u.pathname.includes('/'+date+'/')
      ||!/_minutes\.pdf$/i.test(u.pathname)
      ||!/^202[2-5]-\d\d-\d\d$/.test(d.meetingDate)
      ||!/^\w{64}$/.test(d.originalRawPdfSha256)
      ||!/^\w{64}$/.test(d.extractedTextSha256)
      ||h.rollCallPhrase<1||x.sourceParserTotals.recordedVoteObservations!==0)
      throw Error('Suspicious source roll-review identity or parser metadata');
    const tier=h.ayeOrNayLabel>0?'yea_nay_label_plus_roll_cue'
      :h.rollCallPhrase>1?'repeated_roll_call_phrase':'single_roll_call_phrase';
    return {
      year,committeeName:d.committeeName,hearingDate:d.meetingDate,
      originalOfficialPdfUrl:d.sourceUrl,originalPdfSha256:d.originalRawPdfSha256,
      extractedTextSha256:d.extractedTextSha256,
      parserRollCallPhrases:h.rollCallPhrase,parserAyeNayLabels:h.ayeOrNayLabel,
      parserVoiceVotePhrases:h.voiceVotePhrase,
      parserMotionOutcomePhrases:h.motionOutcomePhrase,
      parserRecordedRollCallsDetected:0 as const,riskTier:tier,
      riskScore:(h.ayeOrNayLabel>0?100:0)+Math.min(h.rollCallPhrase,20)*10
        +Math.min(h.motionOutcomePhrase,20),
      possibleUnparsedRollCallNotConfirmedAsVote:true as const,
    };
  });
  if(rows.filter(x=>x.parserAyeNayLabels>0).length!==cfg.withAyeNayLabels
     ||new Set(rows.map(x=>x.originalOfficialPdfUrl)).size!==rows.length)
    throw Error('Exact original YEA/NAY label count or uniqueness changed');
  return rows.sort((a,b)=>b.riskScore-a.riskScore
    ||a.hearingDate.localeCompare(b.hearingDate)
    ||a.originalOfficialPdfUrl.localeCompare(b.originalOfficialPdfUrl));
}
