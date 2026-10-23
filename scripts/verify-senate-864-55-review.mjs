/** Source-only integrity and parser comparisons for the completed 55-original review. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {sha,inspectOriginal} from '../src/evidence/senate-864-population-named-rolls.mjs';
const base='docs/evaluation/source-proof/',a=JSON.parse(readFileSync(base+'senate-864-55-ocr-rendered-audit-20261023.json'));
const root='.source-review/'+a.sourceReview.directory;
const manifestBytes=readFileSync(root+'manifest.json'),m=JSON.parse(manifestBytes);
assert.equal(m.registrySha256,a.sourceReview.registrySha256);assert.equal(m.originalsAuthenticated,58);assert.equal(m.pages,90);
const inventoryBytes=readFileSync(base+'senate-864-population-original-inventory-20261023-renewal-ocr.json');assert.equal(sha(inventoryBytes),'dc7d173228cbfcd7bd923c4ba0998e2eec23faed76bf283cf60ca92316878d2f');const inventory=JSON.parse(inventoryBytes);
const priorBytes=readFileSync(a.scope.prior192Audit);assert.equal(sha(priorBytes),a.scope.prior192AuditSha256);const prior=JSON.parse(priorBytes);
assert.equal(new Set([...prior.sources,...a.sources].map(s=>s.sourceId)).size,247);assert.equal(prior.summary.pagesRenderedAndReviewed+a.sources.reduce((n,s)=>n+s.pages.length,0),416);assert.equal(prior.summary.visualNamedOriginals+a.sources.filter(s=>s.printedIndividualChoicesObserved).length,17);assert.equal(prior.summary.qualityHoldOriginals,10);
const registryBytes=readFileSync(base+'senate-864-population-original-registry-20261023-renewal-ocr.json');assert.equal(sha(registryBytes),m.registrySha256);
const verified=new Map();
for(const f of m.files){assert.ok(/^[a-zA-Z0-9/_.,-]+$/.test(f.path)&&!f.path.includes('..'));const b=readFileSync(root+f.path);assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);verified.set(f.path,f);}
assert.equal(a.sources.length,55);assert.equal(new Set(a.sources.map(s=>s.sourceId)).size,55);
const report=[];let pages=0;
for(const s of a.sources){
 const original=m.sources.find(d=>d.sourceId===s.sourceId);assert.ok(original);assert.equal(original.originalSha256,s.originalSha256);assert.equal(original.date,s.date);assert.equal(s.pages.length,original.pageCount);
 const old=inventory.originals.find(d=>d.sourceId===s.sourceId);assert.ok(old);
 const texts={3:[],11:[]};
 for(const p of s.pages){
  pages++;assert.equal(p.reviewIndex,pages);assert.equal(p.legible,true);assert.equal(p.orientationCorrect,true);
  assert.ok(p.finding);const file=s.sourceId+'/page-'+p.page+'.json',x=JSON.parse(readFileSync(root+file));assert.equal(verified.get(file).sha256,p.ocrEvidence.sha256);assert.equal(x.raw300dpiPageSha256,p.raw300dpiPageSha256);assert.equal(x.reviewImageSha256,p.reviewImageSha256);
  for(const mode of ['3','11']){assert.equal(sha(x.passes[mode].text),x.passes[mode].textSha256);texts[mode].push(x.passes[mode].text);}
 }
 const counts={};
 for(const mode of ['3','11']){const x=inspectOriginal({text:texts[mode].join('\n\n'),authenticated:true,date:s.date,committee:s.committee,session_slug:s.session});counts[mode]={status:x.status,candidateQuestions:x.candidates,choiceOccurrences:x.choiceOccurrences,parserCounts:x.parserCounts,strictProvenQuestions:x.questions.filter(q=>q.confidence==='source_proven_question').length};}
 report.push({sourceId:s.sourceId,date:s.date,committee:s.committee,visualNamed:s.printedIndividualChoicesObserved,priorInventoryStatus:old.status,priorParserCounts:old.parserCounts,priorCandidateQuestions:old.candidates,psm:counts});
}
assert.equal(pages,85);assert.equal(a.sources.filter(s=>s.printedIndividualChoicesObserved).length,3);
assert.equal(a.sources.filter(s=>!s.printedIndividualChoicesObserved).length,52);
assert.equal(a.certifiedNewVotes,0);assert.equal(a.productionWrites,0);
const receipt={schemaVersion:'senate864-55-review-integrity-parser-comparison-v1',reviewedCommit:process.env.GITHUB_SHA,sourceReviewCommit:a.sourceReview.commit,manifestSha256:sha(manifestBytes),originals:55,pages:85,visualNamedOriginals:3,scopedNegativeOriginals:52,verifiedPublicFiles:verified.size,wordPerfectOcrCertified:false,productionWrites:0,report};
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/senate864-55-review-comparison.json',JSON.stringify(receipt,null,2)+'\n');
console.log('SENATE864_55_REVIEW_COMPARISON='+JSON.stringify(receipt));
