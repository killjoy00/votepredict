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

  const synthetic = execFileSync(process.execPath, [
    "--test",
    "tests/senate-media-2022-standalone-parents-bills-primary.test.mjs",
  ], { encoding: "utf8", timeout: 30_000, maxBuffer: 500_000 });
  assert.match(synthetic, /# fail 0/);
  assert.match(synthetic, /# pass 9/);

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
    },
  );

  const data = JSON.parse(readFileSync(out, "utf8")) as {
    version: string;
    journals: Array<{
      date: string;
      status: string;
      rawPdfSha256: string | null;
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
    archived: Array<{ status: string; rawOriginalHtmlSha256: string | null }>;
    texts: Array<{ bill: string; status: string; rawPdfSha256: string | null }>;
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
  console.log(summaryLine);
});
