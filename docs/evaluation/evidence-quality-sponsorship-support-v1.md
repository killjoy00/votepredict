# Evidence Quality sponsorship support policy v1

Policy version: `evidence-quality-sponsorship-support-v1`

## Rule

A verified exact member-bill sponsorship relationship is supportive evidence for that bill.

Qualifying relationships include:
- sponsor / co-sponsor;
- author / co-author / chief author;
- a clear first-person authorship statement such as “my bill” or “I introduced HF123”.

The evidence representation is:
- `claimType=sponsorship`;
- `linkage=exact_member_bill`;
- `specificity=exact_bill`;
- `stance=supports`.

This is semantic evidence classification, not a predictive coefficient. Sponsorship remains context-only and non-mechanical, and its model weight remains zero unless a separate evaluation/promotion protocol changes that.

## Source hierarchy

1. Dated Minnesota Revisor authorship reconstruction is the canonical structured source.
2. Durable member, campaign, news, or official text may corroborate the relationship.
3. Ambiguous identity, ambiguous bill linkage, or unavailable historical timing fails closed.

A source saying a member merely presented, discussed, heard, chaired, moved, amended, or procedurally handled a bill is not enough to establish sponsorship.

## Reviewed-corpus migration

The checked-in 226-document manual Evidence Quality corpus contained 25 claims labeled `sponsorship` under the prior conservative rule.

- 24 claims are verified authorship/sponsorship relationships and are migrated from `stance=none` to `stance=supports`.
- One Kristi Pursell / HF3793 claim (`3fccb9f4-ed6f-4b7c-8a8d-79a299de3c1f`) says only that she previously “presented” the bill. It is corrected to `procedural_action`, `stance=none` rather than being promoted as sponsorship.

Git history preserves the original annotations and prior policy. Production synchronization must be guarded, exact-ID scoped, idempotent, and must not alter model or serving behavior.
