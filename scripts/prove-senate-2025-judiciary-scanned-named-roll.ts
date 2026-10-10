/**
 * Issue #864: exact original 2025-03-12 Judiciary PDF named rollcall proof.
 * Reacquire only one already hashed official public LRL scanned Minutes PDF.
 * No original bytes/text or member names retained; emit source-choice hashes.
 * No private database, prediction, scheduler, 2027 or office contact.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { auditSenateCommitteeOriginalMinutePdf } from '../src/evidence/senate-committee-original-pdf-action-audit.js';
import { parseSenateCommitteeMinuteVotes } from '../src/evidence/minnesota-senate-committee-minutes.js';
import { fetchSenateCommitteeMinutePdf } from '../src/evidence/minnesota-senate-committee-source.js';
import {
  ORIGINAL_SENATE_JUDICIARY_MARCH12_2025,
  verifySenateJudiciaryMarch2025NamedOriginal,
  originalSenateNamedChoicesDistinct,
} from '../src/evidence/senate-committee-2025-judiciary-ocr-roll-proof.js';
import {
  SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES,
  validateSenateOriginalOcrPageCount,
} from '../src/evidence/senate-committee-scanned-ocr-pilot.js';

async function getPinnedOriginal(
  input: string | URL | Request, init?: RequestInit,
): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  if (url !== ORIGINAL_SENATE_JUDICIARY_MARCH12_2025.url)
    throw Error('Refusing any other original Senate Minutes URL');
  const resp = await fetch(url, { ...init, redirect: 'manual' });
  if (resp.status !== 200) throw Error('Official original HTTP '+resp.status);
  const len=Number(resp.headers.get('content-length'));
  if (Number.isFinite(len) && len > SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES) {
    await resp.body?.cancel();
    throw Error('Original PDF exceeds hard 8 MiB bound');
  }
  const bytes=new Uint8Array(await resp.arrayBuffer());
  if (bytes.length < 300 || bytes.length > SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES
    || new TextDecoder('latin1').decode(bytes.slice(0, 5)) !== '%PDF-')
    throw Error('Original PDF signature or byte bound failed');
  const dir=mkdtempSync(join(tmpdir(),'senate-2025-jud-original-'));
  try {
    const pdfPath=join(dir,'source.pdf');
    writeFileSync(pdfPath,bytes);
    const info=execFileSync('pdfinfo',[pdfPath],{
      encoding:'utf8',timeout:20_000,maxBuffer:100_000,
    });
    const m=info.match(/^Pages:\s*(\d+)\s*$/mi);
    if (!m) throw Error('Original Senate PDF page count unverifiable');
    validateSenateOriginalOcrPageCount(Number(m[1]));
  } finally {rmSync(dir,{recursive:true,force:true});}
  return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}

async function main(){
  const args=process.argv.slice(2);
  if (args.length!==2 || args[0]!=='--output' || !args[1])
    throw Error('Only --output local file accepted, exact original is fixed');
  if (process.env.VOTEPREDICT_SENATE_COMMITTEE_OCR!=='1')
    throw Error('Explicit original OCR opt-in required');
  const original=ORIGINAL_SENATE_JUDICIARY_MARCH12_2025;
  const pdf=await fetchSenateCommitteeMinutePdf({
    url:original.url,
    fetchImpl:getPinnedOriginal as typeof fetch,
  });
  const originalVotes=parseSenateCommitteeMinuteVotes(pdf.text);
  if (originalVotes.length !== 1
    || !originalVotes[0]!.individualVotesAvailable
    || !originalSenateNamedChoicesDistinct(
      originalVotes[0]!.memberVotes,
      ORIGINAL_SENATE_JUDICIARY_MARCH12_2025.sourceNamedMemberChoices,
    )) {
    throw Error('Recovered original named senator YEA/NAY tokens are missing or duplicated');
  }
  const audit=auditSenateCommitteeOriginalMinutePdf({
    document:{
      year:original.year,
      committeeName:original.committeeName,
      meetingDate:original.meetingDate,
      url:original.url,
    },
    pdf,
  });
  const proof=verifySenateJudiciaryMarch2025NamedOriginal(audit);
  const output=resolve(args[1]);
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(proof,null,2)+'\n');
  const roll=proof.voteObservations[0]!;
  console.log(JSON.stringify({
    originalSourceVerified:true,
    originalPdfSha256:proof.document.originalRawPdfSha256,
    extractedOcrTextSha256:proof.document.extractedTextSha256,
    meetingDate:original.meetingDate,
    voteEventExternalKey:roll.externalKey,
    yeaCount:roll.yeaCount,nayCount:roll.nayCount,
    namedMemberChoiceHashes:roll.choiceIdentitySha256.length,
    twoContextOnlyCandidates:proof.contextOnlyActions.length===2,
    sourceCompletedDbReconciliation:false,
    anyProductionDbAccessOrChanges:false,
    output,
  },null,2));
}

main().catch(e=>{
  console.error((e instanceof Error ? e.message : String(e))
    .replace(/https?:\/\/\S+/gi,'[official public source]'));
  process.exitCode=1;
});
