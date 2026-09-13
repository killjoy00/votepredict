# Historical Deep House Journal mechanics v1

This stage is a **development-only, outcome-blind** inventory of procedural mechanics found in the immutable Minnesota House Journal source bundle frozen by the preceding House Journal source stage.

It exists to answer a narrower question than the Deep forecast itself: **what bill-specific procedural states can be recovered deterministically from official pre-vote House Journals without looking at the later floor outcome?**

## Frozen input

The workflow pins and verifies the exact source artifact before classification:

- source schema: `historical-deep-house-journal-source-bundle-v1`
- source policy: `house-journal-archive-enumeration-v1`
- source workflow run: `34777844843`
- source artifact: `10323714365`
- source head SHA: `504abcb59e82132a570bc106b4e696065ea4cd08`
- source artifact SHA-256: `935f2ffcbdf70ab67efbb47e0f9607debcae90e2b872220ec0edc916dbf90387`

That source bundle already fixes the 24-case development cohort, exact official Journal URLs, strict pre-vote dates, matched case lineage, and original raw-byte SHA-256 provenance for each source page. This mechanics stage does not discover new sources or replace cases.

## Parser policy

Parser: `deterministic-house-journal-mechanics-v1`

The parser uses bill-anchored phrases and bounded Journal sections to classify only procedural mechanics attributable to the frozen bill. The initial taxonomy includes:

- introduction and first-reading referral;
- standing-committee recommendation to the General Register;
- committee re-referral for additional review;
- second reading;
- Rules Committee Calendar for the Day designation;
- House/Senate companion substitution after Chief Clerk comparison;
- conference-committee appointment;
- conference report receipt;
- interchamber amendment messages;
- direct report to the House;
- laid-on-table motions;
- reaching the third-reading/final-passage procedural stage; and
- author additions.

The parser deliberately distinguishes process direction from final-passage prediction. A mechanic may advance, continue, defer, or merely administer the legislative process without implying how the bill or any member will ultimately vote.

## Safety boundary

Every observation is emitted with:

- `mechanicallyActionable: false`
- `finalPassageInference: "none"`
- `outcomeUse: "none"`
- `holdoutUse: "none"`
- `probabilityAction: "none"`

The workflow has no database access, no live Deep calls, no external source discovery, no outcome artifact, and no holdout artifact.

The final-passage-stage rule records only that the bill reached the procedural phrase indicating third reading/final passage. It does **not** consume the ensuing roll-call result. This is important because a House Journal can contain the target outcome on the same page even though the source page itself was selected only because its date precedes the frozen evaluation vote.

## Cross-bill contamination guard

House Journals contain many bills on a single page, so proximity alone is not enough. The parser therefore avoids broad keyword windows:

- committee-report rules require the frozen bill to be the explicit bill referred to that committee;
- Calendar designation searches only the bounded list following the exact Rules Committee designation phrase and stops at the next Journal section;
- companion substitution requires the frozen bill both in the Chief Clerk comparison and in the substitution motion;
- direct actions such as second reading, report to House, or table motions require the frozen bill in the same deterministic phrase.

## Integrity model

The downstream workflow verifies the **entire immutable #170 artifact** against GitHub Actions' SHA-256 digest before downloading or classifying it, then verifies that the bundle's recorded code SHA matches the pinned source-head lineage. Each source also retains the raw-byte SHA-256 created when #170 fetched the official HTTP response.

The raw-byte page hash is provenance, not something this stage can recompute from the JSON `content` string: decoding arbitrary historical HTML bytes to UTF-8 and serializing them into JSON is not guaranteed to preserve the original byte sequence. The mechanics stage therefore validates the recorded per-page hash shape and carries it into every observation rather than pretending that re-encoding decoded text proves raw-byte identity. Artifact-level SHA-256 verification is the integrity boundary for the frozen JSON content consumed here.

Classification also fails closed if a source is no longer strictly before the frozen floor-vote date.

## What this stage does not establish

This artifact does **not** establish that any Journal mechanic predicts final passage, improves Quick, improves Deep, should change a member-level signal, or deserves an evidence weight. It also does not change production forecasts.

A later, separately frozen evaluation may score these mechanics against development outcomes. Any actionability decision must occur only after that evaluation and must remain separate from the extraction code and frozen source lineage.
