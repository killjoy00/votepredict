# Senate evidence index (`senate_evidence_v`)

One read-only view over every raw Minnesota Senate evidence body, built so a
forecast model has a single, as-of-safe place to read evidence from. It does no
inference, scoring or stance classification. Values are as printed in the
source.

Migrations: `migrations/0032_senate_evidence_v.sql` (the view) and
`migrations/0033_senate_evidence_dates.sql` (earlier dates, below).

## Columns

| Column | Meaning |
| --- | --- |
| `evidence_type` | What kind of evidence the row is (see below) |
| `membership_id` | The senator's session membership, when the evidence is about a senator |
| `bill_id` | The bill, when the evidence is about a bill |
| `observed_on` | Earliest date the evidence is known to have been public |
| `observed_basis` | Which source column `observed_on` came from |
| `value_text` | Raw value: vote choice, author role, stated position, score, title, and so on |
| `value_numeric` | Raw number where one exists: vote share, score, author order, two-party share |
| `detail` | Context: committee, organization, scorecard group and year, vote kind |
| `source_table`, `source_row` | Pointer back to the original row |
| `source_url` | Original source URL where stored |

## As-of rule

To use only evidence available before a vote on date `D`:

```sql
SELECT * FROM senate_evidence_v WHERE observed_on < :D;
```

`observed_on` is conservative. When a source prints no publication date, the
view uses the date this project fetched it. That date is later than the true
publication date, so the filter never lets future evidence leak in; at worst it
drops some evidence that was really available earlier. Rows with no usable
date have `observed_on` NULL and are excluded by any cutoff. `observed_basis`
lets a consumer choose to be stricter, for example by ignoring rows dated only
by `*.fetched_at`.

## Evidence types

| `evidence_type` | Senator | Bill | `observed_on` from |
| --- | --- | --- | --- |
| `official_floor_vote` | yes | yes | vote date (official `vote_events`) |
| `committee_vote`, `raw_floor_vote` | yes | yes | minutes or journal date |
| `committee_motion`, `raw_floor_motion` | mover | yes | minutes or journal date |
| `bill_chief_author` | yes (Senate) | yes | earliest of date added and journal introduction line, else bill introduction, else fetch date |
| `bill_coauthor` | yes (Senate) | yes | earliest of date added and journal introduction line, else fetch date |
| `committee_testimony` | Senator witnesses only | yes | hearing date |
| `press_statement_member` | yes | single-bill statements | published date |
| `press_statement_bill` | single-senator statements | yes | published date |
| `election_result` | winners | no | election date |
| `candidate_questionnaire` | yes | no | displayed publication, submission, archive or fetch date |
| `scorecard_score` / `_grade` / `_rating` / `_endorsement` | yes | no | scorecard publication date, else year-specific archive capture, else fetch date |
| `scorecard_bill_position` | no | yes | scorecard publication date, else year-specific archive capture, else fetch date |
| `scorecard_member_vote` | yes | yes | vote date printed on the scorecard |
| `district_partisanship` | each senator serving that district on the matching plan | no | November 30 of the election year |
| `bill_text_version` | no | yes | posted date, else Revisor XML posting time, else archive or fetch date |
| `omnibus_inclusion_mention` | no | yes | minutes or journal date |

## Earlier dates (migration 0033)

Three sources used to be dated only by when this project fetched them. Each now
has an earlier date that is still never before the evidence was public:

- **Authors at introduction** (`senate_bill_introduction_authors`). Senate
  journals print "Senators A, B, and C introduced-- S.F. No. N" on the day a
  bill is introduced. Each named senator is dated to that journal
  (`observed_basis = 'journal.introduction'`). The data is parsed from journal
  text already stored by the raw-vote collector.
- **Bill text versions** (`senate_bill_text_version_dates_v`). The Revisor bill
  status XML stores each text version's posting time (`DATE_INSERT`), and the
  authors pipeline already stores that XML. Captured versions are matched by
  bill and `/versions/N` (`'revisor_xml.date_insert'`).
- **Scorecards** (`senate_scorecard_archive_dates`). The earliest Internet
  Archive capture of the scorecard URL is used only when the URL names the
  scorecard's year, so the capture holds that year's scorecard, and only when
  the capture is not before that year (`'scorecard.archive_first_capture'`).
  A generic URL such as `/scorecard/` keeps the fetch date.

## Notes

- `official_floor_vote` rows are also the forecast target. Filter them by date
  like any other evidence, so a model only sees votes before the one it
  predicts.
- Raw journal floor votes (`raw_floor_vote`) overlap the official floor votes.
  They are kept so committee and floor records from the same raw source line
  up; deduplicate on `bill_id`, date and senator if needed.
- Companion bills are structural rather than dated evidence. Join
  `bill_companions` to carry evidence across an SF/HF pair.
- Campaign finance (issue #864 tables) is not included yet.
