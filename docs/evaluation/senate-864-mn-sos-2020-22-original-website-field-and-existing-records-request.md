# Minnesota SOS 2020/2022 candidate Website field — targeted original snapshot audit and existing-records request

**Issue:** [VotePredict #864](https://github.com/killjoy00/votepredict/issues/864). This is a research-only checkpoint. The 2020 and 2022 original 21-column candidate-filing export remains **unrecovered**, and no new candidate-owned first-party website or issue statement may be added automatically.

## Why the records are time-bound (primary historical legal authority)

Minnesota Statutes **2021 §10.60, subdivision 4(d)** says the Minnesota Secretary of State election-related site must link to a campaign website **if the candidate or committee requests it and submits a valid URL in writing**. The same rule specifies links were required to be displayed from the opening of filing **only until** the business day following the State Canvassing Board's declaration of the general-election results or **November 30** of the election year, whichever was earlier. This explains why a 2026 filing website does not reproduce the earlier site's original link universe. It does **not** mean a campaign lacked a website when its old candidate-list page displayed no link. Primary original-law HTML: https://www.revisor.mn.gov/statutes/2021/cite/10.60

The **current Minnesota SOS [Candidate Filings](https://www.sos.mn.gov/election-administration-campaigns/data-maps/candidate-filings/)** instructions distinguish an election-era filing list with extended candidate metadata from **post-general `cand.txt`**, which has **no website column**. The 2026 candidate search site's download relies on ASP.NET POST and the existing public runner got a Radware CAPTCHA page; do not bypass it or use a 2026 file as 2020/22.

From previous source-audited [PR #1237](https://github.com/killjoy00/votepredict/pull/1237), three pre-general State Senate-only official candidate filing snapshots are independently indexed and **whole-byte verifiable**:
- **2020-10-21 UTC** original full HTML SHA256 `89fe0c0cb330a005ad662a5b9d993b520954b247934b93204c324218e1022d89`; original indexed CDX SHA1/Base32 `BBYBU7X3BAFEV27UGT5BGV6WMWIOJ7IM`; named official SD3 Thomas Bakk, SD6 David Tomassoni, SD43 Chuck Wiger.
- **2022-05-28 UTC** original SHA256 `55dec1666b6664beaafb125a7321a52fdf48aa56c4b3d96cbeb1e5b418a1e69d`; indexed SHA1 `EY2O2CJG3DA3DTAVCRX3DZWZNZAM7IMH`; original named Bill Weber, Kari Dziedzic.
- **2022-08-16 UTC** original SHA256 `1776f314b4ef3b35eb8610ec883f7f0033b91199f3c1b4e6b55bfece5b537464`; indexed SHA1 `7WHUBL6VSXWR36YI2PMWCIMWC3QFZLZX`; named Weber, Dziedzic.

This branch's `scripts/audit-senate-864-original-sos-candidate-website-table-field.mjs` precisely checks original independent CDX fingerprint and full HTML SHA256, candidate names, and **the original table's *explicit* 'Website' header aligned to each named candidate cell**. It records blank/nonblank as *website displayed in this one dated listing*, **not** a finding of no actual campaign, no URL ever submitted, or no other versions/archives. All original election post-vote 67-district winners are independently reread and rehashed for identity. All raw HTML remains ephemeral; no file containing addresses, phones, email, cookies or ASP.NET viewstate is committed or saved as an artifact.

## The official Data Practices path

The [Minnesota Secretary of State official Data Practice Requests page](https://www.sos.mn.gov/about-the-office/rulemaking-data-practice/data-practice-requests/) identifies **Lauren Bethke**, Data Practices Compliance Officer, at **lauren.bethke@state.mn.us** and **651-201-6895** for customized elections records requests (as observed October 12, 2026). That policy specifies the agency is not required to create records that do not already exist, can provide existing public data in response to request, and will estimate costs for customized requests. Legal access reference: [Minnesota Statutes §13.03](https://www.revisor.mn.gov/statutes/cite/13.03), especially subdivision 3(a), (c) and (e).

### Draft for human review only — **NOT SENT**

**To:** lauren.bethke@state.mn.us  
**Subject:** Minnesota Chapter 13 public data request — historical 2020 and 2022 candidate filing campaign website fields

> Hello,
>
> I am requesting access to existing public electronic government data under Minnesota Statutes §13.03 concerning the **Campaign Website** information recorded or displayed in the Minnesota Secretary of State's **2020 and 2022 State Senate candidate filings**.
>
> Please provide copies of any **existing and retained** public, election-year candidate-filing exports (including the federal/state/county candidate text-file export), dated snapshots, prior versions or archived tables from the 2020 and 2022 filing/election periods containing the fields **Candidate Name, Office/State Senate District, Campaign Website URL (including blank values), and capture/extract or effective date**, to the extent such records exist. We are interested especially in versions as of **October 21, 2020; May 28, 2022; and August 16, 2022**, and any later pre-general-election preserved versions in those years.
>
> If full public extracts for State Senate candidates are unavailable, please first identify or provide responsive **existing public candidate-specific records** reflecting website addresses submitted for the 2020 State Senate candidates **Charles ("Chuck") Wiger (SD43), David J. Tomassoni (SD6), Thomas ("Tom") Bakk (SD3)** and 2022 candidates **Bill Weber (SD21), Kari Dziedzic (SD60)**. This may include any **retained election-year electronic candidate detail record, published website-link table, or candidate/committee URL submission under Minnesota Statutes §10.60, subdivision 4(d)**. Please include the applicable record's date if preserved, so a later website update is not mistaken for a pre-election publication.
>
> The candidate-filing site originally offered a **federal/state/county filed-candidates** text export with a **Campaign Website** field; the unrelated post-general-election `cand.txt` election-results lookup omits that field and therefore would not be responsive as a substitute. We do **not** need voter registration records, residential or mailing addresses, telephone numbers, personal email addresses, social security numbers, or other private data. Please provide/redact only the public candidate identity, office/district, historical website information and associated record dates.
>
> This request is for **existing records**, not a request to create a new report or reconstruct data that the office does not maintain. If the requested historical data no longer exist or were not retained, please indicate that status if ascertainable, and, if available, identify the applicable retention schedule and whether an existing maintained archive or historical export location is known.
>
> If copying or retrieval would incur a fee, please provide a cost estimate before proceeding. Electronic delivery in any existing native format is preferred. Please let me know if a narrower record description would help locate the files.
>
> Thank you.

**Approval gate:** This is a suggested public-data request, NOT an email sent or scheduled by this research. Confirm the recipient and approve outreach separately before sending. Do not issue a fee commitment or request private data automatically. No response from the State has been represented as received.

## Research classification and next decision

When original public snapshot website **column explicitly aligns** with a named candidate row, a **blank observed field** may support the narrow finding *“no SOS-displayed website in this dated snapshot”*. It must not be upgraded into *“the candidate had no website”*. An **actual published URL** is still a lead, not first-party campaign content: separately archive-rehash historical candidate ownership, Senate-versus-other-office, exact speaker statement and publication timing before adding any original campaign quote.

Candidate-owned original website coverage remains **92/95** and selected issue excerpts remain **1,285**, with Wiger/Tomassoni/Bakk unverified. [Merged PR #1239](https://github.com/killjoy00/votepredict/pull/1239) independently confirmed two authentic but disqualified source traps: 2008 Bakk Governor and 2019 Tomassoni-domain unrelated SEO content.

**No government contact, no production database reads/writes, forecast feature/model/training/scoring changes, app/CI deployment, or private candidate data retained. Issue #864 stays open.**
