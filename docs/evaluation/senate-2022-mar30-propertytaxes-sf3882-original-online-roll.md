# #864 — Original Senate March 30, 2022 Property Taxes Subcommittee SF3882 2–2 named roll

**Original official public source:** [Minnesota Senate online meeting minutes, hearing 16933](https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=16933&ls=92). This is an actual historical **2022 Senate SUBCOMMITTEE** proceeding, not a Senate floor vote, and is distinct from selective published Rule 12.10 Senate Journal reports. The source heading explicitly says **Subcommittee on Property Taxes — Wednesday, March 30, 2022**.

## Actual printed motion

Under **SF3882**, Senator Klein requested a **roll-call vote to refer the bill to Local Government**. Four senators are individually printed as voting **yes or no** (names not separately listed by side in this GitHub repository); the meeting minutes say **2–2, motion did not prevail**. The source prints no *motion-specific* absent-voter field, so this value is **null**, NOT zero.

**Different event and absence trap:** The whole-meeting attendance header separately lists an absent senator. That does **not** certify motion-specific absence or authorization to infer the individual votes of anyone outside this printed four-person division. A subsequent Senator Weber motion to **lay over SF3882** is a **different motion**, not a second four-person roll or equivalent referral vote. Likewise, preceding amendment/result-only paragraphs for SF4021 and SF3200 do NOT identify individual voting sides.

## Authenticated-source workflow

This change introduces a narrowly allowlisted, HTTP/MIME/redirect/stream-size checked original Senate online HTML acquisition, with original raw-byte SHA256 and exact-motion text neighborhood/context SHA256. The parser must reject a wrong committee/date/bill, different referral target, extra/missing named division, false 2–2 outcome, duplicated motion, or changed individual named-side SHA commitments. It uses fictional-only voting members in public regression fixtures. **No original readable actual member-by-side vote list or raw HTML content is committed.**

Online text discovery is NOT proof of separately authenticated HTML original bytes. **Only after exact-head clean migration/check/production-security CI and genuine on-merge GitHub Actions source-job success, plus independent ZIP and decoded JSON hashes, may this be counted as a byte-authenticated online committee named roll.** Genuine failures must remain failures.

## Scope and limitations

This is the Senate's published **electronic online meeting record**, not the separate 2022 *printed* Senate committee-minute collection. The [Minnesota Legislative Reference Library states these 2022 print/electronic collections may differ](https://www.lrl.mn.gov/minutes/); print minutes are held in the Library and have not been obtained or compared. March 30 is an actual recorded original meeting date; the exact vote clock and first public-by/source availability time remain unknown, so do not infer same-day historical prediction eligibility. A source-printed 2–2 vote is not automatically a missing stored VotePredict member_vote row. No production/private DB access, row import/backfill, 2027, floor roll, forecast, training, model or scheduler change. True 2021–2025 statewide committee roll denominator remains unknown. Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) **OPEN**.
