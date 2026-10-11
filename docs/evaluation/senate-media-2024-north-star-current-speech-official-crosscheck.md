# Track D: 2024 North Star Act newspaper source — three actual Senate-member roles

**Issues:** [#946](https://github.com/killjoy00/votepredict/issues/946), [#912](https://github.com/killjoy00/votepredict/issues/912). **Public research observation:** October 10, 2026. **Publisher-displayed date:** February 12, 2024 at **4:10 p.m.**, timezone **unknown**. This is source triage only; a displayed publisher date is **not historical Wayback public-by proof**.

## Current publisher article versus original archive

The [Minnesota Reformer brief](https://minnesotareformer.com/briefs/sanctuary-state-bill-already-dead-as-house-speaker-says-it-doesnt-have-the-votes/) currently redirects to [its dated /2024/02/12/ path](https://minnesotareformer.com/2024/02/12/sanctuary-state-bill-already-dead-as-house-speaker-says-it-doesnt-have-the-votes/). The presently served article is attributed to **Deena Winter**. A current publisher redirect, exact article text now visible, a byline and displayed local time cannot prove which bytes were available in **2024**, a 2024 redirect, first-public-by, a captured Wayback original SHA or membership in the private VotePredict archive.

### A legitimate *candidate* senator quotation, not yet an authenticated historical remark

The current article directly introduces **Senate Majority Leader Erin Murphy** and attributes a first-person passage to her with “she said.” A short candidate excerpt is **“I think it’s important that we rely on the committee process”**. The same article also reports a longer explanation about committee hearings. This is **a currently published newsroom speaker-attribution lead**, not independently recovered original-2024 bytes, not a completed private human source review, and **not a verified quote in the VotePredict Track D audit**. In particular, those words do not substantiate whether Murphy supported or opposed the **specific SF2724** bill.

The article's **Grant Hauschild** statement is a journalist's *paraphrase* of a [linked social media post](https://twitter.com/grant_hauschild/status/1756375725714571676). The original external post's exact wording, authenticated publisher/posted time and original capture were **not obtained**. Do not turn that paraphrase into a verbatim attributed quote. **Omar Fateh** is named as the Senate bill's chief author but is **not directly quoted** in the current article. It also contains direct remarks by then-House Speaker **Melissa Hortman**, who was **not** a state senator; those remarks may not be transferred to Hauschild, Murphy or Fateh.

## Independently checked official service and bill record

Minnesota Legislative Reference Library individual historical legislator records place **all three** named Senate-member leads in the **2023–2024 Senate session**, with oath dates **January 3, 2023**: [Grant Hauschild, District 3](https://www.lrl.mn.gov/legdb/fulldetail?id=15577); [Erin P. Murphy, District 64](https://www.lrl.mn.gov/legdb/fulldetail?id=15284); and [Omar Fateh, District 62](https://www.lrl.mn.gov/legdb/fulldetail?ID=15559). The Murphy record independently states that the DFL caucus elected her **Majority Leader February 6, 2024**, six days before the article's displayed date. This verifies appropriate historical Senate service and leadership for these research leads; it does **not** authenticate any reporter quotation or historical article publication time.

The [official Office of the Revisor SF2724 history](https://www.revisor.mn.gov/bills/93/2023/0/SF/2724/) describes the proposal as Minnesota sanctuary-state immigration-enforcement legislation, lists companion **HF2860**, and lists Senate authors **Fateh and Pha**. Its actions include **March 8, 2023** introduction and Judiciary/Public Safety referral, **March 14, 2023** referral to State and Local Government and Veterans, and **April 3, 2023** addition of Pha as author. The current official page displays bill text **“As Introduced”** and does not list a Senate floor passage. Do not invent a 2024 Senate floor vote, convert bill authorship into a reporter quotation, or treat these 2023 dated legislative actions as independent proof that the 2024 newspaper article was already public.

## Decision boundaries and reproducibility

The machine-readable [research cross-check](senate-media-2024-north-star-current-speech-official-crosscheck.json) preserves different classifications for a current-publisher reported direct quote (Murphy), journalist paraphrase of an external post (Hauschild), Senate bill authorship (Fateh), and House-speaker direct speech (Hortman). Tests assert official service and bill chronology, source URLs, and all fail-closed quote/Wayback/forecast flags:

    node --import tsx --test tests/senate-media-2024-north-star-current-speech-official-crosscheck.test.ts

**Still required before a verified historical Senate media quote:** separately authorized private VotePredict source-document identity, exact timestamped original Wayback HTTP body bytes matching the stored source SHA-256, independent article publication date and archive public-by (not the present article 4:10 p.m. clock), a verified actual senator term on that publication day, and substantive human quote-attribution/issue review. The current article and an official bill page do not replace those steps.

No raw private article, SQL connection, live Neon query, production source ingestion, model stance, serving change, historical forecast eligibility, or statewide publisher publication denominator is established here.
