# 2021–2025 Senate media remarks: offline attribution audit v1

**Issue:** #864, bucket D. **Scope:** Minnesota Senate 2021–2025.
**Status:** offline audit code and synthetic tests. The 44 curated archive publishers and the previously counted 948 historical context items are **not** 948 senator statements. Those 948 span three legislative sessions: 313 (2021–22), 273 (2023–24), 362 (2025–26 combined). A 2025-only count has not been proven.

## Correct distinction: article discovery vs quoted senator

The existing local/trade news collector intentionally records neutral context, zero model weight, and member-name mentions as discovery signals. A senator named in a headline, mentioned anywhere in an article, or linked to a bill does not thereby become the speaker of any text in the article.

The offline audit distinguishes the four human-review dispositions:

- **contextual_mention:** source mentions a senator, but does not contain a verified exact attributable passage.
- **speaker_ambiguous:** possible remarks, but captions, pronouns or source text do not independently identify who spoke.
- **source_unavailable:** original archived article body cannot be verified, even if a source URL or excerpt exists.
- **exact_named_quote:** exact archived source bytes independently match SHA-256, contiguous original passage contains quotation and explicit named speaker attribution, senator identity/term is verified, issue classification is reviewed, original contains independent publisher date proof, and separate archived public-by date is proven.

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

Keep #864 **open**. The existing historical feature freeze, Senate floor parser, training, serving, Vercel/Neon production records and schedulers are unchanged. No outreach to public agencies is authorized.
