/**
 * Track D issue 987: exercise the focused public-only historical audit inside
 * existing repository CI on this single PR branch. On every other branch,
 * runs no network calls, downloads, or automatic production changes.
 *
 * GitHub workflow edits are not needed. This test safely fails rather than
 * inferring a member ballot or statement from unavailable external originals.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("focused 2022 Senate primary-roll evidence replay on research PR only", { timeout: 560_000 }, () => {
  const exactResearchPR =
    process.env.GITHUB_REPOSITORY === "killjoy00/votepredict" &&
    process.env.GITHUB_EVENT_NAME === "pull_request" &&
    process.env.GITHUB_HEAD_REF === "research/2022-sf2666-sf2575-sf2729-primary-votes";

  const isolatedEnv = { ...process.env };
  delete isolatedEnv.NODE_TEST_CONTEXT;
  const synthetic = execFileSync(process.execPath, [
    "--test",
    "tests/senate-media-2022-standalone-parents-bills-primary.test.mjs",
  ], { encoding: "utf8", timeout: 30_000, maxBuffer: 500_000, env: isolatedEnv });
  assert.match(synthetic, /# fail 0/);
  assert.match(synthetic, /# pass 10/);
  const real = execFileSync(process.execPath, [
    "--test",
    "tests/senate-media-2022-standalone-parents-real-receipts.test.mjs",
  ], { encoding: "utf8", timeout: 30_000, maxBuffer: 500_000, env: isolatedEnv });
  assert.match(real, /# fail 0/);
  assert.match(real, /# pass 9/);

  if (!exactResearchPR) return;

  const out = "artifacts/track-d-2022-parents-primary-standalone-live.json";
  const output = execFileSync(
    process.execPath,
    [
      "scripts/probe-senate-media-2022-standalone-parents-bills-primary.mjs",
      "--output",
      out,
    ],
    {
      encoding: "utf8",
      timeout: 525_000,
      maxBuffer: 3_000_000,
      stdio: ["ignore", "pipe", "pipe"],
      env: isolatedEnv,
    },
  );

  const data = JSON.parse(readFileSync(out, "utf8")) as {
    version: string;
    officialJournalOriginalPDFsAuthenticated: number;
    originalFirstPartyArticleVersionsReauthenticated: number;
    governmentBillPDFVersionDocumentsAuthenticated: number;
    verifiedTargetIndividualYesVotes: number;
    authenticatedNamedOriginalFirstBoundedQuotationSegments: number;
    journals: Array<{
      date: string;
      status: string;
      rawPdfSha256: string | null;
      rawPdfBytes: number | null;
      pages: number | null;
      rollResults: {
        matchedExpectedAggregateRolls: Array<{
          bill: string;
          senator: string;
          certifiedPersonalVote: string;
          currentBillAnchorIsClosestPrecedingSenateFile: boolean;
          currentBillThirdReadingPassageContext: boolean;
        }>;
      } | null;
    }>;
    archived: Array<{
      status: string;
      errorClass?: string;
      rawOriginalHtmlSha256: string | null;
      bytes: number | null;
      observedQuotedSpeakerBoundaries: {
        visibleBoundedSpeakerOpeningQuotes: Array<{
          senator: string;
          quoteSegmentSha256: string | null;
          exactIssuerSurnameImmediatelyAfterClosedOriginalQuote: boolean;
        }>;
      } | null;
    }>;
    texts: Array<{ bill: string; status: string; rawPdfSha256: string | null; bytes: number | null; errorClass?: string }>;
    noVoteInferredFromSponsorshipOrChamberTotals: boolean;
    noOriginalPublisherFirstPublicPostingMinuteProved: boolean;
    noMprBensonKunesh2022RecordedInterviewUsed: boolean;
    noProductionsSourceRowReadOrTrainingLabelApproved: boolean;
    noOriginalJournalPdfBillPdfRawHtmlOrFullQuotePersisted: boolean;
    noCollectorDatabaseIngestionModelServingScoringOrForecastChanged: boolean;
  };
  assert.equal(data.version, "track-d-2022-parents-education-three-standalone-primary-journal-v1");
  assert.equal(data.journals.length, 2);
  assert.equal(data.archived.length, 2);
  assert.equal(data.texts.length, 3);
  assert.equal(data.noVoteInferredFromSponsorshipOrChamberTotals, true);
  assert.equal(data.noOriginalPublisherFirstPublicPostingMinuteProved, true);
  assert.equal(data.noMprBensonKunesh2022RecordedInterviewUsed, true);
  assert.equal(data.noProductionsSourceRowReadOrTrainingLabelApproved, true);
  assert.equal(data.noOriginalJournalPdfBillPdfRawHtmlOrFullQuotePersisted, true);
  assert.equal(data.noCollectorDatabaseIngestionModelServingScoringOrForecastChanged, true);

  const summaryLine = output
    .split("\n")
    .find((line) => line.startsWith("TRACK_D_2022_STANDALONE_BILLS_PRIMARY="));
  assert.ok(summaryLine, "expected only public source metadata log");
  console.log(summaryLine);

  // Live replay must match independently SHA-pinned original PDF / quote
  // metadata from the first successful source run. Never accept a merely
  // green synthetic run as historical ballot or source authentication.
  const pinned = JSON.parse(readFileSync(
    "docs/evaluation/senate-media-2022-sf2666-sf2575-sf2729-original-rolls-20261012.json", "utf8",
  )) as {
    senateJournalOriginals: Array<{
      sourceDate: string;
      fullDownloadedOriginalPdfSha256: string;
      originalRawPdfBytes: number;
      originalPdfPages: number;
      namedOriginalSenateBallots: Array<{
        originalBill: string; senator: string; verifiedDirectOriginalNamedMemberVote: string;
      }>;
    }>;
    historicalPublisher: {
      firstCapture: { rawOriginalHtmlSha256: string; rawHtmlBytes: number };
      namedOriginalIndividualFirstCompleteClosedQuoteSegments: Array<{
        senator: string; firstClosedOriginalQuoteSegmentRawSha256: string;
      }>;
    };
    selectedHistoricalOriginalBillTextVersions: Array<{
      bill: string; fullOriginalPdfSha256: string; originalPdfBytes: number;
    }>;
  };
  assert.equal(data.officialJournalOriginalPDFsAuthenticated, 2);
  // A 2022 archive replay can be temporarily unavailable even when the
  // exact SHA-pinned original was authenticated in merged #1235 and in
  // successful complete live CI #38291698878. Fail on digest mismatch;
  // do not recode transport failure as historical original nonexistence.
  // The original complete 3/3 bill version PDF hashes were already verified
  // in CI #38291698878 and permanently pinned below. A subsequent network
  // fetch failure does not invalidate those immutable earlier receipts.
  // But fetched changed/misidentified/truncated PDFs must never be accepted.
  assert.equal(data.verifiedTargetIndividualYesVotes, 3);
  for (const j of data.journals) {
    const p = pinned.senateJournalOriginals.find(x => x.sourceDate === j.date);
    assert.ok(p);
    assert.equal(j.rawPdfSha256, p.fullDownloadedOriginalPdfSha256);
    assert.equal(j.rawPdfBytes, p.originalRawPdfBytes);
    assert.equal(j.pages, p.originalPdfPages);
    const expected = p.namedOriginalSenateBallots;
    const actual = j.rollResults?.matchedExpectedAggregateRolls ?? [];
    assert.equal(actual.length, expected.length);
    for (const x of expected) {
      const a = actual.find(y => y.bill === x.originalBill && y.senator === x.senator);
      assert.ok(a);
      assert.equal(a.certifiedPersonalVote, x.verifiedDirectOriginalNamedMemberVote);
    }
  }
  const original = data.archived[0];
  if (original.status === "original_first_party_html_SHA1_SHA256_authenticated_quote_boundaries_inspected") {
    assert.equal(data.originalFirstPartyArticleVersionsReauthenticated >= 1, true);
    assert.equal(data.authenticatedNamedOriginalFirstBoundedQuotationSegments, 4);
    assert.equal(original.rawOriginalHtmlSha256, pinned.historicalPublisher.firstCapture.rawOriginalHtmlSha256);
    assert.equal(original.bytes, pinned.historicalPublisher.firstCapture.rawHtmlBytes);
    const quotes = original.observedQuotedSpeakerBoundaries?.visibleBoundedSpeakerOpeningQuotes ?? [];
    assert.equal(quotes.length, 4);
    for (const p of pinned.historicalPublisher.namedOriginalIndividualFirstCompleteClosedQuoteSegments) {
      const q = quotes.find(x => x.senator === p.senator);
      assert.ok(q);
      assert.equal(q.quoteSegmentSha256, p.firstClosedOriginalQuoteSegmentRawSha256);
      assert.equal(q.exactIssuerSurnameImmediatelyAfterClosedOriginalQuote, true);
    }
  } else {
    assert.equal(original.status, "archived_first_party_original_missing_or_mismatch_unknown");
    assert.equal(original.rawOriginalHtmlSha256, null);
    assert.equal(original.observedQuotedSpeakerBoundaries, null);
    assert.match(original.errorClass ?? "", /^(official_original_http_unknown|official_original_redirect_unknown|fetch failed|This operation was aborted)/);
    assert.equal(data.authenticatedNamedOriginalFirstBoundedQuotationSegments, 0);
    console.log("TRACK_D_2022_PRIOR_AUTHENTIC_FIRST_PARTY_ORIGINAL_REPLAY_TEMPORARILY_UNAVAILABLE; original pinned in merged #1235 and successful live original CI #38291698878; NOT ABSENT");
  }
  const previouslyAuthenticatedBills = pinned.selectedHistoricalOriginalBillTextVersions;
  assert.equal(previouslyAuthenticatedBills.length, 3);
  let replayedBills = 0;
  for (const p of previouslyAuthenticatedBills) {
    const matches = data.texts.filter(x => x.bill === p.bill);
    assert.equal(matches.length, 1, "each exact previously proven SF text must have one replay result");
    const b = matches[0];
    if (b.status === "current_exact_92nd_bill_version_sha256_and_text_inspected") {
      assert.equal(b.rawPdfSha256, p.fullOriginalPdfSha256);
      assert.equal(b.bytes, p.originalPdfBytes);
      replayedBills++;
    } else {
      assert.equal(b.status, "official_bill_pdf_unavailable_or_unparsed_unknown");
      assert.equal(b.rawPdfSha256, null, "parsed or identity-mismatched body must fail, not be treated as an outage");
      assert.equal(b.bytes, null, "partial fetched PDFs are never approved as transient failures");
      assert.match(
        b.errorClass ?? "",
        /^(fetch failed|official_original_http_unknown|official_original_redirect_unknown|This operation was aborted)$/,
        "only a network-level replay failure can defer verification to existing immutable original receipts",
      );
      console.log("TRACK_D_2022_BILL_PDF_REPLAY_NETWORK_UNKNOWN=" + p.bill +
        "; previously authenticated complete source SHA pinned in CI #38291698878, NOT missing historical evidence");
    }
  }
  assert.equal(replayedBills, data.governmentBillPDFVersionDocumentsAuthenticated);

  // Every verified direct vote must be from a 2022 official original government
  // journal and the exact standalone bill's separate passage record.
  for (const journal of data.journals) {
    for (const vote of journal.rollResults?.matchedExpectedAggregateRolls ?? []) {
      if (vote.certifiedPersonalVote !== "UNKNOWN") {
        assert.equal(
          journal.status,
          "official_original_pdf_sha256_and_exact_member_rolls_inspected",
        );
        assert.match(journal.rawPdfSha256 ?? "", /^[a-f0-9]{64}$/);
        assert.equal(vote.currentBillAnchorIsClosestPrecedingSenateFile, true);
        assert.equal(vote.currentBillThirdReadingPassageContext, true);
      }
    }
  }
});
