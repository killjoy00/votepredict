import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AUDIT,verifyOcrAudit} from '../scripts/verify-senate-864-ocr-audit.mjs';
const a=JSON.parse(readFileSync(AUDIT)),bytes=readFileSync(a.input.path);
test('all 192 pinned originals and 331 reviewed pages retain exact OCR text hashes and bounded findings',()=>{
 assert.deepEqual(verifyOcrAudit(a,bytes),{originals:192,pages:331,namedOriginals:14,additionalVisualOriginals:3,qualityHoldOriginals:10,productionWrites:0});
});
for(const [name,edit,error]of [
 ['missing rendered page',x=>x.sources[0].pages.pop(),/Page census/],
 ['changed baseline text',x=>x.sources[0].baselineExtractedText+='x',/Original text/],
 ['changed OCR text',x=>x.sources[0].pages[0].passes['3'].text+='x',/OCR text SHA/],
 ['unreviewed orientation',x=>x.sources[0].pages[0].renderedReview.orientationCorrect=false,/Rendered review/],
 ['promotion of findings to new votes',x=>x.summary.certifiedNewVotes=3,/Source-only/],
 ['discarding parser miss holds',x=>x.additionalVisualFindings.pop(),/explicit holds/]
])test('reject '+name,()=>{const x=structuredClone(a);edit(x);assert.throws(()=>verifyOcrAudit(x,bytes),error);});
