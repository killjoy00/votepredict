import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
const ui=readFileSync('src/app/dashboard/legislators/[legislatorId]/page.tsx','utf8');
const loader=readFileSync('src/legislators/profile.ts','utf8');
test('evidence display includes exact real source family and does not call a stored finance evidence date authenticated public-by',()=>{
 assert.match(loader,/sd\.source_kind/);
 assert.match(loader,/sourceKind: row\.source_kind/);
 assert.match(ui,/isCampaignFinanceSourceKind\(item\.sourceKind\)/);
 assert.match(ui,/Stored evidence date/);
 assert.match(ui,/not verified exact-report publication/);
 assert.match(ui,/Financial context · historical public-by unverified/);
});
test('prior-cycle stored eligibility does not claim independently established public access in UI',()=>{
 assert.match(ui,/Stored prior-cycle finance eligibility \(under audit\)/);
 assert.match(ui,/Stored availability labels/);
 assert.match(ui,/not certified PDF public-by/);
 assert.match(ui,/some of which have not passed independent exact filing-version publication verification/);
 assert.doesNotMatch(ui,/>Proven before the current session</);
 assert.doesNotMatch(ui,/>Proven public /);
});
test('financial entity relationships distinct from candidate contributions and voting positions',()=>{
 assert.match(ui,/Independent spending is by third parties/);
 assert.match(ui,/does not mean that employer gave the contribution/);
 assert.match(ui,/not evidence of how a legislator will vote/);
 assert.match(ui,/Recent 2025–26 CFB-derived activity/);
});
test('review-only UI source-confidence workflow, no DB write, migrations or production deployments',()=>{
 const y=readFileSync('.github/workflows/senate-864-finance-evidence-confidence-ui-v29.yml','utf8');
 assert.match(y,/pull_request:/);
 assert.match(y,/permissions:\s*\n\s*contents: read/);
 assert.match(y,/node --test tests\/cfb-864-finance-evidence-confidence-ui-v29.test.mjs/);
 assert.doesNotMatch(y,/NEON|secrets\.|upload-artifact|issues: write|workflow_dispatch|schedule:|deploy|gh run/i);
});
