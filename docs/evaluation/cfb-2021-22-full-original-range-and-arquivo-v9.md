# #864 Track B — June 2022 original-source alternate Range transport and Arquivo.pt index (V9)

**Scope:** Minnesota Senate historical campaign-finance 2021–2025. Public-only historical original file integrity research. No user contact or email, private Neon/database access, CFB evidence row writes, eligibility backfills, model/training/serving, production deployment, 2027 or scheduler. #864 remains OPEN.

## Why V9 is technically different

V4 [public historical source verification](https://github.com/killjoy00/votepredict/actions/runs/38285676317) independently authenticated the **June 6, 2022, 10:30:37 UTC** CFB candidate-expenditure original by full raw Wayback replay and exact CDX SHA1 plus independent SHA256. The immutable complete original checkpoint is:

- CFB original download selector **-1890073264** under the official **cfb.mn.gov** candidate finance URL.
- Entire **41,138,871-byte** original body, CDX SHA1/Base32 **GMF33XY3X4LNADGCPU52JWEDWRHXE23V**, independent full-body SHA256 **6d9d9061a0a4080083b62b352763697852105c10b3ab1d1bef96fea25ce4d00b**.
- Official canonical source parser emitted **18,497 records from 2021, 3,241 from 2022**, and **21,495 distinct canonical row keys**.
- This establishes a source captured and publicly retrievable by June 6 2022 in V4; it does **not** establish the first exact public date or that stored evidence rows actually match original source keys.

V6 protected [run 38297382142](https://github.com/killjoy00/votepredict/actions/runs/38297382142) attempted the exact V4 raw **whole-file GET** again, but got a Wayback replay HTTP HOLD; candidate contribution versions' exact live CDX lookups also held. No protected DB contact occurred. V7's independently indexed Common Crawl July 4 2022 candidate source pointers and V8's body checks separately established **WARC-Truncated** contribution and intermittently 503 expenditure WARC; those historic Common Crawl crawls had a [1 MiB cap on crawled content](https://www.commoncrawl.org/errata/content-is-truncated). A 1 MiB WARC cannot reproduce the verified 41 MB official expenditure original.

**V9 now tries a distinct transfer mechanism:** ten requests for *exact byte ranges* (4 MiB max each) for the previously proven full original, in ephemeral public GitHub CI RAM, using Range and identity content encoding. It checks **HTTP 206**, exact Content-Range from 0 to 41,138,870, exact total length and actual chunk bytes, disallows any redirect/encoded/oversized/partial body. The **complete reconstructed 41,138,871 bytes** must match BOTH previously authenticated exact SHA1 and SHA256 and reproduce the three independent canonical row counts. It tries at most two fixed raw Wayback historical replay URL **scheme variants**, first HTTPS-original, then HTTP-original only if needed; it never alters official selector or target capture timestamp. A matching alternative-scheme body is evidence of exact **body identity** to the prior V4 original, **not** a separately verified alternate URL's historical-publication timestamp. A 200 full-body fallback is deliberately not silently accepted: this is a Range-only probe. Failure is HOLD, not lost finance transactions.

This method is an **experimental possibility**: Wayback may not support Range, may return HTTP 503, may redirect to a nearest capture, or may not expose a complete file in chunks. Strict error outcomes are intentional. The previous V4 proof is not weakened if V9 holds.

## New independent archive index path

Unlike the previous V7 Arquivo.pt exact **Memento time-map** requests, which returned 404, V9 tests a separately documented **Arquivo.pt CDX Server API endpoint** at https://arquivo.pt/wayback/cdx documented in the [Portuguese open-data portal](https://dados.gov.pt/en/datasets/cdx-server-api-url-search). It checks two official selectors in **HTTPS/HTTP original URL forms** under a fixed historical 2021–2025 request window, capped at 16 rows and 48 KB of index metadata per response; it validates exact host/path/query, archive capture timestamp, CSV MIME, 200 status and a Base32 source-index SHA1. Captures found there are **independent archival metadata leads only**; the full original CSV bytes and exact source timeline would need separate verification. A valid zero-result CDX answer or a 404 is only for that bounded query and cannot establish that a report or transaction was absent.

Archive-It's [official CDX/C help](https://support.archive-it.org/hc/en-us/articles/115001790023-Access-Archive-It-s-Wayback-index-with-the-CDX-C-API) explicitly reports its public **/all** collection CDX endpoint temporarily blocked for DDoS as of July 2026, so V9 does not retry that known blocked endpoint without a specific public collection ID. Ordinary Wayback's generic [CDX search interface](https://github.com/internetarchive/wayback/blob/master/wayback-cdx-server/README.md) usually omits physical WARC filename/offset needed for direct underlying raw storage fetch; do not presume a public WARC download path exists for the V4 source from digest alone.

## Read-only job, confidentiality, and interpretation

This is a PR-only workflow, source code is on a reviewed feature branch before merging, CI uses zero protected credentials, no Neon calls, no external contacts/emails, no original CSV/WARC artifacts, no original body/transaction identity log output. Only fixed source-version, count/hold reason and non-sensitive original digests are printed.

Run:

    node --import tsx --test tests/cfb-864-full-original-alternatives-v9.test.mjs
    node --import tsx scripts/prove-cfb-864-full-original-range-arquivo-v9.mjs

The VERIFIED_IDENTICAL_V4_JUNE_ORIGINAL status is **only** produced after all requested Range parts, whole-body double digest, size and original 2021–22 canonical parsing agree. Without those, explicit range HOLDS or complete-ranges-but-digest-or-parse HOLD is emitted. For Arquivo, an INDEPENDENT_ARCHIVE_INDEX_LEAD_ONLY status is **not** a verified CSV original body or any private evidence row match.

**Still unverified and unchanged:** V6 candidate source-to-stored finance observation parity (earlier *bounded* sample: 909 archive-labelled candidate expenditure / 1,140 archive-labelled contribution observations); 2,448 older filing-derived historical disclosure/public-by claims; original/amended 2023–25 PDF versions and Senate-specific actual required/received filer-reporting obligations; deployed serving database binding; complete official 2021–25 Senate coverage. V5 IE 101/101 bounded stored parity remains independently proved. Any protected private count-only audit needs a **new reviewed merged-main, uniquely marked, first-attempt READ ONLY repeatable-read transaction and explicit rollback** and source-version-specific keys; V9 does not run one or change as-of flags.
