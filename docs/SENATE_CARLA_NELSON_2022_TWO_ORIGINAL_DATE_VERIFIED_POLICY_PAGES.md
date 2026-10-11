# #864 — Carla Nelson: six real pre-election 2022 campaign issue positions, personally verified service and original dates

**This is the first 2022 original candidate-owned campaign issue page in the reviewed historical Senate issue source corpus with two independently hash-verified Wayback captures and exact issue excerpts.** The candidate **Carla J. Nelson** is independently shown by the official [Minnesota LRL Senate service directory](https://www.lrl.mn.gov/legdb/senate_dir) to have served the actual Minnesota Senate (Senate SD24 from 2023 onward, among earlier service). The original public LRL HTML was acquired on **2026-10-10 23:26 UTC**, SHA256 and observedAt pinned. This source acquisition and policy audit contains *no candidate who never actually served*.

Two original candidate-owned campaign site HTML pages were downloaded during [GitHub Actions source run 38098726687](https://github.com/killjoy00/votepredict/actions/runs/38098726687) (source artifact **11686238089**, 30-day retention):

| URL | Original Wayback capture, valid until Nov 8, 2022 election | Original HTML SHA-256 | Original Wayback CDX SHA-1 Base32 |
| --- | --- | --- | --- |
| [Carla Nelson Home Page 2022 V1](https://www.carlanelson.com/home-page/) | **2022-10-06 16:15:31 UTC** | \`39f1dd1d361456b051f9fbbaf92ac6f9424a7beba45ae8ffb5434d153c43c906\` | \`LYTTCLQFRT22CFWZ2BKA77VM6QIZ557W\` |
| [Carla Nelson Home Page 2022 V2](https://www.carlanelson.com/home-page-2/) | **2022-10-06 16:48:45 UTC** | \`4ec5bafb34be6a02083cc198dedf60f5c189032ba501aa087092b8fb3373a63b\` | \`XFGJ6BST44KA7UYXVEUASNP3TJITVUYI\` |

The independent original Wayback CDX indexes and the real original-page HTML were separately downloaded and match SHA-1 Base32 on **both versions**. The original HTML was actually retrieved **2026-10-11 00:32–00:33 UTC** (the evening of October 10, Central time). That observation time is preserved separately. The ZIP's exact SHA256 is \`35b3fa5ae6d07dcdb54d3824247766a7341ce461cd5f291e9f5a177b3f659cea\`; acquired manifest SHA256 \`419622088610695228bfac20146a4e3d3aa4ff58c9eff804cc7d1ebba4b61ed1\`. Permanent provenance in \`data/evaluation/senate-carla-nelson-2022-dated-original-platform-excerpts-v1.json\`; original HTML remains the public GitHub artifact, not copied wholesale into Git.

### Six candidate-owned policy priorities, same text in both 2022 captures

The original campaign platform contains self-reported policy priorities and descriptions of claimed past work, grouped by issue heading. Small exact quote fragments and conservative interpretation are pinned in source JSON.

| Issue family | Candidate campaign's original described position |
| --- | --- |
| Taxes | Relief from taxes, specifically Social Security benefits income taxation |
| Public safety | Tougher sentences for repeat violent offenders and support for more police |
| Healthcare | Protections against surprise medical billing and better care access |
| Education | Parental involvement, reading/literacy support and school resources |
| Environment | Environmental protection, described as science-driven |
| Transportation | Funding for roads and bridges, including township roads and Highway 14 |

**Every one of six short snippets occurs literally in original visible campaign issue section text in BOTH original 2022 captures.** The validator must independently verify all **12 occurrence checks**, the two full original HTML SHA256 hashes, the two historical CDX digest base32 SHA1 hashes, 2022 capture dates, original URL and official LRL senator service. The six issue-specific words are historically attested **no later than 2022-10-06 16:15:31 UTC**, reaffirmed by independent capture at 16:48:45 UTC. This is a conservative public-by for these exact words; it does NOT prove first original website POST date, that a proposed legislative bill was supported, or any historical feature readiness.

### Reproducible, fail-closed original byte checks

\`\`\`bash
node --import tsx scripts/audit-senate-carla-2022-original-policy-excerpts-offline.ts \
  --2022-original-a /originals/carla-2022-page-a-wayback-20221006161531.html \
  --2022-original-b /originals/carla-2022-page-b-wayback-20221006164845.html \
  --official-lrl-html /lrl/mn-lrl-official-senate-service-directory.html \
  --official-lrl-metadata /lrl/mn-lrl-official-senate-service-directory-audit.json \
  --output /tmp/senate-carla-2022-historically-attested-issue-excerpt-report.json
\`\`\`

The internal, one-time PR workflow \`.github/workflows/audit-carla-2022-original-platform-proof.yml\` independently downloads **both** raw public original artifacts from prior successful actions #38098726687 and #38094976711, repeats every digest and original snippet check and saves a sanitized 30-day report of six short excerpts and conservative date semantics. The CLI refuses to overwrite source originals; every output is 0600, no network, secrets, Neon/Vercel or scheduled collector. Without both original source files, the audit reports **not locally reverified** rather than inventing a source-proof success.

**Do not directly ingest into forecasts or existing production evidence rows.** This source proves a dated original 2022 candidate-authored campaign issue claim from a real served senator. Membership-to-production-source evidence IDs, true first publishing dates, original 2020/22 SOS campaign filing website field and statewide 2021–25 member-by-year issue position completeness remain unresolved. Issue #864 stays OPEN.
