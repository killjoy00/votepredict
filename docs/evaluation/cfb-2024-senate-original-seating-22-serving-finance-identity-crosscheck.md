# Original 2024 Minnesota Senate roster evidence for the 22 verified campaign-finance senators

**Finance-only public original-source research, issue #864, October 11, 2026**. Builds on the independent actual 2022-service evidence and 2023 Minnesota Secretary of State Legislative Manual 22/22 source identity crosscheck. This is *new 2024 published roster documentary evidence*, not a historical report public-by date, statutory filing-obligation finding, or claim that each senator held office on every day.

The Minnesota Senate’s original official [2024 Seating Arrangement PDF](https://www.senate.mn/members/2023-2024/info/seating-chart.pdf), produced by the Office of the Secretary of the Senate, is **4,444,913 bytes**, SHA-256 `06e9194a23407ac2f47f5fb141150037558befb2f8004da3f4940e8189aedc4c`. It contains **two different roster representations inside ONE original government PDF**:

- A seating-map diagram with each named senator and printed community / district caption.
- An alphabetical `Senate Members` table with name, party, district and seat/room data.

Using first name, family name and **exact Senate district**, both components **independently within the document identify all 22 of 22 actual already-verified senators**; no held names or contradictory district identities remain in this sampled crosswalk. Thus we have independent 2023 Secretary of State and **2024 Senate** published-document evidence of office identity, in addition to 2022 authenticated original serving status.

## Source extraction issue resolved, not a historical-person conflict

An indexed text view appeared to attribute district 20 to "Steve Duckworth", but the original PDF was source-retrieved and found to **print "20Drazkowski, Steve J. (R)"** in the member table and "Steve Drazkowski / Mazeppa - 20" on the seating map. This validates Steve Drazkowski as the person in that district in the source, not any invented substitution.

The original PDF text extractor emits the **seat map before the alphabetical member table**, with district and surname fused (for example `20Drazkowski`). Some seat-map captions occur after the PDF text stream's `Senate Members` heading, although they remain *before* the first alphabetic member-table entry. The research parser now splits at the **actual first printed senator table row**, not at the heading. A first exploratory classification of 0/22 and a second partial 14/22 seat-map match were rejected; the corrected original-source acquisition returned **22/22 in both representations**. The source original PDF SHA and byte count did not change. These were parser-only false negatives, not missing senators. Neither government source is altered or reauthored.

[Permanent 22 senator original-source table/map proof ledger](source-proof/cfb-2024-original-senate-seating-chart-22-member-two-section-crossyear-proof.psv), [original source SHA / byte checkpoint](source-proof/cfb-2024-original-senate-22-two-section-2024-service-checkpoint.json), source-only parser and regressions in `src/evidence` / `tests`, and reproducible original government PDF acquisition workflow.

## Scope boundaries

The same printed chart contains two different sections but **not two independent government sources**. Both agree with the **independent 2023 SOS Legislative Manual** for all sampled 22. A 2024 seating chart is still not precise office tenure by *each historical vote date*; that requires dated Senate Journals or an exact roster's effective date. More importantly, the original finance reporting duty requires historical registration, termination and exemption assessment separately. Not one of the 71 year-end viewer versions has an independently proven original public-by posting timestamp; all stay excluded from historic prediction as-of eligibility. Other actually serving senators outside the sampled 22 and the previously held SD31 identity still require independent recovery.

The source acquisition keeps only SHA256, byte size, senator/district/committee registration identifiers and binary two-section match flags. Raw source PDF text, seating maps, staff contact details, donor names and financial transactions are not committed. No production DB read/write, model, forecast, scheduler, serving or 2027 scope changes. Issue #864 remains **OPEN**.
