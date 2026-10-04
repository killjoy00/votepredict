# Evidence Quality baseline 101 — human adjudication v1

This record resolves the remaining semantic judgment calls identified by the full 101-item assistant second-pass review in PR #626.

The project owner supplied the following adjudications in chat on 2026-10-04:

1. **Tina Liebling / HF 2414** — **directional support; explicit**.
   - Source document: `894a1d79-9bc6-4257-9d74-f62591e2d92c`
   - Baseline row: 92
   - Decision: retain `quoted_position`, `stance=supports`, `specificity=exact_bill`.
   - Human characterization: “very supportive, explicit.”

2. **Robert Bierman / HF 2461** — **directional support; explicit**.
   - Source document: `69f2839a-1f47-4828-b611-ebbeb45e3edc`
   - Baseline row: 69
   - Decision: retain `quoted_position`, `stance=supports`, `specificity=exact_bill`.
   - Human characterization: “positive. explicit.”

3. **Kaohly Vang Her / HF 398, HF 399, HF 400, HF 835** — **directional support; very explicit**.
   - Source documents: `b408092a-9261-437d-affb-7bbc3794010b` and `8ad6d16e-3cc8-4706-9dcb-908bff3806fe`
   - Baseline rows: 70 and 68
   - Decision: retain `explicit_position`, `stance=supports`, `specificity=exact_bill` for the duplicated source variants.
   - Human characterization: “positive, very explicit.”

## Gate interpretation

All semantic questions surfaced by the 101-item second-pass review now have a disposition:
- 83 accepted without identified issue;
- 15 clear repairs implemented in PR #627;
- the remaining judgment calls above explicitly adjudicated by the project owner.

This is **not** a claim that the original 101-item worksheet was independently re-reviewed item-by-item by a human. It is a complete assistant second-pass review plus human adjudication of every flagged judgment call.

No model fitting, Quick/P8, forecast/probability, model-weight, or serving change is authorized by this record.
