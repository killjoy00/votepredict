import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{SCHEMA,originalNewtonPublicReportReference}
 from'../scripts/retry-cfb-864-jerry-newton-2021-original-raw-PDF-v37.mjs';
test('original Minnesota CFB 2021 Jerry Newton YE report is government-indexed despite a past document-fetch failure',()=>{
 assert.equal(SCHEMA,'cfb-864-2021-jerry-newton-one-original-indexed-PDF-retrieval-v37');
 const r=originalNewtonPublicReportReference();
 assert.equal(r.versionId,'18004:21:pcc:YE:0:0');
 assert.equal(r.person,'Jerry Newton');
 assert.equal(r.registrationNumber,'18004');
 assert.match(r.originalViewerResponseSha256,/^[a-f0-9]{64}$/);
 assert.equal(r.officialPdfUrl,
  'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=21&type=pcc&period=YE&se=0&regnum=18004&amend=0');
});
test('original source-only public raw PDF retry does not run OCR, donor-row extraction, Neon, private data or deployments',()=>{
 const y=readFileSync('.github/workflows/senate-864-newton-2021-original-pdf-retry-v37.yml','utf8');
 assert.match(y,/pull_request:/);assert.match(y,/contents: read/);
 assert.match(y,/node --import tsx --test tests\/cfb-864-newton-2021-original-raw-source-v37.test.mjs/);
 assert.doesNotMatch(y,/NEON|secrets\.|upload-artifact|workflow_dispatch|schedule:|deploy|issues: write|gh run/i);
});
