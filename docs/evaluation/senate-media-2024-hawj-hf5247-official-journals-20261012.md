# Track D — first-party 2024 Minnesota Senate Journal establishes Hawj's THREE distinct HF 5247 YES votes

**Official original PDF vote evidence (issue [#987](https://github.com/killjoy00/votepredict/issues/987)), October 12, 2026.** This is a narrow research-only upgrade to the earlier public [2024 HF 5247 aggregate action and secondary-vote-lead audit](senate-media-2024-hawj-hf5247-bill-action-bridge-20261012.md). Previous #1220 reported official chamber totals, but the individual Foung Hawj ballot had not been independently confirmed from official Senate Journal originals. Here, both exact **2024 official Minnesota Senate Journal PDFs** were downloaded into ephemeral runner storage, cryptographically hashed, inspected at the exact matching roll-call blocks, and deleted.

## New result: Hawj personally appears among the YES votes in all three primary-source HF 5247 roll calls

The original public Senate Journals identify Hawj by name inside the **affirmative** voter lists immediately following each *H.F. No. 5247* roll-call motion (not merely in session attendance, earlier amendment votes, reporter names, a party position or a proxy notation). Separate affirmative/negative sections and exact chamber tally/event identities were checked, and none of these three lists names Hawj in the negative section.

| Exact official vote day | HF 5247 Senate proceeding | Chamber tally (yeas–nays) | Hawj's personally named ballot | Printed Senate Journal page where roll begins | Original PDF page (1-based) |
| --- | --- | ---: | --- | ---: | ---: |
| 2024-05-07 | third reading passage | 55–10 | **YES** | 16488 | 57 |
| 2024-05-19 | conference report | 34–12 | **YES** | 20020 | 2022 |
| 2024-05-19 | third reading amended | 34–14 | **YES** | 20021 | 2023 |

On May 7, the official journal records 'H.F. No. 5247 was read the third time, as amended' then the 55–10 roll with Hawj in affirmative voters at **printed page 16,488**, continuing on 16,489. On May 19, the original day-119 Journal separately lists Hawj in the affirmative voter names for both **34–12 conference-report/repassage** and the **34–14 third reading as amended** at printed pages **20,020** and **20,021**, respectively. These are **three distinct recorded Senate vote events**, not three duplicate citations or votes on each individual Hawj SF proposal.

## Exact official PDF source provenance

| Official primary source | Raw PDF HTTP bytes | PDF page count | Downloaded entire original PDF SHA-256 |
| --- | ---: | ---: | --- |
| [2024-05-07 original day 113 Senate Journal](https://www.senate.mn/journals/2023-2024/20240507113.pdf) | 1,474,362 | 86 | `bea831ff7e8a9c51f388641012189af7c72cc2155e21de66717a6331f9a7b7b4` |
| [2024-05-19 original day 119 Senate Journal](https://www.senate.mn/journals/2023-2024/20240519119.pdf) | 28,283,947 | 2026 | `fdc77ecf62de6f56ae33915105316f26f2f7c60765b9296dddf14d94c9f9584c` |

The pinned original PDFs have an actual `%PDF-` magic, terminal `%%EOF`, required PDF MIME, HTTP 200, an exact allowlisted state senate session/day URL and manual no-redirect network policy. The original SHA-256 is over the **full downloaded PDF body**, not extracted text, a search snippet, or a government status page. The CI runner temporarily installs `poppler-utils`; reads PDF metadata via `pdfinfo`, and selectively extracts **45 tail pages of May 7**, **40 tail pages of May 19**, through local `pdftotext -layout`. The May 19 original has 2,026 PDF pages, but only its final 40 were read as text. Temp files are destroyed even if extraction fails. Only source URL, SHA, byte length, PDF page count, exact event/tally and individual affirmative/negative list flags were committed.

The first independently successful real-public-PDF replay was [GitHub Action #38265042318](https://github.com/killjoy00/votepredict/actions/runs/38265042318), source PR head `dbb8d7dd78a1564f354ce4b2f204b9bb02ed3a96`, public **metadata-only** artifact `11753813661` with **9/9 adversarial offline tests**, two original government Senate PDF hashes verified, all three exact individual YES lists matched.

## Proper link to the earlier Hawj policy statement and future cutoffs

The separate first-party DFL publisher statement from [#1216](https://github.com/killjoy00/votepredict/pull/1216) existed in an **exact SHA1/SHA256-indexed publisher original by March 24, 2024, 19:01:09 UTC** (original raw HTML SHA-256 `aa6da6e8722e33f2f692ba31bfd6699cf97768e74c788dbdb0786a75a3ad5743`). It directly attributes a short quoted support statement to Foung Hawj and names transportation-equity **SF 4056, SF 3257 and SF 3250**. The first verified archived version exists *before* both May 7 and May 19 HF 5247 votes, and that is a genuine potential **temporal source-before-vote** relationship.

**Critical label boundary:** Neither the official Senate Journal vote on the multi-policy 2024 HF 5247 omnibus nor its positive ballot alone proves a **vote on SF 4056, SF 3257 or SF 3250**, the presence of one of those exact policies in the version before the vote, or that Hawj's earlier source evidence is eligible for a VotePredict prediction/training label. The earlier March 11 Hawj testimony and March 18 SF 3250 committee action **predate** the March 24 authenticated original; those cannot be predicted by this later written source.

The official HF 5247 **third engrossment** was posted May 3, 2024, a potentially relevant *earlier* source of bill text for the May 7 vote. Official Revisor version listings show **fourth engrossment posted May 20**, after the May 19 vote; the May 19 **conference committee report** is listed as posted May 19 without independently authenticated pre-rollcall clock. Therefore **do not substitute later engrossment or enacted Chapter 127 wording as the exact version senators saw at either May vote**. Precise historical by-vote pre-senate-session bill text, amendments, and a verifiable SF-to-HF provision crosswalk remain open.

The source-timing relationship and individual ballot are now **two distinct independently substantiated facts**. Connecting them into an issue-specific labeled event is a *separate analysis*, not a side effect of this evidence PR. No existing private VotePredict source rows have been compared, and the statewide media denominator remains unknown.

## Tests, reproducibility and limits

- [Bounded official journal original-PDF inspector](../../scripts/probe-senate-media-hawj-hf5247-official-journal-pdfs.mjs) permits only two exact official day-113 and day-119 journal URLs. Individual ballots must occur in an affirmative/negative list attached to the specific H.F. No. 5247 context and chamber tally; attendance lists, proxy mentions and other bill motions do not count.
- [Adversarial synthetic tests](../../tests/senate-media-hawj-hf5247-official-journal-pdfs.test.mjs): nine offline fixtures for fixed original Hawj SHA, correct session/day, wrong bill same tally, Hawj in negative list, no name in either or both, non-voting proxy and attendance, source redirect/MIME failures, oversized PDFs and no automatic forecast-label promotion.
- [Pinned real-original journal regression tests](../../tests/senate-media-hawj-hf5247-official-journal-real-receipts.test.mjs): both exact official original PDF SHA-256 values, pages, byte lengths, primary bill/tally/printed page/member side and source-before-vote dates.
- [Immutable public machine-readable primary Senate Journal source receipt](senate-media-2024-hawj-hf5247-official-journals-20261012.json). CI must pass the **final-head real PDF replay** and repository-wide checks before merge.

Net result: **one serving Minnesota senator, two original official Journal PDFs, three distinct member YES votes on one omnibus bill**; **zero new media article URLs, zero new media archive versions, zero authenticated historical audio, zero individually certified standalone SF policy bill ballots, zero approved predictive labels**.

No downloaded original full journal PDFs, extracted full text, copyrighted media transcripts, private VotePredict data, production database/collector/ingest/model/serving/forecast/vote scoring were stored or altered. The research issue remains open for pre-vote bill-section identity and true 2022 Benson/Kunesh named MPR program audio.
