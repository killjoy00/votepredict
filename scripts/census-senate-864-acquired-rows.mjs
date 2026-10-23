/** Local SHA-checked acquired-text census; no database or source acquisition claim. */
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {extractRowRollQuestions,sha} from '../src/evidence/senate-864-population-named-rolls.mjs';
const input='docs/evaluation/source-proof/senate-864-population-original-inventory-20261023-explicit-labels.json';
if(process.argv.length!==4)throw Error('Usage: node --import tsx scripts/census-senate-864-acquired-rows.mjs CORPUS_DIRECTORY OUTPUT_JSON');
const bytes=readFileSync(input);
if(sha(bytes)!=='685f08e5e3645fa8262d04876102e9dbbf529dcf0e7c33c669c84d67348b71ea')throw Error('Frozen inventory changed');
const inventory=JSON.parse(bytes),candidates=new Set(inventory.originals.filter(d=>d.status==='named_candidate_original').map(d=>d.sourceId));
let readable=0,rowOriginals=0;const additional=[];
for(const d of inventory.originals){
 if(!d.readable)continue;
 const c=JSON.parse(readFileSync(join(process.argv[2],d.sourceId+'.json')));
 if(c.source_url!==d.sourceUrl||c.content_sha256!==d.originalSha256||sha(c.text)!==d.extractedTextSha256)throw Error('Acquired original text identity changed');
 readable++;
 const rows=extractRowRollQuestions(c.text,{date:d.date,committee:d.committee,session_slug:d.session});
 if(rows.length){rowOriginals++;if(!candidates.has(d.sourceId))additional.push({sourceId:d.sourceId,sourceUrl:d.sourceUrl,rows:rows.length});}
}
if(readable!==2859||candidates.size!==233)throw Error('Corpus truncated');
writeFileSync(process.argv[3],JSON.stringify({schemaVersion:'senate864-renewed-question-local-source-census-v1',sourceOnlyLocalCheck:true,productionWrites:0,input:{path:input,sha256:sha(bytes)},extractorSha256:sha(readFileSync('src/evidence/senate-864-population-named-rolls.mjs')),readableTextsChecked:readable,rowCandidateOriginals:rowOriginals,newRowCandidateOriginalsOutsideExisting233:additional,limitation:'Local SHA-checked acquired text census; not a protected Actions acquisition or production readback. The separate 192-original rendered-page audit found three visual named originals outside these parser-candidate metrics.'},null,2)+'\n');
console.log(JSON.stringify({readable,rowOriginals,additionalOriginals:additional.length}));
