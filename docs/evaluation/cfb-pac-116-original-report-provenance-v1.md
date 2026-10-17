# #864: Two source-attested PACs — 116 campaign-contribution original-report provenance audit

## Narrow scope and question

This is **campaign finance**, not media or press-release discovery. The merged
PR #1404 protected audit observed **116 distinct 2021–2025 Minnesota Senate
candidate-contribution records** from two presently independently
source-attested registered CFB PAC identities (70001 and 30558).
The third current registration research lead remains HELD.

The critical question is **which of those canonical contribution rows can
be independently traced to a specific original Minnesota CFB candidate-report
PDF**, and whether the specific row and specific report version were publicly
available at the forecast/vote cutoff. The two-source PAC identity was observed
in October 2026; it does NOT independently establish affiliation in 2021–2025.

## Evidence contract

1. Re-hash stored first-party PAC and official CFB registration originals
   from the independent 0031 ledger and require the existing dual-original
   name+number affiliation contract to validate the two *current* PACs.
2. Select only `candidate_contribution_record` on canonical Senate candidate
   campaigns, 2021–2025, with registered contributor ID matching those
   verified contemporary identities. Keep candidate expenditures and
   independent expenditures **out of the contribution family**.
3. Dedupe by the same filer-registration + SHA-256 row key used in PR #1404.
   Preserve evidence-copy counts, quarantine inconsistent duplicate row
   attributes, and report whether the prior 116-record baseline reproduces.
4. Join existing official PDF-version registry (830 versions, 813 unique
   bodies) by the receiving candidate committee registration/report year.
   This is **only candidate-report inventory**, not transaction containment.
5. Reexamine existing 0028 original schedule transaction links and exact
   page/entry fields. A report counts as **present-day exact PDF containment**
   only when the canonical contributor full name, transaction date, amount,
   schedule A contribution classification, unique entry, committee/year,
   original PDF version ID and independently re-hashed original PDF bytes
   all agree. Ambiguous and unmatched rows stay separate.
6. Verify the report's statutory release-date minimum against the **report
   DUE date** rather than filed-at + one day. [Minn. Stat. §10A.20 subd. 1b](https://www.revisor.mn.gov/statutes/2021/cite/10A.20)
   bars public release before **8 AM the day after the report was due**.
   Exact first-public historical version evidence is still absent from
   the V48 registry: `historical_exact_version_public_by_proven = false`.
   An estimated website date or current full PDF does not establish the
   historical first public-by date.
7. Independently captured bulk row observations are reported separately
   from original report containment. Stored `asOfEligible=true` and an
   earlier `published_at` are **legacy claims**, not certified historical
   public evidence.

## Outputs and deliberate limitations

The GitHub workflow emits **bounded aggregate integers only** for year,
deduplicated source rows, source conflicts, report version availability,
exact currently verified PDF entry matches, ambiguity, no stored links,
due-date-floor validity, observed bulk archive rows and potential
legacy timestamps earlier than that linked report's legal release floor.
There are no donor names, individual amounts, row keys, PDF page text,
source URLs or contributor identifiers in the public logs.

**Very important:** even a fully exact currently verifiable schedule-entry
match plus a legal release floor is NOT proof that exact report body existed
publicly before a historical vote. No 2021–2025 forecast source eligibility
is granted by this audit; historical strict-as-of features stay at **zero**.
The same distinction applies to contemporary PAC legal affiliation and
organization-to-bill positions, which are outside this finance-only audit.

## Execution safeguards

`.github/workflows/senate-864-cfb-pac-116-contribution-readonly.yml`
runs keyless source/temporal/family safety tests for a PR. After an
independently reviewed merge to `main` with the exact marker
`SENATE_864_CFB_PAC_116_FINANCE_READONLY_V1`, the same keyless checks
and `npm audit` must succeed again before the credential-bearing job can
start. That job discovers ONLY the existing independently-marked VotePredict
Neon default branch/primary via the repository's already protected action,
executes `REPEATABLE READ READ ONLY` and always `ROLLBACK`.
It performs no schema migration, scheduling changes, external contact,
new finance ingestion, eligibility rewrites, retraining, serving or forecasts.

## Next gates

Use actual safe production counts to prioritize exact original line-to-row
review for the unmatched PAC cohort. For any proposed historical as-of
claim, prove the specific first-public version independently (e.g., a
timestamped exact-version historic archive) and separately review a
member/bill cutoff before any promotion or backdating. Never assert
that absence of a match in the bounded parser proves absence from the
original disclosure.
