# #946 — offline public media URL coverage shadow audit (2021–2025)

**Scope:** compare the *existing* 44 publisher seed URL prefixes and actual topical path-selection rules against public 2021–2025 Senate news research leads. **No changes to production collector, Neon, archives or forecasts.**

## Reproduce locally, no credentials or Internet connection

Run from the VotePredict repository root:

```bash
node --import tsx scripts/report-senate-media-public-discovery-gaps.ts
```

The command reads the existing 14-lead [`senate-media-public-article-discovery-2021-25.json`](senate-media-public-article-discovery-2021-25.json) fixture and runs `diagnoseMediaPublicDiscoveryPaths`. It checks two *sequential* collector gates: (1) whether the public original URL begins with the **configured** Wayback seed prefix; and (2) whether the same URL survives the collector's **actual topical path-priority filter**. It produces aggregate counts and lead IDs on stdout. No HTTP GET, source-body parsing, SQL, archive capture, data promotion, output artifact or database write is performed.

Passing the first gate is **not enough**: current archive collection requires both. A public article about Minnesota politics can therefore be excluded even if its live publisher URL is inside the archive seed prefix, when its slug lacks the collector's trigger words. One concrete audit fixture is the [MPR News June 10, 2021 school-choice report](https://www.mprnews.org/story/2021/06/10/gop-wants-private-school-option-walz-dfl-push-back). Its public URL starts with the `mpr-news-story-archive` seed prefix but does not match existing topical URL hints. This is a reproducible path-selection limitation, not proof that VotePredict lacks the article under another URL or collection.

## Minnesota Reformer /briefs/ and dated-url aliases

The existing `minnesota-reformer-article-archive` prefix starts at `https://minnesotareformer.com/202`; the 14-lead discovery sample includes four 2021/2023 `/briefs/` URLs that cannot satisfy that prefix. Further `/briefs/` Senate-story leads from 2022, 2024 and 2025 are tracked in [#946](https://github.com/killjoy00/votepredict/issues/946) but **not** silently counted in the 14-lead fixture.

An article can also have a `/briefs/slug/` URL and a `/YYYY/MM/DD/slug/` URL. The helper emits only a **candidate alias pair** when the *same publisher host*, *same displayed publication day* and *exact same final slug* occur in both path forms. It does **not** declare equal archived article bytes, identical underlying article, an archived capture, or a deduplicated source document. Synthetic tests enforce that distinction. Any actual archived equivalence must be verified separately using source URL mapping, original Wayback bytes/digest and independently confirmed capture-time public availability.

## Correct interpretation

| Statistic | What it means | What it does **not** mean |
| --- | --- | --- |
| Outside configured seed prefix | A current public original URL in the research fixture is unreachable by this seed query | An article is absent from all archives or persisted VotePredict records |
| Excluded by topical URL-path selection | The collector's current `pathPriority` routine drops this URL | The page cannot contain policy content or Senate remarks |
| Excluded by either gate | URL cannot survive the current two-step collector selection | The article is historically available before a forecast cutoff or is a missed unique story |
| Candidate alias pair | Same publisher, displayed day and slug across `/briefs/` and dated path | One authenticated original article or a proven duplicate |

**All reported denominators are restricted to the selected public research sample.** Historical publication availability, archive/public-by dates, original SHA fingerprints, senator identity at publication, human named quote verification, full publisher publication counts and statewide completeness remain **unknown**. No quote, stance or model feature is added.

### Later controlled follow-up

After separate source availability confirmation, compare potential missed original URLs with the separately authorized private VotePredict source-document export. Deduplicate candidate URLs before any count increase; independently verify a Wayback capture existed before the relevant prediction cutoff; check membership and human reviewer attribution before treating any article text as a senator statement. A production archive seed change requires separate explicit review; this audit alone does not authorize it.
