import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const raw=readFileSync(new URL('../docs/evaluation/source-proof/senate-committee-141-dated-alternate-source-ledger.json',import.meta.url),'utf8');
const ledger=JSON.parse(raw);

test('pin 141 official dated source page recovery archive and four exact artifact hashes',()=>{
  const blob=createHash('sha1').update('blob '+Buffer.byteLength(raw)+'\0').update(raw).digest('hex');
  assert.equal(blob,'56177bbf81145017857246f1510ae9cebf5e1092');
  assert.equal(ledger.issue,864);
  assert.equal(ledger.originalIndexedMeetingCensus.runId,38065594898);
  assert.equal(ledger.originalIndexedMeetingCensus.artifactId,11674762938);
  assert.equal(ledger.originalIndexedMeetingCensus.electronicIndexedMeetings,1592);
  assert.equal(ledger.originalIndexedMeetingCensus.meetingsWithoutLinkedMinutes,141);
  assert.equal(ledger.firstFailedRedirectRun.reportedPageFailures,141);
  assert.equal(ledger.firstSourceRecoveredPagesRun.allPagesFetched,141);
  assert.equal(ledger.firstSourceRecoveredPagesRun.failureCount,0);
  const s=ledger.scopedSourceRun;
  assert.equal(s.runId,38076153790);
  assert.equal(s.pr,892);
  assert.equal(s.mainSha,'a022a8a5cef1375d22b9d9e1d2f4af74bd426db7');
  assert.equal(s.totalPages,141);
  assert.equal(s.exactDateSectionValidated,141);
  assert.equal(s.failedPages,0);
  assert.equal(s.possibleDatedSectionMediaLinkPages,138);
  assert.equal(s.distinctMediaCandidateUrlHashes,138);
  assert.equal(s.remainingPagesWithoutMediaCandidates,3);
  assert.equal(s.exactOfficialMinutesPdfLinksRecovered,0);
  assert.deepEqual(s.recordsByYear.map((x:any)=>[
    x.year,x.pagesFetched,x.datedSectionMediaPages,x.noMediaPages,x.otherMinutesKeywordLinks
  ]),[[2022,12,11,1,0],[2023,64,64,0,2],[2024,42,41,1,0],[2025,23,22,1,0]]);
  const sum=(key:string)=>s.recordsByYear.reduce((n:number,x:any)=>n+x[key],0);
  assert.equal(sum('pagesFetched'),141);
  assert.equal(sum('dateSectionsVerified'),141);
  assert.equal(sum('datedSectionMediaPages'),138);
  assert.equal(sum('failedPages'),0);
  assert.equal(sum('exactOriginalMinutesPdfLinksRecovered'),0);
  for(const x of s.recordsByYear) {
    assert.match(x.zipSha256,/^[a-f0-9]{64}$/);
    assert.match(x.jsonSha256,/^[a-f0-9]{64}$/);
    assert.ok(x.artifactId>0);
  }
});

test('date-scoped media links are NOT recordings, recorded votes or restored Minutes PDFs',()=>{
  const l=ledger.limits;
  assert.equal(l.mediaLinksAreUnverifiedCandidateUrlsNotVerifiedRecordings,true);
  assert.equal(l.datedPageHasMeetingHeadingButNotVoteContentProof,true);
  assert.equal(l.scopedCandidateLinkHashesNotFullExternalSourceCapture,true);
  assert.equal(l.categoryIsNotExactRecordedVoteProof,true);
  assert.equal(l.year2021PrintOnlyOfficialSourcesUnresolved,true);
  assert.equal(l.year2022PrintAndElectronicMayDiffer,true);
  assert.equal(l.officialAllRecordedVotesDenominator,null);
  assert.equal(l.officialAllCommitteeMeetingsDenominator,null);
  assert.equal(l.privateEvidenceDbReconciliationPerformed,false);
  assert.equal(l.productionDatabaseOrModelServingChanges,false);
});
