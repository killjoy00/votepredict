/**
 * Issue #864. ONE-TIME public HTML shape reconnaissance, Senate only.
 * No database, no candidate report downloads, no private contact details.
 * This probe is not a statutory reporting universe and cannot certify it.
 */
import { createHash } from 'node:crypto';

const origin = 'https://register.cfb.mn.gov';
const districts = ['6', '35', '64'] as const;
const segments = [2022, 2024, 2026] as const;
const pathRoot = '/reports-and-data/viewers/campaign-finance/districts-constitutional-offices/Senate/';

function stripTags(text: string) {
  return text.replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|amp|quot|#39);/g, ' ').replace(/\s+/g, ' ').trim();
}
function visibleCandidates(html: string) {
  // Exploratory, NOT a verified parser. Preserve only names that occur in
  // input-label shapes and previously familiar CFB candidate widget markup.
  const known = ['Abeler', 'Murphy', 'Oundo', 'Nelson'];
  return known.map(name => {
    const at = html.toLowerCase().indexOf(name.toLowerCase());
    if (at < 0) return null;
    const local = html.slice(Math.max(0, at - 200), Math.min(html.length, at + 240));
    return {
      name,
      offset: at,
      surroundingMarkupTokens: [...new Set([...local.matchAll(/<\/?([a-z][a-z0-9-]*)/gi)]
        .map(match => match[1].toLowerCase()))].slice(0, 15),
      // Avoid echoing freeform page text containing address, contact or finance details.
      nearestCandidatesHref: (local.match(/\/candidates\/\d{3,8}\/20\d{2}\//i) ?? [])[0] ?? null,
    };
  }).filter(Boolean);
}
function refs(html: string) {
  const matches = [...html.matchAll(/\/reports-and-data\/viewers\/campaign-finance\/candidates\/(\d{3,8})\/(20\d{2})\/?/gi)];
  return [...new Set(matches.map(m => m[1] + ':' + m[2]))].sort();
}
function candidateLookalikes(html: string) {
  // Only capture semantic field names and bounded link paths; do not echo values.
  const attributes = [...html.matchAll(/\b(?:name|id|class|data-[a-z-]+)=["']([^"']{1,110})["']/gi)]
    .map(x => x[1]).filter(x => /cand|senate|district|committee|segment|elect/i.test(x));
  return [...new Set(attributes)].slice(0, 30);
}

for (const district of districts) {
  for (const segment of segments) {
    const sourceUrl = origin + pathRoot + district + '/' + segment;
    try {
      const response = await fetch(sourceUrl, {
        headers: { 'user-agent': 'Mozilla/5.0 VotePredict/2.0 historical-cfb-source-proof' },
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000),
      });
      const target = new URL(response.url);
      if (target.protocol !== 'https:' || target.hostname !== 'register.cfb.mn.gov') {
        throw Error('Unexpected redirected source');
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 3_000_000) throw Error('HTML exceeded 3 MB bound');
      const text = new TextDecoder().decode(bytes);
      const links = refs(text);
      const matches = visibleCandidates(text);
      console.log(JSON.stringify({
        district, segment, status: response.status, finalUrl: response.url,
        sourceSha256: createHash('sha256').update(bytes).digest('hex'),
        responseBytes: bytes.byteLength, htmlTitle: stripTags(text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').slice(0, 100),
        pageHasExpectedSenateHeading: new RegExp('Senate\\s+' + district + '(?:\\D|$)', 'i').test(stripTags(text)),
        profileReferenceCount: links.length, profileReferenceSample: links.slice(0, 16),
        candidateNameLandmarks: matches,
        fieldNames: candidateLookalikes(text),
        scriptSrcCount: [...text.matchAll(/<script\b[^>]*\bsrc=/gi)].length,
        selectedFormCount: [...text.matchAll(/<form\b/gi)].length,
        missingPage: !response.ok,
        dataCompletenessCertified: false,
      }));
    } catch (error) {
      console.log(JSON.stringify({district,segment,status:'source_fetch_failed',error: error instanceof Error ? error.message.slice(0,120) : String(error).slice(0,120),dataCompletenessCertified:false}));
    }
  }
}
