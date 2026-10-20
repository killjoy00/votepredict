/** Additive source-metadata repair. The 668-record planner and freezes are untouched. */
import {readFileSync} from 'node:fs';
import {expansionInputs} from './senate-864-website-expansion.mjs';
import {SOURCE_LEDGER_FILES} from './senate-864-95-historical-source-neon-parity.mjs';
import {websiteExcerptPlan} from './senate-864-historical-site-excerpt-asof.mjs';
import {buildRecoveryPlan} from '../../scripts/build-senate-864-95-missing-original-recovery-plan.mjs';
const base='data/evaluation/';
export const RECOVERY_ARTIFACTS={
 'senate-second20-15-original-serving-senators-issue-excerpts-v1.json':[11717125740],
 'senate-last16-five-new-original-site-policy-excerpts-v1.json':[11719882698,11719617752,11716126718],
 'senate-five-new-2022-original-site-capture-dated-policy-excerpts-v1.json':[11691732567],
 'senate-five-additional-served-2022-capture-dated-candidate-quotes-v1.json':[11706400701],
 'senate-four-more-2022-original-campaign-policy-excerpts-capture-dated-v1.json':[11690766863],
 'senate-two-2021-serving-2020-original-capture-dated-41-policy-excerpts-v1.json':[11691923324],
 'senate-carlson-hawj-2020-22-original-first-party-17-issue-excerpts-v1.json':[11714578217],
 'senate-nicole-mitchell-2022-original-priorities-excerpts-v1.json':[11687282664],
 'senate-carla-nelson-2022-dated-original-platform-excerpts-v1.json':[11686238089],
 'senate-roger-chamberlain-2016-original-10-economic-issue-excerpts-and-domain-review-v1.json':[11713536195],
 'senate-authenticated-campaign-issue-excerpt-leads-2024-25-v1.json':[11682363094,11682351954],
};
export function walkObjects(o,visit){if(!o||typeof o!=='object')return;if(!Array.isArray(o))visit(o);for(const x of Object.values(o))if(x&&typeof x==='object')walkObjects(x,visit)}
const aliases={
 originalArchiveCdxSha1Base32:['cdxSha1Base32','independentCdxSha1Base32','archiveCdxSha1Base32','independentHistoricalCdxSha1Base32','independentHistoricCdxPayloadSHA1Base32','originalCdxDigestSha1Base32','independentWaybackOriginalPayloadSHA1Base32'],
 originalUrl:['originalCandidateWebsiteUrl','firstPartyArchivedCampaignURL'],
 originalArchiveCaptureAtUtc:['originalCaptureUtc','actual2020ArchiveCaptureUtc','originalArchivedCaptureUtc'],
 originalHtmlSha256:['originalWholeHtmlSHA256'],
 originalHtmlFile:['originalArchivedCampaignPageFile','sourceArchiveOriginalHtmlFileName'],
};
export function normalizeSourceAliases(o){walkObjects(o,row=>{for(const [key,names] of Object.entries(aliases)){
 const vals=[...new Set([row[key],...names.map(k=>row[k])].filter(v=>typeof v==='string'&&v))];
 if(vals.length>1)throw Error('Conflicting explicit source aliases');if(vals.length===1)row[key]=vals[0];
 }});return o}
export function recoveryDocuments(){
 const docs=new Map(SOURCE_LEDGER_FILES.map(p=>[p,normalizeSourceAliases(JSON.parse(readFileSync(p)))]));
 for(const [target,receipt,field] of [
 ['senate-five-new-2022-original-site-capture-dated-policy-excerpts-v1.json','senate-eight-probed-six-served-original-2022-23-html-receipts-v1.json','allAuthenticatedOriginal2022SourcePages'],
 ['senate-two-2021-serving-2020-original-capture-dated-41-policy-excerpts-v1.json','senate-two-2021-served-2020-original-campaign-eight-html-source-receipts-v1.json','originalFirstPartyWebPages'],
 ])docs.get(base+target).recoveredOriginalReceipts=normalizeSourceAliases(JSON.parse(readFileSync(base+receipt)))[field];
 const roger=docs.get(base+'senate-roger-chamberlain-2016-original-10-economic-issue-excerpts-and-domain-review-v1.json');
 roger.recoveredOriginalReceipts=[{...roger.source,id:'original_2016_candidates_issues_goals'}];
 // Both ledgers explicitly attest every literal in BOTH original copies.
 const nicole=docs.get(base+'senate-nicole-mitchell-2022-original-priorities-excerpts-v1.json');
 if(!nicole.shortIssues.every(r=>r.verifiedInBothOriginalCopiesByHumanReview===true))throw Error('Nicole source attestation changed');
 for(const r of nicole.shortIssues)r.pageId='nicole2022-priorities-feb01';
 const carla=docs.get(base+'senate-carla-nelson-2022-dated-original-platform-excerpts-v1.json');
 if(!carla.verifiedOriginals.every(r=>r.sameExactIssueExcerptsAllSixObserved===true))throw Error('Carla source attestation changed');
 for(const r of carla.issues)r.pageId='carla-2022-page-a';
 return docs;
}
export function recoveredWebsitePlan(docs=recoveryDocuments()){
 const old=expansionInputs(),plan=websiteExcerptPlan(old.manifest,docs,buildRecoveryPlan().witnesses);
 const lookup=new Map(plan.ready.map(r=>[r.id,r]));
 if(old.current.ready.some(r=>JSON.stringify(lookup.get(r.id))!==JSON.stringify(r)))throw Error('Existing 668 records changed');
 const keys=new Set(old.current.ready.map(r=>r.ingestionIdentityKey));
 return {...old,current:plan,added:plan.ready.filter(r=>!keys.has(r.ingestionIdentityKey)),oldKeys:keys};
}
