# Track D: historical original Jeremy Miller Enterprise Minnesota magazine interview speaker attribution

**Public original-source evidence reviewed October 11, 2026 (America/Chicago).** Scope is exactly **one already-discovered interview source URL**, two previously authenticated original HTML body versions, and one short policy-fragment statement candidate. This **does not** add a new distinct article URL or archived version to previous source inventory.

## The newly established historical individual printed-answer attribution

Enterprise Minnesota's ["Valuable Legislative Support" Q&A](https://www.enterpriseminnesota.org/articles/winter-2021/valuable-legislative-support/) is a publisher first-party printed interview identifying **Jeremy Miller** as the answering Minnesota state senator. The current page displays November 8, 2021; **that date has not been independently authenticated as the original web-publication day**.

Earlier [source-original work, PR #1208](https://github.com/killjoy00/votepredict/pull/1208), already independently authenticated the same original publisher URL at October 5, 2022 and January 31, 2023. It found the short policy cue on both archived page bodies but a generic name-nearby check returned false. This follow-up re-downloads **exact same historical originals**, cryptographically authenticates their previously pinned indexed SHA-1, raw SHA-256 and byte lengths, and applies a **stricter paragraph-bounded printed speaker attribution** test.

**Result:** in **both** authenticated originals, the normalized policy-fragment cue about wages and the free market appears inside the *same HTML `<p>` paragraph beginning `Miller:`*. Each original contains 61 inspected HTML paragraphs and 13 explicitly `Miller:`-labeled paragraphs. Exactly **one** inspected paragraph contains the selected cue and it begins with `Miller:`; the cue is **242 characters after the printed label**. No intervening interviewer label before the cue. The narrow selected passage is therefore attributable as an **original publisher-printed Jeremy Miller Q&A answer** that existed by **October 5, 2022**, not merely reporter paraphrase or an unlabeled article mention.

This is **printed editorial attribution**, not independent validation of voiced audio, full verbatim interview completeness, human-approved quote or an actual recorded legislative vote.

## Immutably verified original identities

| Source capture UTC | Independently indexed original SHA-1 base32 | Exact downloaded raw SHA-256 | Raw HTML bytes | Printed `Miller:`-same-paragraph cue |
| --- | --- | --- | ---: | --- |
| `2022-10-05T01:59:37Z` | `Z55ODFJANQV2PCOGS32J3IZE3GEL2DBR` | `28dada90321263cbf20a75cc9949c176527a97c2d89d33c0831ed63469167f36` | 65348 | **Yes**, 242 chars after label |
| `2023-01-31T06:39:41Z` | `KDDZ7S7QX7HETNGDLYUQLZUUTAO5275J` | `fb8fd1d2c4bd209e54a905d5b050310a520a46d46f82c3a910a7270c723f3251` | 67207 | **Yes**, 242 chars after label |

The original Wayback index provenance was established and pinned in PR #1208. This follow-up re-verifies exact `web/<capture>id_/<original URL>` bodies with manual redirect policy and SHA1/SHA256/byte identity checks; no archive alias or changed body passes the evidence gate.

## Evidence timing and permissible use

The current publisher's November 8, 2021 display date is not independently authenticated 2021 historical HTML. The earliest exact authenticated original for this policy fragment is **2022-10-05T01:59:37Z**. The statement is a research candidate potentially relevant to *later* legislative discussions about minimum wages and business regulation. It cannot be used as proven pre-vote evidence before October 5, 2022, nor automatically as a prediction input for any vote without a separately established bill/topic match and prediction cutoff.

Two archived versions are **one source/article and one short Q&A passage**, not two separate senator statement events. Net new original publisher URLs: **zero**. Net new archive versions: **zero**. Upgrade from prior research: **one selected historical original printed-answer fragment authenticated inside its individual's labeled paragraph**, across both already authenticated originals.

## Public workflow and regression tests

- First successful actual bounded replays: [GitHub Actions #38202630302](https://github.com/killjoy00/votepredict/actions/runs/38202630302) from initial successful source head `edbcc9df3978c6dcecba2e25e0bbc30e17a11ff5`, 7 synthetic adversarial tests passed, public metadata artifact ID `11726325317`.
- [Exact original and paragraph-boundary probe](../../scripts/probe-senate-media-miller-enterprise-original-qa-turns.mjs) uses explicit `Miller:` same-paragraph and label-after-event guards; synthetics reject reporter cues, host/interviewer labels, text outside the labeled paragraph, hidden scripts/template/styles, modified source hashes/bytes, redirects and unavailable archive states.
- [Immutable source receipt regression tests](../../tests/senate-media-miller-enterprise-qa-real-receipts.test.mjs) check both original UTC, indexed SHA-1/raw SHA-256/raw bytes against prior original proofs and check exact bounded attribution indicators.
- [Metadata-only JSON original speaker-turn receipts](senate-media-miller-enterprise-original-speaker-qa-20261011.json) preserve no full archived article HTML, audio or full Q&A turns.

## Outstanding evidence gaps

The independent **2021** first-published timestamp remains unverified; authentic historically dated radio/recorded speech is not available; the complete interview has not received human verbatim approval; no recorded member votes or private VotePredict source records have been inspected. The original 2022 Benson/Kunesh interview and exact audio binaries, 2023 Pratt original, 2025 individual Pha/Coleman originals, and the Hauschild February 2024 original speaker-transcript-vs-later-version gap remain open under [#987](https://github.com/killjoy00/votepredict/issues/987).

No changes to production database, collector, seed, schedule, ingestion, model, feature extraction or forecasting are authorized or made here.
