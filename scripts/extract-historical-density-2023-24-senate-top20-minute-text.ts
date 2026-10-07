import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SOURCE_ARTIFACT_ID=11502134219;
const SOURCE_ARTIFACT_DIGEST=
  'sha256:bb6318582f5fb01e9078fbaa6c2b67c43274ca4b4f8f6ced95aa7f9625975d50';
const SOURCE_COMMIT_SHA='db48cd441d90823ba56165ad972f1bbf54b6ddc4';
const SOURCE_BYTES_PROOF=
  '1f18cc0ff5f5477b4dd3ded5889c2bf6c779ee2276cb5b208492e6ff2610ecf7';
const SELECTION_PROOF=
  '1a6bc27b8b8bb433b060abfe213f1db7ad3463902536be5f741ed166b9b84e0f';

type Json=Record<string,any>;
function sha256(value:string|Uint8Array){return createHash('sha256').update(value).digest('hex');}
function env(name:string){const v=process.env[name]?.trim();if(!v)throw new Error(`${name} is required`);return v;}
function normalize(text:string){return text.replace(/\r\n?/g,'\n').replace(/[ \t]+\n/g,'\n').trim()+'\n';}

async function main(){
  const manifestPath=resolve(env('VOTEPREDICT_SENATE_2023_24_TOP20_MANIFEST_PATH'));
  const sourceRoot=resolve(env('VOTEPREDICT_SENATE_2023_24_TOP20_SOURCE_ROOT'));
  const outputDir=resolve(process.env.VOTEPREDICT_SENATE_2023_24_TEXT_OUTPUT_DIR ?? 'tmp/senate-2023-24-top20-text');
  const source=JSON.parse(readFileSync(manifestPath,'utf8')) as Json;
  if(
    source.schemaVersion!=='historical-density-2023-24-senate-electronic-minute-top20-freeze-v1'
    || source.sourceOverlap?.artifactId!==11501649286
    || source.selection?.selectedDocuments!==20
    || source.selection?.selectedTargetEvents!==97
    || source.selection?.selectedUncoveredRows!==6498
    || source.selection?.selectionProofSha256!==SELECTION_PROOF
    || source.sourceFreeze?.documentCount!==20
    || source.sourceFreeze?.totalBytes!==1957937
    || source.sourceFreeze?.sourceBytesProofSha256!==SOURCE_BYTES_PROOF
    || source.policy?.targetVoteOutcomesRead!==false
    || source.policy?.memberStanceInferred!==false
    || source.policy?.featureRowsWritten!==false
    || source.policy?.modelFitting!=='none'
    || source.policy?.servingChanged!==false
  ) throw new Error('Canonical top-20 source freeze drifted');

  const {CanvasFactory}=await import('pdf-parse/worker');
  const {PDFParse}=await import('pdf-parse');
  const textDir=resolve(outputDir,'texts');
  mkdirSync(textDir,{recursive:true});
  const rows:Json[]=[];
  for(const document of source.sourceFreeze.documents as Json[]){
    const path=resolve(sourceRoot,String(document.archivedRelativePath));
    const bytes=new Uint8Array(readFileSync(path));
    if(sha256(bytes)!==document.contentSha256) throw new Error(`Frozen PDF hash mismatch rank ${document.rank}`);
    const parser=new PDFParse({data:bytes.slice(),CanvasFactory});
    let raw='';
    try{const parsed=await parser.getText();raw=parsed.text ?? '';}finally{await parser.destroy();}
    const text=normalize(raw);
    const readable=text.trim().length>=40;
    const textSha256=sha256(text);
    writeFileSync(resolve(textDir,`${document.contentSha256}.txt`),text,'utf8');
    rows.push({
      rank:document.rank,
      minuteUrl:document.minuteUrl,
      minuteCommitteeName:document.minuteCommitteeName,
      minuteMeetingDate:document.minuteMeetingDate,
      pdfContentSha256:document.contentSha256,
      pdfBytes:document.bytes,
      extractionMethod:'pdf-parse-embedded-text',
      readableEmbeddedText:readable,
      textChars:text.length,
      textWords:text.trim()?text.trim().split(/\s+/).length:0,
      textSha256,
      archivedTextRelativePath:`texts/${document.contentSha256}.txt`,
    });
  }
  rows.sort((a,b)=>a.rank-b.rank);
  const readableRows=rows.filter((row)=>row.readableEmbeddedText);
  const extractionProofSha256=sha256(rows.map((row)=>[
    row.rank,row.pdfContentSha256,row.extractionMethod,row.readableEmbeddedText,
    row.textChars,row.textWords,row.textSha256,
  ].join('|')).join('\n')+'\n');
  const report={
    schemaVersion:'historical-density-2023-24-senate-top20-text-extraction-v1',
    generatedAt:new Date().toISOString(),
    issue:718,
    sourceFreeze:{
      artifactId:SOURCE_ARTIFACT_ID,
      artifactDigest:SOURCE_ARTIFACT_DIGEST,
      sourceCommitSha:SOURCE_COMMIT_SHA,
      sourceBytesProofSha256:SOURCE_BYTES_PROOF,
      selectionProofSha256:SELECTION_PROOF,
    },
    summary:{
      documents:rows.length,
      readableEmbeddedTextDocuments:readableRows.length,
      insufficientEmbeddedTextDocuments:rows.length-readableRows.length,
      totalTextChars:rows.reduce((n,row)=>n+row.textChars,0),
      totalTextWords:rows.reduce((n,row)=>n+row.textWords,0),
      extractionProofSha256,
    },
    documents:rows,
    interpretation:{
      textFrozen:true,
      semanticReviewPerformed:false,
      billMentionInferred:false,
      memberAttributionInferred:false,
      memberStanceInferred:false,
      insufficientEmbeddedTextRequiresSeparateOCRLane:true,
    },
    policy:{
      productionDatabaseQueried:false,
      productionWrites:false,
      targetVoteOutcomesRead:false,
      outcomeUse:'none',
      exactFrozenPdfBytesOnly:true,
      featureRowsWritten:false,
      modelFitting:'none',
      modelWeightChanged:false,
      servingChanged:false,
      vercelUsed:false,
    },
  };
  mkdirSync(outputDir,{recursive:true});
  writeFileSync(resolve(outputDir,'historical-density-2023-24-senate-top20-text-extraction-v1.json'),JSON.stringify(report,null,2)+'\n','utf8');
  console.log(JSON.stringify({senate2023_24Top20TextExtraction:report.summary},null,2));
}
main().catch((error)=>{console.error(error instanceof Error?(error.stack??error.message):String(error));process.exitCode=1;});
