# #864 — 22 newly authenticated 2022 Senate campaign-finance PDF originals (SD14–24)

**Finance Track A is source-authenticated and merged; this is a permanent source checkpoint, not a report-obligation or historical forecast-eligibility determination.**

## Result and original-source reproducibility

[Merged acquisition PR #1012](https://github.com/killjoy00/votepredict/pull/1012) read the real official 2022 SOS Senate general result, the original Minnesota LRL Senate service directory, twelve 2022 CFB Senate district rosters, the permanent 396-row original CFB reports-tab API source ledger, eleven unchanged candidate reports-tab API payload hashes, **twenty-two actual original 2022 campaign finance PDFs**, and the independent original 2022 Senate disclosure calendar.

- **11** uniquely confirmed *actually served* Minnesota state senators, **22** distinct original-version PDF identities (**11 pre-primary C and 11 pre-general E**), districts **14–24**.
- **22/22** exact PDF binary SHA-256, first-page committee registration/office, reporting coverage end, Board received and independent original CFB calendar checks passed.
- **0** failed selected original report PDF proofs on the final complete source run; **0** independently verified actual historical public-by dates.
- **District 13** was **not** promoted: unique original official election-result → candidate CFB roster registration mapping remained unresolved. This neither excludes the senator nor proves any committee failed to file.
- **12 of the 22 original PDFs** (six 2022 incumbent senators) print a **different pre-redistricting Senate district** from the 2022 SOS ballot district. Those printed values were accepted only after matching to that exact person's original LRL Senate term overlapping 2022. The ledger retains *both* districts, no manual rewriting to the new ballot district.
- No overlap with the earlier [24 independently authenticated original 2022 Senate C/E PDF identities from SD1–12](source-proof/cfb-2022-senate-24-original-ce-pdf-source-checkpoint.json). This follow-up's 22-person serving filter must not retroactively claim the earlier 24-report cohort was all ever-served senator evidence.

Two distinct source acquisitions independently confirmed **all 22 exact binary report fingerprints**:

| Source workflow | Immutable source metadata | Verification |
| --- | --- | --- |
| [Original run #38107882680](https://github.com/killjoy00/votepredict/actions/runs/38107882680) | Artifact **11690660273**; 73,677-byte JSON SHA256 `daf13482159ebc0f56a0bfcebc3e59a5cca04310e2f62fd001cf56c0fada1c81` | 22/22 original source proofs succeeded on commit `b218163e` |
| [Final run #38108141175, attempt 2](https://github.com/killjoy00/votepredict/actions/runs/38108141175) | Artifact **11691465004**; 73,677-byte JSON SHA256 `f9c37d0eb60d57f4dac8ee2f4df0d8f0a0d61df4c2a7b5f2ed2ab327b1df253f` | 22/22 successful on final PR head `46df8002`; [full CI #38108141165](https://github.com/killjoy00/votepredict/actions/runs/38108141165) success |

The final source artifact expires **November 10, 2026 UTC**. [Permanent 22-row original-report ledger](source-proof/cfb-2022-served-d13-24-original-ce-pdfs.psv) preserves independent PDF SHA-256s, byte lengths, exact source report identities, actual serving senator, **2022 election district versus original printed district**, coverage, Board receipts, due dates and conservatively computed *not-before* dates. Its canonical LF-joined rows without a terminal newline are **3,663 bytes**, SHA256 `cae761dacf3dfaa5403f859e8fe5de38bf9a3759dd974f2822d9524ebfa3887b`. The [metadata checkpoint](source-proof/cfb-2022-served-d13-24-original-ce-source-checkpoint.json) pins both source ZIP SHA-256s, both source JSON hashes, the original LRL/SOS/calendar bytes' SHA-256 and actual acquisition UTC times, and eleven CFB reports-tab and district roster original-source hashes. Test `tests/cfb-2022-served-d13-24-original-ce-permanent-source.test.ts` enforces the hashes and exclusion of already-authenticated report IDs.

## Dates, interpretation, remaining work

Original official [2022 candidate disclosure calendar](https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2022/House_2022.pdf): pre-primary report C coverage ends **July 18, 2022**, due **July 25**, conservative earliest lawful publication **July 26**; pre-general E coverage ends **October 24, 2022**, due **October 31**, conservative earliest lawful publication **November 1**. Actual CFB Board receipt dates are separately retained for each individual PDF.

The official 2022 source bytes were acquired **October 11, 2026 UTC** in GitHub Actions; historical report coverage, Board receipt and legal publication *floors* must **not** be misrepresented as proof that the report was publicly accessible at a specific 2022 prediction cutoff. For these 22 reports, independently proven historical public-by remains **null**, and no historical forecast eligibility is granted.

**Track B remains open:** legally owed Senate filing count, 2021–25 historical registration lifecycles, nonfilers, completeness of the full original PDF universe, source-to-database donation/expenditure reconciliation, retroactive v6 report availability corrections and district 13's exact CFB join. Neither the 396 historical viewer API snapshots nor any new 2022 original PDF constitutes the denominator of legally owed reports.

All proof is **metadata only**. Raw original PDFs, donor names, financial transactions, personal addresses, all never-served candidate names and original election vote counts are not preserved in the repository. No production Neon/Vercel access or writes, database ingestion, forecast serving, retraining, scheduler or 2027 work. Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) **OPEN**.
