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

Operations exposes the latest pipeline status plus current finance, campaign-site, member-primary, news, and web-covered-member counts. It also reports news-member coverage, last-batch news insert/failure/no-lead counts, and the age of the prospective public-evidence corpus so evidence accrual can be monitored without manual database inspection. Public evidence ingestion is expected to remain useful even when every item is non-mechanical.

## Quick evaluation boundary

The first Quick experiment tests whether aggregate campaign-finance activity contains **possible incremental signal** beyond the serving model. It is intentionally an exploratory upper-bound sensitivity screen, not a promotion-eligible backtest.

`public-evidence-quick-screen-v1` replays the serving Quick pipeline with 180-day member-history decay and adds a ridge-regularized logistic offset using four aggregate finance activity features whose underlying transactions occurred before each target vote:

- log receipts;
- log campaign spending;
- log independent spending magnitude;
- log finance transaction count.

It explicitly excludes donor names, employers, donor categories, spender identity, inferred issue alignment, campaign-site text, and news text. Training uses 2021-22; regularization selection uses 2023-24; 2025-26 is descriptive only.

The screen is **not leakage-safe for historical public availability** because the CFB bulk transaction date does not establish the item-level filing/publication timestamp. Accordingly:

- `promotionEligible` is false;
- `shadowNominationEligible` is false;
- `prospectiveShadowNomination` is forced false in the production artifact;
- any apparent improvement is labeled a `hypothesisSignal` only;
- serving Quick probabilities never change and `productionAction` remains `none`.

The recurring pipeline solves this going forward: finance, campaign-site, member-primary, and news evidence receive durable `fetched_at` provenance prospectively. Once future forecasts resolve, those truly as-of captures can support an eligible Quick evidence evaluation.

News, campaign-site, and member-primary material also begin as a prospective durable corpus because VotePredict does not have comparable timestamped historical captures. They must not be backfilled from the present web and treated as though they were known before old votes.

### Prospective evidence-availability test

`public-evidence-prospective-v1` is frozen before 2027-28 outcomes. Every eligible Quick member prediction records a non-serving snapshot of the durable evidence that had actually been fetched by that forecast's as-of timestamp: source counts, source diversity, finance/campaign/member-primary/news mix, and newest-evidence age. The snapshot contains no text-derived stance, no probability adjustment, and no outcome information.

The primary future test is whether evidence availability/freshness identifies forecast strata with different residual magnitude or calibration, plus whether collection coverage is imbalanced by chamber or party. The protocol is not promotion-eligible and cannot authorize a directional evidence-to-vote transformation. Minimum primary scoring is deferred until at least 40 resolved forecasts, 2,000 member outcomes, and 50 members with captured web evidence are available. Operations reports whether eligible future Quick revisions successfully received the snapshot.

## Existing commands

- `npm run data:cfb:snapshot` builds the normalized Minnesota Campaign Finance and Public Disclosure Board snapshot through the shared TypeScript live-source parser.
- `npm run data:cfb:evidence -- --snapshot=PATH` maps that snapshot to current memberships and persists campaign-finance context when run in an environment with a routable database connection.
- `npm run data:evidence:bills -- --manifest=PATH` ensures official Revisor bills referenced by an evidence manifest have canonical bill/version records and deterministic features.
- `npm run data:evidence:curated -- --manifest=PATH` fetches and hashes each manifest source, resolves targets, and persists evidence.
- `npm run data:evidence:legislators` imports the versioned official committee/leadership context manifest using stable `lrl:` legislator keys.

## Initial curated tranches

`data/evidence/gambling-curated-v1.json` contains sourced member statements, official Revisor authorship records, and documented MIGA/SMSC gaming-policy positions. All remain inspectable and non-mechanical unless a separate evaluated model says otherwise.

`data/evidence/legislator-context-v1.json` adds official 2025-2026 House member profiles and Senate committee rosters for the initial identity-gap cohort. Committee assignments and leadership roles remain neutral context and do not imply support or opposition.