# Historical Deep expansion source bundle

## Purpose

The 24-event historical Deep expansion cohort was frozen before any new evidence lookup. This workstream now asks a narrower, outcome-blind question: **which exact official Minnesota House committee-minutes pages existed before those already-selected floor votes and named those already-selected bills?**

This is source collection only. It does not extract directional signals, score floor outcomes, change the production targeter, tune evidence weights, or write to the database.

## Frozen cohort lineage

`data/evaluation/historical-deep-expansion-source-lineage-v1.json` pins the cohort artifact by workflow run, artifact ID, artifact name, head SHA, and SHA-256 artifact digest. The workflow verifies that digest before source discovery begins.

The source collector never replaces a selected event because another bill is easier to source. A selected event with no qualifying official page remains in the output with `sourceIds: []`.

## Archive enumeration policy

Source policy: `house-committee-archive-enumeration-v1`.

The collector does **not** use bill search, general web search, search rankings, present-day commentary, floor outcomes, or known Deep signal locations. It enumerates fixed historical Minnesota House committee ID ranges:

- `92001` through `92099` for 2021–22;
- `93001` through `93099` for 2023–24.

For each ID it fetches the official `house.mn.gov/Committees/home/<id>` page and accepts the page only when it explicitly identifies the expected historical regular session. Committee home pages are routing/index pages only; they never become Deep evidence.

The collector extracts the meeting links published on each accepted committee home page. Legacy House minute links are normalized to the exact canonical identity:

`https://www.house.mn.gov/committees/minutes/<committee>/<meeting>`

Only those exact official pages are fetched for evidence collection.

## Strict pre-vote proof

A minute page is eligible only when all of the following hold:

1. the committee home page supplies a meeting date;
2. the exact minute page independently identifies the same regular session and meeting date;
3. the home-page date and minute-page date agree exactly;
4. the minute date is strictly before the selected floor-vote date;
5. the page contains the exact frozen bill identifier (`HF`/`SF` plus bill number);
6. the request finishes on the same exact official committee/meeting identity;
7. the response is HTML, non-empty, and no larger than 5 MB.

Same-day committee minutes do not qualify under the current prior-day historical cutoff.

## Frozen source content

Every retained page records:

- exact source URL and final URL;
- session, committee ID, meeting ID, and meeting date;
- matched frozen cohort event(s);
- fetch timestamp and HTTP/content metadata;
- byte length;
- SHA-256 of the exact response bytes;
- full frozen HTML content.

One committee page may legitimately match more than one already-frozen event. The source is stored once and carries all matching stable event keys.

The artifact also reports every selected event, including events with zero qualifying source pages, so archive availability is measurable rather than silently conditioned on successful discovery.

## Failure behavior

The collector fails rather than accepting an obviously incomplete archive crawl when it cannot discover a minimum viable set of historical committee pages/minute links, when the official site repeatedly returns rate-limit/server failures, or when no qualifying pre-vote source exists anywhere in the frozen cohort.

Individual exact minute URLs returning 404, an unprovable date, or a date mismatch are recorded as diagnostics and excluded from evidence.

## What comes next

After this bundle is frozen, a separate evaluation step may run the existing deterministic committee-roll-call extractor over the frozen pages and the frozen Quick member manifests. Only after extraction is frozen should later floor outcomes be joined for scoring.

No evidence weight or production targeting change belongs in the same experiment.
