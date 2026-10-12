import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const BASE='docs/evaluation/source-proof/';
const NAMES={
  queue:'cfb-2021-25-served-senator-next-source-pdf-targets.psv',
  annual:'cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv',
  special:'cfb-2025-served-sd29-seven-amended-version-pdfs.psv',
  resolutions:'cfb-2021-25-51-priority-queue-source-resolution.psv',
} as const;
const source=Object.fromEntries(Object.entries(NAMES).map(([key,name])=>
  [key,readFileSync(BASE+name,'utf8')])) as Record<keyof typeof NAMES,string>;
const lines=(text:string)=>text.trimEnd().split('\n').map(line=>line.split('|'));
const queue=lines(source.queue),annual=lines(source.annual),special=lines(source.special);
const resolved=lines(source.resolutions);
const annualById=new Map(annual.map(r=>[r[0]!,r]));
const specialById=new Map(special.map(r=>[r[0]!,r]));
const resolvedById=new Map(resolved.map(r=>[r[1]!,r]));
const sha256=(x:string)=>createHash('sha256').update(x).digest('hex');
const gitBlob=(x:string)=>createHash('sha1')
  .update('blob '+Buffer.byteLength(x,'utf8')+'\0')
  .update(x).digest('hex');
const queueCp=JSON.parse(readFileSync(BASE+
  'cfb-2021-25-served-senator-committee-year-coverage-source-checkpoint.json','utf8'));
const annualCp=JSON.parse(readFileSync(BASE+
  'cfb-2023-24-served-22-71-yearend-legal-release-and-publicby-checkpoint.json','utf8'));
const specialCp=JSON.parse(readFileSync(BASE+
  'cfb-2025-served-sd29-seven-amended-version-source-checkpoint.json','utf8'));
const isDate=(v:string)=>/^\\d{4}-\\d{2}-\\d{2}$/.test(v)
  &&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const nextDay=(v:string)=>new Date(Date.parse(v+'T00:00:00Z')+86400000)
  .toISOString().slice(0,10);

test('all input source ledgers are exactly immutable proven repository inputs, not today's viewers',()=>{
  assert.equal(queue.length,51);
  assert.equal(annual.length,71);
  assert.equal(special.length,7);
  assert.equal(source.queue.endsWith('\n'),true);
  assert.equal(source.annual.endsWith('\n'),true);
  assert.equal(source.special.endsWith('\n'),true);
  assert.equal(sha256(source.queue),queueCp.acquisitionQueue.sha256);
  assert.equal(gitBlob(source.queue), 'f9f832d610ed55eb05236e830423636b7cf8ffb7');
  assert.equal(gitBlob(source.annual), annualCp.ledger.gitBlobSha);
  assert.equal(gitBlob(source.special), specialCp.permanentPdfLedger.gitBlobSha);
  assert.equal(specialCp.comparison.all7PdfBinarySha256AndByteLengthsIdenticalAcrossRuns,true);
  assert.equal(specialCp.comparison.firstPageDocumentIdentityHolds,0);
  assert.equal(annualCp.independentCrossLedgerAccounting.sourceAuthenticatedDistinctPdfBinariesTotal,68);
  assert.equal(annualCp.independentCrossLedgerAccounting.sourceHolds,2);
  assert.equal(annualCp.independentCrossLedgerAccounting.actualPublicByProvenCount,0);
});

test('each of the 51 old exact PDF version targets is reconciled by registration/person/version to later pinned proof',()=>{
  assert.equal(new Set(queue.map(q=>q[1])).size,51);
  assert.equal(resolved.length,51);
  assert.equal(resolvedById.size,51);
  const out:{[year:string]:{auth:number;alias:number;hold:number}}={};
  const seenSha=new Set<string>();
  for(let i=0;i<queue.length;i++){
    const q=queue[i]!,got=resolved[i]!;
    assert.equal(got.length,20);
    const [priority,id,parent,year,person,district,registration,viewerYear,viewerSha,parentSha]=q;
    const old=year!=='2025';
    const proof=old?annualById.get(id!):specialById.get(id!);
    assert.ok(proof,'No source resolution for exact queued version '+id);
    assert.equal(got[0],priority);
    assert.equal(got[1],id);
    assert.equal(got[2],year);
    assert.equal(got[3],person);
    assert.equal(got[4],registration);
    assert.equal(got[5],parent);
    assert.equal(got[6],viewerSha);
    assert.equal(got[7],old?'served22_2023_24_71_yearend':'sd29_2025_seven_amendments');
    const status=old?proof[8]!:proof[12]!;
    const cls=old?(status==='original_pdf_first_page_authenticated'
      ||status==='distinct_authenticated_amended_pdf'?'AUTHENTICATED_DISTINCT_PDF'
      :status==='HOLD_first_page_registration_unverified'?'SOURCE_DOCUMENT_IDENTITY_HOLD'
      :status==='duplicate_official_amendment_reference_pdf_alias'?'OFFICIAL_VERSION_BINARY_ALIAS'
      :'INVALID_STATUS'):
      status==='distinct_amended_pdf'?'AUTHENTICATED_DISTINCT_PDF'
      :status==='reviewed_official_index_aliases_original_pdf'?'OFFICIAL_VERSION_BINARY_ALIAS'
      :'INVALID_STATUS';
    assert.notEqual(cls,'INVALID_STATUS');
    const actualSha=old?proof[7]!:proof[5]!;
    const received=old?proof[10]!:proof[9]!;
    const start=old?proof[11]!:proof[7]!;
    const end=old?proof[12]!:proof[8]!;
    const due=old?proof[13]!:proof[10]!;
    const floor=old?proof[15]!:proof[11]!;
    const alias=old?proof[9]!:proof[13]!;
    assert.equal(got[8],status);
    assert.equal(got[9],cls);
    assert.equal(got[10],actualSha);
    assert.match(got[10]!,/^[a-f0-9]{64}$/);
    assert.ok(isDate(due));
    assert.equal(got[14],due);
    assert.equal(got[16],alias);
    assert.deepEqual(got.slice(17,20),['-','-','false'],
      'No historical publication / legal obligation / prediction eligibility newly established');
    if(old){
      assert.equal(proof[1],person);
      assert.equal(proof[2],district);
      assert.equal(proof[3],registration);
      assert.equal(proof[4],year);
      assert.equal(proof[6],viewerSha,'CFB registration viewer API hash must match across ledgers');
      assert.equal(proof[16],'-');
      assert.equal(proof[17],'-');
      assert.equal(proof[18],'false');
    }else{
      assert.equal(proof[1],person);
      assert.equal(proof[2],district);
      assert.equal(proof[3],parent);
      assert.equal(proof[4],parentSha);
      assert.equal(viewerYear,'2026');
      assert.equal(viewerSha,specialCp.originalPinnedViewer.apiBodySha256);
    }
    if(cls==='SOURCE_DOCUMENT_IDENTITY_HOLD'){
      assert.equal(got[11],'-');
      assert.equal(got[12],'-');
      assert.equal(got[13],'-');
      assert.equal(got[15],'-');
      assert.equal(floor,'-');
    }else{
      assert.deepEqual(got.slice(11,14),[start,end,received]);
      assert.equal(got[15],floor);
      assert.ok([start,end,received,floor].every(isDate));
      assert.ok(start<=end && end<=received && due>=end);
      // A due-date floor is an exclusion boundary, NOT proof of public-by.
      assert.ok(floor>=nextDay(due) && floor>=received);
    }
    if(cls==='AUTHENTICATED_DISTINCT_PDF'){
      assert.equal(alias,'-');
      assert.ok(!seenSha.has(actualSha),'Two distinct authenticated PDFs share an identical binary SHA');
      seenSha.add(actualSha);
    }else if(cls==='OFFICIAL_VERSION_BINARY_ALIAS'){
      assert.notEqual(alias,'-');
      if(old){
        const target=annualById.get(alias);
        assert.ok(target,'Canonical annual reference missing from authenticated source');
        assert.equal(target[7],actualSha);
        assert.notEqual(target[8],'HOLD_first_page_registration_unverified');
      }else{
        assert.equal(alias,specialCp.alias.authenticatedOriginalParent);
        assert.equal(actualSha,specialCp.alias.bothSourcePdfSha256);
      }
    }
    const bin=out[year!]??={auth:0,alias:0,hold:0};
    if(cls==='AUTHENTICATED_DISTINCT_PDF')bin.auth++;
    else if(cls==='OFFICIAL_VERSION_BINARY_ALIAS')bin.alias++;
    else bin.hold++;
  }
  assert.deepEqual(out,{
    '2023':{auth:19,alias:0,hold:1},
    '2024':{auth:23,alias:1,hold:0},
    '2025':{auth:6,alias:1,hold:0},
  });
  assert.equal(seenSha.size,48);
  assert.equal(queue.filter(q=>q[0]==='P1_PARENT_VERIFIED_AMENDMENT').length,7);
  assert.equal(queue.filter(q=>q[0]==='P2_AUTHENTICATE_ORIGINAL_FIRST').length,28);
  assert.equal(queue.filter(q=>q[0]==='P3_AMEND_AFTER_PARENT').length,16);
});

test('two aliases and the single 2023 Putnam report identity HOLD remain explicit',()=>{
  assert.deepEqual(resolved.filter(r=>r[9]==='OFFICIAL_VERSION_BINARY_ALIAS').map(r=>r[1]).sort(),[
    '18430:24:pcc:YE:0:2','19229:25:pcc:YE:0:1']);
  assert.deepEqual(resolved.filter(r=>r[9]==='SOURCE_DOCUMENT_IDENTITY_HOLD').map(r=>r[1]),[
    '18430:23:pcc:YE:0:1']);
  assert.ok(resolved.every(r=>r[17]==='-'&&r[18]==='-'&&r[19]==='false'));
});
