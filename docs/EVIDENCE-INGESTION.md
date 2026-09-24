# Durable evidence ingestion

VotePredict stores reusable public evidence in the existing `source_documents` and `evidence_items` tables. UI-only constants are not a durable evidence source.

## Rules

1. **Retain source provenance.** Every imported source is fetched or derived from an identified URL and stored with a SHA-256 content hash.
2. **Resolve targets conservatively.** Member and bill targets must resolve uniquely. Ambiguous targets are recorded as unresolved rather than guessed. Curated member evidence should prefer the durable LRL legislator external key (`lrl:<id>`) when available so display-name changes do not break identity.
3. **Make refreshes idempotent.** Evidence receives a deterministic ingestion key scoped to source content, resolved target, claim, date, and extractor version. Re-running the same import reuses the prior evidence item.
4. **Version mutable evidence explicitly.** Repeated aggregates and mutable campaign pages receive a stable `evidenceSeriesKey`. When a newer source snapshot creates a new item in the same series, the new item points to the older current item with an `evidence_relationships.relation_kind='supersedes'` relationship. Reads that represent current evidence exclude superseded items.
5. **Separate evidence from model effect.** Importing an item does not make it a forecasting feature. New public evidence defaults to `mechanicallyActionable: false` until a separately frozen evaluation or prospective protocol justifies model use.
6. **Treat money as context, not stance.** Campaign receipts, campaign expenditures, and independent expenditures are factual context. They do not imply a legislator's vote position by themselves.
7. **Treat campaign claims as primary-source claims.** A campaign site establishes what a campaign publishes, not whether the claim is independently true and not how the legislator will vote.
8. **Treat news discovery separately from verification.** GDELT is a discovery index. A hit is not durable evidence until VotePredict fetches the underlying article, verifies the target member is actually named, and preserves publication/capture provenance.
9. **Prefer official identity sources.** Campaign-site URLs come from Minnesota Secretary of State candidate filings rather than guessed domains or general web search.
10. **Preserve as-of boundaries in modeling.** Historical use requires evidence that the information was public before the forecast cutoff, not merely that the underlying event happened before it.

## Relationship to Quick and Deep

Durable evidence ingestion does **not** require a Deep forecast. The durable store is a shared substrate that can be populated on a schedule and then displayed in member profiles, issue dossiers, Operations, or Quick forecast explanations.

The serving Quick model remains `member-eb-v1.2-decay180` and does not mechanically consume general durable public evidence. That separation is intentional: storing a source-backed fact does not prove that using it as a numeric feature improves forecasts.

Deep adds a separate targeted research layer for consequential/uncertain members. It can perform fresh research, classify directional evidence, apply the evidence-impact policy, and create an immutable Deep revision. Deep being unavailable does not stop the public evidence pipeline.

## Unified public evidence pipeline

The recurring non-Deep pipeline combines four streams behind a common provenance and durability contract.

### Campaign sites

Minnesota Secretary of State candidate filings are the campaign-site discovery authority. VotePredict retrieves the state House/Senate filing results, matches a filed candidate to a current membership only when chamber, district, first name, and last name line up, and persists the filed campaign URL as official registry context. Email-like values in the filing Website field are explicitly rejected rather than treated as web hosts.

For uniquely matched sites, the crawler captures the campaign home page plus a bounded set of same-site pages that look most useful for legislative context: issue/platform/policy pages first, then press/news/update pages, then about pages. Each captured page is source-hashed and mutable paths use stable evidence-series keys so later captures supersede rather than overwrite history.

Campaign pages are stored as `member_primary` neutral context. They are not automatically converted into support/opposition evidence.

### Member-primary publications

VotePredict now maintains a dedicated member-primary source registry for the active Minnesota Legislature instead of relying on general web search to discover legislator statements.

- Minnesota House members use the government-hosted `house.mn.gov/members/profile/news/{memberId}` archive derived from the legislator's durable `lrl:` identity.
- Minnesota Senate DFL members are resolved through the caucus senator directory, then their caucus-hosted profile and publication results are verified against member identity and district.
- Minnesota Senate Republican members are resolved through the caucus senator directory, and the per-senator profile's "News from Senator" links are used as the article index.

The registry page is stored separately from individual publications. Publication pages are accepted only after the fetched page verifies the target member; Senate DFL items additionally require a matching member byline. Each accepted item is source-hashed, timestamped, stored as `member_primary` neutral context, and assigned a stable evidence-series key so edited pages supersede older captures without erasing history.

These publications establish what a member or office published. They do not independently verify every factual assertion in the publication and they do not automatically imply a future vote position. They remain `mechanicallyActionable: false` until a separately frozen prospective evaluation justifies mechanical use.

### News

News discovery uses GDELT DOC 2.0 and Bing News RSS as complementary discovery surfaces. VotePredict does not trust either index as evidence: every discovered URL must resolve to an underlying publisher page, the page is fetched through the hardened public fetcher, and the article is accepted only when its readable text contains an unambiguous recognizable name for the target member.

Discovery expands stored legislator names into bounded aliases that remove middle initials and normalize suffix placement, so records such as `Jennifer A McEwen`, `D. Scott Dibble`, and `Jr. Bidal Duran` can still find publisher coverage using common public name forms. Bing retrieval is capped per member before the group cap is applied, preventing one well-covered member from consuming the entire batch. GDELT and Bing results are unioned rather than treating Bing as an all-or-nothing fallback. If GDELT returns a rate-limit response, the runtime temporarily backs it off and continues with Bing instead of repeatedly consuming the batch window on known-throttled requests.

Publication time comes from article metadata when available, with the provider timestamp retained only as a fallback. Discovery provider, title/domain, query-member attribution, and publication-date source remain in metadata. General news remains non-mechanical durable context until prospective coverage and evaluation justify anything more.

### Campaign finance

The existing official Minnesota Campaign Finance and Public Disclosure Board bulk-data path is part of the same public evidence program. It refreshes:

- candidate contributions/receipts;
- candidate general expenditures/contributions made;
- independent expenditures affecting candidates.

Current production aggregates retain source hashes, cycle metadata, top-level descriptive breakdowns, and explicit supersession lineage. Money remains neutral context; donor identity, employer, contribution amount, spender identity, or independent spending is never directly translated into a vote stance.

CFB bulk rows expose transaction dates, while ordinary campaign-finance information is generally disclosed through periodic reports and some large contributions have separate faster notice rules. A transaction date therefore does **not** prove the item was already public on that date. VotePredict preserves this distinction in model evaluation.

## Fetch hardening

Arbitrary public URLs are treated as untrusted input. The shared fetcher:

- allows only HTTP(S);
- resolves DNS and rejects localhost, private, link-local, loopback, and other non-public destinations;
- revalidates every manual redirect destination;
- caps redirect count, response bytes, and request duration;
- accepts only text/HTML-like content for the first implementation;
- canonicalizes URLs and strips common tracking parameters;
- computes the durable SHA-256 from the fetched response body;
- extracts readable text, title, publication metadata, and same-page links without executing page scripts.

The crawler is intentionally bounded rather than exhaustive. One bad site or article does not fail the other evidence streams.

## Production cadence

`.github/workflows/public-evidence-refresh.yml` invokes the protected production runtime every six hours and after a successful production deployment. The job pulls production authentication privately and calls `POST /api/operations/public-evidence-refresh`; database work occurs inside the deployed Vercel runtime where the Neon Marketplace connection is routable.

Current-member web work is rotated by least-recent public-evidence capture. Production now requests the endpoint maximum of 24 memberships per run, so the 200-member active legislature is revisited in roughly nine scheduled batches rather than seventeen. Each pass may retain up to four recent member-primary publications and three verified publisher-news articles per member. Campaign-finance refresh is folded into the same run when the last successful live finance refresh is older than the configured freshness threshold, avoiding repeated bulk downloads on every web batch.

Operations exposes the latest pipeline status plus current finance, campaign-site, member-primary, news, and web-covered-member counts. It also reports news-member coverage, last-batch news insert/failure/no-lead counts, the age of the prospective corpus, and the number of current Quick Evidence candidate items/members. Candidate counts are distinct from serving mechanically-actionable counts. Public evidence ingestion remains useful even when an item has no serving model impact.

## Quick Evidence candidate

VotePredict now has one unified non-serving evidence candidate: `quick-evidence-v1`. Serving Quick remains `member-eb-v1.2-decay180`; the candidate is computed after the immutable Quick revision is persisted and is stored beside the serving probability in `forecast_member_predictions.context`. It never overwrites or serves the Quick probability.

The candidate uses a single feature vector. The first directional inputs are intentionally narrow:

- verified bill-specific direct or related statements from member-controlled House/Senate/campaign pages, extracted only when the member attribution, explicit support/opposition language, and an exact current-session bill identifier occur locally together;
- existing bill-specific directional evidence that already clears the evidence impact policy;
- official prior passage votes by the same legislator on the same bill or its recorded companion, strictly before the forecast cutoff.

The candidate also records campaign-finance volume, campaign-site/member-primary/news counts, source diversity, freshness, conflict status, prior same-bill non-passage vote counts (amendment, motion/procedural, and other YEA/NAY), and a fail-closed `billAuthor` flag. Historical authorship is reconstructed from the official Revisor current-author roster by reversing dated author-added/stricken actions on or after the forecast date; ambiguous roster identity makes the bill ineligible, and same-day author changes are excluded because historical action timestamps are date-granular. These fields have zero directional weight until separately validated. A YEA or NAY on an amendment or procedural motion is not automatically treated as support or opposition to final passage. Donor or lobbying relationships, party identity, generic news sentiment, and campaign-finance magnitude likewise do not imply a vote stance.

Directional candidate items created by the public crawler are stored with `quickEvidenceCandidate=true` and `mechanicallyActionable=false`. That distinction is deliberate: Quick Evidence may evaluate them in its shadow under its frozen policy, while Deep and serving Quick continue to treat the underlying item as non-mechanical.

The initial candidate reuses the existing `logit-evidence-v1` contribution function and caps the *combined* evidence adjustment at ±1 logit. The cap prevents several correlated evidence items from overwhelming the serving historical/analogue model during evaluation.

### Prospective Quick Evidence protocol

`quick-evidence-prospective-v1` supersedes the earlier availability-only `public-evidence-prospective-v1` before activation. At supersession there were zero 2027-28 Quick revisions and zero captures under the old protocol, so no prospective cohort was redefined after outcomes or observations existed.

Every eligible 2027-28 Quick member prediction now records the same unified feature vector plus:

- the serving base probability;
- the non-serving candidate probability;
- uncapped and applied evidence logit deltas;
- evidence counts and conflict state.

All durable evidence rows must have been fetched by the forecast as-of timestamp, and any publication timestamp must also be no later than the cutoff. Revisor authorship has the same prospective rule: its official status observation must have been fetched by the forecast as-of timestamp and its identity reconstruction must be complete. Capture is outcome-blind and automatic promotion is forbidden.

Primary prospective scoring waits for at least 40 resolved forecasts, 2,000 member outcomes, and 50 members whose candidate received directional evidence. The required comparison is paired serving Quick versus Quick Evidence overall and among actually moved members, with calibration/error slices by evidence type, source quality, freshness, chamber, party, and conflict status.

### Structured legislative diagnostic

The unified program also evaluates historically reconstructable prior same-bill non-passage votes without giving them production weight. `quick-evidence-legislative-screen-v1` uses only official bill-linked member votes dated strictly before the target floor-vote date. Same-day records are excluded because the historical corpus does not preserve vote time.

The screen records six feature families: amendment YEA/NAY, motion-or-procedural YEA/NAY, and other recorded YEA/NAY. Counts are log-transformed and tested as a bounded ridge-logistic offset on top of the serving Quick probability. Training uses 2021-22, regularization selection uses 2023-24, and 2025-26 remains descriptive. Regardless of result, these ambiguous vote types remain zero-weight in `quick-evidence-v1` until a separate frozen decision changes that policy.

### Finance diagnostic

`public-evidence-quick-screen-v1` remains an exploratory component diagnostic inside this single Quick Evidence program. It tests whether aggregate campaign-finance activity may contain incremental signal, but it is not a second candidate and cannot promote independently. The screen is not leakage-safe for historical public availability because transaction dates do not establish item-level filing/publication timestamps. It therefore remains hypothesis-only with `productionAction=none`.

## Public source expansion

The eight-family historical/public source expansion is tracked in issue #355 and specified in `docs/evaluation/public-source-expansion-program.md`. Shared historical availability and Internet Archive CDX handling live in `src/evidence/historical-public-availability.ts` and `src/evidence/wayback.ts`. Archive capture time, regulator filing/disclosure time, official publication time, or verified publisher metadata—not the underlying event date—controls historical eligibility.

## Existing commands

- `npm run data:cfb:snapshot` builds the normalized Minnesota Campaign Finance and Public Disclosure Board snapshot through the shared TypeScript live-source parser.
- `npm run data:cfb:evidence -- --snapshot=PATH` maps that snapshot to current memberships and persists campaign-finance context when run in an environment with a routable database connection.
- `npm run data:evidence:bills -- --manifest=PATH` ensures official Revisor bills referenced by an evidence manifest have canonical bill/version records and deterministic features.
- `npm run data:evidence:curated -- --manifest=PATH` fetches and hashes each manifest source, resolves targets, and persists evidence.
- `npm run data:evidence:legislators` imports the versioned official committee/leadership context manifest using stable `lrl:` legislator keys.

## Initial curated tranches

`data/evidence/gambling-curated-v1.json` contains sourced member statements, official Revisor authorship records, and documented MIGA/SMSC gaming-policy positions. All remain inspectable and non-mechanical unless a separate evaluated model says otherwise.

`data/evidence/legislator-context-v1.json` adds official 2025-2026 House member profiles and Senate committee rosters for the initial identity-gap cohort. Committee assignments and leadership roles remain neutral context and do not imply support or opposition.
### Structured public-data expansion

VotePredict captures six additional official public-data families through the structured-public pipeline:

- recorded House floor-amendment proposer and disposition context;
- House/Senate conference-committee appointments;
- named-member, exact-bill remarks attributed in official legislative reporting, with the extractor compatible with caption/transcript text when a verified source is available;
- Minnesota Secretary of State prior-general-election district contest context;
- nonpartisan House Research bill summaries and official Legislative Budget Office fiscal-note context;
- named-member, exact-bill Minnesota House committee roll calls from official committee-minute pages.

Every item is stored through the durable evidence layer with a source hash, capture time, exact bill/member resolution where applicable, and `mechanicallyActionable=false`. The unified `quick-evidence-v1` vector records counts/flags for these families at zero directional weight. Amendment outcomes do not imply final-passage stance; conference appointment does not imply support; district election margins are electoral context rather than ideology; fiscal magnitude does not imply support/opposition; generic speech/reporting mentions are not promoted to directional evidence; and committee AYE/NAY records describe support/opposition to the recorded committee motion only, not an automatic final-passage stance.

The recurring public-evidence refresh rotates a bounded bill batch so bill-specific House/fiscal sources do not create an unbounded crawl. Election and conference sources are hash-deduplicated. Official Session Daily is the initial recurring speech/reporting source. House committee collection enumerates the official current-legislature committee-minutes index, fetches only a bounded recent meeting window, and reuses `deterministic-house-committee-roll-call-v2` plus `mn-house-procedural-mechanics-v1`. A committee record is eligible for a Quick Evidence shadow only when its official meeting date is strictly before the forecast UTC calendar date; same-day records remain excluded because minute timing is date-granular. Senate video-caption parsing remains conservative because the Legislative Reference Library warns that the automatically generated captions can contain errors and misprints; caption-derived content must retain that provenance and remains non-mechanical.

### Committee-action expansion

The frozen broad House committee-roll-call diagnostic cleared its historical thresholds, so House committee rolls now qualify for zero-weight prospective capture before any 2027-2028 Quick revision exists. This does not authorize a serving weight. Senate committee-minute ingestion remains deferred: official Senate digital minutes are filed with the Legislative Reference Library on a delayed schedule, so a future Senate implementation must separately freeze its observation/provenance policy before activation.
