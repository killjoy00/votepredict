/**
 * Source-only 2026 nonnominee sitting Senate original publisher proof (#864).
 * 15 named direct policy quotes; the other 3 current senators' searches explicitly unresolved.
 * No protected DB or archived first published time assumptions.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {acquireSourceWithBoundedFailure} from './audit-senate-864-2026-current-direct-position-leads.mjs';

export const manifestPath='data/evaluation/senate-864-2026-current-nonnominee-legislative-position-leads-v1.json';
export const matrixPath='data/evaluation/senate-864-current-67-senator-public-position-coverage-v1.json';
export function verifyNonNomineeClaims(doc,matrix){
 assert.equal(doc.schema,'mn-senate-864-2026-current-nonnominee-direct-positions-targeted-primary-source-search-v1');
 assert.equal(matrix.senators.length,67);
 assert.equal(doc.claimCount,15);assert.equal(doc.unresolvedSenators,3);
 assert.equal(doc.distinctOriginalUrls,15);assert.equal(doc.claims.length,15);
 assert.equal(doc.unresolved.length,3);
 assert.equal(doc.noOutreach,true);assert.equal(doc.noProductionDatabaseReadsOrWrites,true);
 assert.equal(doc.noAutomatedEvidenceIngestion,true);assert.equal(doc.noModelOrServingChanges,true);
 assert.equal(new Set(doc.claims.map(x=>x.id)).size,15);
 assert.equal(new Set(doc.claims.map(x=>x.url)).size,15);
 const present=new Set(matrix.senators.filter(x=>!x.in49NovemberIncumbentNomineeAudit).map(x=>x.district));
 const verified=new Set([...doc.claims,...doc.unresolved].map(x=>x.district));
 assert.equal(present.size,18);assert.deepEqual(verified,present);
 const safeHosts=new Set(['senatedfl.mn','www.mnsenaterepublicans.com']);
 for(const s of doc.claims){
  assert.ok(present.has(s.district));
  assert.ok(safeHosts.has(new URL(s.url).hostname));
  assert.equal(new URL(s.url).protocol,'https:');
  assert.equal(matrix.senators[s.district-1].nonNomineeCurrentSourcePositionLeadId,s.id);
  assert.equal(matrix.senators[s.district-1].in49NovemberIncumbentNomineeAudit,false);
  assert.equal(matrix.senators[s.district-1].currentTermCampaignIssueItemCount,null);
  assert.equal(matrix.senators[s.district-1].nonNomineePositionOriginalFullHtmlHistoricalCopyAuthenticated,false);
  assert.match(s.publisherDisplayedDate,/^2026-\d{2}-\d{2}$/);
  assert.ok(s.shortExactPassage.length>=25 && s.shortExactPassage.length<=220);
  assert.ok(s.speakerAttributionCue.length>=8);
  assert.ok(['signed_first_person_newsletter','named_caucus_quote'].includes(s.attributionMode));
  assert.equal(s.historicalBacktestEligible,false);
  assert.equal(s.individualOfficialNamedVoteVerified,false);
  assert.equal(s.liveRawPublisherWholePageSha256,null);
  assert.equal(s.originalFirstPublicationTime,null);
  assert.equal(s.archivedOriginal2026CaptureId,null);
  assert.equal(s.sourceAlreadyInEvidenceStore,'not_reconciled');
 }
 for(const s of doc.unresolved){
  assert.ok(present.has(s.district));
  assert.equal(matrix.senators[s.district-1].nonNomineeCurrentSourcePositionLeadId,null);
  assert.match(s.status,/^(searched_|official_)/);
  assert.ok(s.lessSpecificOriginalUrl.startsWith('https://'));
  assert.ok(s.limitation.length>100);
 }
 assert.deepEqual(doc.unresolved.map(x=>x.district).sort((a,b)=>a-b),[37,49,52]);
 assert.equal(matrix.summary.currentNonNomineeSpecificDirectQuoteLeads,15);
 assert.equal(matrix.summary.currentNonNomineeQuoteRemainingGap,3);
 return doc.claims;
}

export async function main(){
 const [flag,outFile]=process.argv.slice(2);
 assert.equal(flag,'--out');assert.ok(outFile&&!outFile.startsWith('--'));
 const doc=JSON.parse(readFileSync(manifestPath,'utf8'));
 const matrix=JSON.parse(readFileSync(matrixPath,'utf8'));
 const claims=verifyNonNomineeClaims(doc,matrix);
 const results=await Promise.all(claims.map(c=>acquireSourceWithBoundedFailure([c])));
 const observed=results.filter(x=>x.originalVerified);
 const disposition={
  schema:'senate-864-2026-nonnominee-18-person-source-receipt-v1',
  firstPublicHtmlObservationUtc:new Date().toISOString(),selectedCurrentSittingNonnomineePopulation:18,
  selectedPersonallyAttributedPublisherStatements:15,
  selectedUnresolvedQuoteGaps:3,
  publisherOriginalURLsAttempted:results.length,
  wholeLiveHtmlSHAAndNamedQuotedPassageEstablished:observed.filter(x=>x.results?.[0]?.currentlyPublisherDisplayedPassageAndSpeakerObserved).length,
  publishedAtDisplayedDatesNotHistoricalFirstPostedTimes:true,
  archivedHistoricalOriginalsProved:0,
  noProductionSourceQueryOrMutation:true,
  copyrightedOriginalHtmlOrFullArticlesNotSaved:true,
  unaccessiblePublicUrlsMarkedUnknown:true,results
 };
 const dest=resolve(outFile);mkdirSync(dirname(dest),{recursive:true});
 writeFileSync(dest,JSON.stringify(disposition,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({population:18,quotes:15,nonquotes:3,
  accessibleRawLiveHtml:observed.length,
  currentHtmlSourceSpeakerQuoteMatched:disposition.wholeLiveHtmlSHAAndNamedQuotedPassageEstablished,
  failuresAreUnknown:true,historyPublicByCertified:0}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 main().catch(e=>{console.error('2026 current public nonnominee proof audit rejected input: '+e.message);process.exitCode=1;});
}