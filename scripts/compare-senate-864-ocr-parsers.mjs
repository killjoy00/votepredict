/** Reproduce parser observations from the audit's literal baseline and paired OCR texts. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AUDIT} from './verify-senate-864-ocr-audit.mjs';
import {parseSenateCommitteeMinuteVotes} from '../src/evidence/minnesota-senate-committee-minutes.ts';
import {parseSenateCommitteeMinutesRaw} from '../src/sources/minnesota/senate-raw-votes.ts';
import {extractSupplementalNamedSenateRollCandidates} from '../src/evidence/senate-committee-supplemental-named-roll-review.ts';
import {extractRowRollQuestions} from '../src/evidence/senate-864-population-named-rolls.mjs';
const audit=JSON.parse(readFileSync(AUDIT));let checked=0;
for(const d of audit.sources){
 const texts={baseline:d.baselineExtractedText,psm3:d.pages.map(p=>p.passes['3'].text).join('\n\n'),psm11:d.pages.map(p=>p.passes['11'].text).join('\n\n')};
 for(const [mode,text]of Object.entries(texts)){
  const raw=parseSenateCommitteeMinutesRaw(text),counts={primaryObservations:parseSenateCommitteeMinuteVotes(text).length,rawNamedObservations:raw.filter(q=>q.memberVotes.length).length,rawNamedChoiceOccurrences:raw.reduce((n,q)=>n+q.memberVotes.length,0),supplementalCandidates:extractSupplementalNamedSenateRollCandidates(text).length,strictRowQuestions:extractRowRollQuestions(text,{date:d.date,committee:d.committee,source_url:d.sourceUrl}).length};
  assert.deepEqual(counts,d.parserCounts[mode],d.sourceId+' '+mode+' parser behavior changed; review literal source evidence');checked++;
 }
}
console.log(JSON.stringify({sourceOnly:true,productionWrites:0,originals:192,parserComparisons:checked,visualParserMisses:audit.summary.additionalVisualNamedOriginals}));
