/** #864: keyless, Neon-secret-free issue report of 95 PUBLIC source-row labels
 * and bounded numeric counts. Never render raw DB names/URLs/excerpts/IDs.
 */
import {readFileSync} from 'node:fs';
import {assertManifest,validatePublicReport}
 from '../src/evidence/senate-864-95-historical-source-neon-parity.mjs';
import {validateV2Report} from '../src/evidence/senate-864-95-original-archive-url-diagnostics.mjs';
const SRC='data/evaluation/senate-864-95-served-historical-candidate-research-manifest-v1.json';
const safeRun=/^https:\/\/github\.com\/killjoy00\/votepredict\/actions\/runs\/\d+$/;
export function render95Issue({verifyResult,readOnlyResult,safe95B64,safe95V2B64,safeFailurePhase,runUrl,mainSha}){
 if(!safeRun.test(runUrl)||!/^[a-f0-9]{40}$/.test(mainSha||''))
  throw Error('Invalid approved workflow identity');
 const header='## #864 — 95 actually-serving historical senators: protected source-to-Neon READ ONLY V1\n\n'
  +'Exact main: \x60'+mainSha+'\x60. [GitHub Actions run]('+runUrl+').\n\n';
 if(verifyResult!=='success')return header+'**PRE-SECRET HOLD:** independent disposable-Postgres/full-repo gate did not succeed. No Neon result certified.';
 if(readOnlyResult!=='success'){
  const safe=/^[a-z_]{1,90}$/.test(safeFailurePhase||'')?safeFailurePhase:'protected_hold';
  return header+'**PROTECTED HOLD:** '+safe+'. No completed 95-person historical database reconciliation is certified. Do not treat missing results as zero.';
 }
 if(typeof safe95B64!=='string'||!safe95B64||safe95B64.length>115000||!/^[a-zA-Z0-9+/=]+$/.test(safe95B64))
  throw Error('Missing valid fixed-bounded protected aggregate receipt');
 const manifest=assertManifest(JSON.parse(readFileSync(SRC,'utf8')));
 const report=validatePublicReport(JSON.parse(Buffer.from(safe95B64,'base64').toString('utf8')),manifest);
 const lines=[
  header,
  '**SUCCESS:** authenticated existing VotePredict Neon default branch; \x60REPEATABLE READ READ ONLY\x60, all SQL results processed only in the trusted runner, **explicit ROLLBACK**. No credentials, raw DB people, source URLs, row/member/source IDs, source hashes, direct excerpts or donor rows exported.\n',
  '- Official 2021–25 denominator: **95 distinct actual-serving people**, **339 service-person-years**.',
  '- Independently authenticated selected original candidate-owned campaign excerpts (all original cycle contexts, not necessarily each service year): **92 people / 1,285 selected research excerpts**.',
  '- Bounded historical research original-page URLs with whole raw HTML SHA and direct person attribution from the selected **29** in-repository ledgers: **'+report.researchUrlShaDirectlyAttributedPages+'**.',
  '- Unique stored legislator identities joined under conservative original public-name equality/limited public aliases: **'+report.uniqueLegislatorJoins+'/95**; **'+report.unjoinedOrAmbiguousOfficialPeople+'** HOLD.',
  '- Across resolved people, stored campaign-site \x60issue_position\x60 rows, all recorded metadata years: **'+report.storedCampaignSiteEvidenceRowsAcrossJoinedHistoricMemberships+'**. Separate stored \x60member_primary_article\x60 rows: **'+report.storedMemberPrimaryArticleRowsAcrossJoinedHistoricMemberships+'** (not independently proven attributed policy statements).',
  '- Exact original source **URL + whole-HTML SHA** matches among senator-linked campaign evidence: **'+report.exactUrlShaStoredLinkedPages+'**. Exact URL with different or absent SHA: **'+report.exactUrlOnlyStoredLinkedPages+'**. Research exact source URLs not observed in the bounded comparison: **'+report.exactUrlNotObservedPages+'**.',
  '\n### Per-person original research versus stored evidence\n',
  '| Original official serving senator | Served | Research excerpts | Stored member evidence rows* | Research pages: URL + original SHA / URL only / URL not observed |',
  '|---|---|---:|---:|---|'
 ];
 for(let i=0;i<95;i++){
  const p=manifest.people[i],r=report.rows[i];
  const counts=r.identityStatus==='joined_unique_legislator'
   ?String(r.storedCampaignSiteIssueRows)
   :'HOLD ('+(r.identityStatus==='hold_multiple_legislator_identities'?'ambiguous identity':'identity not joined')+')';
  const sources=r.identityStatus==='joined_unique_legislator'
   ?r.researchedExactUrlAndWholeShaMatched+' / '+r.researchedExactUrlOnlyMatched+' / '+r.researchedExactUrlNotObserved
   :'HOLD ('+r.researchedOriginalPagesWithUrlSha+' public page leads)';
  lines.push('| '+p.officialName.replace(/\|/g,'')+' | '+p.serviceYears.join(', ')+' | '+p.selectedCandidateOwnedResearchExcerpts+' | '+counts+' | '+sources+' |');
 }
 lines.push('\n*Stored rows count all metadata years across that person’s historical Senate membership IDs, not only 2021–25, and can include duplicate membership linkage. They are **not** exact quote matches or verified legislative positions. Original research excerpts and original webpage-source fingerprints have different units; their counts cannot be subtracted from one another.\n');
 lines.push('**Important holds:** original archive capture establishes public observation by capture time, not first authorship; stored \x60published_at\x60 is database metadata, not independent historical source publication proof. An exact URL unobserved in the selected source query does **not** establish that a senator had no position or that a source was never stored through an alternate URL/source family. The original 29 ledgers may contain additional authenticated pages not individually URL+SHA+person-bounded in this report. This is not an exhaustive 1,285-quote exact-text parity certificate, bill/vote audit, election forecast evaluation, or newly deployed app audit. No ingestion, migration, vote/model/forecast/scheduler change. Leave #864 open.');
 // V2 independently validates the fixed safe ordinal-only payload, never raw SQL.
 if(typeof safe95V2B64!=='string'||safe95V2B64.length<50||safe95V2B64.length>65000
   ||!/^[a-zA-Z0-9+/=]+$/.test(safe95V2B64))
  throw Error('Missing or oversized historical URL/archive V2 receipt');
 const v2=validateV2Report(JSON.parse(Buffer.from(safe95V2B64,'base64').toString('utf8')));
 if(v2.originalPageWitnesses!==report.researchUrlShaDirectlyAttributedPages
   ||v2.historicalPersons!==report.cohortSize)
  throw Error('Different independently fixed 130-page / 95-senator source populations');
 const s=v2.pageResolutionStates,f=v2.memberLinkedStoredFamilyRows,
  w=v2.storedSourceAddressForms,h=v2.wholeOriginalHtmlShaComparison;
 lines.push('\n## Follow-up V2: why 130 original URLs had zero strict URL matches\n');
 lines.push('**New protected READ ONLY diagnostic:** inspected '+v2.memberEvidenceRowsExamined+
   ' source/evidence rows across candidate-site, Wayback, member-primary, registry, news and other issue positions linked to the historic Senate memberships. Original candidate-owned page URLs were also matched to source_documents.metadata.originalUrl, evidence_items.metadata.originalUrl, embedded Wayback replay originals, conservative scheme/www/trailing-slash equivalents, and same-host different-path leads. Raw URLs, document IDs, person identifiers and SHA stayed only in the protected runner.');
 lines.push('\n### Mutually exclusive best page-level resolution (130 original research pages)\n');
 lines.push('| Original-page comparison result | Pages |');
 lines.push('|---|---:|');
 const resolution=[
  ['Direct stored address exact',s.direct_url_exact],
  ['Direct stored address normalized (scheme/www/slash)',s.direct_url_normalized],
  ['Stored originalUrl metadata exact',s.metadata_original_exact],
  ['Stored originalUrl metadata normalized',s.metadata_original_normalized],
  ['Original address extracted from Wayback replay URL exact',s.wayback_embedded_exact],
  ['Original address extracted from Wayback replay URL normalized',s.wayback_embedded_normalized],
  ['Same original domain, different path (not page-proven)',s.same_host_path_unverified],
  ['No same-domain address within the bounded senator-linked source families',s.no_same_host_in_selected_linked_sources]
 ];
 for(const [label,value] of resolution)lines.push('| '+label+' | '+value+' |');
 lines.push('\n**Interpretation:** '+v2.originalPagesWithPageLevelSourceIdentity+
   ' / 130 original page addresses were recovered at the page-URL level within the same senator’s stored evidence, compared with **zero strict original-address matches** in V1. '+
   s.same_host_path_unverified+' more had same-domain evidence for that senator without proof of the exact page. '+
   s.no_same_host_in_selected_linked_sources+' had no same-domain match in the selected bounded source families; this is **not proof** that the original quote was never stored, that the senator had no position, or that the site was absent statewide.');
 lines.push('\n### Source URL and classification evidence\n');
 lines.push('- Source address in stored evidence rows: '+w.archiveReplayRows+' Internet Archive replay URLs, '+w.nonArchiveRows+' non-archive addresses. '+w.archiveReplayRowsWithOriginalMetadata+' archive-linked evidence rows also carry a parseable preserved original URL in source or evidence metadata.');
 lines.push('- Stored source families among selected linked rows (evidence-row counts, not distinct source documents): archived campaign '+f.archived_campaign+', campaign registry '+f.campaign_registry+', other direct campaign '+f.campaign_other+', archived member '+f.archived_member+', member-primary '+f.member_primary+', member registry '+f.member_registry+', news '+f.news_context+', other '+f.other_context+'.');
 lines.push('- Source family of page-level URL matches (one strongest matched source per original research page): '+Object.entries(v2.sourceKindOfPageLevelMatches).map(([k,n])=>k+' '+n).join('; ')+'.');
 lines.push('- Original full-page SHA comparison **only where a matching original URL exists**: '+h.whole_sha_equal+' equal; '+h.whole_sha_differs+' different; '+h.whole_sha_unavailable+' no usable stored SHA. The Wayback importer hashes its fetched archive response, which is not necessarily byte-identical to the independently archived original HTML. Equal URLs or SHA by themselves do not certify the actual short quote or original author-first-publication date.');
 lines.push('- Original research pages whose addresses exist **anywhere** in the bounded global source_documents address / originalUrl lookup (not necessarily evidence-linked to the right senator): '+v2.globalCandidateUrlPresence.pagesWithGlobalDirectUrl+' direct URL, '+v2.globalCandidateUrlPresence.pagesWithGlobalOriginalMetadata+' preserved originalUrl metadata. '+v2.globalSourceDocumentsRead+' bounded global document records inspected.');
 lines.push('\n### Per-original-senator URL mismatch classification\n');
 lines.push('| Historical senator | Page identities: direct / metadata / replay | Same domain only | No matching domain |');
 lines.push('|---|---:|---:|---:|');
 for(let i=0;i<95;i++){
  const p=manifest.people[i],r=v2.perPerson[i],x=r.states;
  if(!r.originalPages)continue;
  const direct=x.direct_url_exact+x.direct_url_normalized;
  const meta=x.metadata_original_exact+x.metadata_original_normalized;
  const replay=x.wayback_embedded_exact+x.wayback_embedded_normalized;
  lines.push('| '+p.officialName.replace(/\|/g,'')+' | '+direct+' / '+meta+' / '+replay+' | '+
   x.same_host_path_unverified+' | '+x.no_same_host_in_selected_linked_sources+' |');
 }
 lines.push('\n**Remaining investigation after V2:** page-level URL recovery is not quote-by-quote evidence equality. Exact text, candidate attribution, source-capture historical as-of, session eligibility, archive payload digests, and genuinely unrepresented source families require their own reviewed work. No ingestion, database writes, feature promotion or forecast/model changes. Keep issue #864 open.');
 const body=lines.join('\n');
 if(body.length>60000)throw Error('Sanitized report longer than fixed scope cap');
 return body;
}
