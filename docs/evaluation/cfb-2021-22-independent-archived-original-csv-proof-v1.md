# #864 Track B — 2021–22 candidate finance public archived CSV original-body proof V1

**Status: source-only independent recovery attempt, no private database access or row repair.** Parent #864 remains OPEN; no serving, model, forecasting, scheduling, deployment, outreach or 2027 work.

## Why this source check is needed

A successful, bounded, protected metadata-only [V3 audit](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6126760508) found 2,150 eligible Senate-membership-linked evidence *observations* with archived-bulk upper-bound **stored proof labels** (2,049 candidate contribution/expenditure, 101 independent expenditure). In all 2,150, old `archiveCapturedAt`, `availableAt` and `published_at` agree at the calendar-day level. Those fields are not an independent original Wayback snapshot hash; the SQL read-only V3 query neither fetched original source bytes nor performed archive/CDX row parity. The separate 2,448 v1–v6 eligible observations are filing-derived and are **not** fixed by this task.

The original 2021–22 candidate archived-CSV research writer `scripts/probe-cfb-bulk-wayback-upper-bound.ts` used two *historically documented* official CFB campaign-finance download selectors. These selectors have external provenance pointers in the public February 2023 `irworkshop/accountability_datacleaning` commits. The new source verifier **does not presume** the currently served URL or a Wayback redirect represents the original historic CSV:

| Bounded original download type | Official historical fixed selector |
| --- | --- |
| Candidate contributions | `cfb.mn.gov/.../campaign-finance/?download=-2113865252` |
| Candidate expenditures | `cfb.mn.gov/.../campaign-finance/?download=-1890073264` |

The historical selectors are **research leads**. They are neither the full original archived CFB source catalog, nor proof that their captures cover all private archived claims, nor the legally required filing/report denominator. This first pass **does not** include the 101 IE-labelled claims; that archive used a separate old download catalog and requires a separately verified bounded original source selector.

## Independent public source validation

The public-only script `scripts/prove-cfb-864-public-archived-csv-source-v1.ts`:

1. Searches Internet Archive CDX for **each exact pre-approved historic official CFB URL**, 2022–2023, 200-status, indexed digest, fixed six-column schema, at most 60 indexed records. Rejects unknown hosts, paths, query selectors, dates, or extra CDX fields. A valid row must carry a 32-character uppercase Base32 SHA-1 CDX digest.
2. Attempts at most **two** capture `/web/<14digit>id_/original-url` raw replays per source. Bounds retrieved CDX JSON to 160 KB and each raw replay to 120 MB, with streaming read, redirect-host checks and timeouts; cannot read private environment files or connect to Neon.
3. Independently computes **SHA-1 Base32 on all received raw replay bytes** and requires equality to that precise capture's CDX digest. Any altered/redacted/replayed body, hash mismatch, oversized response, unavailable CDX or non-CSV file fails closed as a typed source **HOLD**, never as an authenticated original.
4. Independently hashes the complete bytes with SHA-256, then uses the existing canonical CFB contribution/expenditure CSV parsers to count **only 2021/2022** rows and distinct/repeated deterministic `rowKey` values. At least 25 parsed historical rows must exist before a source is treated as a candidate historical original.
5. Only emits the public original capture timestamp/day, official public original selector, original-source byte length, source SHA256 and CDX SHA1 Base32, and *aggregate* parsed row counts. It never commits or uploads archived CSV content, donors, vendors, amounts, personal data, source row keys, or parser raw fields.

A successful raw-body CDX match is **independent proof of the retrieved archived original content** but NOT proof that a particular privately stored evidence row exists in it, or that stored `archiveDigest` equals the independently recovered digest, or that the archived snapshot's public access date is the earliest first-public date. Internet Archive revisit records, decompressed or transformed wire bytes, unindexed historical versions and failures to retrieve a replay all remain potential HOLD cases; they are not zero evidence or zero obligations.

## One-shot execution and safety

- Synthetic tests independently calculate Base32 SHA1 using known fixtures, confirm valid original SHA256 and 2021/2022 parser counts, enforce exact source URL/CDX status/digest/timestamp identity, detect tampering and digest mismatches, and reject production/PR/unreviewed event execution.
- PR tests use **no database**; normal repo CI executes clean disposable PostgreSQL migrations and `npm run check`.
- A unique, reviewed merged-main marker `SENATE_864_CFB_2021_22_ARCHIVE_RAW_CSV_V1` and exact checked-out main SHA are required before the single public network run. Full repository check and `npm audit --omit=dev --audit-level=high` must pass on that merged SHA. A trusted owner exact #864 comment `SENATE_864_CFB_2021_22_CSV_V1_OWNER_ONE_SHOT` is a one-shot fallback only if the original push event is suppressed.
- Dedicated source workflow has **no secrets, Neon variables, database connections or private credential access**. It sends no artifacts or downloaded original bodies to GitHub. A distinct keyless issue reporter validates an exact finite JSON schema, preapproved streams, 2021–22 counts, official URL selectors and fingerprint syntax before writing a public count-only issue #864 receipt.
- An absent/failed CDX capture, mismatch, or unavailable Wayback endpoint is reported **HOLD**, not "no original CSV" or an empty 2021–22 filing inventory.

## Next protected reconciliation after actual original fingerprints

Use independently hashed source version(s) and parsed canonical row keys in an **approved separately reviewed protected READ ONLY** procedure, compare against the bounded private archive-labelled cohort *inside an aggregate-only SELECT*, and emit only counts for version-digest equality, exact row-key containment, matched/mismatched archived capture version, and hold buckets. No personal identifiers, donor names, amounts, original row bodies, private row keys, raw archive source URLs, or private CDX digests may be exported. Do not assume the first two verified public sources cover all private 2,049 candidate or 101 IE archive observations.

Any eventual historical eligibility correction, new as-of action, serving-reader policy change, scheduler or deployment requires separate owner approval. Existing `asOfEligible` rows are unmodified here.
