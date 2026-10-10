/** #864 metadata-only review queue from exact prior original-source PDF audit. */
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import {
  SENATE_ROLL_SIGNAL_SOURCE_RUN,
  SENATE_ROLL_SIGNAL_YEAR_PROOFS,
  extractOriginalRollSignalCandidates,
  type RollReviewYear,
} from '../src/evidence/senate-committee-unparsed-roll-review.js';

function opts(){
  const x=process.argv.slice(2);
  if(x.length!==6 || x[0]!=='--year'||x[2]!=='--source-json'||x[4]!=='--output')
    throw Error('Only exact --year 2022|2023|2024|2025 --source-json --output allowed');
  const year=Number(x[1]);
  if(![2022,2023,2024,2025].includes(year))throw Error('Out-of-scope Senate year');
  return {year:year as RollReviewYear,input:resolve(x[3]!),output:resolve(x[5]!)};
}
const {year,input,output}=opts();
const records=extractOriginalRollSignalCandidates(year,readFileSync(input,'utf8'));
const cfg=SENATE_ROLL_SIGNAL_YEAR_PROOFS[year];
const result={
  schemaVersion:'senate-2022-25-original-embedded-text-possible-unparsed-rolls-v1',
  issue:864,year,
  originalSourceRunId:SENATE_ROLL_SIGNAL_SOURCE_RUN,
  originalSourceArtifactId:cfg.artifactId,originalSourceJsonSha256:cfg.jsonSha256,
  originalEmbeddedTextParsed:cfg.embeddedParsed,
  parsedPdfsWithPossibleUnparsedRollCall:records.length,
  pagesWithAyeNayLabelsAndRollCallPhrase:records.filter(x=>x.parserAyeNayLabels>0).length,
  prioritizedSourceCandidates:records,
  riskTierCounts:{
    yeaNayLabel:records.filter(x=>x.riskTier==='yea_nay_label_plus_roll_cue').length,
    repeatedRollPhraseWithoutAyeNay:records.filter(x=>x.riskTier==='repeated_roll_call_phrase').length,
    singleRollPhraseWithoutAyeNay:records.filter(x=>x.riskTier==='single_roll_call_phrase').length,
  },
  cueDoesNotProveVoteOrExactNamedChoices:true,
  sourcePdfNotReacquiredAndNoTextPersisted:true,
  noPredictionEligibilityUpgrade:true,noDatabaseReadOrWrite:true,
  year2021PrintAnd2022MixedSourceGapsStillOpen:true,
  missingLinkedMinutesDistinctFromThisParsedPdfQueue:true,
};
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({year,sourceCandidates:records.length,
  ayeNayTextLabelCandidates:result.pagesWithAyeNayLabelsAndRollCallPhrase,
  output,dbTouched:false},null,2));
