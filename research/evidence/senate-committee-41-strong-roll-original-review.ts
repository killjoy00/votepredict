/**
 * #864 — original-source verification of the 41 strongest possible unparsed
 * Senate committee roll-call PDFs. Conservative cue classification only.
 * No keyword becomes an asserted vote or named member choice.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export type ReviewYear = 2022 | 2023 | 2024 | 2025;
export const HIGH_SIGNAL_PDF_EXPECTED = {
  2022: 2, 2023: 14, 2024: 13, 2025: 12,
} as const;
const hash = (x:string)=>createHash('sha256').update(x).digest('hex');

export type StrongRollRow = {
  year:ReviewYear;
  committeeName:string;
  hearingDate:string;
  originalOfficialPdfUrl:string;
  originalPdfSha256:string;
  extractedTextSha256:string;
  parserAyeNayLabels:number;
  parserRollCallPhrases:number;
  riskTier:string;
};

export function loadStrongRollSourceManifest(year:ReviewYear, raw:string):StrongRollRow[]{
  const ledger=JSON.parse(readFileSync(new URL(
    '../../docs/evaluation/source-proof/senate-committee-141-unparsed-roll-review-source-ledger.json',
    import.meta.url), 'utf8')) as {
      candidateQueueWorkflowRun:number;byYear:Array<{
        year:number;jsonSha256:string;candidatePdfWithAyeNayLabels:number;
      }>;
    };
  if(ledger.candidateQueueWorkflowRun!==38075573031)
    throw Error('Previously verified candidate queue source run has changed');
  const proof=ledger.byYear.find(x=>x.year===year);
  if(!proof || hash(raw)!==proof.jsonSha256)
    throw Error('Strong-roll candidate source JSON digest differs from independently verified proof');
  const source=JSON.parse(raw) as {
    year:number,originalSourceRunId:number,prioritizedSourceCandidates:StrongRollRow[],
    pagesWithAyeNayLabelsAndRollCallPhrase:number,
  };
  if(source.year!==year || source.originalSourceRunId!==38066441841 ||
    source.pagesWithAyeNayLabelsAndRollCallPhrase!==HIGH_SIGNAL_PDF_EXPECTED[year] ||
    !Array.isArray(source.prioritizedSourceCandidates))
    throw Error('Strong-roll candidate review metadata is inconsistent');
  const selected=source.prioritizedSourceCandidates.filter(x=>x.parserAyeNayLabels>0);
  if(selected.length!==HIGH_SIGNAL_PDF_EXPECTED[year] ||
    selected.length!==proof.candidatePdfWithAyeNayLabels)
    throw Error('Incorrect independently reviewed strong-roll PDF denominator');
  const seen=new Set<string>();
  for (const row of selected) {
    const u=new URL(row.originalOfficialPdfUrl);
    if(row.year!==year || !row.hearingDate.startsWith(String(year)+'-') ||
      !row.committeeName.trim() || row.riskTier!=='yea_nay_label_plus_roll_cue' ||
      row.parserRollCallPhrases<1 ||
      u.protocol!=='https:' || u.hostname!=='www.lrl.mn.gov' ||
      u.search!==''||u.hash!=='' ||
      !u.pathname.startsWith('/archive/minutes/senate/'+year+'/') ||
      !u.pathname.includes('/'+row.hearingDate.replaceAll('-','')+'/') ||
      !/_minutes\.pdf$/i.test(u.pathname) ||
      !/^[a-f0-9]{64}$/.test(row.originalPdfSha256) ||
      !/^[a-f0-9]{64}$/.test(row.extractedTextSha256) ||
      seen.has(row.originalOfficialPdfUrl))
      throw Error('Untrusted, duplicate or out-of-year strong-roll original');
    seen.add(row.originalOfficialPdfUrl);
  }
  return selected.sort((a,b)=>a.originalOfficialPdfUrl.localeCompare(b.originalOfficialPdfUrl));
}
const ROLL=/\broll\s+call\b/gi;
const LABEL=/\b(?:ayes?|nays?|yes|no)\s*[:\-–]/gi;
const ATTENDANCE=/\b(?:present|absent|quorum|attendance|members\s+were\s+called|call\s+of\s+the\s+members)\b/i;
const MOTION=/\b(?:motion|moved|amendment|recommended\s+to\s+pass|re-?refer|adopted|prevailed|failed)\b/i;
const VOTE=/\b(?:vote|votes?|voting|yeas?|nays?|ayes?|noes?)\b/i;

export function triageOriginalRollCueText(text:string){
  if(text.length<40 || text.length>1_000_000)
    throw Error('Source text outside bounded committee review length');
  const indices=(regexp:RegExp)=>Array.from(text.matchAll(regexp),m=>m.index??0);
  const roll=indices(ROLL), labels=indices(LABEL);
  const neighborhood=(at:number,width=360)=>text.slice(Math.max(0,at-width),Math.min(text.length,at+width));
  const cueStats=roll.map(at=>{
    const near=neighborhood(at);
    return {
      at,wordWindowSha256:hash(near),
      attendanceTerm:ATTENDANCE.test(near),
      motionTerm:MOTION.test(near),
      voteTerm:VOTE.test(near),
      ayeNayLabelNearby:/\b(?:ayes?|nays?|yes|no)\s*[:\-–]/i.test(near),
    };
  });
  const nearLabel=labels.map(at=>{
    const near=neighborhood(at,250);
    return {at,hasRollPhraseNearby:/\broll\s+call\b/i.test(near),
      motionTerm:MOTION.test(near),voteTerm:VOTE.test(near),
      labelContextSha256:hash(near)};
  });
  const qualifiesContext=cueStats.filter(x=>
    x.motionTerm && x.voteTerm && x.ayeNayLabelNearby);
  // Compact ephemeral text previews: maximum 3 snippets, 220 chars each,
  // for human review ONLY. Do not commit source prose to a permanent ledger.
  const previewIndices=[...new Set([
    ...cueStats.filter(x=>x.motionTerm && x.ayeNayLabelNearby).map(x=>x.at).slice(0,2),
    ...labels.slice(0,1),
    ...roll.slice(0,1),
  ])].slice(0,3);
  const snippets=previewIndices.map(at=>({
    sourceOffset:at,
    text:text.slice(Math.max(0,at-110),Math.min(text.length,at+110))
      .replace(/\s+/g,' ').trim(),
  }));
  return {
    rollCallPhraseCount:roll.length,ayeNayTextLabelCount:labels.length,
    cuesWithAttendanceWords:cueStats.filter(x=>x.attendanceTerm).length,
    cuesWithMotionWords:cueStats.filter(x=>x.motionTerm).length,
    cuesWithVoteWords:cueStats.filter(x=>x.voteTerm).length,
    cuesWithBothMotionAndAyeNayLabel:qualifiesContext.length,
    labelsNearRollPhrase:nearLabel.filter(x=>x.hasRollPhraseNearby).length,
    textSha256:hash(text),
    cueStats,nearLabel,
    boundedEphemeralOfficialSourcePreview:snippets,
    motionAndLabelsRequireExactSourceVerification:true,
    keywordIsNotVerifiedVote:true,
  };
}
