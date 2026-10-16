/** #864: Only 16 bounded, source-sha-verified source-only shard receipts. */
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';

const yearCounts:{[key:number]:number}={2022:325,2023:454,2024:258,2025:415};
type SafeShard={
 schemaVersion:string;issue:number;year:number;shard:number;shards:number;
 baselineSourceRun:number;baselineParser:string;currentParser:string;
 originalUrlsAssigned:number;originalPdfAndSourceTextVerified:number;originalsHeld:number;
 originallyRecognizedNamedRolls:number;newParserNamedRolls:number;
 originallyRecognizedCountOnlyRolls:number;newParserCountOnlyRolls:number;
 docsWithNamedRollDecrease:number;docsWithCountOnlyDecrease:number;
 verifiedEducationOriginalOldCandidates:number;verifiedEducationOriginalNewActions:number;
 status:string;noPersonNamesUrlsChoiceHashesEventsOrSourceTextExported:boolean;
 noDatabaseReadOrWrite:boolean;completeOfficialMeetingOrVoteDenominatorCertified:boolean;
};
export function aggregateSafeParserShards(shards:SafeShard[]){
 if(shards.length!==16)throw Error('All sixteen original PDF shards required');
 const validatedCountKeys=[
  'originalUrlsAssigned','originalPdfAndSourceTextVerified','originalsHeld',
  'originallyRecognizedNamedRolls','newParserNamedRolls',
  'originallyRecognizedCountOnlyRolls','newParserCountOnlyRolls',
  'docsWithNamedRollDecrease','docsWithCountOnlyDecrease',
  'verifiedEducationOriginalOldCandidates','verifiedEducationOriginalNewActions',
 ] as const;
 for(const receipt of shards){
  if(receipt.issue!==864||receipt.baselineSourceRun!==38066441841||
    receipt.baselineParser!=='mn-senate-committee-minutes-v2'||
    receipt.currentParser!=='mn-senate-committee-minutes-v3'||
    validatedCountKeys.some(k=>!Number.isSafeInteger(receipt[k])||
      receipt[k]<0||receipt[k]>500))
   throw Error('Unverified original source parser/receipt numeric provenance');
 }
 const output=[] as Array<{year:number;originalPdfs:number;verified:number;held:number;
  oldNamed:number;newNamed:number;oldCountOnly:number;newCountOnly:number;
  namedDecreaseDocs:number;countDecreaseDocs:number}>;
 for(const year of [2022,2023,2024,2025]){
  const selected=shards.filter(x=>x.year===year).sort((a,b)=>a.shard-b.shard);
  if(selected.length!==4||selected.some((x,i)=>
    x.schemaVersion!=='senate-864-all-1452-originals-parser-v3-recheck-shard-v1'||
    x.shard!==i||x.shards!==4||
    x.status!=='VERIFIED_ORIGINAL_PDFS_NOT_OFFICIAL_DENOMINATOR'||
    x.noPersonNamesUrlsChoiceHashesEventsOrSourceTextExported!==true||
    x.noDatabaseReadOrWrite!==true||
    x.completeOfficialMeetingOrVoteDenominatorCertified!==false))
   throw Error('Original source shard missing or failed closed');
  const sum=(name:keyof SafeShard)=>selected.reduce((n,x)=>n+Number(x[name]),0);
  const row={year,originalPdfs:sum('originalUrlsAssigned'),
   verified:sum('originalPdfAndSourceTextVerified'),held:sum('originalsHeld'),
   oldNamed:sum('originallyRecognizedNamedRolls'),newNamed:sum('newParserNamedRolls'),
   oldCountOnly:sum('originallyRecognizedCountOnlyRolls'),
   newCountOnly:sum('newParserCountOnlyRolls'),
   namedDecreaseDocs:sum('docsWithNamedRollDecrease'),
   countDecreaseDocs:sum('docsWithCountOnlyDecrease')};
  if(row.newNamed<row.oldNamed||row.newCountOnly<row.oldCountOnly||
    row.oldNamed+row.oldCountOnly>row.originalPdfs*100||
    row.newNamed+row.newCountOnly>row.originalPdfs*100)
   throw Error('Aggregate source parser loss or impossible vote candidate total');
  if(row.originalPdfs!==yearCounts[year]||row.verified!==row.originalPdfs||
   row.held!==0||row.namedDecreaseDocs!==0||row.countDecreaseDocs!==0)
   throw Error('Full exact original year coverage or nonregression missing');
  if(year===2024&&(sum('verifiedEducationOriginalOldCandidates')!==2||
    sum('verifiedEducationOriginalNewActions')!==6))
   throw Error('2024 independently proven six-motion check incomplete');
  output.push(row);
 }
 if(output.reduce((n,x)=>n+x.originalPdfs,0)!==1452)
  throw Error('Original 1452 PDF cohort not fully revalidated');
 return {schemaVersion:'senate-864-all-1452-original-pdf-parser-v3-public-only-v1',
  issue:864,originalSourcePdfs:1452,yearResults:output,
  totalOldNamed:output.reduce((n,x)=>n+x.oldNamed,0),
  totalNewNamed:output.reduce((n,x)=>n+x.newNamed,0),
  totalNewNamedCandidateGain:output.reduce((n,x)=>n+x.newNamed-x.oldNamed,0),
  allOriginalPdfHashesReverified:true,allOcrRecoveredPdfsReprocessed:true,
  parsedCandidatesNotOfficialAllRecordedMotions:true,
  sourceToPrivateStoredRowParityNotEstablished:true,
  noNamesSourceTextUrlsChoiceHashesOrPrivateIdsPublished:true,
  noProductionAccessOrDbWrite:true,
  official2021Print2022PrintAnd141NoPdfMeetingsHeld:true,
  issue864Open:true};
}
function main(){
 const args=process.argv.slice(2);
 if(args.length!==4||args[0]!=='--input'||args[2]!=='--output')
  throw Error('Only fixed safe shard input/output');
 const folder=resolve(args[1]!),output=resolve(args[3]!);
 const names=readdirSync(folder).filter(n=>n.endsWith('.json'));
 if(names.length!==16)throw Error('Missing or extra safe shard JSON');
 const receipts=names.map(name=>{
  if(!/^senate864-v3-202[2-5]-[0-3]\.json$/.test(name))
   throw Error('Unexpected safe artifact filename');
  const raw=readFileSync(join(folder,name),'utf8');
  if(raw.length>7000||/https?:|sourceUrl|sourceName|normalizedName|choiceIdentitySha256/i.test(raw))
   throw Error('Unsafe original-source artifact payload');
  return JSON.parse(raw) as SafeShard;
 });
 const result=aggregateSafeParserShards(receipts);
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log('SENATE_864_COMPLETE_ORIGINAL_PDF_PARSER_V3='+JSON.stringify(result));
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-864-parser-v3-shard-receipts.ts'))
 try{main()}catch{console.error('SENATE_864_COMPLETE_ORIGINAL_PDF_PARSER_V3_HOLD=aggregate');process.exitCode=1}
