# 2021–2025 Senate media remarks: offline attribution audit v1

**Issue:** #864, bucket D. **Scope:** Minnesota Senate 2021–2025.
**Status:** offline audit code and synthetic tests. The 44 curated archive publishers and **948 verified live Wayback media context rows** are **not** 948 senator statements. The verified protected [capture-year aggregate](senate-media-verified-live-neon-capture-year-counts.md) establishes **2021:131, 2022:182, 2023:155, 2024:118, 2025:208** = **794** in-study rows, plus **154 outside 2021–2025** (not proved entirely 2026); summed within-year distinct source documents = **688** (not globally deduplicated). No original text or human-verified named quote was produced by the aggregate.

## Correct distinction: article discovery vs quoted senator

The existing local/trade news collector intentionally records neutral context, zero model weight, and member-name mentions as discovery signals. A senator named in a headline, mentioned anywhere in an article, or linked to a bill does not thereby become the speaker of any text in the article.

The offline audit distinguishes the four human-review dispositions:

- **contextual_mention:** source mentions a senator, but does not contain a verified exact attributable passage.
- **speaker_ambiguous:** possible remarks, but captions, pronouns or source text do not independently identify who spoke.
- **source_unavailable:** original archived article body cannot be verified, even if a source URL or excerpt exists.
- **exact_named_quote:** exact archived source bytes independently match SHA-256, contiguous original passage contains quotation and explicit named speaker attribution, senator identity/term is verified, issue classification is reviewed, original contains independent publisher date proof, and separate archived public-by date is proven.

### First-party, speaker-labeled MPR transcripts: explicit review mode (#987)

The current [February 19, 2024 MPR Grant Hauschild interview](https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south), [February 7, 2023 Mary Kunesh interview](https://www.mprnews.org/episode/2023/02/07/new-bill-would-keep-native-families-together-proponents-say) and [April 24, 2025 Susan Pha interview](https://www.mprnews.org/episode/2025/04/24/bill-granting-benefits-to-hmong-lao-veterans-passes-minnesota-senate) show **full-name transcript speaker labels** (for example `GRANT HAUSCHILD:`), which are not written inside reporter quotation marks. Previously the offline auditor would fail even a byte-authenticated original MPR transcript because its only direct-speech syntax rule required quotation marks.

For a **separately acquired and SHA-256-authenticated original archived MPR HTML page** with a visible `Audio transcript` section, a human reviewer may now explicitly specify `"quotePresentation":"speaker_labeled_transcript"` in a review already marked `"disposition":"exact_named_quote"`. The reviewer must supply the **full Minnesota senator's name followed by a colon** as `attributionCue` (not a surname or job title), the precise continuous `sourcePassage`, the exact direct `exactQuote` found **after that label and before any next full speaker label**, the reviewed issue, source-contained original publisher timestamp, serving membership and human reviewer identity/time. The original exact source SHA, archived capture/public-by, quote text, publication-day Senate membership and all existing neutral-context/date checks remain mandatory. Only **MPR News original `/episode/` or `/story/` pages** can use this exception. Others still use the quote-mark rule.

Without that explicit field, the existing `reported_quotation` mode remains the unchanged default, and reporter paraphrases **must still include an actual delimited direct-speech quotation**. A host's question, another interviewed person's answer, another senator's label, a reporter summary mentioning a senator, an absent transcript section, or a transcribed quotation not in the senator's own turn all fail closed.

**Temporal boundary:** MPR's own [February 7, 2023 original publisher page](https://www.mprnews.org/episode/2023/02/07/new-bill-would-keep-native-families-together-proponents-say) states that Minnesota Now **attempts to publish transcripts on the next business day after broadcast**. Consequently the publisher-displayed radio **broadcast/page date cannot establish when a specific version of a transcript became publicly available**. Use only the independently authenticated timestamp of the **exact archived page version** as a conservative historical public-by; do not promote a next-day or later transcript to a broadcast-day prediction. The audio file is also a **separate artifact**: the review result explicitly reports `archivedAudioIndependentlyAuthenticated:false` even if the **archived HTML transcript text** itself passed. A source-text quotation review does not certify that the audio bytes were independently checked or that the transcript was already present during live broadcast. No same-day model eligibility is created.

**Actual research status:** These current publisher MPR transcript examples are research leads; **no corresponding 2023, 2024 or 2025 original Wayback HTML/audio or private VotePredict source SHA has been authenticated** in this round. The new tests use fictional HTML and timestamps and are **not observed historical senator quotes**. The MPR `/episode/` discovery blind spot [#987](https://github.com/killjoy00/votepredict/issues/987) stays open. No production collector, seed, model, serving, score or persisted evidence was changed.

Synthetic *review format* only:

    {"sourceDocumentId":"source-synthetic","disposition":"exact_named_quote","quotePresentation":"speaker_labeled_transcript","membershipId":"membership-example","issueCategory":"immigration","exactQuote":"A synthetic senator's distinct words in their own turn.","sourcePassage":"GRANT HAUSCHILD: A synthetic senator's distinct words in their own turn.","attributionCue":"GRANT HAUSCHILD:","publisherPublishedAt":"2024-02-19T10:32:00-06:00","publicationDateProof":"content=\"2024-02-19T10:32:00-06:00\"","reviewedBy":"synthetic-reviewer","reviewedAt":"2026-10-10T19:00:00Z"}

**This illustrative record would NOT be accepted** unless all other original-source, authentic hash, term, passage and publication-date proof gates separately passed.

Named attribution and quote linkage require **human semantic review**. String matching verifies provenance but cannot replace the reviewer's substantive judgment. Anonymous captions, reporters' narration and quotations by other people always fail the senator-statement gate.

The report retains **two different dates**: the article's publisher publication date and the first independently demonstrated Wayback archive capture time (public-by). They are not interchangeable. Publisher metadata alone cannot backdate archived bytes. Same-day date-only forecasts remain ineligible. Even a passing verified quotation is neutral evidence in this audit: it is **not** automatically a vote stance, a claim of exact-bill support, or model training input.

## Files and private offline workflow

Both SQL files are documentation and SELECT-only export templates. Run only using a separately authorized **restricted SELECT-only** role. Do not run through GitHub Actions, and never post the private export, raw article bodies or private resulting report to public issues or workflow logs.

1. **scripts/export-senate-media-context-readonly.sql**: JSONL of original 44-source archived context identities, source SHA, URLs, publisher and archive timestamps, neutral flags and article mention leads. No full article text.
2. **scripts/export-senate-media-roster-readonly.sql**: JSONL of active Senate memberships by actual 2021–2025 calendar year, including term dates. Missing term boundaries stay unknown and prevent quote verification.
3. **Independent exact original snapshot bytes**: private JSONL with fields sourceDocumentId and rawBodyBase64. The base64 must encode the precise archived HTTP body originally hashed as source_documents.content_sha256. An excerpt, newly fetched live page or reconstructed article text is not proof.
4. **Human review verdicts**: private JSONL with sourceDocumentId, disposition and reviewer identity/time; named-quote verdicts additionally require membershipId, issueCategory, exactQuote, sourcePassage, attributionCue, publisherPublishedAt and publicationDateProof. Reviewer records should correspond to actual review of the original source.

Example review JSONL row, with *synthetic* illustrative values:

    {"sourceDocumentId":"source-1","disposition":"exact_named_quote","membershipId":"membership-23","issueCategory":"education","exactQuote":"Our schools need more funding.","sourcePassage":"Sen. Example said, \"Our schools need more funding.\"","attributionCue":"Sen. Example said","publisherPublishedAt":"2023-04-02T12:00:00Z","publicationDateProof":"content=\"2023-04-02T12:00:00Z\"","reviewedBy":"reviewer-id","reviewedAt":"2026-10-10T19:00:00Z"}

Example local execution (optional --reviews and --snapshots may be omitted for a **discovery-only** report):

    node --import tsx scripts/audit-senate-media-remarks-offline.ts --context PRIVATE-context.jsonl --roster PRIVATE-roster.jsonl --reviews PRIVATE-reviews.jsonl --snapshots PRIVATE-snapshots.jsonl --output PRIVATE-report.json

The checker makes no DB or network connection. It does not create an evidence row, write to production, update forecasts or schedule an ingestion job. Local output is non-overwriting and written with file permissions 0600.

## What its numbers do and do not measure

- It enumerates **44 publisher seeds × 5 archive years = 220 publisher/year slots**. A zero means not observed in the *supplied* bounded archive export, not zero articles published.
- It enumerates senator/year rows from the **supplied roster**, not an assumed complete statewide list. Member-name matches remain contextual discovery leads, never direct quotes.
- It counts context evidence items separately from distinct article source documents, supplied original snapshots, unreviewed articles, invalid provenance, verified named quotations and unverified review attempts. Multiple verified quotes in one article do not inflate the article count.
- It excludes out-of-scope 2026 evidence rows explicitly. A quote published in 2022 but first verified in a 2023 archive does not become proven pre-2023 evidence.
- Existing archive selection is bounded to one URL/year and up to 40 selected captures per publisher. Paywalls, missing archive snapshots, undated publisher articles, senator identity ambiguity and unsampled article URLs prevent a statewide completeness certificate.

## Remaining work and boundaries

This PR supplies the **reproducible attribution gate**, a senator/year and publisher/year missingness report, read-only export templates and synthetic regression tests. It does **not** conduct a private production export, acquire source article bytes, identify human-verified real quotes, reconcile all original source bodies with persisted DB rows, prove a full source denominator, or claim predictive lift.

Track D [#912](https://github.com/killjoy00/votepredict/issues/912) was **closed by the repository owner**; do not reopen it or interpret administrative closure as completion of quote/archive reconciliation. The specific MPR /episode/ [#987](https://github.com/killjoy00/votepredict/issues/987) and Minnesota Reformer /briefs/ [#946](https://github.com/killjoy00/votepredict/issues/946) source-acquisition issues remain open. Prior historical umbrella #864 was also closed without a comprehensive media evidence certificate. The existing historical feature freeze, Senate floor parser, training, serving, Vercel/Neon production records and schedulers are unchanged. No outreach to public agencies is authorized.

## Shared-surname and contradictory availability safeguards (Track D follow-up)

A human review cannot infer a unique speaker from a source saying only **“Sen. Surname”** if two different Minnesota Senate memberships in the article's publication year could have used that surname on that date. The offline verifier now treats that cue as **ambiguous** and records `ambiguous_senator_surname_requires_full_named_cue`; it does not arbitrarily select the first matching membership. The original article must contain an **explicit full-name speaker cue** to resolve that particular collision. A peer with unknown term boundaries is conservatively treated as potentially active; a peer conclusively out of term on the date does not create a collision.

The stronger deterministic check supplements—but does not replace—human semantic review, whose reviewer must still verify who actually spoke. A direct quotation attributed to “Sen. Surname” is never equivalent to knowing which senator spoke simply because the media collector mentioned an individual with that surname. Similarly, a given exact source-document ID cannot be simultaneously human-classified as **source unavailable** and accepted for an exact named quote; contradictory verdicts are rejected and must be resolved in the private review ledger. A single source can legitimately contain both neutral contextual mentions and a separately verified exact named quote.

These checks neither change the published statewide-media denominator (still **unknown**) nor add any quote to production, predict votes, alter models or access a database. The archive source bytes, member/year roster, and human reviewer record must first exist privately under the earlier `#904/#909/#916` gates.

## Repeated context-source provenance fails closed (2026-10-10 follow-up)

Multiple `evidence_items` context rows can point to the **same archived source document**, and one article can mention multiple different senators. Those rows count separately in the **context-row denominator** but are **one distinct archived source**, not multiple authenticated original articles or quotes.

The offline reviewer now checks neutral-context provenance **for every row** of a shared `sourceDocumentId` and accumulates all provenance problems at the source level. Previously, the same source ID with different context flags could overwrite the stored source reference: an invalid first row followed by a valid row could wrongly remove the earlier provenance failure from `reviewResults`. This order dependence is removed. Either ordering of a neutral and non-neutral context row marks the source invalid for exact quote approval; a benign second context retains both row observations but does not multiply a single reviewed quotation.

Source-level provenance fields (archived URL and capture time, original URL, SHA-256, publisher/seed identity, source kind, archive digest and publisher publication timestamp) must agree across all rows linked to the same source ID; contradictions **throw** rather than silently choose the last row's date. Context-level name mentions may differ between rows and remain *research leads*, not attributable speakers. The independent [private archive rehydration plan](senate-media-original-wayback-rehydration.md) also counts every evidence row before fetching each unique source once.

Tests use deliberately synthetic article text and records; they are **not** historical verified quotations. No private export, Wayback-original acquisition, approval of actual named remarks, production prediction update, or statewide publication denominator is implied.

## Timezone and publisher-local senator service days (2026-10-10)

Archived media has *three distinct clocks*: (1) a publisher's displayed local article day/clock, possibly **without a known timezone**; (2) a source-authenticated publisher timestamp with an **explicit UTC or numeric timezone offset**; (3) an independently recorded Wayback original snapshot/capture time, expressed in **UTC**. Do **not** silently interpret a publisher webpage's unzoned `4:10 p.m.` as UTC or as a confirmed publication instant. A displayed publication date is a research lead, not an independently proved archived public-by timestamp.

The offline named-quote verifier now requires an **explicit timezone** (`Z` or valid ±HH:MM) and a **real calendar date and clock** for publication times, evidence/capture timestamps and reviewer audit times. Zone-less values, invalid leap days, rolled-over month days, `24:00`, out-of-range offsets and unsupported fractional precision fail closed. The existing original article SHA, exact date proof, reviewer and independent archive capture requirements still apply. This is a strict evidence **safety gate**, not historical original capture discovery.

For **membership on the publication date**, use the source's explicitly zoned **publisher-local calendar day** rather than converting the same instant to a possibly different **UTC day**. For example, 2023-04-02 23:30 -05:00 occurs on April 3 in UTC but is an **April 2 article publication day**. A person sworn in on April 3 cannot be considered a senator at the April 2 publication based only on the UTC conversion. The same local-day rule applies when checking multiple potentially active senators with the same surname. It does **not** by itself certify a particular senator's precise oath time when that matters.

Regression tests are entirely synthetic and deliberately probe the edge across UTC midnight. Prior sample leads with displayed-only, timezone-unknown local publication clocks remain **unverified**, not automatically reclassified as valid quotes or forecast information. No changes to persisted evidence, production models, quote approvals, serving or the 2021–2025 study-year definitions are authorized by this stricter offline check.
