/**
 * Issue #864: one bounded, public-source-only check of a 2024 Minnesota Senate
 * Education Policy Minutes document with repeated, independently recorded
 * amendment divisions. It must not be used as a stored-DB parity certificate.
 *
 * Source-specific names and choice digests remain transient in process memory.
 * Only original-PDF hashes and bounded aggregate counts may be returned.
 */
import {createHash} from 'node:crypto';
import {parseSenateCommitteeMinuteVotes} from './minnesota-senate-committee-minutes.js';

const sha=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');

export const EDUCATION_2024_REPEATED_ROLL_SOURCE={
  originalSourceRunId:38066441841,
  originalArtifactId:11675315164,
  originalMetadataSha256:'c461c82a8f3be64b863783b1c4d02bc2b055f37fc0ecb39ec542ee5560ec4085',
  sourceUrl:'https://www.lrl.mn.gov/archive/minutes/senate/2024/educ/20240214/educ_20240214_Minutes.pdf',
  committeeName:'Education Policy',
  hearingDate:'2024-02-14',
  originalPdfSha256:'6d00d812236d4585ea315da9fdf2da8325fcad512e4089e1422fa4a96e2a7f52',
  originalEmbeddedTextSha256:'99d3fcdd8fd30010b1f5efd7da7196d5003e58388d8ba92c74e5237cd0440f4a',
  originalPdfBytes:131315,
  archiveParsedDocuments:245,
  archiveUnparsedDocuments:13,
  archiveOriginalLinks:258,
  previouslyDetectedNamedRolls:2,
  expectedDistinctAmendments:['10','2','3','5','6','9'],
} as const;

type PinnedCandidate={
  yeaCount:number;
  nayCount:number;
  namedMemberChoicesInPdf:number;
  individualVotesAvailable:boolean;
  choiceIdentitySha256:string[];
};
export interface PinnedEducationSource {
  sourceUrl:string;
  originalPdfSha256:string;
  extractedTextSha256:string;
  originalPdfBytes:number;
  previousCandidates:PinnedCandidate[];
}

const expected=EDUCATION_2024_REPEATED_ROLL_SOURCE;
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const hex64=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);

/** Never select a source document by merely matching a committee or tally. */
export function selectPinned2024EducationSource(manifestRaw:string):PinnedEducationSource{
  if(sha(manifestRaw)!==expected.originalMetadataSha256)
    throw Error('Original 2024 source metadata SHA did not match');
  const manifest=JSON.parse(manifestRaw) as {
    schemaVersion?:string;auditedYear?:number;
    independentlyDiscoveredOriginalMinutesPdfLinks?:number;
    originalPdfsFetchedAndParsed?:number;
    originalPdfsFailedOrUnparsed?:number;
    documentProofs?:Array<{
      document:{
        sourceUrl:string;committeeName:string;meetingDate:string;
        originalRawPdfSha256:string;extractedTextSha256:string;originalPdfBytes:number;
      };
      voteObservations:PinnedCandidate[];
    }>;
  };
  if(manifest.schemaVersion!=='senate-committee-original-2022-25-pdf-actions-v1'
    ||manifest.auditedYear!==2024
    ||manifest.independentlyDiscoveredOriginalMinutesPdfLinks!==expected.archiveOriginalLinks
    ||manifest.originalPdfsFetchedAndParsed!==expected.archiveParsedDocuments
    ||manifest.originalPdfsFailedOrUnparsed!==expected.archiveUnparsedDocuments
    ||manifest.documentProofs?.length!==expected.archiveParsedDocuments)
    throw Error('Original year source universe changed');

  const proofs=manifest.documentProofs.filter(p=>
    p.document.sourceUrl===expected.sourceUrl
    ||(p.document.meetingDate===expected.hearingDate
      &&p.document.committeeName===expected.committeeName));
  if(proofs.length!==1)throw Error('Original hearing source identity absent or ambiguous');
  const proof=proofs[0]!;
  const doc=proof.document;
  if(doc.sourceUrl!==expected.sourceUrl
    ||doc.meetingDate!==expected.hearingDate
    ||doc.committeeName!==expected.committeeName
    ||doc.originalRawPdfSha256!==expected.originalPdfSha256
    ||doc.extractedTextSha256!==expected.originalEmbeddedTextSha256
    ||doc.originalPdfBytes!==expected.originalPdfBytes
    ||proof.voteObservations.length!==expected.previouslyDetectedNamedRolls)
    throw Error('Exact pinned source date, PDF bytes or parser observations changed');
  const previousCandidates=proof.voteObservations;
  for(const v of previousCandidates){
    if(v.yeaCount!==4||v.nayCount!==6||v.namedMemberChoicesInPdf!==10
      ||v.individualVotesAvailable!==true
      ||v.choiceIdentitySha256.length!==10
      ||v.choiceIdentitySha256.some(h=>!hex64(h))
      ||new Set(v.choiceIdentitySha256).size!==10)
      throw Error('Pinned original source recorded-choice proof invalid');
  }
  if(!equal(previousCandidates[0]!.choiceIdentitySha256,
    previousCandidates[1]!.choiceIdentitySha256))
    throw Error('Old parser candidate choices are not the same source slate');
  return {
    sourceUrl:doc.sourceUrl,originalPdfSha256:doc.originalRawPdfSha256,
    extractedTextSha256:doc.extractedTextSha256,originalPdfBytes:doc.originalPdfBytes,
    previousCandidates,
  };
}

/**
 * Deliberately extract the ACTION boundaries, not merely unique voter slates.
 * Six separately numbered amendment roll calls may share all ten choices.
 * Fail closed if the layout, semantics, amendment identities or fingerprint
 * evidence changes. This does not prove storage absence for any of the six.
 */
export function audit2024EducationRepeatedAmendmentRolls(
  originalPdfExtractedText:string,
  candidates:readonly PinnedCandidate[],
){
  if(!originalPdfExtractedText||originalPdfExtractedText.length>100_000
    ||candidates.length!==expected.previouslyDetectedNamedRolls)
    throw Error('Source text or original parser baseline unverified');
  const flat=originalPdfExtractedText.replace(/\s+/g,' ').trim();
  const requestCount=[...flat.matchAll(/\brequested a roll call vote\b/gi)].length;
  const requests=[...flat.matchAll(
    /\bSenator\s+[A-Za-zÀ-ž][A-Za-zÀ-ž .'-]{0,80}?\s+requested a roll call vote for the adoption of\s+(\d{1,2})\s+amendment\./gi,
  )];
  if(requestCount!==6||requests.length!==6)
    throw Error('Every original roll-call request must be separately located');
  const amendments=requests.map(r=>r[1]);
  if(!equal(amendments,expected.expectedDistinctAmendments)
    ||new Set(amendments).size!==6)
    throw Error('Original separate numbered amendment motions cannot be authenticated');

  const originalBaseline=candidates[0]!.choiceIdentitySha256;
  if(candidates.some(c=>c.yeaCount!==4||c.nayCount!==6
    ||c.namedMemberChoicesInPdf!==10||c.individualVotesAvailable!==true
    ||!equal(c.choiceIdentitySha256,originalBaseline)))
    throw Error('Original historical parser fingerprint baseline no longer identical');
  let individualChoiceOccurrences=0;
  for(let i=0;i<requests.length;i++){
    const start=requests[i]!.index??-1;
    const stop=requests[i+1]?.index??flat.length;
    if(start<0||stop<=start)throw Error('Original action offsets not provable');
    const block=flat.slice(start,stop);
    const found=block.match(
      /4\s*\/\s*6\s*\(\s*Ayes?\s*:\s*([^)]*?)\s*;\s*Nays?\s*:\s*([^)]*?)\s*\)\s*MOTION\s+FAILED\b/i,
    );
    if(!found)throw Error('Original individual motion result/tally ambiguous');
    const snippet='4/6 (Ayes: '+found[1]+'; Nays: '+found[2]+') MOTION FAILED';
    const votes=parseSenateCommitteeMinuteVotes(snippet);
    if(votes.length!==1)throw Error('Original source choice list cannot be parsed once');
    const v=votes[0]!;
    if(v.yeaCount!==4||v.nayCount!==6||v.memberVotes.length!==10
      ||v.memberVotes.filter(c=>c.choice==='yea').length!==4
      ||v.memberVotes.filter(c=>c.choice==='nay').length!==6
      ||new Set(v.memberVotes.map(c=>c.normalizedName)).size!==10)
      throw Error('Original explicit member choices differ from numeric tally');
    const fingerprints=v.memberVotes
      .map(c=>sha(c.choice+':'+c.normalizedName)).sort();
    if(!equal(fingerprints,originalBaseline))
      throw Error('Independent source-fingerprinted choices differ by motion');
    individualChoiceOccurrences+=v.memberVotes.length;
  }
  const currentCandidates=parseSenateCommitteeMinuteVotes(originalPdfExtractedText);
  if(currentCandidates.length!==2
    ||currentCandidates.some(v=>v.yeaCount!==4||v.nayCount!==6
      ||v.memberVotes.length!==10
      ||!equal(v.memberVotes.map(c=>sha(c.choice+':'+c.normalizedName)).sort(),
        originalBaseline)))
    throw Error('Current parser candidate baseline changed; distinct re-audit needed');

  // STRICT ALLOWLIST. No source text, name, URL, choice digests or private DB IDs.
  return {
    schemaVersion:'senate-864-2024-education-repeated-amendment-original-rolls-v1' as const,
    issue:864 as const,
    year:2024 as const,
    sourceKind:'official_original_electronic_minutes' as const,
    originalRecordedAmendmentRolls:6 as const,
    originallyParserRecognizedRollCandidates:2 as const,
    candidateRollUndercountWithinThisOnePdf:4 as const,
    distinctAmendmentMotionNumbersVerified:6 as const,
    originalNamedChoiceOccurrencesAcrossActions:individualChoiceOccurrences,
    sameTenIndividualChoicesSourceAuthenticatedOnEachRoll:true as const,
    eachMotionHasFourYeasAndSixNays:true as const,
    allSixMotionsAreDifferentAmendmentActions:true as const,
    missing2024StoredYeaPersonOrEventLinked:false as const,
    noSourceToDatabaseParityDeterminedForTheseSixActions:true as const,
    noOfficialFullMeetingOrVoteDenominatorCertified:true as const,
    noDatabaseReadOrWrite:true as const,
    noPrivateIdentityOrMemberChoiceDigestsExported:true as const,
  };
}
