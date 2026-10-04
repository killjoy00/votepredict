# Evidence Quality baseline 101 — assistant second-pass review v1

This review covers all 101 items in the baseline human-audit artifact from run 37164825006 / artifact 11288992290. It is a second-pass assistant review against the supplied durable source text and `evidence-quality-prompt-v1`; it is **not** independent human sign-off.

Rules applied:
- do not predict votes;
- do not use or infer later outcomes;
- directional stance only for attributable explicit position or quote;
- legislative action, sponsorship, committee/procedural activity alone do not establish final-passage support/opposition;
- supporting excerpts must be grounded in supplied source text.

## Summary

- Documents reviewed: **101/101**
- Accepted without identified issue: **83**
- Repair required: **15**
- Needs human judgment: **3**
- Mechanical supporting-excerpt grounding failures: **0**
- Production mutation: **none**
- Modeling/serving change: **none**

## Repair-required items

| Audit item | Source document | Baseline file/row | Finding |
|---|---|---|---|
| 3 | `eb2a29a5-029e-425d-81d8-d9536bff5818` | batch-03 row 59 | SF2356 stance relies only on campaign text reporting Hoffman's completed vote. Preserve action/provenance but do not derive directional exact-bill stance from the later outcome alone. |
| 12 | `1cc98f6a-99af-46e2-b127-bd7c5981694c` | batch-02 row 33 | HF28 directionality comes only from a member-news index title reporting a vote. Index/action language alone should be non-directional. |
| 16 | `c5265947-3184-4151-9f7e-5730c9e9fe06` | batch-03 row 63 | Duplicate-source Hoffman SF2356 completed-vote issue. |
| 21 | `894a1d79-9bc6-4257-9d74-f62591e2d92c` | batch-04 row 92 | Claim 2 is `quoted_position` with `attributed_paraphrase`; prefer `explicit_position` or narrow to a true direct quote. Claim 1's exact-bill support from “many wonderful things” is also a human-judgment subissue. |
| 24 | `a91d5e3f-110b-42b5-a829-cca40d9f9ebe` | batch-01 row 11 | Greenman HF28 directionality comes only from an index title reporting a completed vote. |
| 35 | `d4731ca8-75af-475d-ae1b-9164bbf4b68a` | batch-01 row 10 | Duplicate-source Greenman HF28 index-only directional issue. |
| 38 | `e76ffed9-ff0f-4ad8-b3dc-d051dd955480` | batch-03 row 53 | HF4 directionality is anchored to “I voted to pass HF 4”; surrounding text explains effects but does not independently state final-passage support. |
| 47 | `20499c17-6414-4c3a-b832-3ad3eaaff2dc` | batch-03 row 67 | Duplicate-source Hoffman SF2356 completed-vote issue. |
| 62 | `93ef6f73-4676-4ed0-afa3-86161da7c0c6` | batch-02 row 27 | Duplicate-source Hoffman SF2356 completed-vote issue. |
| 68 | `e9c0f2d1-ffaf-4c61-b731-b1486771d365` | batch-01 row 17 | HF9 directionality is anchored to a post-vote “voted in support” statement; outcome-blind semantics favor legislative_action unless independent explicit position text is substituted. |
| 78 | `c21414ca-36ad-41c4-ac81-4ef1771b2785` | batch-01 row 2 | HF4 directionality is anchored to “I voted to pass HF 4”; favorable description does not independently state final-passage support. |
| 81 | `47f6d3e6-701f-460f-bf1c-0912165c0b49` | batch-03 row 62 | Duplicate-source Hoffman SF2356 completed-vote issue. |
| 89 | `535b888c-8d26-434f-b8df-343b677fd5c9` | batch-01 row 22 | HF3631 directionality is ultimately anchored to a completed vote (“I voted no” / “I voted no because…”). The rationale explains the action but does not provide a separate pre-outcome position statement; outcome-blind treatment should retain this as legislative_action/stance=none. |
| 94 | `8ae52cc1-5a4f-4b4f-a9d1-ca0767e0df56` | batch-03 row 58 | Duplicate-source Hoffman SF2356 completed-vote issue. |
| 96 | `e22e38b5-0038-4b73-84d2-28f576d5e228` | batch-02 row 40 | Full source contains Brand's direct supportive quote (“This is an important step…”), but selected excerpt is only co-authorship plus completed vote. Replace with the direct quote and preferably `quoted_position`. |

## Needs human judgment

| Audit item | Source document | Baseline file/row | Question |
|---|---|---|---|
| 31 | `69f2839a-1f47-4828-b611-ebbeb45e3edc` | batch-03 row 69 | Bierman explains a beneficial financing mechanism in HF2461 but does not explicitly state final-passage support. Is this `policy_discussion/none` or enough for directional support? |
| 91 | `b408092a-9261-437d-affb-7bbc3794010b` | batch-03 row 70 | Vang Her explains the rationale and intended beneficiaries of four authored housing bills but does not explicitly say she supports final passage of each. |
| 98 | `8ad6d16e-3cc8-4706-9dcb-908bff3806fe` | batch-03 row 68 | Duplicate-source variant of item 91; same directional-vs-policy-discussion question. |

## Interpretation

The baseline is substantially sound, but the blank human-audit gate was masking a small set of real issues. The dominant repair pattern is **completed-vote/index language being promoted into directional evidence**, which conflicts with the prompt's outcome-blind rule. Two other repair cases have valid directional evidence elsewhere in the same frozen source but need better supporting excerpts so the claim itself does not rely on a completed vote.

No annotation rows should be changed in production solely from this assistant review. Clear repairs can be prepared in repository artifacts, but the three judgment items—and the Liebling subissue in item 21—should remain explicit human-adjudication targets before final feature-matrix freeze.
