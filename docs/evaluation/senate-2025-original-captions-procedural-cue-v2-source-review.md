# #864 — Senate auto-caption procedural cue locator v2: correct false positives before using any review queue

**Scope:** metadata-only procedural-*candidate* windows in the exact **22 official 2025 LRL committee hearing media record** caption payloads, indexed dates with **no linked Minutes PDF**. Original source IDs/record-page HTML SHA/caption payload SHA are pinned in the successful original-source artifacts. This tool never certifies an actual recorded motion, named vote, vote time or historical publication day.

## Defect discovered from actual source, and why v1 is not an admissible motion-count numerator

The prior [one-time content scan #38107642535](https://github.com/killjoy00/votepredict/actions/runs/38107642535) actually verified **21/22 caption bodies** and returned **162 time/category regex cue windows** before a Jan 22 HTTP source failure. The strict one-source [retry #38108045386](https://github.com/killjoy00/votepredict/actions/runs/38108045386) verified the final original Jan 22 HTML/caption SHA and returned **five more v1 windows**. Therefore the old count **167 = 162 + 5** is **unreviewed v1 regex output**, NOT 167 distinct motions, roll calls or attributable statements; those values must **not** appear in a reported vote denominator.

Inspecting actual Jan 22 source output revealed two deterministic v1 defects:
1. Its neighborhood text slicing starts at the **middle of the \`data-time\` opening HTML tag**, and some unverified previews contain chunks of \`<span class="video_seek_link" ...>\` markup rather than intelligible spoken words.
2. Its broad \`move that\`/ \`move to\` procedural regex incorrectly flags normal topic discussion like **"strategic move that positions businesses"** and **"move to clean energy"** as if the committee had made a parliamentary motion.

## Strict source review v2

The fixed [pure parser](../../src/evidence/senate-committee-caption-motion-cues-v2.ts) builds each caption segment **after its entire opening tagged HTML element**, strips HTML, removes visible player clock tokens, and requires that **every \`data-time\` token be found in a complete opening HTML tag**. If markup changes, fail closed. Narrow procedural language includes explicit “I move”, “motion to”, “call the roll”, “motion prevailed”, committee recommendation, explicit tally terms, and voice-vote phrases. *Generic move that/to an issue* is never a parliamentary motion.

Each time-localized output is **only a cue category, candidate timestamp, original exact visible-context SHA, and repeated within-30-second hits**. It stores **no raw transcript, original caption text, preview, spoken member names or named sides**. Multiple mentions of the same phrase are NOT multiple motions; 30-second category groups are review location buckets and cannot count unique bill actions. Up to 120 cue windows per hearing are stored, with overflow exposed. Human actual audio playback and speaker/bill/motion-adjudication remain necessary.

The [one-time original workflow](../../.github/workflows/senate-2025-22-caption-motion-cues-v2.yml) reuses the three successful original source artifacts (2025 official dated 22 URLs, SHA-hashed HTML, original caption body SHA/bytes and time-marker counts), allowing **only the same 22 original sources**. Original HTML capped at 600KB, caption bodies 1.5MB, two concurrent source fetches, no redirects, 30-second per response timeout. Rechecks original SHA before analyzing. The original 2025 v1 first-run **failure**, and its single-source **successful retry**, stay separately recorded; neither is rewritten as a single 22/22 success.

**Acceptance:** obtain independently verified **actual** v2 source artifact ZIP+JSON checksums, source successes/failures, exact tagged timestamp counts and candidate cue categories. Report source *research locations* only; never infer 2021–2025 recorded vote denominator, automatic member YEA/NAY, pre-vote publication, direct speaker attribution or policy stance.

**Other gaps unchanged:** seven 2022–25 caption-inaccessible audio/no-timed-caption records; official 2021 print-only minutes; 2022 print/electronic discrepancy; original source-to-private member/evidence row parity; CFB legally owed finance, original campaign-site as-of pages and verified media-quote denominators. No production/private DB, model/forecast/training/serving/scheduler/floor/2027 change, and no public office contact. Keep #864 OPEN.
