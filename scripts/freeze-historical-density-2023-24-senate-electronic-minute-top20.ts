import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SOURCE_ARTIFACT_ID = 11501649286;
const SOURCE_ARTIFACT_DIGEST =
  'sha256:c5ed67e03a2aabb7b41df147beb2d4e814b6db834055387efaf716e3b6ac3f42';
const SOURCE_COMMIT_SHA =
  '8469ed3e04328143fb69a0639cf648f68dcc6d2a';
const SOURCE_ASSOCIATION_PROOF =
  'dbb3e5e4ce5191ec4fb47aa1f777f72067a3dca7fedefc0871ac41ed341adbf1';
const EXPECTED_SELECTED_DOCUMENTS = 20;
const EXPECTED_SELECTED_TARGET_EVENTS = 97;
const EXPECTED_SELECTED_UNCOVERED_ROWS = 6498;
const EXPECTED_SELECTION_PROOF =
  '1a6bc27b8b8bb433b060abfe213f1db7ad3463902536be5f741ed166b9b84e0f';
const EXPECTED_TOTAL_PDF_BYTES = 1957937;
const EXPECTED_SOURCE_BYTES_PROOF =
  '1f18cc0ff5f5477b4dd3ded5889c2bf6c779ee2276cb5b208492e6ff2610ecf7';
const EXPECTED_CONTENT_SHA256_BY_RANK = [
  'b13d144bc9903a0f434d0e22b1e7c984d1007429d4662c19d9b45eaf91910d93',
  '4b600090857e7cdd1d69fd609157a4fecf4777e07c616522157c7c112a098d82',
  'aba65fd2fd0f354c328c2619c5f96e6c10e712eeb6be34c6d0909e016010b9e6',
  'e03303f78847f341cff08b8c20ef0ee9503e3a14b6d23910f85415405c9d57ce',
  '1f9de5c3b87492574badfe1d348f6a1609f7e0c6ede4c3cf4c33db9965b81ae5',
  '088fb47bc888407025aa4a888c9649c95196b061b43515749e77ba2cc8d76629',
  '9c51ec881c2aea7e57f176738e4ad66ff47a641e2f70837c50236043cc1a59c8',
  '74f1ef0fbe1179ebc5d2d2d618a273c4cf49ae2659d69a27074756670fefde8a',
  '954abde27f43a9b4933424d13cefae0857219a6f3c0cc8923c2927e792cc4553',
  '5cbc8cdcce8b29fd795bc7a615e401f2bcf78cc17ba80fa5bd08cb9f7734d067',
  'a49f69ead3f3fb28f734cf7613b124dc54efe493fbfa37e796488dfd090ab5d5',
  '2156525cc946418ffbedbde2a156f16ee9ae789e40a36519df93bf3984d45984',
  'cf2f3b4d0ea7d81435b5b23f5f2f7883102ae18e2ff0ddebc3b08a7c5785c17b',
  'bcd4fdb17acd6e70d1c9b42b4ce10708092fb68ca98c10f3c37ff53907145291',
  'f991b7a57b9439544ee916683cbe6bc318d57b2863431300d912480e0723ca7a',
  '747c4c54d9e2bd622d98f7074c1e0a579aa0f546d5d12ed2c97dc5967e76eb96',
  'a90f47e7ab18230622ca826770658fcdae08d4732d1e4e65dfca3d3dfa2b1ca8',
  '688ad8421425e0c2af88eff5d2ede79474c5d92cb931a41f37034ac0c8ba07a5',
  'ba9bda23465962b940b693642053ca1982be0083065ae6e4e897c3e123650796',
  '4f3be2ced2f3357556c604057ce2476b820238c566a3a5f5c04d04a44a682e36',
] as const;
const MAX_PDF_BYTES = 25_000_000;
const CONCURRENCY = 4;

type Json = Record<string, any>;

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}
function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
async function mapLimit<T,R>(
  values: readonly T[],
  limit: number,
  mapper: (value:T)=>Promise<R>,
): Promise<R[]> {
  const out=new Array<R>(values.length);
  let cursor=0;
  async function worker() {
    while (true) {
      const index=cursor++;
      if (index>=values.length) return;
      out[index]=await mapper(values[index]!);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,values.length)},()=>worker()));
  return out;
}
async function fetchPdf(urlValue:string) {
  let current=urlValue;
  let response:Response|undefined;
  for (let redirects=0; redirects<=3; redirects+=1) {
    const url=new URL(current);
    if (
      url.protocol!=='https:'
      || url.hostname.toLowerCase()!=='www.lrl.mn.gov'
      || !url.pathname.toLowerCase().startsWith('/archive/minutes/senate/')
    ) throw new Error('Selected minute URL left official LRL Senate archive');
    response=await fetch(current,{
      redirect:'manual',
      headers:{
        'user-agent':'VotePredict/2.0 historical-density-2023-24-senate-minute-freeze',
        accept:'application/pdf,application/octet-stream;q=0.8,*/*;q=0.1',
      },
      signal:AbortSignal.timeout(60_000),
    });
    if (![301,302,303,307,308].includes(response.status)) break;
    const location=response.headers.get('location');
    if (!location) throw new Error('LRL PDF redirect missing Location');
    current=new URL(location,current).toString();
  }
  if (!response?.ok) throw new Error(`LRL PDF HTTP ${response?.status ?? 'none'}`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength<300 || bytes.byteLength>MAX_PDF_BYTES) {
    throw new Error(`LRL PDF has unexpected byte length: ${bytes.byteLength}`);
  }
  const header=new TextDecoder('ascii').decode(bytes.subarray(0,5));
  if (header!=='%PDF-') throw new Error('LRL minute is not PDF bytes');
  return {finalUrl:current,bytes,contentSha256:sha256(bytes)};
}

async function main() {
  const source=JSON.parse(readFileSync(env('VOTEPREDICT_SENATE_2023_24_OVERLAP_PATH'),'utf8')) as Json;
  const outputDir=resolve(
    process.env.VOTEPREDICT_SENATE_2023_24_TOP20_OUTPUT_DIR
      ?? 'tmp/senate-2023-24-minute-top20-freeze',
  );
  if (
    source.schemaVersion!=='historical-density-2023-24-senate-electronic-minute-target-overlap-v1'
    || source.issue!==718
    || source.targetGap?.uncoveredRows!==14471
    || source.overlap?.targetEventsWithChronologicallyEligibleMinute!==117
    || source.overlap?.matchedUncoveredRows!==7838
    || source.overlap?.uniqueCandidateMinuteDocuments!==436
    || source.overlap?.minuteTargetAssociations!==1727
    || source.overlap?.associationProofSha256!==SOURCE_ASSOCIATION_PROOF
    || source.policy?.targetVoteOutcomesRead!==false
    || source.policy?.pdfBodiesFetched!==false
    || source.policy?.productionDatabaseQueried!==false
    || source.policy?.featureRowsWritten!==false
    || source.policy?.modelFitting!=='none'
    || source.policy?.servingChanged!==false
  ) throw new Error('Canonical 2023-24 Senate overlap artifact drifted');

  const associations=source.overlap.associations as Json[];
  const byUrl=new Map<string,Json[]>();
  const eventRows=new Map<string,number>();
  for (const row of associations) {
    const bucket=byUrl.get(row.minuteUrl) ?? [];
    bucket.push(row);
    byUrl.set(row.minuteUrl,bucket);
    eventRows.set(row.voteEventId,row.uncoveredRows);
  }

  const covered=new Set<string>();
  const selected:Json[]=[];
  for (let rank=1; rank<=EXPECTED_SELECTED_DOCUMENTS; rank+=1) {
    const options=[...byUrl.entries()]
      .filter(([url])=>!selected.some((row)=>row.minuteUrl===url))
      .map(([url,rows])=>{
        const ids=[...new Set(rows.map((row)=>String(row.voteEventId)))]
          .filter((id)=>!covered.has(id));
        return {
          url,rows,ids,
          marginalRows:ids.reduce((sum,id)=>sum+(eventRows.get(id) ?? 0),0),
        };
      })
      .filter((row)=>row.ids.length>0)
      .sort((a,b)=>
        b.marginalRows-a.marginalRows
        || b.ids.length-a.ids.length
        || a.url.localeCompare(b.url));
    const next=options[0];
    if (!next) throw new Error('Top-20 selector exhausted unexpectedly');
    next.ids.forEach((id)=>covered.add(id));
    const first=next.rows[0]!;
    selected.push({
      rank,
      minuteUrl:next.url,
      minuteMeetingDate:first.minuteMeetingDate,
      minuteCommitteeName:first.minuteCommitteeName,
      marginalTargetEvents:next.ids.length,
      marginalUncoveredRows:next.marginalRows,
      cumulativeTargetEvents:covered.size,
      cumulativeUncoveredRows:[...covered].reduce(
        (sum,id)=>sum+(eventRows.get(id) ?? 0),0),
      marginalTargetEventIds:[...next.ids].sort(),
      allCandidateTargetEventIds:[
        ...new Set(next.rows.map((row)=>String(row.voteEventId))),
      ].sort(),
    });
  }

  const selectionProofPayload=selected.map((row)=>({
    rank:row.rank,
    minuteUrl:row.minuteUrl,
    minuteMeetingDate:row.minuteMeetingDate,
    minuteCommitteeName:row.minuteCommitteeName,
    marginalTargetEvents:row.marginalTargetEvents,
    marginalUncoveredRows:row.marginalUncoveredRows,
    cumulativeTargetEvents:row.cumulativeTargetEvents,
    cumulativeUncoveredRows:row.cumulativeUncoveredRows,
  }));
  const selectionProofSha256=sha256(JSON.stringify(selectionProofPayload));
  if (
    selected.length!==EXPECTED_SELECTED_DOCUMENTS
    || covered.size!==EXPECTED_SELECTED_TARGET_EVENTS
    || selected.at(-1)?.cumulativeUncoveredRows!==EXPECTED_SELECTED_UNCOVERED_ROWS
    || selectionProofSha256!==EXPECTED_SELECTION_PROOF
  ) throw new Error('Pinned top-20 Senate minute selection drifted');

  const fetched=await mapLimit<Json, Json & {
    finalUrl:string;
    bytes:Uint8Array;
    contentSha256:string;
  }>(selected,CONCURRENCY,async(row)=>{
    const pdf=await fetchPdf(String(row.minuteUrl));
    return {...row,finalUrl:pdf.finalUrl,bytes:pdf.bytes,contentSha256:pdf.contentSha256};
  });

  const pdfDir=resolve(outputDir,'pdfs');
  mkdirSync(pdfDir,{recursive:true});
  for (const row of fetched) {
    writeFileSync(resolve(pdfDir,`${row.contentSha256}.pdf`),row.bytes);
  }

  const documents: Json[] = fetched.map((row)=>{
    const pdfBytes=row.bytes as Uint8Array;
    return {
      ...row,
      bytes:pdfBytes.byteLength,
      archivedRelativePath:`pdfs/${row.contentSha256}.pdf`,
    };
  });
  const sourceBytesProofSha256=sha256(
    documents.map((row)=>[
      row.rank,row.minuteUrl,row.finalUrl,row.contentSha256,row.bytes,
    ].join('|')).join('\n')+'\n',
  );
  const totalBytes=documents.reduce((sum,row)=>sum+Number(row.bytes),0);
  if (
    totalBytes !== EXPECTED_TOTAL_PDF_BYTES
    || sourceBytesProofSha256 !== EXPECTED_SOURCE_BYTES_PROOF
    || documents.some((row,index)=>
      row.rank !== index + 1
      || row.contentSha256 !== EXPECTED_CONTENT_SHA256_BY_RANK[index])
  ) {
    throw new Error('Pinned top-20 Senate minute source bytes drifted');
  }

  const report={
    schemaVersion:'historical-density-2023-24-senate-electronic-minute-top20-freeze-v1',
    generatedAt:new Date().toISOString(),
    issue:718,
    sourceOverlap:{
      artifactId:SOURCE_ARTIFACT_ID,
      artifactDigest:SOURCE_ARTIFACT_DIGEST,
      sourceCommitSha:SOURCE_COMMIT_SHA,
      associationProofSha256:SOURCE_ASSOCIATION_PROOF,
    },
    selection:{
      requestedDocuments:EXPECTED_SELECTED_DOCUMENTS,
      selectedDocuments:documents.length,
      selectedTargetEvents:covered.size,
      selectedUncoveredRows:documents.at(-1)?.cumulativeUncoveredRows ?? 0,
      availableOverlapTargetEvents:117,
      availableOverlapUncoveredRows:7838,
      selectionProofSha256,
    },
    sourceFreeze:{
      documentCount:documents.length,
      totalBytes,
      sourceBytesProofSha256,
      documents,
    },
    interpretation:{
      exactOfficialPdfBytesFrozen:true,
      pdfTextExtracted:false,
      pdfContentSemanticallyReviewed:false,
      minuteExistenceIsEvidence:false,
      nextStep:
        'Extract text from the frozen PDFs and perform outcome-blind bill/member semantic review before any evidence proposal.',
    },
    policy:{
      readOnly:true,
      productionDatabaseQueried:false,
      productionWrites:false,
      targetVoteOutcomesRead:false,
      outcomeUse:'none',
      exactOfficialPdfBytesFetched:true,
      memberStanceInferred:false,
      featureRowsWritten:false,
      modelFitting:'none',
      modelWeightChanged:false,
      servingChanged:false,
      vercelUsed:false,
    },
  };
  mkdirSync(outputDir,{recursive:true});
  writeFileSync(
    resolve(outputDir,'historical-density-2023-24-senate-electronic-minute-top20-freeze-v1.json'),
    JSON.stringify(report,null,2)+'\n',
    'utf8',
  );
  console.log(JSON.stringify({
    senate2023_24Top20MinuteFreeze:{
      selection:report.selection,
      documents:report.sourceFreeze.documentCount,
      totalBytes:report.sourceFreeze.totalBytes,
      sourceBytesProofSha256,
      targetVoteOutcomesRead:false,
      pdfTextExtracted:false,
    },
  },null,2));
}
main().catch((error)=>{
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode=1;
});
