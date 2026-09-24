# Public source expansion program

Tracking: issue #355.

## Goal

Expand VotePredict's durable public-information corpus across eight source families while preserving the same strict event-time rule used by lifecycle research: a historical model may use an item only when an independent source proves it was public before the model cutoff.

The expansion does not change serving probabilities. All new evidence defaults to context / non-mechanical until separately evaluated.

## Frozen availability hierarchy

1. **Official publication timestamp** — dated government/legislative source intended as a historical record.
2. **Independent archive capture** — exact Internet Archive capture timestamp; the capture timestamp is the availability bound.
3. **Regulatory filing/disclosure timestamp** — filed report/notice/publication date from the regulator; transaction/event dates alone do not qualify.
4. **Publisher page metadata** — accepted for verified publisher/member-primary pages when the publication timestamp is internally carried by the source.

For date-granular lifecycle replay, evidence must satisfy `available_date < cutoff_date`. Same-day material is excluded unless the historical source proves ordering precisely enough for the relevant model.

## Eight families

1. **Wayback campaign sites.** Backfill SOS-filed campaign home/issues/news/about pages using CDX capture timestamps and preserve original URL, archive URL, capture time, digest, fetched content hash, and supersession.
2. **Independent expenditures.** Preserve candidate, spender, amount, support/oppose designation where reported, entity type, reporting source, and disclosure availability. Row-level CFB ingestion is implemented separately from availability proof: transaction rows are stored immediately with `asOfEligible=false` until a regulator filing/notice proves when the information became public. Money remains context and never becomes an inferred legislative stance.
3. **Finance disclosure timing.** Reconstruct report/notice availability from CFB historical disclosure calendars, filed reports, and large-contribution notices. The frozen rule requires an actual filing/notice publication date; due dates and contribution/receipt/transaction dates are insufficient. For electronically filed campaign-finance reports, CFB board records state publication occurs the day after filing, so `availableOn = filedOn + 1 day` only when `filedOn` is independently proved. Large-contribution-notice proofs must separately prove the notice's filing date and official publication/availability date; a contribution or receipt date carried by the notice/viewer must never be substituted for either one. Regulatory disclosure proofs must retain an official `cfb.mn.gov` HTTPS provenance URL; third-party pages cannot establish CFB filing or publication timing.
4. **Endorsements/questionnaires/scorecards.** Preserve organization, candidate/member, question/response or endorsement record, publication/archive date, source hash, and neutral provenance. Do not infer legislative votes from an endorsement.
5. **Lobbying subjects/associations.** Preserve association/principal, lobbyist, specific subject/category, spend/report period, filing/publication date, and source. Do not infer member stance from lobbying relationships. The Board's July 10, 2024 minutes identify the January-May 2024 lobbyist activity report as the first report to disclose specific lobbying subjects, so the program must not fabricate pre-2024 specific-subject history. For subject/category evidence, report periods, activity dates, statutory due dates, and principal expenditure years are provenance only; historical eligibility requires separately proven filing and regulator publication dates, or an independent pre-cutoff archive capture. The campaign-finance electronic-report next-day publication rule is not assumed for lobbyist reports.
6. **Committee/hearing material.** Ingest agendas, schedules, testifier lists, written testimony/handouts, amendments, minutes, roll calls, bill summaries, and fiscal-note revisions with official dates and bill resolution.
7. **Member/caucus archives.** Backfill House/Senate/caucus publications natively where historical dates survive, otherwise require pre-cutoff archive captures.
8. **Targeted local/trade news.** Expand curated publisher discovery around Minnesota legislators/bills/issues; historical use requires publisher metadata or a pre-cutoff archive capture. The initial archive collector rotates bounded MPR News, Minnesota Reformer, MinnPost state-government, and Finance & Commerce publisher prefixes. It rejects fetched snapshots that do not contain explicit Minnesota legislative language or an HF/SF identifier. For archived pages, the exact Wayback capture timestamp is the availability bound; publisher dates are preserved separately as provenance and never substitute for archive availability. These records remain neutral context with `modelWeight=0`, `sameDayEligible=false`, and no inferred member or bill stance.

## Modeling boundary

The source expansion may support new research feature matrices, but retrospective 2021-26 results remain development/robustness evidence. Governing confirmation stays prospective. No automatic model promotion or serving change is allowed.
