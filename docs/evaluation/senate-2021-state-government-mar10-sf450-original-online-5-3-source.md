# #864 — recovered 2021 Senate online committee roll: March 10 SF450 (5–3)

**2021 Minnesota Senate committee votes only; print-original verification still HOLD.**

The [Senate's original online minutes page](https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=16146&ls=92&type=minutes) for **Wednesday, March 10, 2021** identifies the **State Government Finance and Policy and Elections Committee**, hearing ID **16146**, and a named roll on the **SF450 recommendation to pass and re-refer to Finance**. This is a new **2021 committee-level named choice source lead** beyond the LRL's 2022–25 electronic Minutes census.

## Original online narrative

**Senator David Osmek** moved to recommend **SF450** pass and re-refer to **Finance**; **Senator Jim Carlson** requested a roll call; and **5 YEA / 3 NAY** was recorded, with the motion **prevailing**. Eight members are accounted for by the explicitly printed individual sides:

- **YEA:** Kiffmeyer, Howe, Osmek, Pratt, Koran.
- **NAY:** Carlson, Clausen, Fateh.

The same online page has a later recap on the *same bill*: Senator Osmek again moved that SF450 be recommended to pass and re-referred to Finance, with MOTION PREVAILED. This **does not print another independently introduced named roll**, and cannot be counted automatically as a second historical vote. The committee's other bills, SF1564, SF714, SF1907, etc. have separate voice recommendations and do not inherit SF450 named sides. SF708 was laid over.

## Official 2021 print-original gap

The [Minnesota Legislative Reference Library](https://www.lrl.mn.gov/minutes/) expressly states the **official 2021 Senate committee minutes are in print at LRL**, and that Senate electronic committee minutes collected by LRL begin in 2022. The Senate's 2021 online historical record is real and dated, but **has not been compared with official print**. Therefore this is a recoverable public-source named-roll candidate, **not** an official-print-authenticated record, certified statewide missing vote, or member-vote production import. The [2021 April 7 Senate Education SF960 online minutes](https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=16260&ls=92) report multiple **4–5 counted results without individual named choices**; research these as motion-level contexts but never infer individual sides.

## Strict source parser and original-byte action

The [bounded Senate online HTML source inspector](../../src/evidence/senate-2021-state-government-mar10-sf450-online-source.ts) requires the exact hearing date, committee and SF450 section, Osmek mover, Carlson roll request, exactly one 5/3 YAY/NAY name partition covering all **eight** committee senators, motion prevailed and one later recap. It persists only original byte SHA metadata, original section neighborhood and pre-roll hashes and side-name SHA identities, not unhashed individual-choice lists. The source roll does not print its own Absent field, so the absent count is **null / not printed**, not an inferred zero from opening attendance.

The [single-use public source workflow](../../.github/workflows/senate-2021-mar10-sf450-online-original.yml) must acquire this ONE exact original Senate URL with no redirect, strict HTML MIME and streamed byte cap, independently hash and parse it. **Completed, successful ORIGINAL PUBLIC ONLINE SOURCE acquisition (October 11, 2026):** [PR #1087](https://github.com/killjoy00/votepredict/pull/1087) merged at commit `4c58093389fd031cd3d418fe1726d51428098682` after clean exact-head CI. The genuine one-time original Senate online source run [#38160308868](https://github.com/killjoy00/votepredict/actions/runs/38160308868) **SUCCEEDED**: verified **73,656 original HTML bytes** with SHA256 `5f21d06bd06fd9d71bd91c7dcd897692cafe5d166c21216f67fb215854674ee1`, one original SF450 5/3 named roll, exactly one duplicate recap, **zero failures**. Original Actions artifact #11710021221 was independently downloaded: ZIP **1,756 bytes**, SHA256 `3e53817e0c61ff7bfd15d41d71d9e2b22801f069f26b92609d311c53c65578a7`; decoded original JSON **3,202 bytes**, SHA256 `bd247a7d2256521d3b12d0d06925e3da4761a35d8cb21c29390da9448b8619b3`. Source-original motion offset **5357**, result-end offset **5632**, bounded neighborhood SHA256 `6c26b3e2dfafd5cb7339f8ec28a1ba021408d04b58d00b68afc494af56dcb460`. All are permanently pinned in the [source-only original success proof](source-proof/senate-2021-state-government-mar10-sf450-online-original-success.json) and [regression](../../tests/senate-2021-state-government-mar10-sf450-online-original-success.test.ts).

**This authenticates the public Senate ONLINE page only.** The separate **official 2021 print committee minutes at LRL are still unreviewed**. Nothing was inserted into private VotePredict member_vote tables, the state denominator is still UNKNOWN, and duplicate recap is not a new source-certified vote. Hearing date is not a proved original minute-level first-public-by, and no same-day forecast admission follows.

Adversarial regression tests use fictional voter names and reject altered side partitions, dates, motion introductions, voter counts and duplicate roll sections. No raw original HTML or full senator member-side lists committed, no private/production DB access or member_vote import, models, forecasts, training, serving, scheduler, Senate floor, 2027 or office outreach. The true statewide 2021–2025 official committee vote denominator is UNKNOWN. **Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) OPEN.**
