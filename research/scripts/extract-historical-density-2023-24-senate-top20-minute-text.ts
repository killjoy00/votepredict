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
const EXPECTED_TOTAL_TEXT_CHARS=63078;
const EXPECTED_TOTAL_TEXT_WORDS=9488;
const EXPECTED_EXTRACTION_PROOF=
  'ad0e37fc543ec8be11adfdab8c09f6212bc5ba45f4a6af105a2dc2a723f8d9af';
const EXPECTED_TEXT_SHA256_BY_RANK=[
  'ac7d3ad00d20efdcbfd3295959f1ff3e6437a4cf552f3df8008b281d9dc6a414',
  'cdc4b1f22ad4a3d3a0affb75e6d04172898a24da2383d72125886b250e750270',
  '7167f9d6ba01d7852f36484cd1060ca3e4b3731a70035b8766707aa0a8ce933a',
  '60ef46c1652c9da884b654f952288fb219be3b4b8490cb9325dcc286bc346273',
  '3ec13fd850c9b1858cd6be814356366710ca3887108b4b7b2c37785243f2eb73',
  '87f83931136b4a45fe00151d1c9e8b75b078b7ef344ff6e9c5e2b8bf6cea0f7c',
  '9e111450cb4af353fcfddf5d943e6536a81bc6a31da500683522796ad9d73ad5',
  'ca7a95b1952eed34825cc990a85c323e5014b532d65cbff70e28ff5d8d2456e8',
  '9e637e9ffdb3664e6215ee177c5efe851e5b7a209f0a9d0cb81126efaaf3bb14',
  '88e70cf325cbc1990f8d495e9026c9e4e90b4d2c51ec458493cb902cef7947ac',
  'fb60b2e30d11870d3937c427de64bf4d33934a29ccec5dd1ba31c17de90c3d49',
  '6a48b205c2fb8ebddc343f9a6cf89d57f86172ab956f647b0e853101bba3d497',
  'e55974285fc2f0028b5d0c2aafa814ae2870a739d26b371e18099dc128d1942c',
  '18c089cbcdb065f616e079a4a4b9165423928de66f5e3a7a535c9fba31eef1bd',
  '8b92f672f14d2028f0e645e80026c11aeb44c4e950e4ebf845c7b32d6947359a',
  'f38fd951d68d56a404f08b8c01268aacc1ea57b3ae447789e07ce0a0b5b86016',
  '189f70d28eaac4d9b5b631039c03092294f0e739ad42004dfaa12b3d4574d4a2',
  '0129520f9b1f001bb2de2e09816c3b2b9f12ca5dcfa6120548c75b00fd49517f',
  'be3da4d6d15f6f0ec248a2e368f57a3489925650a76281ae9c1c8d8602f6df1b',
  '1e7806aaadeffbdab28c1606a8f3f07d684f68c076f0ddafbfd4a192109f4271',
] as const;

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
  const totalTextChars=rows.reduce((n,row)=>n+row.textChars,0);
  const totalTextWords=rows.reduce((n,row)=>n+row.textWords,0);
  if(
    readableRows.length!==20
    || totalTextChars!==EXPECTED_TOTAL_TEXT_CHARS
    || totalTextWords!==EXPECTED_TOTAL_TEXT_WORDS
    || extractionProofSha256!==EXPECTED_EXTRACTION_PROOF
    || rows.some((row,index)=>row.rank!==index+1 || row.textSha256!==EXPECTED_TEXT_SHA256_BY_RANK[index])
  ) throw new Error('Pinned top-20 Senate text extraction drifted');
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
      totalTextChars,
      totalTextWords,
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
