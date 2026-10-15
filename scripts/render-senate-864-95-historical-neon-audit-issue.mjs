/** #864: keyless, Neon-secret-free issue report of 95 PUBLIC source-row labels
 * and bounded numeric counts. Never render raw DB names/URLs/excerpts/IDs.
 */
import {readFileSync} from 'node:fs';
import {assertManifest,validatePublicReport}
 from '../src/evidence/senate-864-95-historical-source-neon-parity.mjs';
const SRC='data/evaluation/senate-864-95-served-historical-candidate-research-manifest-v1.json';
const safeRun=/^https:\/\/github\.com\/killjoy00\/votepredict\/actions\/runs\/\d+$/;
export function render95Issue({verifyResult,readOnlyResult,safe95B64,safeFailurePhase,runUrl,mainSha}){
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
 const body=lines.join('\n');
 if(body.length>45000)throw Error('Sanitized report longer than fixed scope cap');
 return body;
}
