# #864 campaign-finance positioned original PDF verification (V5)

This stage continues read-only original CFB campaign-contribution
verification of two **contemporarily attested** PAC identities and
**116** Senate candidate contributions, 2021-2025. It does not establish
the PACs' historic legal affiliations, an actual vote position, or
that a specific original report version was historically public.

## Observed original report blocker

Previously protected run #39043166450 authenticated 173 original government
PDF bodies across 173 distinct source pages displaying Schedule A1 and a
literal registered PAC number, but the locked pdf-parse getTable parser
recognized **zero** table headers. Absence of recognized grids is
not evidence that the 116 contributions are absent from PDF reports.
The 114 stored historic source eligibility flags remain unverified.

## Coordinate method, two disjoint source evidence lanes

Use the same independently SHA256-rehashed original PDF bytes, report
version/receiving committee/year, current-PAC source attestation and
existing Neon read-only guard. The already locked pdfjs-dist getDocument /
getPage / getTextContent API supplies actual printed text-item x/y baselines
and item widths from the immutable government original (no new service).

* **Provisional original text-line candidate:** exact PAC registration
  number, transaction date, amount and a distinctive legal counterparty
  name appear on the same tight printed baseline. Without independent
  column labels this is only a finding worth source-level follow-up, not
  certified individual receipt-to-original PDF containment.
* **Column-constrained original PDF transaction row:** four distinct
  original printed header columns (Date, registration, Name, Total)
  unambiguously define x regions and all four precise tokens fall in the
  corresponding region on that same baseline. A PAC number merely printed
  elsewhere in the PDF, a nearby adjacent line, PDF footer summary,
  fused unpositionable item, multiple possible column headers, conflicting
  canonical transaction or incomplete receiving committee/year comparator
  must hold the record out of the strict category.

Compare each printed source hit against **all** available canonical
candidate-contribution rows of the receiving campaign committee/year, not
only the 116-PAC subset, and retain original/amended PDF version aliases
separately. No data is written and no row or PDF coordinate, donor name,
amount, page text, or PDF content is printed to public GitHub Actions logs:
only integer aggregates and static safe flags.

**Even strict current original report-row containment does not establish
historical first-public source availability at a past vote cutoff.**
Zero eligibility/publication timestamp upgrades, serving/model updates,
prediction changes or outside source expansions are authorized.

## Release

The existing source-attested PAC116 protected workflow runs keyless PR
tests and separate main CI/npm audit before the protected existing Neon
default-primary connection can read the originals. First-attempt reviewed
main commit must retain marker
SENATE_864_CFB_PAC_116_FINANCE_READONLY_V1. Database sessions use
REPEATABLE READ READ ONLY and explicit ROLLBACK.

Synthetic tests verify the actual locked PDF.js coordinate API using a
generated valid one-page PDF fixture, plus fail-closed cases for neighbouring
baseline, wrong amount/date/registered PAC/name/column, fused text, canonical
collision, incomplete registered donor identity, and amendment alias.
