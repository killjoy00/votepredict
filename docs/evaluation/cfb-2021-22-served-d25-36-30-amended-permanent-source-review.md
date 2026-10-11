# #864 — Permanent official CFB amendment PDF source evidence, Senate-serving SD25–36 cohort

This preserves the real original-source output of merged [PR #1056](https://github.com/killjoy00/votepredict/pull/1056), **not** a statutory legally owed filing denominator or a production financial-row backfill. The 2022 CFB candidate reports-tab and earlier authenticated Senate-service proof identify 11 real Minnesota senators in the verified SD25–36 cohort (SD31 identity held), with 30 amendment-version references on 10 registrations linked to 19 of the 40 independently verified original C/E and year-end PDF parents.

## Permanent evidence

- [30-row report-version source ledger](source-proof/cfb-2021-22-served-d25-36-30-amended-report-pdfs.psv): each exact official version ID, actual senator, original versus 2022 Senate districts, original parent ID and PDF SHA, official viewer response SHA, amended PDF SHA and original byte length, individual acquisition time, reporting coverage, Board receipt, statutory original-report due date, conservative *possible* date-only release floor, and alias classification. **11,489 UTF-8 bytes**, trailing LF, SHA-256 `5de332aed85aa00c0e4b5ad943ce13a31f586d7333671d519aa91ad0a0341723`.
- [Permanent source checkpoint](source-proof/cfb-2021-22-served-d25-36-30-amended-source-checkpoint.json) holds the original GitHub ZIP/JSON fingerprints, both independent October 11, 2026 CFB acquisitions, exact merged head and CI IDs, LRL/SOS/official calendar source SHA anchors, actual source counts, reviewed Hoffman alias, and explicit research boundaries.
- [Regression tests](../../tests/cfb-2021-22-served-d25-36-30-amended-permanent-source.test.ts) fail on changed PSV bytes, mismatched original CFB parent/report registration, invented adjacent Senate district, incorrect period/receipt/due date, omitted version, additional binary duplicate, or reclassification of the Hoffman alias as a second unique form.

## Two observed source acquisitions

| Item | Initial independent fetch | Independent source recheck |
| --- | --- | --- |
| Official CFB workflow | [38147337575](https://github.com/killjoy00/votepredict/actions/runs/38147337575) | [38148567237](https://github.com/killjoy00/votepredict/actions/runs/38148567237) |
| Result | Strict all-distinct revision-chain gate failed, while **all 30 first pages passed** | **Success**: exact previously observed alias accepted, all other duplicates rejected |
| Original amendment-version PDF bodies retrieved | 30 | 30 |
| Distinct amended PDF SHA-256 fingerprints | 29 | 29 |
| Authenticated parent identities | 19 | 19 |
| ZIP SHA-256 | `06d167bbcd31a628a798405ac944a2938278ae93fe9344924b32d0c1908f58ff` | `c31042ae6abddcbd348250811e149b625f6e8c5e5e3d155e9b524383c12b56f4` |
| Embedded metadata JSON SHA-256 | `d3d952465404db511ea93657d421bc0c83c705ff149d5c1ee9d9812b7c01d8c9` | `bbf033118d0ae5ca14d76eeddaa39af827264a4c552e093cdfa70e793683c75e` |

All 30 source-version ID, source-URL, original parent, individual amended PDF hash and byte length, report coverage, original source identity and Board receipt fields are unchanged between these two downloads. Official candidate-viewer API hashes also remained unchanged. The only expected difference is the source acquisition timestamp and the second run's more accurate report-reference classification. Full CI on the exact merged PR head `228fb39a2c2903e4bfdea098df0061167f93631c` passed in [run 38148567249](https://github.com/killjoy00/votepredict/actions/runs/38148567249); source and CI both passed before squash merge commit `ee97f4ab1e752690f3e2ac49a404bd02b0e3a670`.

## Exact one-source-PDF / two-viewer-reference alias

Real Senate member **John A. Hoffman**, Minnesota CFB registration **17319**, 2022 year-end. Official amendments `17319:22:pcc:YE:0:1` and `17319:22:pcc:YE:0:2` both resolve to an identical **686,801-byte PDF**, SHA-256 `5a95df8f11a8b912b65d4befebd368cf00008e814844c69c3069c77fac7f8e2d`, period January 1–December 31, 2022, stamped Board-received **May 28, 2023**. Both refer to independently authenticated original `17319:22:pcc:YE:0:0` (SHA-256 `9021188adb7c834e0b28273b71fb72f2ceaabb18cbb2c56b1a0e93a6489e7485`). The #3 version is **another distinct binary**, Board-received July 21, 2023.

The source **does not establish why** CFB exposes two version indices with the same PDF, whether an earlier different binary was once returned under one index, or when each version first became public. Keep both references, but count the duplicate content **once**, not twice. The verified result is **30 actual official version references = 29 distinct amended PDF binaries + 1 alias**, not 30 distinct amended PDF forms. An unrelated duplicate, missing report identity, or source drift is a HOLD, never silently excused.

The report mix is 2021 YE: 3; 2022 YE: 13; 2022 pre-primary C: 7; 2022 pre-general E: 7. This cohort's 40 originals plus 29 unique authenticated amended binaries are **69 distinct PDF forms**, not 70. Together with the earlier SD14–24 cohort's 67 forms, that makes **136 authenticated forms across 22 independently verified serving senators** in these two cohorts. A separate unusual Aric Putnam-linked source-only PDF remains held and is not counted.

## Deliberate exclusions

CFB Board receipt, a statutory due date and a conservatively possible date-only release floor **do not establish actual historical public-by**. Source acquisition in October 2026 is not historical 2021–2023 availability. None of these amendments is approved for retrospective prediction eligibility. The statewide legally owed denominator, actual committee status/exemptions, and contribution/expenditure-row coverage remain separate research questions. No raw PDFs, extracted report text, donors, individual transactions, never-served candidate details, production database access, forecasting, serving, scheduler, training or 2027 changes were made. Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) open.
