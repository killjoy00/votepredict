# Exact Senate questions, papers and historical roles

Migration 0035 adds a research layer for the 2021–22, 2023–24 and 2025–26 Minnesota Senate. It preserves accepted vote events, member choices, source-document identities, serving models and frozen evaluations. It does not replay positional event keys.

## What is linked

`senate_vote_paper_current_v` preserves source-local question/proposal identity with original extracted-character locators, full literal proposed amendments, explicit base-version references, outcomes and the ordered keys of amendments adopted earlier **in the same journal**. Rejected proposals remain inspectable and never enter that adopted list. Voice actions remain distinct without invented named choices. The list is not claimed to be a complete cross-day or assembled legislative text state.

`senate_vote_paper_exact_raw_v` links only uniquely matching raw questions. `senate_vote_paper_exact_event_v` links accepted events by source URL, session/date/bill, question wording, stated tally, and the entire normalized named ballot. Ambiguous repeated questions/ballots remain unresolved, even when their proposals differ. No connection is based solely on bill number, tally, latest edition or positional ordinal. If accepted and raw records use different source rows at the same URL, the connection is visible only after a fresh government-PDF download matches the retained extracted text. Fresh PDF byte SHA and size are retained independently; legacy source fingerprints are preserved.

Changing source payloads hides their old derived actions/links. Changing an accepted event or its ballot invalidates its link fingerprint. Source scans and failed verification attempts are fingerprinted and bounded so unavailable sources do not permanently crowd out the remaining work.

Nested amendment/withdrawal sequences that are not fully separated are held rather than combined into an exact proposal. Source-local prior-adoption lists include recovered actions only; they are not exhaustive when a source sequence remains unresolved.

`senate_vote_paper_components_current_v` connects an explicitly named base locator to captured text for that bill. Conflicting retained text hashes at the same version URL hold that representation rather than selecting a latest body. HTML and PDF representations preserve their separate original bytes and extracted-text hashes. Full assembled amended-bill text remains explicitly **unverified**. A linked question or amendment is not automatically a complete final-passage paper.

## Population-wide vote-to-text gap audit (#1498)

The same independently gated, protected production readback now includes `coverage.gapAudit`, a **read-only** event-level reconciliation of **every accepted Senate vote event** in the three requested biennia. It is a classification of existing evidence, not an attempt to reconstruct an unspecified version or to overwrite accepted votes. It is checked against the already deployed `senate_vote_paper_coverage_v` denominator for **both** accepted event counts and exact event-paper question links; disagreement fails the protected run.

Each event falls into exactly one stage:

- `exact_question`: the preexisting unique official-question/full-named-ballot linkage is intact. Separate counters show literal proposed text, explicitly named base version, captured base representation, in-journal earlier adopted actions, and original-source verification. **None** is a certified complete assembled bill state.
- `same_source_day_bill_unlinked`: a parsed paper exists in the **same original document, bill and day**, but the exact question+ballot link did not pass. Audit the original question, distinct ballot/motion and possible parser defects; never auto-attach by date/bill.
- `same_bill_day_other_source`: paper exists for the same bill and date but not the accepted event's exact document source. A fresh government-source/PDF identity proof is needed, not simply identical vote tallies.
- `bill_papers_on_other_dates`: this bill has papers, but not on the event date. Publication date cannot substitute for acted-on text.
- `no_parsed_paper_for_bill`: existing paper parser has no source-local paper for this resolved bill. Retrieve/inspect the correct official journal, committee text, or missing paper only after identifying original source context.
- `no_resolved_bill`: the accepted event itself lacks a bill link; do not assume its text from neighboring proceedings.

The output breaks these categories down by session, existing vote kind and source family (`senate_journal`, `committee_minutes`, `other_source`), with at most 18 **public bill/day-only** examples and a bounded HF100 April 28, 2023 original-action pilot. It includes no raw journal text, named member choices, internal IDs, SQL connection strings, or source URLs. A committee-minute vote does not inherit a floor-journal paper link. A procedural vote may have a completely specified *question* without constituting a vote to enact particular policy language.

The original October 20, 2026 protected snapshot counted **2,308 accepted Senate votes and 890 exact question links** (455/658 passage, 225/1,218 amendment), **82 captured explicit base components**, and **zero certified complete assemblies**. These are baseline measures until the new readback is verified; source-local paper counts are not interchangeable with the event denominator.

Once the gaps are measured, first review journal-origin `same_source_day_bill_unlinked` votes by original question text, recorded ballot and amendment disposition. Every improvement must originate in authentic source evidence and pass exact-match conflict tests. The first source-backed pilot remains HF100 April 28, 2023: journal states first unofficial engrossment as the amendment base, with four amendments adopted and one rejected before final passage. The existing source-only PDF SHA ledger is not itself a stored event identity match. The live vote model and time-sensitive `senate_evidence_asof` remain untouched.

### Population-wide same-journal exact-link failure census (#1498)

The original protected read-only gap audit identifies **697 of 2,308** accepted
Minnesota Senate votes in **2021–22 through 2025–26** that have a parsed
paper on the **same original official journal URL, bill, and proceeding date**,
but no exact accepted vote/question linkage. The preexisting population
classification is **427 amendment votes, 203 passage votes, 55 motions
and 12 other votes**, all in the Senate Journal source family.

The protected paper-history readback now also performs an **independent
source-only, population-wide first-failure census** within its verified
`REPEATABLE READ READ ONLY` transaction. It enumerates all same-source
eligible official votes (including already-linked votes to guard reverse
uniqueness), all current source-local parsed actions in those scopes, and
tests complete normalized **named ballots**, *both* yea/nay counts, source
document identity, verified original-source cross-row provenance,
and independently retained question text. A second strict count gate compares
every unlinked vote to the previous `gapAudit` population by exact source
URL/bill/date and rejects any missing, extra or duplicate event.

Each unlinked vote receives **one exclusive first-failure reason**:

- accepted named ballot incomplete (cannot determine a complete normalized roll)
- parsed source paper lacks verified provenance across separate stored
  source-document rows
- paper lacks a complete named ballot, no matching tally, or different
  complete named ballot
- same named ballot appears on more than one paper or more than one
  accepted event in the same source/bill/day context
- identical source question/ballot but missing current link (possible
  stale/hidden identity, backfill or fingerprint defect)
- typography-only or question-intro-only wording difference, as a
  **research candidate** and *not* a silent normalized exact question
- substantive question difference (including motion-vs-passage wording)

The instrument emits ONLY stage/session/vote-kind aggregate counts and at
most eighteen **public bill/date/count** examples. It never logs member
choices, names, original text, source URLs, internal event IDs, or bill
version assumptions. It does not create provisional or exact links,
change text captures, replay ordinal event identities, reclassify motions as
passage, or change accepted official ballots.

These stages should be used to choose one **reusable** parser/matcher
repair, then re-run authentic-source and collision tests before enabling
any individual link. In particular, tally-only similarity and same-bill/day
proximity are never evidence of exact question identity. Do not extrapolate
the 697 into 697 distinct bills or conflate a correct question link with
certified amended bill text.

### Append-only Senate nested amendment QUESTION identity repair (#1498)

The independent original-Journal tally census found **181** unmatched
same-source/day Senate vote questions, including **31** uniquely matched
source nested-amendment questions and **105** preliminary raw roll
questions. Protected original-source verification subsequently
established that **all 31 nested candidates** are also independently
source-unique across EVERY nested proposal ballot and separately
parsed direct v1 paper within the original government Journal:
**0** reused original nested ballots, **0** conflicting direct-paper
ballots, **0** invalid original proposal or question spans.

The guarded promotion requires EXACT baseline **2,308 accepted
official votes, 991 question links, 596 same-Journal unlinked,
181 no-matching-tally cases**. In a single `SERIALIZABLE`
transaction it recomputes both accepted-event source-day
uniqueness and original-source printed source-question
uniqueness. Exactly **31** new records may pass, requiring
the authentic original government-Journal extracted-text SHA
proof, unchanged entire original amendment literal SHA and
source action key, precise original question character offsets,
bill identity, accepted question text, both vote totals,
full **member-by-member ballot** and existing accepted identity
fingerprint.

Each successful original question receives a new **append-only**
source-local paper action with deterministic SHA key using a
separate `original-nested-amendment-question-v1` namespace,
and an exact `unique_question_full_ballot` accepted-event edge.
The action is **question-only** with `kind='amendment'`,
`proposed_text=NULL`, `outcome='unknown'`, no base locator,
no proposal capture and no prior adopted bill-amendment claims:
an amendment to another amendment does NOT prove a direct
bill-text change. No accepted votes, member choices, previous
paper actions, original bodies, bill versions or serving
models are changed.

The protected transaction must independently read back
**1,022 exact links, 565 same-Journal unlinked, and 150
no-matching-tally** cases or **ROLL BACK all 31**.
The earlier completed 2022 passage-roll recovery also explicitly
recognizes this verified **1022/565** subsequent exact-link state
as a no-op, without relaxing its 30 duplicate-ballot and one
incomplete named-roll holds. Every other production coverage drift
continues to fail closed.

Subsequent protected executions only allow a verified
no-op baseline with **zero** additional source-unique nested
candidates; new sources cannot be silently promoted.
The 105 raw-only candidates are analyzed separately and
remain unlinked until their original printed question
boundary and source ballot uniqueness are verified.

### Strict source-unique raw Senate Journal question-only promotion (#1498)

The independent original-government-source census identifies **105**
preliminary raw Journal question matches, but the stronger printed-question
source-side audit clears only **89 of those 105**, in **57** authenticated
source documents. The remaining **12** have insufficiently proved original
question spans or bill context and **4** share their complete source ballot
with a separate parsed original paper. They remain HELD. Both the
independent HF4 and HF4124 original SHA-pinned Journal PDF canaries are
mandatory.

The optional promotion is permitted only after the separately verified
31 nested question links, from **1,022 exact / 565 same-Journal
unlinked / 150 no-matching-tally**. It recomputes all 105 original
source-side proofs in a single serializable transaction and must obtain
**exactly 89** mutually unique printed questions and full named ballots.
Each is independently bound to the exact original roll-header and question
character offsets, authenticated full Journal extracted-text SHA, original
printed bill/day, yea/nay, accepted question, accepted full normalized member
votes and the database's existing event identity fingerprint.

The repair inserts only a namespaced append-only **question-only** paper
action (unknown outcome, no proposed amendment text, no bill-text base, no
prior-adoption assertion) and one strict exact event edge. It does not touch
a source body, old paper action, accepted vote/member choice, bill version,
serving model or schema. Any conflict must roll the **whole 89-link batch
back**. A successful committed readback must prove **1,111 exact links
and 476 same-Journal unlinked**; later protected runs must be strict
zero-insert no-ops. No claim of complete amended bill text follows from
question identity. The original **16 source-side holds** and all separately
ambiguous ballots are preserved.

### Raw Senate Journal roll-question source-position proof (105 preliminary cases)

The original-source-read-only census separately identified **105**
unlinked accepted Senate votes with an exact independently parsed
raw Journal question, matching complete named ballot, matching
yea/nay totals, bill/date and unique accepted event across all
same-original-Journal source-day votes. This is a preliminary
**accepted-event** match, NOT yet proof of a unique printed
**source question**.

An additional protected `REPEATABLE READ READ ONLY` evidence gate
now independently enumerates the ORIGINAL printed roll headers
using the same tight literal original Senate Journal syntax as
the authenticated raw ingester, and requires each parsed raw
vote to correspond in sequence **one-to-one** with exactly one
original roll header and the same yea/nay totals. It anchors the
original latest preceding `The question was taken on ...` /
`The question recurred on ...` marker, original question
character start, roll header character start, and the original
context's last separately printed bill identifier. It refuses
question text that is missing, different, contaminated,
too short, overlong or truncated. A full original quorum roster,
complete original named yes/no lists and exact accepted motion
text are mandatory.

Before considering an exact question link, the NEW source-side
audit also requires the same complete named ballot/tally to
appear **exactly once anywhere in that entire original
government Journal**. Reuse by another original nested
amendment or v1 direct paper action is a hard hold. These
conditions are independent of the accepted event uniqueness
check and are intentionally conservative.

Every one of the 105 preliminary candidates is categorized
into one of eight exhaustive source-side outcomes, including
different printed questions reusing identical ballots, source
nested/direct question collision, unsafe question start/end
positions, original header/parser disagreement, or strictly
source-unique printable questions. All 105 must reconcile
exactly before reporting, with at most twenty PUBLIC bill/date/
count examples. No source text, senator names, private IDs,
vote choices or ballot digests leave the protected transaction.

This source audit does **not** create any links, alter the raw
parser, backfill accepted events, introduce migrations, or
certify complete amended bill text. Later promotion must
have a new reviewed exact-original-source action/key schema
and strict one-to-one proof, not inferred chronology or
matching tallies alone.

### Strong original printed-source uniqueness for nested-amendment questions

The protected source-only missing-tally census first found **31** nested
amendment paper questions with exact full accepted member ballots, tallies,
bill/date and printed question text, unique against all accepted
same-Journal source-day votes. These are **preliminary** question candidates:
the *source* may still contain a second question with that same ballot
even when the accepted vote is unique.

A second independent source-sided gate now checks EACH of the 31
within its authenticated original Journal PDF text:

- Exactly **one** nested question among **all printed nested papers
  in the original Journal**, independent of bill or question text,
  may have the complete normalized named ballot and both totals.
- **No independently parsed original v1 paper** in the full same Journal
  may have the same complete ballot and totals, even for another bill.
- The nested question's original proposal start/end, question start/end,
  verbatim proposal bytes, literal SHA-256 and printable source action
  key must agree with the original PDF extraction exactly.
- The original still has uniquely matched complete accepted vote
  and exact original nested question text. The verified source URL,
  separate parent amendment identity and government original-source
  SHA/text verification remain mandatory.

The protected census reports **four** additional count-only metrics:
`nestedStrongSourceUniqueCandidates`,
`nestedSourceBallotRepeated`,
`nestedConflictingV1PaperBallot`, and
`nestedOriginalPrintedSpanInvalid`. These MUST partition the
previously measured 31 independently unique accepted-ballot nested
questions exactly; no source text, private event IDs, member names or
ballot digests are reported. A fixture tests that a second distinct
printed question reusing the same named ballot must remain a hold,
even though the accepted motion text itself agrees with one question.

Even a source-unique nested question is **not an enacted change to
the parent bill**. Any later persistence should be *question-only*
without claiming direct bill amendment adoption, cumulative text or
pre-vote publication. This stage is strictly `READ ONLY` and adds
no paper or event links.

### Population-wide 181 Senate missing-paper-tally investigation (#1498)

Following 101 strict original-source passage links, the independent
post-merge protected census classifies **181** unlinked accepted Senate
events whose current same-official-Journal URL/bill/day paper actions
lack even a matching **yea/nay tally**. These are not 181 different
bills. **148 are amendments** (21 in 2021–22, 100 in 2023–24 and
27 in 2025–26). Two especially concentrated original-source examples
are **HF4 on 2023-02-21 (16)** and **HF4124 on 2024-05-03 (15)**.

The original government Senate Journals plainly contain multi-level
floor amendment discussions, individual roll calls, and questions on
amendments **to other amendments**. Those are distinct questions; a
nested amendment to a parent proposal is NOT adopted bill text.
One-size-fits-all bill/day or tally matches are explicitly prohibited.

The new `senate-no-tally-original-census.ts` checks **every** event in
this independently reconciled population, inside the existing protected
`REPEATABLE READ READ ONLY` transaction. It uses only stored,
original-government-verified and SHA-bound Journal text. For each
event it checks (a) whether the exact original printed roll totals
exist anywhere, (b) whether the original day has a complete
independently printed quorum attendance roster, (c) whether the
previous strict v1 bill-paper parser would recover a matching tally
with that roster, (d) whether the existing conservative nested
source-amendment extractor recovers the **same bill, original
question, both tallies and complete normalized named ballot**, and
(e) whether this named ballot is **unique among ALL accepted events
from the same official Journal URL/day, including different bills
and unresolved bill identities**. It also compares unlinked
accepted votes to raw original Journal roll readings without
assuming those raw readings identify the correct amendment.

The result has **one exclusive first-failure stage per accepted vote**:
source unverified/multiple original copies/quorum unreadable,
actual original tally absent, parser refusal, nested exact candidate
or nested repetition/question/ballot hold, v1 reparse tally recovery,
raw vote strict candidate or raw-question/bill conflict, or merely
printed tally with no provably matching full named ballot. A
conservation test requires the stage counts to total the independently
reconciled **181** (or a changed future denominator if verified
links are later added). Protected output is only aggregate
session/kind/stage counts plus up to 20 **public bill/day/count**
groups, never original PDF text, member ballots, source URLs,
internal IDs or candidate hashes.

A **source-only** keyless original government replay independently
parses both `20230221025.pdf` (HF4) and
`20240503111.pdf` (HF4124) to determine what the nested and raw
parsers actually recover.

Original government PDF byte-verified receipts from keyless CI:

- **2023-02-21** `20230221025.pdf`: 1,747,673 bytes, SHA-256
  `b97fc9c01535ee55b9907a226598fc16ab86e08620abbd30b4d47fb9dae3ada9`.
  HF4: **2** current v1 paper actions, **12** distinct nested amendment
  sources with **12 complete named ballots**, **19** raw signed bill rolls.
- **2024-05-03** `20240503111.pdf`: 7,350,157 bytes, SHA-256
  `67792bd8d486d831a04c418b4fb3848fab395f453d87168aba0830daf166d04e`.
  HF4124: **1** current v1 paper action, **3** distinct nested amendment
  sources with **3 complete named ballots**, **16** raw signed bill rolls.

These are **source-only parser outputs**, not 15 verified question-to-event
links: repeated accepted ballots, question wording differences and parent
amendment attribution remain independent holds. Full original SHA and
minimum distinct nested/complete-ballot/raw-roll receipts now gate future
keyless PR and main original-source runs. No database writes, source/paper
replacement, new exact links, serving-model changes or text-state
certification are part of this exploratory phase. A later generic
parser repair must be separately source-pinned, reviewed and tested
against original-question/ballot collisions before any promotion.

### 2021–22 original Senate passage exact-link promotion (#1498)

The protected production replay from merge #1517 identified **101** independently
verified mutually unique source-ballot/question candidates among the
**132** unlinked 2021–22 passage events with existing printed tallies
but incomplete persisted paper ballot hashes. **30** events share the
same complete accepted named ballot with another accepted vote and **one**
source passage ballot remains incomplete. Those 31 events must NOT be
promoted by tally or proximity.

A later, narrowly bounded repair in
`src/operations/senate-2022-passage-link-repair.ts` is authorized only
by the existing production paper-history marker, primary identity and
migration-ledger guards. It creates **no schema migrations**.

The repair operates in one `SERIALIZABLE READ WRITE` transaction and
requires exact pre-repair baselines (**2,308** accepted votes, **890**
exact question links, **697** same-Journal unlinked events, **132**
original 2021–22 missing named passage ballots) before attempting
anything. It reuses the original **37 fully source-verified Journal
documents** and the unchanged independent printed quorum attendance
names to reparse the original question, named choices and passage
tallies. It must produce exactly **101** unique source/accepted pairs,
with 30 repeated accepted ballots and one incomplete source ballot
held. Before any write the source action must match the existing
persisted v1 action's immutable SHA key, printed original character
start/end, order, question wording, both tallies and bill/date. Any
different action, previously filled ballot, existing link or changed
source verification is rejected.

For each proved unique pair, the operation changes ONLY the previously
`NULL` **derived `senate_vote_paper_actions.ballot_sha256`** and inserts
one existing-method `unique_question_full_ballot` edge to the exact
accepted vote with a fingerprint of all identity-bearing accepted
vote and member choice fields. It does NOT edit any original source
body, existing non-null paper fingerprint, accepted vote/member record,
bill version, complete amended state or serving model.

The transaction must independently read back **exactly 991** exact
question links and **596** unlinked same-Journal votes after those 101
repairs, with zero question-only rechecks and zero hidden stored
links. On *any* mismatch it rolls back the entire batch. A subsequent
protected run permits a no-op only when the remaining **31** missing
paper ballots partition into the same 30 duplicates and one incomplete
named source ballot. It does not auto-promote any future newly discovered
paper/action candidates.

This is a *question-to-vote* linkage repair only. No claim is made that
a complete cumulative amended bill version existed or was publicly
available before passage.

### 2022 original Journal attendance-roster named-roll shadow replay

The population audit establishes that **132** unlinked 2021–22 Senate
final-passage votes have a matching source-local *passage action and
yea/nay tally*, but the stored paper lacks a complete named ballot. A
further one vote has no parsed passage action. The 132 are not an
authorization to infer or insert missing member choices.

Independent keyless source-only replay checked the official **May 10,
May 11, and May 20, 2022** Minnesota Senate Journals, including
SF1391, SF2922, HF3845 and HF2665. The original PDFs are identified by
their entire-body SHA-256 digests, **not** by a mutable webpage or copied
text snippets:

- 2022-05-10, `20220510106.pdf`, 3,402,568 bytes,
  SHA-256 `160dee14bf8d824d4d332f87aa3154fbd96593197f639dc0398c13f11d139a5f`
- 2022-05-11, `20220511107.pdf`, 1,210,956 bytes,
  SHA-256 `d32e223bccbe2a3dc3892a84a12d4821a12609a65b90448cde9d2061967d4ff6`
- 2022-05-20, `20220520113.pdf`, 669,374 bytes,
  SHA-256 `bcdffbb63d711ba36b6613103f2daef2610ca3eabd0bb44aa916bbb06383a591`

With names independently printed in each Journal's **opening quorum
attendance list** as strict parsing hints, the source-only parser
recovered complete source ballots for **all six tested passage rolls**,
including the two distinct HF3845 (60–6, 57–9) and HF2665
(65–0, 66–0) passage/repassage questions. Merely re-reading with no
roster can be incomplete: the source-quorum hints retain original
proper names without inventing vote choices. Each passed raw complete
named-ballot cardinality checks. The source receipt is a positive
reference example, not proof all 132 can be repaired.

The protected `REPEATABLE READ READ ONLY` population shadow checker
now probes *only* that independently reconciled 132-vote cohort against
the existing authenticated stored Journal text, using the complete
**source-internal** attendance list. The opening attendance extraction
requires exactly one verified introductory roll, a printed quorum
boundary, 55–67 unique normalized proper names, source URL/sha
provenance and exact date/bill coordinates. A bad/partial attendance
list refuses to guess. A recovered source paper MUST still match the
accepted event's **complete independently accepted named ballot,
both vote totals, and printed question** with **mutual uniqueness on
both sides**. A repeated paper/accepted ballot or changed question is
recorded as a hold.

The shadow produces only safe counts and public bill/day/count examples;
it does **not** modify, migrate, rescan, upsert or auto-link current
paper actions, accepted events or serving models. In particular,
`PAPER_PARSER` is unchanged. Promoting proven links or changing
the production parser requires a separate reviewed, source-anchored
change and protected readback verifying zero collisions.

### 2021–22 final-passage parser triage (source-only)

The population-wide census shows **133 missing-paper-ballot final-passage
events from 2021–22**, a concentrated defect class worth investigating
before another bill-specific amendment reconstruction. These are only
first-failure cases with an authentic paper on the **same original Journal
URL / bill / date**, not 133 independent bills or 133 provable new links.

The protected read-only census now subdivides these 133 events into:

- **No passage action parsed at all:** the matched source/bill/day contains
  other recognized actions (possibly voice or amendment papers), but
  none identified as a passage action. Fixing ballot parsing alone would
  not address this; inspect original question extraction and bill context.
- **Passage action with printed yea/nay tally but no complete named ballot:**
  prioritize exact government-PDF roll-call boundary, folio header and
  voter-list parsing across multiple original 2021–22 journals.
- **Passage action without printed tally:** investigate question/roll
  association and whether the purported passage action actually precedes
  an oral/voice disposition.

The three mutually exclusive subcounts must sum **exactly** to the
independently reconciled 2021–22 passage / missing-paper-ballot stage;
original content and named member ballots are not emitted. At most
twelve original **public bill/date/count** cases are logged for selecting
government-original replay tests. None is automatically linked or
treated as assembled vote-time bill text. Follow up with a generic
source-backed parser repair only where complete named ballot plus
unique question evidence passes.

### Original-source HF100/HF1/HF7 individual cases

The guarded protected production readback also reports `coverage.caseAudit` from the
existing **verified REPEATABLE READ, READ ONLY transaction**. The diagnostic compares
stored current paper actions against accepted votes from the **same exact
official source URL and day**, even when the verified original and its accepted
vote events have separate database source-document rows. Cross-row matching is
permitted only where the paper original is independently verified. It recomputes normalized complete named ballot
signatures inside the transaction, and separates full-question matches from
unique-ballot-only candidates, unresolved bill identities, repeated ballots,
and absent candidate ballots. Only aggregate category counts and source
ordinal/kind/tally for the **HF100** pilot are emitted; member ballots, names,
internal IDs, URLs and source bodies are never logged.

The source-pinned cases are **HF100 on April 28, 2023**, **HF1 on January 27,
2023**, and **HF7 on February 2, 2023**. Unlinked but same-ballot events are
investigation candidates, *not* links: a vote on tabling a bill can share its
division with a motion to re-refer it, and repeated amendment divisions can
be identical. Prior original-PDF provenance remains required before any
new append-only event/paper link is created. The 2,308-event denominator
and existing official-vote integrity safeguards stay unchanged.

### HF100 first-unofficial printed-line anchor pilot (source-only)

A separate keyless original-source canary pairs the April 28, 2023 authenticated Senate Journal with the **official Revisor HF100 first unofficial engrossment PDF**, not a later engrossment or the live/last version. The canary preserves the full official PDF byte digest and verifies printed `page.line` coordinates against the extracted first-unofficial text. A source offset from the journal is not assumed to be a Revisor printed page number.

The targeted, in-memory proof is **strictly narrower than full amendment application**:

The downloaded Revisor original was independently verified in both PR workflows at SHA-256 `547d33380988ad84e1e8fdec6d421437f5eb699f51465bff111b4519f883369c` (5,716,766 bytes); the keyless canary now pins both values and must fail on changed source bytes.

- **Port (adopted):** four literal `before ... insert` operations anchor to their individually specified printed lines on pages 56 and 71. The first instruction explicitly means the **second** instance of “eight” on line 56.7. The remaining **15 instructions in the same adopted Port amendment are NOT interpreted**, so Port has only *partial anchor coverage*, not a completed amendment or state.
- **Hoffman (adopted):** one complete source instruction on page 296, line 19 deletes two occurrences of `$4,000,000` and inserts `$5,500,000` in their places. Both deleted anchors must occur **exactly twice on that one printed line**, be consumed exactly, and yield two added new anchors. The resulting single-line text is kept in memory and never persisted or represented as an assembled bill.
- **The two adopted Hauschild amendments:** not interpreted as patch instructions; they include structural or appropriation changes. The **rejected Hauschild amendment** is excluded from passage. The passage still carries the four original adopted source keys in exact order.

Expected verified research-only outcome: **five distinct printed base lines anchored; four partial Port insertions; two Hoffman line replacements; one of four adopted amendments completely instruction-checked **in isolation**; three other adopted amendments without full instruction proof; **all four** still held for composite application; zero full bill assemblies and zero newly linked accepted votes**. Any mismatching printed line, changed source wording, missing/duplicate anchor, original digest drift or reordered adoption chain fails the canary instead of silently choosing a nearby line or latest edition. This does **not** prove the full amended HF100 text that went to final passage, a complete text hash or historical publication-before-vote timing. No accepted event, serving model or database table is modified by the proof.

### HF100 Port instruction coverage continuation (source-only)

The follow-on original-source check enumerates **all 19** Port amendment instruction
headings in the original April 28, 2023 Journal order and binds each target to
its **original first-UE printed page.line**, never to an approximate neighboring
line or an implicitly renumbered post-amendment page. The independent PR canary
uses the already pinned original Revisor PDF bytes. Four previously checked
insertions stay hard-gated by the existing pilot.

Nine additional instructions are *eligible* for isolated local preview only:
four simple inserts/replacements on pages 146, 148, 177 and 251; the
page 291.26 replacement; and four local changes on page 292 (lines 1, 26,
27 and 28). Each earns a checked count **only** if its exact printed line,
complete literal anchor and any required occurrence cardinality agree. Text
layer fusion (for example `grantsissued` or `isfor`) is an explicit hold,
not permission to guess where spaces belong or replace a nearby token.
The six other Port instructions—page 144.22/23, page 175.7/8, and
page 291.27/28–32—are always held as structural or cross-line operations,
even when their original page/line coordinates exist.

This checker reports instruction-level aggregate outcomes. It deliberately
does **not** materialize, store, hash, certify, or publish a completed Port
amendment; it does not resolve renumbering, quoted multi-line replacement
layout, the two adopted Hauschild amendments, dependent appropriation
adjustments, the composite final-passage bill text or pre-vote web availability.
The one rejected Hauschild proposal remains outside the passage chain.
An unresolved new anchor reduces the verified-local count and raises the
held count; it never triggers a guessed amendment. No serving table or accepted
vote/event link changes.

### HF100 Port cross-line structural-pair preview (source-only)

This second-stage verifier is deliberately separate from the preceding
19-instruction **local-line** coverage audit. It pairs the exact FULL quoted
original Senate Journal insertion wording with each immediately following
line-deletion instruction and insists on the first-unofficial Revisor PDF's
immutable printed coordinates. The journal and PDF original-byte SHA checks
remain upstream hard gates.

The three bounded pairs, collectively covering six previously held Port
instructions, are:

- **144.22 + delete 144.23:** preserve the unique `(a)` prefix,
  replace its original remainder with the entire quoted *CanGrow revolving
  loan account* language, delete original 144.23 and verify 144.24's
  unchanged paragraph boundary.
- **175.7 + delete 175.8:** likewise check complete quoted *CanStartup
  revolving loan account* wording, consume original 175.8 and preserve
  175.9's next paragraph.
- **291.27 + delete 291.28-32:** require exactly two original commas,
  replace only text after the **second** comma with the exact printed
  `subdivision 4.`, consume all five original numbered lines, and
  verify the unchanged 292.1 boundary. This last pair is held unless
  prior Port instruction 291.26 has already passed its own unique
  original-line anchor check.

An isolated preview is **not** a cumulative layout-correct amendment:
the PDF text extraction can fuse whitespace, original printed page.line
references cannot be directly applied to an already reflowed edition,
and the page **177.8** instruction says only `before "revolving"`
although the printed line has *two* occurrences. It remains unresolved.
The independent original-government canary enforces all three complete
pairs and exactly 18 of Port's 19 source instructions having isolated
operation checks (prior 12 local checks plus these six). **Port is still
not completely applied** and *zero* composite bill states or pre-vote
publication claims are authorized. The two adopted Hauschild amendments,
including `Adjust amounts accordingly`, remain outstanding.

If an original target line, span, punctuation or next-line boundary
fails to match, the pair is **held**; it is never replaced by an inferred
neighbor. Changed complete Senate quote/order or base-edition identity
fails CI outright. The verifier produces only safe counts and static
instruction ordinal/status labels, not bill text or ballots. No database
migration, accepted vote or serving model is modified.

### HF100 second unofficial engrossment: successor witness, not vote-time proof

The official Revisor version list also contains a **second unofficial engrossment**
for HF100, a *distinct original PDF edition* from the first unofficial
engrossment named in the Senate's April 28 amendment motions. The current
[Revisor version page](https://www.revisor.mn.gov/bills/93/2023/0/HF/100/versions/ue/2/)
reports **April 28, 2023 at 6:31 p.m.** as its posting time.
That present-day metadata does **not** independently establish when that
edition was historically public relative to the final Senate vote.

The keyless original-source canary downloads the second-UE PDF separately,
requires the independently verified original **SHA-256**
`fd4f28a4c1068e10faba827ab4142c108f05aca6d34fe6028b52ac30b0651e3a`
(**5,749,963 bytes**) before parsing, rejects a different source URL
or bill/edition identity, and checks bounded exact wording excerpts that are
**absent** in the pinned first-UE body and appear **uniquely** in the second-UE
body. The reviewed witness set covers Port's CanGrow/CanStartup account and
appropriation provisions, the successor's commissioner-held CanStartup
repayment account (in contrast to the nonprofit's unqualified revolving
account), Hauschild's local retail restrictions and public-safety changes,
and Hoffman's fiscal-year transfers.

At the original-pinned first keyless check, **8 of 9** distinct new
successor wording witnesses were uniquely verified, spanning **all four
adopted amendment sources**. The ninth, the public-safety totals as a single
PDF table expression, was held because the PDF text layer did not yield that
joint layout. Its two revised totals also appear in the official Revisor
HTML successor, but that observation is **not** silently promoted into a
PDF-table match, an exhaustive edition diff or vote-time proof.

Witness checks tolerate whitespace text-extraction artifacts only;
different letters, numbers, punctuation, repeated occurrences and missing
phrases are held and reported by safe static ID. These are **retrospective
source-wording observations**, *not* an exhaustive, independently verified
first-UE-to-second-UE diff; the successor must not be joined automatically
to an accepted floor vote, an at-vote textual hash or an eligibility clock.
The original Journal's four adopted and one rejected proposals remain
immutable gates. The existence of a complete official later PDF edition
does not mean the separately requested complete **amended-at-final-passage**
bill text was reconstructed or its historical public availability proved.

**Promotion prerequisites:** pin second-UE original bytes; independently
attribute every substantive change across both entire editions to the
adopted four-action Journal sequence, including Port 177.8 and Hauschild's
dependent appropriations; account for normalization and page reflow without
confusing printed *original* line coordinates; verify any remaining
editorial/source differences and the original exact question. Historical
public-before-vote remains a separate archival/release-clock question.

### HF100 Hauschild public safety: original fiscal amount-delta audit

Original Senate Journal's **second adopted Hauschild amendment** (original
source sequence 6) replaces the first-UE Public Safety total appropriation
`13,987,000 / 5,654,000` with `23,987,000 / 10,654,000`, adds explicit
`$10,000,000` first year and `$5,000,000` second year general-fund
language, preserves `$6,157,000` / `$2,218,000` trunk-highway funding,
and ends **“Adjust amounts accordingly.”**

The current official first-UE and second-UE Revisor HTML editions suggest
an **apparent $500,000 second-year disagreement**: the total increases
by $5,000,000, while the State Patrol subamount changes from $2,218,000
to $7,718,000 (+$5,500,000); first-year totals and State Patrol both
increase $10,000,000.

An independent source-only canary now attempts to establish the same
**numerical contradiction directly from BOTH original byte-SHA-pinned
Revisor PDFs**, bounding all four money figures per edition to the exact
`Sec. 16. PUBLIC SAFETY` section before `Sec. 17. REVENUE`.
It refuses repeated or absent money values and wrong section boundaries,
checks the complete Senate Journal money instruction framing, and reports
only named delta counts. If original PDF extraction does not preserve
enough table structure, the entire comparison is held: never resolve by
jumping to the nearest section, making up a $500,000 adjustment, or
automatically replacing a printed source amount.

**This is an arithmetic-reconciliation hold, not a correction or proof
of editorial error.** The public-safety fund accounting, actual second-UE
PDF layout, and all consequences of `Adjust amounts accordingly`
still require independent reconciliation. Whether the successor edition
represents the *at-final-vote* text and its web availability *before* that
vote remain separate, unproven questions. No full amended text, newly
accepted vote, exact link, new migration, or serving modification is created.

## Historical text and role dates

The collector stages exact numbered, unofficial-engrossment and conference-report URLs, including official PDF representations, from existing text stores and explicit journal references. Legacy-store discovery prioritizes bills with Senate official votes or raw proceedings links; it does not spend the historical retrieval budget on every unrelated House bill. Exact base references are also queued for current original-body acquisition. Publisher redirects are followed only within the same explicit bill/edition/representation and biennium, or between the exact assignment-sheet paths on www.senate.mn and assets.senate.mn. Resolved source URLs are retained; off-site, wrong-bill and wrong-edition redirects are rejected before fetching. A current download proves current wording, not historical availability.

Historical jobs acquire actual original archived bodies, not just CDX timestamps. They keep original URLs, replay URLs, capture clocks, body hashes and parsing outcomes. Source host/path, bill identity and historical session are checked. An archive response with a contradictory Memento clock is held. Bill text is captured only from the requested version with legislative body content; latest-version and wrong-bill pages are rejected. Matching old bodies can supply `archived_observed_at` without overwriting retained wording. Archive attempts and source jobs preserve unavailable/unparsed outcomes; those are evidence gaps, not successful historical captures.

Both modern version paths and the original Revisor `text.php` URLs are searched. Legacy query fields must identify the same regular-session bill and explicit edition; latest, duplicate parameters and special sessions are excluded. Introduction URLs for Senate-voted/heard bills are staged even when the legacy text store retained only a mutable latest body. The small metadata-only `historical-capture-leads-v1.json` preserves one independently downloaded positive canary: HF100's January 5, 2023 introduction capture. Its exact archived body SHA/size must be independently matched again before ingestion. This verifies an observation upper bound, not the first publication moment or statewide coverage.

The assignment parser preserves wrapped committee headings and PDF column boundaries, so neighboring surnames are not combined. Regular members are recovered only from explicit column cells or unambiguous single-name rows.

Role recovery has three explicit bases:

- `role.authenticated_archive_observation`: the literal historical committee/leadership page or assignment PDF was observed at the retained archive capture.
- `role.official_action_date`: a dated official journal records an actual election/adopted leadership declaration, or official minutes explicitly identify a chair/vice chair. Nominations, witnesses' outside titles and generic reporting senators are not promoted into roles. This is a historical legislative-act fact, not a claim that a web page was published that day.
- `role.dated_roster_fetched_at`: a freshly downloaded original official assignment PDF explicitly dates its list within the requested biennium. Its stated role-fact date and the actual download clock are retained separately. A bare biennium/year is insufficient. The printed date does not backdate current wording in the strict as-of interface. `role_observed_on` remains available for an explicitly selected retrospective factual-role experiment, without pretending the PDF's historical public availability was proved.

`senate_role_history_v` retains both clocks, original words and nullable stated tenure dates. These observations also enter `senate_role_evidence_v` and the shared `senate_evidence_asof` interface. The date-exclusive cutoff excludes the entire target day. Point observations do not silently become whole-biennium or indefinite tenures. A prior role observation can be a historical feature; it does not establish that the member still held that role on a later vote date.

## Coverage and remaining uncertainty

### Source-original question audit for missing papers and unresolved bills (#1498)
**Protected original source audit verified:** [PR #1544](https://github.com/killjoy00/votepredict/pull/1544)
merged after both exact-head source-PDF and general CI passed, and [protected
production run #39846423630](https://github.com/killjoy00/votepredict/actions/runs/39846423630)
returned `committed_and_readback_verified`. The entire original-Journal
cohort: **522** accepted votes; **150** known bills without ANY parsed
paper for that bill, and **372** accepted source votes without a resolved
bill. Read-only: **240** stored original document entries, **107** original
PDF-attested full-roll readable documents, **1,619** complete accepted
source-day peers inspected across every known/unassigned bill.

For the 150: **99** uniquely authenticated full printed question + complete
member ballot + original bill/day/source proven, **42** physically repeated
source question/ballots, **6** unproven original question spans, **3** without
one verified government original. For the 372: **zero** safely evidenced
bill-ID assignments under the strict rule requiring a bill identifier printed
within the SAME full original question. **237** have no bill printed in the
question (potentially genuine non-bill procedure); **80** source question/
ballot repeats; **43** non-unique/unverified originals; **12** unproven source
spans. Do NOT infer a bill from a nearby heading/previous motion. This
original-source audit created **0** links and changed **0** bill IDs.

The separately guarded source proof writer authorizes only the **99** unique
original question-only actions + exact accepted links, while keeping all
**51** known-bill paper holds and **372** unassigned bills unchanged. It
replays all 522 and their government PDF receipt/SHA, exact physical question/
header offsets, full named choices, printed bill/session identity and entire
accepted source-day collision universe inside a single `SERIALIZABLE`
transaction. Full bill state and adoption claims remain **zero**. Initially
**1,255/2,318** accepted exact question links; reviewed poststate
**1,354/2,318**, with unchanged source documents, original member choices,
previous parsed paper actions and serving models. Exact independent Neon
read-back still required before recording this as deployed.


The next two full-population first-failure cohorts are **150** accepted Senate
Journal votes with a known bill but *no parsed paper anywhere for that bill*,
and **372** Senate Journal votes without a resolved bill ID. The original
2026/2021–2025 distinction remains intact. `senate-orphan-journal-original-audit.ts`
replays all authenticated original Minnesota Senate Journals across both
cohorts in one independently verified protected `REPEATABLE READ READ ONLY`
transaction. Every accepted vote must have an independent *physical* printed
question+complete named ballot, matching yea/nay, a single identical source
roll and a single matching accepted source/day event among **all** bills and
already-linked peers. Source bodies require exact original PDF extract SHA and
verification receipt; source URLs, member names, original question text, and
UUIDs are never emitted from the protected runner.

For known bills the printed original bill must equal the already established
bill. For missing bill IDs, a unique bill must be printed **inside the same
full original question** and also agree with the physical roll's printed bill;
the bill catalog must have exactly one matching identifier in the correct
session. Merely appearing nearby on the page or in an adjacent motion is not
bill identity evidence. Original source/accepted collisions, unreadable
rosters, non-bill procedural questions, conflicting questions/ballots, and
preexisting stored links all hold. The initial stage is **read-only** and
produces **zero** links or official bill-ID changes. Counts from the protected
entire-population audit, not synthetic canaries, are required before any
separate exact-source guarded writer can be authorized.

### Full named-ballot mismatches against stored Senate papers (#1498)
**Independent protected source audit completed:** [PR #1540](https://github.com/killjoy00/votepredict/pull/1540)
merged and [protected original Neon run #39835363900](https://github.com/killjoy00/votepredict/actions/runs/39835363900)
returned `committed_and_readback_verified`. The entire first-failure **62**
partition was reconciled across **32** authenticated official original Senate
Journals, with **682** complete accepted source/day vote records checked for
collisions. **24** original-source-unique printed questions and complete named
ballots reveal a stored-v1 named-ballot mismatch; **31** other original-source
unique matches reveal a wrong v1 paper-question association. Exactly **55**
source-and-accepted unique candidates qualify for a separate atomic writer.
**Seven** must stay held: three physically repeated source question+ballots,
three unproven printed source question/bill boundaries, and one complete
accepted named ballot that is printed only under a *different* original
question. There were **zero** unknown government sources, unreadable opening
rosters, original question+tally absent, genuine original vs accepted named
choice conflicts, or competing accepted/question link collisions in this
bounded audit. The audit alone created **zero** links.

The separately authenticated follow-on `senate-named-mismatch-exact-repair.ts`
requires this exact first-failure distribution, the complete 32 original PDF
extract SHA/verification receipts, original physical printed question/roll
start and header, complete named choices, source bill/date, all accepted
source-day peer uniqueness, and the immutable accepted event fingerprint. It
appends only **55** original question-only actions and accepted-event edges
inside one `SERIALIZABLE` all-or-nothing guarded transaction; an identity or
population drift rolls the **entire batch** back. The protected prestate is
**1,200** exact accepted events/2,308 and **387** same-Journal unlinked; the
reviewed expected poststate is **1,255** exact and **332** same-Journal
unlinked. This does not correct, overwrite or infer the old v1 parsed action,
accepted member choices, original source, serving model or amended bill text.
The seven evidence holds stay explicit; question-only identity is NOT proof
of an adopted amendment or complete pre-vote amended bill state.


After production-verified +25 exact links in PR #1537, **62** accepted Minnesota
Senate votes have a parsed paper at the same original Journal, bill and day,
with matching yea/nay counts, **but a different complete member-level ballot**.
A matching tally alone is not proof. `senate-named-mismatch-original-audit.ts`
authenticates the original PDF extract SHA and government receipt, independently
parses **every physical original roll** using the full opening attendance roster,
and compares the entire printed question, exact yea/nay, complete named ballot,
source bill and source-day accepted event universe (including cross-bill
collisions). The audit divides all 62 into mutually exclusive named stages:
missing original question, source/question/roll ambiguity, genuinely different
original member choices, original unreadable roster, preexisting link claim, or
uniquely proven original source/accepted question+ballot. A unique original
candidate is separately classified as a stored-paper *ballot parsing* defect
versus a stored-paper *question association* defect. It never relabels an old
action, modifies a source, assumes a roll ordinal, imports amended bill text,
or publishes member names, IDs, ballots, source URLs or original question text
in the production report. The read-only census is not permission to link:
only a second source-SHA- and event-fingerprint-pinned serializable writer may
promote proven candidates after reviewing actual protected Neon counts.

### Repeated-accepted-ballot question collisions (#1498)
**Protected original replay #39826840419**: 85 unlinked accepted votes
with duplicated complete ballots were checked against 39 authenticated original
Senate Journals and 744 complete accepted source-day records, with all original
quorum rosters and physical roll headers aligned. The exact first-failure
partition was **25** source-and-accepted unique complete printed questions and
named ballots, **55** no matching original full question+ballot (55 passage),
**2** physically repeated original question+ballots and **3** unproved printed
question/bill spans. Zero sources or accepted votes were unverified, and zero
existing paper link collisions were observed. No link was written by the audit.
See merged PR #1535, correction PR #1538 and protected
https://github.com/killjoy00/votepredict/actions/runs/39826840419.

The separately gated append-only
`senate-repeated-accepted-exact-repair.ts` proposes to promote precisely
those **25** original source-unique question-only actions and independent
accepted-event fingerprint edges, in a single SERIALIZABLE transaction.
Its reviewed baseline is 1,175/2,308 exact links and 412 same-original-Journal
unlinked; expected state after a successful independently read-back commit is
**1,200** exact and **387** same-Journal unlinked. The preceding 2022 passage,
nested, raw and earlier repeated-paper repairs recognize ONLY this additional
reviewed state as an idempotent no-op, with the previous 143 original repeated
questions and three uncertain source spans held. This work does not reconstruct
or date any complete amended bill text, alter previous source actions, mutate
accepted member votes or affect serving/forecasting.


After protected PR #1533, **85** additional same-original-Journal bill/date
accepted Senate votes have precisely one parsed complete paper ballot, but at
least one other accepted bill/day event has the same complete member choices.
They must NOT be associated by ballot, tally, event ordinal or question
proximity. `senate-repeated-accepted-original-audit.ts` now independently
replays the entire authenticated original Journal's printed physical roll
headers, original question boundaries, source bill, yea/nay and complete
named votes, and demands exactly one **full printed question + full ballot**
across every original roll and exactly one accepted source-day event across
**all** bill identities, including unresolved bill assignments. This original
source replay reuses the provenance-verified and entire-Journal-aligned
physical parser independently exercised by PR #1532; a source-bill or
question span uncertainty is an explicit hold. A previously linked legacy
paper question is another explicit hold. The protected production report
contains only stage counts and public bill/day summaries. Candidate
observations are not links; a later separately guarded append-only writer
will need actual production source uniqueness counts, exact source extract
hash and receipt, printed roll offset/header, accepted fingerprint, and an
independent post-commit full-population readback. No bill text, member choices,
accepted vote events or serving weights change during this READ ONLY audit.


### Repeated-paper complete-ballot cases (#1498)
**Protected original-government release #39808559911** proved 64 physically
source-unique full printed question+named-ballot accepted-event candidates across
40 independently authenticated Senate Journals; 143 source question+ballot
repetitions remain ambiguous and three original bill/question boundaries remain
unproven. The stored-paper question audit had no candidates (82 missing exact
paper question and 128 repeated paper question), so it is not the writer.

The guarded follow-on `senate-repeated-paper-exact-repair.ts` does not infer
identity from repeated ballots: within an independently authenticated
SERIALIZABLE production transaction it replays the exact source Journal,
rechecks physical question/header offsets, source bill, full question, every
member choice, source byte-extract digest, printed-day identity and uniqueness
across entire source and accepted events. It appends source-anchored question-only
paper actions and `unique_question_full_ballot` edges for precisely verified
candidates; no amendment outcomes, amended bill-state claims, bill text,
accepted event/member edits or serving weights are allowed. The entire batch
rolls back on a single source/identity drift. The post-commit exact-link and
full population readback must independently conserve the count. Existing
2022 passage, nested and raw repairs recognize only the reviewed new final
poststate as a no-op. Unresolved 143+3 remain held.


The second, distinct `senate-repeated-paper-original-roll-audit.ts` independently
replays the complete physical original Senate Journal named-roll corpus with an
opening printed attendance roster and SHA-authenticated stored PDF extract. It
validates the real printed question start immediately preceding the roll header,
explicit source bill and ballot, and unique question+full ballot across the
**entire original Journal**, not uniqueness of the ballot alone. It rejects
repeated accepted question+ballots even across differently resolved bills.
Only verified aggregate candidates are reported, without inserting any link;
future writes must bind to exact source offsets and protected fingerprints.


The independently reconciled readback after the original-source +89 question
repair has **210 unlinked official votes whose complete named ballot appears in
multiple stored paper actions**. This is a first-failure diagnostic bucket, not
210 automatically recoverable links. `senate-repeated-paper-question-audit.ts`
compares the *full*, non-800-character-truncated printed paper question against
the accepted motion, requiring exactly one question-and-full-ballot paper across
the entire original Journal source-day (including other bills), exactly one
same-day accepted official event even when its bill is unresolved, verified
original-paper provenance, and an action not already linked. It runs only in
`REPEATABLE READ READ ONLY` within protected Neon and reports aggregate stage
counts and public bill/date examples; member names, source bodies, IDs, URLs and
question text remain private to the transaction. Its candidate count is
**not an exact link**. Original source byte/SHA, printed source question/span,
all original roll-header/ballot identities, existing event fingerprint and
mutual uniqueness must be independently proved before any bounded write.


```sql
SELECT * FROM senate_vote_paper_coverage_v ORDER BY session, vote_kind;
SELECT session_slug, kind, count(*), count(proposed_text)
FROM senate_vote_paper_current_v GROUP BY session_slug, kind;
SELECT observed_basis, count(*), count(membership_id)
FROM senate_role_history_v GROUP BY observed_basis;
```

The coverage denominator is accepted official Senate **events**, split by session and motion kind. Separate columns measure exact question identity, exact proposal text, original-source verification, any same-bill text observed before the vote day, and an explicit exact base observed before that day. None substitutes for complete amended state. Pipeline readback additionally separates senator/vote-day pairs with an earlier admissible role observation from those with only a retrospective dated-roster fact. Neither counts proven continuous tenures.

`complete_assembled_bill_text` is false and `availability_relation` is `at_vote_identity_not_pre_vote_publication_proof`. Officially considered wording, historical web availability, and introduction-time availability are different questions. An exhaustive modeling exercise must select the intended prediction horizon and eligibility rules explicitly. These views are not a deduplicated training matrix and do not change forecast weights.

## Execution and continuation

`.github/workflows/senate-paper-history-production.yml` runs after a reviewed main merge bearing `SENATE_PAPER_HISTORY_PRODUCTION`, then at `11 * * * *` UTC. It independently applies all migrations to disposable Postgres, runs full checks, verifies four pinned original Senate PDFs and audits production dependencies before entering the existing protected Neon environment. The production job checks primary identity and the complete checksum ledger, applies only 0035, performs bounded idempotent recovery, then uses READ ONLY / ROLLBACK for coverage. Main continuation can coexist with later reviewed migrations only when the complete ledger matches; it never silently skips pending migrations.

The initial run scans up to four 1,000-document batches, independently verifies up to 400 original journals within a ten-minute budget, fetches up to 60 explicitly named base URLs and checks up to 30 historical archive jobs. Later runs verify up to 30 journals within three minutes and use smaller acquisition budgets. A freshly reviewed push may immediately retry earlier canonical-URL failures while retaining the three-attempt cap. Archive jobs alternate between text/role families and all three biennia, prioritizing actual Senate floor-voted bills within each text family. Committee URL variants are discovery leads whose bodies must independently pass session-specific parsing. Counts and hashes are logged; raw bodies, ballots, UUIDs and credentials are not emitted.

### Next step: entire Senate amendment source state prerequisites (#1498)

Exact paper-to-vote links and literal bill states are separate proof problems.
The read-only `senate-amendment-state-chain-census.ts` inspects **every**
current source-local Senate paper action, including voice and procedural
source actions with no accepted roll-call edge, so an adopted predecessor
cannot be erased merely because no named ballot exists. It inventories the
source-attested original Journal, literal proposed amendment capture,
explicitly selected base edition, unique source-backed base capture,
source-local chronological adopted-action keys, and adopted/rejected outcome.
The summary has disjoint first-failure stages and a fully reconciled action
population denominator. Every prior adopted action must itself satisfy the
source evidence prerequisite before later actions can be described as ready
for literal instruction replay; rejected and unknown actions never become
an adopted amendment.

Even an `adopted_ready_for_instruction_replay` row is **not** an applied
amendment, a page/line accurate result, an assembled-at-vote bill version,
or publication-by-vote-time proof. All original text, IDs, roster ballots,
private source keys and full amendment instructions remain inside the
independently authenticated read-only transaction and do not appear in the
report. Accepted official votes, historic original bill versions, old paper
actions, member choices, link tables and serving models remain unchanged.
This is the population-level dependency audit needed before a separately
proved textual edit/reconciliation writer, not permission to certify an
assembled bill state. HF100 source evidence already independently has 5
captured proposals/unique bases, 4 adopted actions, and 1 rejected action;
its existing Port/source-line and first-UE/second-UE witnesses preserve their
explicit incomplete composite and unknown as-of publication holds.
