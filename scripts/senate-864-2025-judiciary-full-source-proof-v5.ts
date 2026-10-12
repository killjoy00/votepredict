/**
 * #864 V5 — independent 2025-03-12 Judiciary original Minutes candidate roll.
 *
 * Exact source-only GitHub Actions run #38070395356, artifact #11676168658:
 * authenticated government original PDF raw SHA, OCR text SHA, 7 YEA/1 NAY,
 * eight distinct original one-way choice fingerprints. Old V2 OCR artifact
 * retained only external key/count. This bridge upgrades only that one source
 * proof, not any database row, historical service identity or official census.
 */
import {createHash} from 'node:crypto';
import {ORIGINAL_SENATE_JUDICIARY_MARCH12_2025 as PIN} from
 '../src/evidence/senate-committee-2025-judiciary-ocr-roll-proof.js';
import type {OriginalSenateCommitteePdfProof} from
 '../src/evidence/senate-committee-source-to-db-reconciliation.js';
import type {mergeSourceAuditsWithAuthenticated207Ocr} from
 './merge-senate-864-ocr-207-original-proof-metadata.js';

export const JUDICIARY_2025_ORIGINAL_PROOF={
 originalRunId:38070395356,
 originalCommit:'66856e47ac48608a287f4264b36b6a077a721ec0',
 originalArtifactId:11676168658,
 zipSha256:'841dc184b1596a2af00a7652910c31fa903cde258b85d3cdb4e0ff1d08aeb703',
 artifactJsonFilename:'senate-2025-judiciary-original-named-roll-source-metadata.json',
 artifactJsonSha256:'26f47dfa3b4cb45507fa9bf9e816a8f7ceb2d4db7ff2dc0bf780683141aa892b',
} as const;
type Merged=ReturnType<typeof mergeSourceAuditsWithAuthenticated207Ocr>;
type Proof=OriginalSenateCommitteePdfProof;

export function promoteOne2025JudiciaryOriginalToFullyHashedProof(
 original:Merged,artifactBytes:Buffer,
){
 if(!Buffer.isBuffer(artifactBytes)||artifactBytes.length<500
   ||artifactBytes.length>20000||createHash('sha256').update(artifactBytes).digest('hex')
    !==JUDICIARY_2025_ORIGINAL_PROOF.artifactJsonSha256)
  throw Error('Independent original 2025 Judiciary full proof metadata SHA mismatch');
 const json=JSON.parse(artifactBytes.toString('utf8')) as Record<string,unknown>;
 if(json.schemaVersion!=='senate-2025-judiciary-original-ocr-roll-source-proof-v1'
  ||json.originalRawPdfAndTextShaBothIndependentlyReverified!==true
  ||json.namedSourceChoicesAreOneWayHashesOnly!==true
  ||json.originalPdfOrExtractedOCRTextStored!==false
  ||json.senatorIdentityMatchedToHistoricalMembership!==false
  ||json.sourceNamedRollAutomaticallyAddedToDb!==false
  ||json.sourceNamedRollEligibleForForecast!==false
  ||json.originalSourceDoesNotProveOfficialHistoricalAllVoteDenominator!==true)
  throw Error('Original Judiciary proof scope or private-name boundary unverified');
 const d=json.document as Record<string,unknown>|undefined;
 const expected=PIN;
 if(!d||d.year!==2025||d.committeeName!==expected.committeeName
  ||d.meetingDate!==expected.meetingDate||d.sourceUrl!==expected.url
  ||d.originalRawPdfSha256!==expected.originalPdfSha256
  ||d.extractedTextSha256!==expected.ocrTextSha256
  ||d.extractionMethod!=='ocr_tesseract'
  ||d.originalPdfBytes!==874494||d.extractedTextBytes!==3168)
  throw Error('Original Judiciary official PDF identity/OCR transcript SHA not independently verified');
 const observations=json.voteObservations;
 if(!Array.isArray(observations)||observations.length!==1)
  throw Error('Original 2025 Judiciary candidate proof has unknown vote count');
 const r=observations[0] as Record<string,unknown>;
 const hashes=r.choiceIdentitySha256;
 if(r.externalKey!==expected.voteEventExternalKey
  ||r.yeaCount!==7||r.nayCount!==1
  ||r.voteKind!=='motion'
  ||r.individualVotesAvailable!==true
  ||r.namedMemberChoicesInPdf!==8
  ||r.finalPassageStanceInferred!==false
  ||!Array.isArray(hashes)||hashes.length!==8
  ||hashes.some(x=>typeof x!=='string'||!/^[0-9a-f]{64}$/.test(x))
  ||new Set(hashes).size!==8
  ||!Array.isArray(json.contextOnlyActions)||json.contextOnlyActions.length!==2
  ||!json.contextOnlyActions.every(x=>x&&typeof x==='object'
    &&(x as Record<string,unknown>).individualVotesAvailable===false))
  throw Error('Independent 2025 Judiciary original choice/tally fingerprint proof incomplete');
 if(original.knownKeyOnlyOriginalEvents.length!==1
  ||original.knownKeyOnlyOriginalEvents[0]!.year!==2025
  ||original.knownKeyOnlyOriginalEvents[0]!.sourceUrl!==expected.url
  ||original.knownKeyOnlyOriginalEvents[0]!.meetingDate!==expected.meetingDate
  ||original.knownKeyOnlyOriginalEvents[0]!.externalKey!==expected.voteEventExternalKey
  ||original.knownKeyOnlyOriginalEvents[0]!.sourceNamedChoiceTokensKnownCount!==8
  ||original.metadata.fullKeyTallyChoiceSourceCandidateRolls!==152
  ||original.metadata.sourceNamedChoiceTokensWithExactOriginalChoiceDigests!==981
  ||original.metadata.keyOnlyUnverifiableTallyChoiceOriginalRolls!==1)
  throw Error('Previous V2 key-only independent source universe changed');
 let promoted=0;
 const years=original.years.map(y=>({
  ...y,
  documentProofs:y.documentProofs.map(p=>{
   if(p.document.sourceUrl!==expected.url)return p;
   if(y.auditedYear!==2025||p.document.year!==2025
    ||p.document.meetingDate!==expected.meetingDate
    ||p.document.committeeName!==expected.committeeName
    ||p.document.originalRawPdfSha256!==expected.originalPdfSha256
    ||p.voteObservations.length!==0)
    throw Error('Exact original 2025 source proof not present as one V2 key-only cohort');
   promoted++;
   return {...p,
    voteObservations:[{
     externalKey:expected.voteEventExternalKey,
     yeaCount:7,nayCount:1,
     individualVotesAvailable:true,
     namedMemberChoicesInPdf:8,
     choiceIdentitySha256:[...(hashes as string[])].sort(),
    }],
    contextOnlyActions:[] as Proof['contextOnlyActions'],
   };
  }),
 }));
 if(promoted!==1
  ||years.reduce((n,y)=>n+y.documentProofs.reduce((a,p)=>a+p.voteObservations.length,0),0)!==153
  ||years.reduce((n,y)=>n+y.documentProofs.reduce((a,p)=>a+p.voteObservations.reduce(
    (s,x)=>s+x.namedMemberChoicesInPdf,0),0),0)!==989)
  throw Error('Original official 2025 Judiciary full source promotion not unique or not bounded');
 return{
  years,knownKeyOnlyOriginalEvents:[] as Merged['knownKeyOnlyOriginalEvents'],
  metadata:{
   ...original.metadata,
   fullKeyTallyChoiceSourceCandidateRolls:153,
   keyOnlyUnverifiableTallyChoiceOriginalRolls:0,
   allOriginalCandidateRollsIncludingKeyOnly:153,
   sourceNamedChoiceTokensWithExactOriginalChoiceDigests:989,
   sourceNamedChoiceTokensWithoutIndividualDigestProof:0,
   totalSourceNamedChoiceTokens:989,
   // This proves a parser-level original candidate only, not all source actions.
   originalPdfSourceParserNotAnOfficialAllMotionsDenominator:true,
  },
  originalJudiciaryMetadataShaIndependentlyVerified:true as const,
  originalJudiciaryTallyAndEightNamedChoiceDigestsAvailable:true as const,
 };
}
