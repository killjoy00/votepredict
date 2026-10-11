# #864: 2020 first-party campaign archive recovery for five actual 2021-serving Minnesota senators

Five actual Minnesota **2021 state senators**, not just general-election winners, whose original 2020 candidate campaign domains have historically independently attributable public discovery leads.

| Senator | Historical 2020 SD | Public candidate-domain discovery | External corroboration |
|---|---:|---|---|
| Carrie Ruud | 10 | https://carrieruud.com/ | https://en.wikipedia.org/wiki/Carrie_Ruud |
| Justin Eichorn | 5 | https://justinformnsenate.com/ | https://minnesotareformer.com/2020/10/20/state-sen-justin-eichorn-tries-to-hold-off-bemidji-mayor-rita-albrecht-with-control-of-senate-at-stake/ |
| Roger Chamberlain | 38 | https://rogerchamberlain.org/ | https://en.wikipedia.org/wiki/Roger_Chamberlain |
| Rich Draheim | 20 | https://draheimforsenate.com/ | https://draheimforsenate.com/its-decision-time-why-me/ |
| David Senjem | 25 | https://senjemforsenate.com/ | https://www.majoritystrategies.com/wp-content/uploads/2022/05/MS_casestudy_MN_Senjem.pdf |

**Only domain leads at this point.** No original 2020 candidate HTML, campaign statements or their first-published dates are proven yet. Do not backdate 2016 or 2022 website content from current pages. The 2020 general election was November 3, 2020. The one-shot source workflow authenticates the full public Minnesota LRL historical actual Senator-service directory (acquisition run `38094976711`, source artifact `11685387674`, SHA-256 `bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51`) and confirms each candidate personally served in **2021 SD10, 5, 38, 20 or 25**, before the first archive network query.

For each domain, the job downloads one genuine independent Wayback CDX index between January 1 and November 2, 2020 (maximum 300 rows), selects at most four candidate issues/priorities/home pages from the historical index, replays real original full HTML (maximum 20 across five people), saves only actual bytes whose SHA-1 Base32 matches original CDX digest, and retains whole original HTML, SHA-256, historical capture UTC, original URL, request status and any error in an Actions artifact. Original CDX index metadata without genuine matching HTML is a discovery lead, not a policy statement. Empty/unavailable/capped samples do not imply absent candidate positions.

Next research is a **separate** original HTML and CDX rehashing audit of exact short candidate-owned policy excerpts with their public-by 2020 archive UTC and earlier-cycle context. No author date invented; legislative-action claims are not recorded Senate vote verification. This source-only PR admits zero positions and never accesses or mutates Neon, Vercel, production databases, model, forecasts, evidence tables, schedulers, 2027 or government offices. Keep #864 open.
