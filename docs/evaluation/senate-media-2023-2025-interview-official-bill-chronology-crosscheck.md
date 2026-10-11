# Track D: Official bill/event chronology versus senator media interview dates (2023 and 2025)

**Sources checked:** 2026-10-10. **Scope:** independently verify official Senate legislative chronology beside two currently served MPR first-party interviews with actual Minnesota senators. This does **not** establish historic news/audio/archive availability, the exact 2023/2025 MPR original article body, or a human-verified senator quotation.

## February 7, 2023 — Mary Kunesh, Minnesota Indian Family Preservation Act

The current [MPR News Kunesh interview](https://www.mprnews.org/episode/2023/02/07/new-bill-would-keep-native-families-together-proponents-say) displays **February 7, 2023, 11:49 a.m.** (timezone and newsroom historical edit clock unknown) and currently offers speaker-labeled Kunesh audio/interview text. The [Legislative Reference Library member record](https://www.lrl.mn.gov/legdb/fulldetail?id=15466) confirms Kunesh served in the Senate that year.

An [official Senate Health and Human Services agenda](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=10157&view_id=2) explicitly schedules **SF667 (Kunesh)** for **Tuesday, February 7, 2023, 8:30 a.m.** The time is the **scheduled agenda clock**, not an independently inspected meeting start, actual appearance, speech transcript or original hearing recording. **No** journal quote can be inferred from being named as sponsor on a meeting agenda.

The [official Revisor SF667 history](https://www.revisor.mn.gov/bills/93/2023/0/SF/667/?body=Senate) establishes the separate chronology: **January 25** introduction; **February 8** amended committee report; **February 27** Senate third-reading passage **66–1**; **March 16** approval and **2023 Session Law Chapter 16**; **August 1, 2023** effective date. House companion **HF1071**. Neither February 27 passage nor March 16 enactment could be historically used as a completed event in a purported February 7 pre-vote MPR remark without separate pre-cutoff evidence; these are later recorded outcomes. The Revisor page's current appearance is not a contemporaneous public-by timestamp.

## April 24, 2025 — Susan Pha, Secret War/Hmong and Lao veterans

The [current first-party MPR interview](https://www.mprnews.org/episode/2025/04/24/bill-granting-benefits-to-hmong-lao-veterans-passes-minnesota-senate) displays **April 24, 2025, 1:00 p.m.** (unverified timezone), and currently has speaker-labeled Susan Pha responses. Official [LRL senator history](https://www.lrl.mn.gov/legdb/fulldetail?id=15583) confirms she served in 2025. Because the **Senate's 65–0 vote was April 23**, the MPR page with an April 24 displayed date is **not evidence that her interview was available to an April 23 forecast**. A current publication label is insufficient first-public-by proof in either direction; no archived 2025 original or SHA exists here.

**Never collapse two Senate bill IDs or author roles:**

- [**SF568** (companion HF1845)](https://www.revisor.mn.gov/bills/94/2025/0/SF/568/?body=Senate), veteran definition expansion and advisory task force: **Foung Hawj** first listed Senate author; **Susan Pha** added **February 3, 2025**; other authors Tou Xiong and Erin Maye Quade. Revisor records **April 3** and **April 10** committee reports/referrals, but does **not** list a third-reading Senate floor passage of SF568. The later **65–0 vote is not a recorded SF568 passage**.
- [**SF1959** (companion HF2444)](https://www.revisor.mn.gov/bills/94/2025/0/SF/1959/?body=Senate), **Veterans omnibus policy and appropriations**, official Senate authors are **Putnam, Carlson and Mitchell**; Pha is **not** listed as an SF1959 author. The Revisor specifically records **April 23, 2025** amended third-reading Senate passage **65–0**. After subsequent House action, the Senate considered the conference report and repassed the bill **May 17**, governor approval **May 23**, enacted **2025 Chapter 30**, effective **July 1**. Future May history must not be treated as known during the April 24 radio interview.

**Separate direct-speaker boundary:** A [Minnesota Senate DFL statement published with a displayed April 23, 2025 date](https://senatedfl.mn/senate-minnesota-asian-pacific-caucus-statement-on-passage-of-senate-veterans-omnibus-bill/) carries **Senator Susan Pha's byline**, but explicitly attributes the quoted passage to the **Senate Minnesota Asian Pacific Caucus**, which includes **Tou Xiong, Foung Hawj, and Susan Pha**. The collective passage is **not** automatically an individually spoken verbatim quote from Pha, and the first historical archival publication timestamp and source bytes have not been authenticated. The statement confirms the news was discussing the veterans omnibus vote (65–0), not a 65–0 standalone SF568 passage. All three caucus members actually served as senators, but only original attributed remarks may be assigned to individuals.

## Source levels and the pre-vote guard

The [public research ledger](senate-media-public-article-discovery-2021-25.json) records both MPR interview URL leads with distinct senator service/history fields, reported current speech levels and collection-filter results. This official cross-check is intentionally **separate** and does not promote either to the verified historical VotePredict media corpus. Publication date on a current MPR page, current legislative history page, a future bill enactment, a public caucus press statement, audio recording or quote-like transcript can each be real current observations **without** proving which exact words/document were publicly accessible at a historical forecast cutoff.

**Still needed:** 2023/2025 Wayback original HTML/audio response/capture, SHA-256 matched to a separately authorized private VotePredict source document, actual historical first-public-by plus time zone, trusted exact senator speaker attribution and private human review. No new Neon credential, database read/write, production collector/seed, scheduler, forecast, stance, or statewide media census was performed. Parent #912 is owner-closed; #987 is open.

### Offline reproducible fixture checks

The [machine-readable original/official comparison](senate-media-2023-2025-interview-official-bill-chronology-crosscheck.json) is exercised by [source-specific synthetic invariant tests](../../tests/senate-media-2023-2025-interview-official-bill-chronology-crosscheck.test.ts). They validate the checked-in public research assertions, not fresh network reads of the official pages or any historical original media capture.

    node --import tsx --test tests/senate-media-2023-2025-interview-official-bill-chronology-crosscheck.test.ts
