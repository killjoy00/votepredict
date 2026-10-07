import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const OVERLAP_ARTIFACT_ID=11501649286;
const OVERLAP_ARTIFACT_DIGEST=
  'sha256:c5ed67e03a2aabb7b41df147beb2d4e814b6db834055387efaf716e3b6ac3f42';
const OVERLAP_PROOF=
  'dbb3e5e4ce5191ec4fb47aa1f777f72067a3dca7fedefc0871ac41ed341adbf1';
const TEXT_ARTIFACT_ID=11502902302;
const TEXT_ARTIFACT_DIGEST=
  'sha256:c73031633618f4a599a8e1ae1147eb9cd2b429db229335dccef14961a3aa835c';
const TEXT_SOURCE_COMMIT='b3e91058d1e9071491690d3ca6cde58cf733230c';
const TEXT_EXTRACTION_PROOF=
  'ad0e37fc543ec8be11adfdab8c09f6212bc5ba45f4a6af105a2dc2a723f8d9af';
const EXPECTED_PAIRS=160;
const EXPECTED_LITERAL_MATCH_PAIRS=21;
const EXPECTED_LITERAL_MATCH_EVENTS=21;
const EXPECTED_LITERAL_MATCH_BILLS=12;
const EXPECTED_LITERAL_MATCH_DOCUMENTS=9;
const EXPECTED_LITERAL_MATCH_UNCOVERED_ROWS=1407;

type Json=Record<string,any>;
function sha256(v:string){return createHash('sha256').update(v).digest('hex');}
function env(n:string){const v=process.env[n]?.trim();if(!v)throw new Error(`${n} is required`);return v;}
function billPattern(identifier:string):RegExp{
  const m=identifier.toUpperCase().replace(/\s+/g,'').match(/^([SH])F(\d+)$/);
  if(!m) throw new Error(`Unsupported bill identifier: ${identifier}`);
  return new RegExp(
    `(?<![A-Z0-9])${m[1]}[\\s.\\u0000]*F[\\s.\\u0000]*0*${m[2]}(?![0-9])`,
    'gi',
  );
}
function context(text:string,index:number,length:number):string{
  const start=Math.max(0,index-120), end=Math.min(text.length,index+length+180);
  return text.slice(start,end).replace(/\u0000/g,' ').replace(/\s+/g,' ').trim();
}

function main(){
  const overlap=JSON.parse(readFileSync(env('VOTEPREDICT_SENATE_2023_24_OVERLAP_PATH'),'utf8')) as Json;
  const extraction=JSON.parse(readFileSync(env('VOTEPREDICT_SENATE_2023_24_TEXT_REPORT_PATH'),'utf8')) as Json;
  const textRoot=resolve(env('VOTEPREDICT_SENATE_2023_24_TEXT_ROOT'));
  const output=resolve(process.env.VOTEPREDICT_SENATE_2023_24_BILL_SCREEN_OUTPUT
    ?? 'tmp/historical-density-2023-24-senate-top20-bill-mention-screen-v1.json');

  if(
    overlap.schemaVersion!=='historical-density-2023-24-senate-electronic-minute-target-overlap-v1'
    || overlap.overlap?.associationProofSha256!==OVERLAP_PROOF
    || overlap.policy?.targetVoteOutcomesRead!==false
    || extraction.schemaVersion!=='historical-density-2023-24-senate-top20-text-extraction-v1'
    || extraction.sourceFreeze?.artifactId!==11502134219
    || extraction.summary?.documents!==20
    || extraction.summary?.readableEmbeddedTextDocuments!==20
    || extraction.summary?.extractionProofSha256!==TEXT_EXTRACTION_PROOF
    || extraction.policy?.targetVoteOutcomesRead!==false
    || extraction.interpretation?.semanticReviewPerformed!==false
  ) throw new Error('Canonical overlap/text lineage drifted');

  const assocByUrl=new Map<string,Json[]>();
  for(const row of overlap.overlap.associations as Json[]){
    const bucket=assocByUrl.get(row.minuteUrl)??[];
    bucket.push(row);
    assocByUrl.set(row.minuteUrl,bucket);
  }
  const rows:Json[]=[];
  for(const doc of extraction.documents as Json[]){
    const textPath=resolve(textRoot,String(doc.archivedTextRelativePath));
    const text=readFileSync(textPath,'utf8');
    if(sha256(text)!==doc.textSha256) throw new Error(`Frozen text hash mismatch rank ${doc.rank}`);
    const unique=new Map<string,Json>();
    for(const a of assocByUrl.get(doc.minuteUrl)??[]) unique.set(a.voteEventId,a);
    for(const a of [...unique.values()].sort((x,y)=>String(x.voteEventId).localeCompare(String(y.voteEventId)))){
      const re=billPattern(String(a.identifier));
      const matches=[...text.matchAll(re)];
      rows.push({
        documentRank:doc.rank,
        pdfContentSha256:doc.pdfContentSha256,
        textSha256:doc.textSha256,
        minuteCommitteeName:doc.minuteCommitteeName,
        minuteMeetingDate:doc.minuteMeetingDate,
        minuteUrl:doc.minuteUrl,
        voteEventId:a.voteEventId,
        billId:a.billId,
        identifier:a.identifier,
        targetVoteDate:a.targetVoteDate,
        uncoveredRows:a.uncoveredRows,
        literalBillMention:matches.length>0,
        literalMatchCount:matches.length,
        literalMatchTokens:[...new Set(matches.map(m=>m[0].replace(/\u0000/g,'')))].sort(),
        firstLiteralContext:matches[0]&&matches[0].index!==undefined
          ? context(text,matches[0].index,matches[0][0].length)
          : null,
        semanticDecision:null,
        memberAttribution:null,
        memberStance:null,
      });
    }
  }
  rows.sort((a,b)=>a.documentRank-b.documentRank
    || String(a.identifier).localeCompare(String(b.identifier))
    || String(a.voteEventId).localeCompare(String(b.voteEventId)));

  const hitRows=rows.filter(r=>r.literalBillMention);
  const hitEvents=new Set(hitRows.map(r=>r.voteEventId));
  const hitBills=new Set(hitRows.map(r=>r.billId));
  const hitDocs=new Set(hitRows.map(r=>r.documentRank));
  const eventRows=new Map<string,number>();
  for(const row of rows) eventRows.set(row.voteEventId,row.uncoveredRows);
  const matchedUncoveredRows=[...hitEvents].reduce((n,id)=>n+(eventRows.get(id)??0),0);
  if(
    rows.length!==EXPECTED_PAIRS
    || hitRows.length!==EXPECTED_LITERAL_MATCH_PAIRS
    || hitEvents.size!==EXPECTED_LITERAL_MATCH_EVENTS
    || hitBills.size!==EXPECTED_LITERAL_MATCH_BILLS
    || hitDocs.size!==EXPECTED_LITERAL_MATCH_DOCUMENTS
    || matchedUncoveredRows!==EXPECTED_LITERAL_MATCH_UNCOVERED_ROWS
  ) throw new Error('Pinned literal bill-mention screen counts drifted');

  const screenProofSha256=sha256(rows.map(r=>[
    r.documentRank,r.pdfContentSha256,r.voteEventId,r.billId,r.identifier,
    r.literalBillMention,r.literalMatchCount,
  ].join('|')).join('\n')+'\n');
  const report={
    schemaVersion:'historical-density-2023-24-senate-top20-bill-mention-screen-v1',
    generatedAt:new Date().toISOString(),
    issue:718,
    inputs:{
      overlapArtifactId:OVERLAP_ARTIFACT_ID,
      overlapArtifactDigest:OVERLAP_ARTIFACT_DIGEST,
      overlapAssociationProofSha256:OVERLAP_PROOF,
      textArtifactId:TEXT_ARTIFACT_ID,
      textArtifactDigest:TEXT_ARTIFACT_DIGEST,
      textSourceCommitSha:TEXT_SOURCE_COMMIT,
      textExtractionProofSha256:TEXT_EXTRACTION_PROOF,
    },
    summary:{
      documentCandidateEventPairs:rows.length,
      literalMatchPairs:hitRows.length,
      literalMatchDocuments:hitDocs.size,
      literalMatchTargetEvents:hitEvents.size,
      literalMatchBills:hitBills.size,
      literalMatchUncoveredRows:matchedUncoveredRows,
      screenProofSha256,
    },
    rows,
    interpretation:{
      literalBillMentionOnly:true,
      literalMentionEstablishesApplicability:false,
      literalMentionEstablishesMemberAttribution:false,
      literalMentionEstablishesDirection:false,
      nextStep:'Review only literal-match rows against frozen context/source text for explicit attributable member statements; all other rows remain fail-closed.',
    },
    policy:{
      targetVoteOutcomesRead:false,
      outcomeUse:'none',
      productionDatabaseQueried:false,
      productionWrites:false,
      semanticDecisionAutoFilled:false,
      memberAttributionInferred:false,
      memberStanceInferred:false,
      featureRowsWritten:false,
      modelFitting:'none',
      modelWeightChanged:false,
      servingChanged:false,
      vercelUsed:false,
    },
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(JSON.stringify({senate2023_24BillMentionScreen:report.summary},null,2));
}
main();
