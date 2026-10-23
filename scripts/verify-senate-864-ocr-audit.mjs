/** Validate the scoped rendered-page evidence without turning it into vote evidence. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
export const AUDIT='docs/evaluation/source-proof/senate-864-192-ocr-rendered-audit-20261023.json';
export function verifyOcrAudit(a,inventoryBytes){
 const fail=s=>{throw Error(s);};
 if(a.sourceOnlyLocalAudit!==true||a.productionWrites!==0||a.summary.certifiedNewVotes!==0)fail('Source-only boundary changed');
 if(a.input.sha256!==sha(inventoryBytes)||a.input.sha256!=='685f08e5e3645fa8262d04876102e9dbbf529dcf0e7c33c669c84d67348b71ea')fail('Frozen inventory drift');
 const inv=JSON.parse(inventoryBytes),targets=inv.originals.filter(d=>['2022','2025'].includes(d.date.slice(0,4))&&d.extractionMethod==='ocr_tesseract');
 if(a.sources.length!==192||targets.length!==192||new Set(a.sources.map(d=>d.sourceId)).size!==192)fail('Original census incomplete');
 let pages=0,blank=0,named=0,misses=0,quality=0;const years={},indices=new Set();
 for(const d of a.sources){
  const old=targets.find(x=>x.sourceId===d.sourceId);
  if(!old||['sourceUrl','originalSha256','extractedTextSha256','date','committee','status'].some(k=>old[k]!==d[k]))fail('Original identity drift');
  if(sha(d.baselineExtractedText)!==old.extractedTextSha256||d.originalBytesAuthenticated!==true||d.allPagesRenderedAndReviewed!==true||d.wordPerfectOcrCertified!==false)fail('Original text or review scope drift');
  if(d.pageCount!==d.pages.length||d.pageCount<1||d.pageCount>40)fail('Page census incomplete');
  let observed=false,held=false;
  for(const [i,p]of d.pages.entries()){
   if(p.page!==i+1||!/^\w{64}$/.test(p.raw300dpiPageSha256)||![0,90,180,270].includes(p.rotationClockwise))fail('Page order or raster identity drift');
   if(Object.keys(p.passes).sort().join(',')!=='11,3')fail('OCR pass incomplete');
   for(const t of Object.values(p.passes))if(sha(t.text)!==t.textSha256)fail('OCR text SHA drift');
   const r=p.renderedReview;
   if(r.reviewer!=='Codex rendered-page review'||r.orientationCorrect!==true||typeof r.legible!=='boolean')fail('Rendered review incomplete');
   if(r.finding==='blank_raster_page_observed'){blank++;if(r.visualIndex!=null)fail('Blank page review index changed');}
   else {if(!Number.isInteger(r.visualIndex)||indices.has(r.visualIndex))fail('Rendered review duplicated/missing');indices.add(r.visualIndex);}
   observed||=['named_sides_observed','printed_individual_choices_observed'].includes(r.finding);
   held||=!r.legible||/clipp|occlu/i.test(r.note||'');pages++;
  }
  if(observed!==d.printedIndividualChoicesObserved||held!==d.qualityHold)fail('Visual finding summary drift');
  const b=d.parserCounts.baseline,miss=observed&&!['primaryObservations','rawNamedObservations','supplementalCandidates','strictRowQuestions'].some(k=>b[k]>0);
  if(miss!==d.parserMissedPrintedChoices)fail('Parser miss summary drift');
  named+=observed;misses+=miss;quality+=held;years[d.date.slice(0,4)]=(years[d.date.slice(0,4)]||0)+1;
 }
 if(pages!==331||blank!==7||indices.size!==324||Math.min(...indices)!==1||Math.max(...indices)!==324||years['2022']!==136||years['2025']!==56)fail('Page/year census incomplete');
 if(named!==14||misses!==3||quality!==10||a.summary.visualNamedOriginals!==named||a.summary.additionalVisualNamedOriginals!==misses||a.summary.qualityHoldOriginals!==quality)fail('Coverage summary drift');
 if(a.additionalVisualFindings.length!==3||a.additionalVisualFindings.some(x=>!a.sources.some(d=>d.sourceId===x.sourceId&&d.parserMissedPrintedChoices)||x.status!=='source_only_extractor_or_question_hold'))fail('Parser misses must remain explicit holds');
 return {originals:192,pages,namedOriginals:named,additionalVisualOriginals:misses,qualityHoldOriginals:quality,productionWrites:0};
}
if(process.argv[1]===import.meta.filename){const a=JSON.parse(readFileSync(AUDIT));console.log(JSON.stringify(verifyOcrAudit(a,readFileSync(a.input.path))));}
