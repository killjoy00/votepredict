# #864: Four dated Nicole Mitchell Senate campaign issue excerpts in two original 2022 Wayback page versions

## Verified Senate service and pre-election original sources

The Minnesota Legislative Reference Library's original public Senate service directory confirms that **Nicole L. Mitchell actually served in the Minnesota Senate, SD47, 2023–2025**. The source audit re-hashes the official original directory acquired by [run 38094976711](https://github.com/killjoy00/votepredict/actions/runs/38094976711) (artifact 11685387674), and checks original html identity before any issue quote verification. No candidate who never actually served appears in this output.

The [source acquisition run 38100551887](https://github.com/killjoy00/votepredict/actions/runs/38100551887) recovered **two independent historic original page versions** for Nicole Mitchell's candidate-owned 2022 campaign priorities URL (https://www.nicolemitchell.org/priorities), both prior to the November 8 election. Original artifact ID **11687282664**, original ZIP SHA-256 **ec3d348fdf2f1fc5b94a30a0e78f153b5179805ef6f771d99e7dbed36a510857** and source manifest SHA-256 **bf84f6110b6984889f98228d848b53f5cddbe8787928b7a9c98836ee487c6c47**.

| Provenance attribute | February 2022 original | November 2022 original |
| --- | --- | --- |
| Original Wayback capture UTC | **2022-02-01T00:55:54Z** | **2022-11-05T16:03:01Z** |
| Original HTML SHA-256 | e88c085174a9e5cfbdc23216405254763d9816d83d31ef03d18a4975e47daa51 | a950fb05606c470c9ecc88a972afca887b42504130e603111d7e6dfafa57d73b |
| Independent CDX SHA1 Base32 | TVGIODYLDQ33ZPUY6522BDQDUKJ5CAA7 | HOD3ELVKGD5SN6NL5THHFTHCMUUWXGZ3 |
| Actual retrieval UTC | 2026-10-11T01:04:48.050Z | 2026-10-11T01:04:49.147Z |
| Source file in original GitHub artifact | mitchell-historical-20220201005554-0.html | mitchell-historical-20221105160301-1.html |

The separate original Wayback index digest SHA-1 and actual historic original replay byte SHA-1 **match** for both captures. The full HTML includes explicit "Nicole Mitchell for Minnesota State Senate" and original committee attribution. This proves original campaign page content **no later than** the verified 2022 capture timestamps, NOT the author's original first posting date or an official SOS historic filed website-field assignment.

## Four exact original candidate-authored positions, twice attested

Four short excerpts occur literally in **both** original historically captured policy pages. The earliest sampled proof is 2022-02-01 00:55:54 UTC for each:

| Issue family | Exact candidate-authored words | Conservative public-by time |
| --- | --- | --- |
| Education | fully fund our public schools | Feb 1, 2022 00:55:54 UTC |
| Education | strong supporter of Early Childhood Family Education (ECFE) | Feb 1, 2022 00:55:54 UTC |
| Environment | time is now to address climate change | Feb 1, 2022 00:55:54 UTC |
| Elections | free and fair elections in Minnesota | Feb 1, 2022 00:55:54 UTC |

Eight exact quote-span checks are performed by the offline audit (4 short excerpts × 2 independent original source copies), with each original page SHA-256 and historical CDX SHA-1 cross-check. The February 1 original about-page also exists in the archive bundle but has **not** been used to infer policy family positions. This report is limited to Nicole Mitchell, whose actual Senate service was independently proven; never-served candidate sources are excluded.

**Dating guarantee:** A historical original-page capture establishes these words appeared **by** the capture time. It does NOT prove that the author first posted them then. Current 2026 retrieval can only attest retrieval in 2026 without independently validated historic bytes. Do not retroactively infer 2020/22 original Minnesota SOS filed Campaign Website field or membership/evidence IDs from a verified campaign-site domain alone.

## One-click reproducibility, source report not production evidence

The dedicated PR-only public-artifact verification workflow downloads original Minnesota LRL service and both original archived HTML files. After validating original directory SHA-256, exact candidate service, two HTML SHA-256 digests and two original CDX SHA-1 values, it insists on all eight text-span checks and produces an exclusive 0600 audit report:

    node --import tsx scripts/audit-senate-nicole-2022-original-policy-offline.ts \
      --lrl-original /path/mn-lrl-official-senate-service-directory.html \
      --lrl-metadata /path/mn-lrl-official-senate-service-directory-audit.json \
      --feb-original /path/mitchell-historical-20220201005554-0.html \
      --nov-original /path/mitchell-historical-20221105160301-1.html \
      --output /tmp/nicole-2022-senate-campaign-original-policy-audit.json

Original page bytes remain in the 30-day source artifact and are not dumped into Git. The audit performs **no Neon/Vercel reads/writes, source/evidence insertion, model/forecast changes, serving changes or scheduler work**. The earlier #982 consolidated six-senator/20-excerpt source report has not been updated by this narrowly scoped four-excerpt proof; do not misstate that global report until its own separate merge. Keep [#864](https://github.com/killjoy00/votepredict/issues/864) OPEN.
