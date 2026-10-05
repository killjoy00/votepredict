import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const SESSION = '2021-2022';
const MAX_LINK_CANDIDATES_PER_MEMBER = 16;
const MAX_VERIFIED_PUBLICATIONS_PER_MEMBER = 8;
let secrets: string[] = [];

function argumentValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(name + '='));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function mask(value: string) {
  if (value.length > 3) {
    console.log(
      '::add-mask::'
      + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'),
    );
  }
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 1200);
}

async function chooseDb(env: Record<string, string | undefined>) {
  const { Pool } = await import('pg');

  async function works(value: string) {
    const candidate = new Pool({
      connectionString: value,
      max: 1,
      connectionTimeoutMillis: 8_000,
    });
    try {
      await candidate.query('select 1');
      return true;
    } catch {
      return false;
    } finally {
      await candidate.end().catch(() => undefined);
    }
  }

  for (const key of DATABASE_CANDIDATES) {
    const value = env[key]?.trim();
    if (value && await works(value)) return value;
  }

  const secret = env.CRON_SECRET?.trim();
  if (!secret) throw new Error('CRON_SECRET unavailable');

  let lastBridgeError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(DATABASE_BRIDGE_URL, {
        method: 'POST',
        headers: { authorization: 'Bearer ' + secret },
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
      const value = (await response.text()).trim();
      secrets.push(value);
      mask(value);
      if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
      return value;
    } catch (error) {
      lastBridgeError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
  }

  throw lastBridgeError instanceof Error
    ? lastBridgeError
    : new Error('Database bridge failed after bounded retries');
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function normalizeText(value: string): string {
  return decodeEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedHost(value: string): string {
  return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
}

function unwrapWaybackUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.hostname.toLowerCase() !== 'web.archive.org') return parsed.toString();
    const match = parsed.pathname.match(/^\/web\/\d{14}(?:[a-z_]+)?\/(https?:\/\/.*)$/i);
    if (!match?.[1]) return null;
    return new URL(decodeURIComponent(match[1]) + parsed.search).toString();
  } catch {
    return null;
  }
}

function canonicalOriginalUrl(value: string): string | null {
  const unwrapped = unwrapWaybackUrl(value);
  if (!unwrapped) return null;
  try {
    const url = new URL(unwrapped);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_') || ['fbclid','gclid','ref','source'].includes(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return null;
  }
}

function articleCandidateScore(url: string, linkText: string, profileUrl: string): number {
  const parsed = new URL(url);
  const profile = new URL(profileUrl);
  const path = parsed.pathname.toLowerCase();
  const profilePath = profile.pathname.replace(/\/+$/, '').toLowerCase();
  const candidatePath = path.replace(/\/+$/, '');
  if (!candidatePath || candidatePath === profilePath) return -100;
  if (/\.(?:jpg|jpeg|png|gif|svg|webp|pdf|docx?|xlsx?|zip)$/i.test(path)) return -100;
  if (
    /\/(?:author|home\/members|members?|senators?|about|contact|events?|category|tag|feed|wp-content|wp-json|search|privacy|terms|donate|join|leadership)(?:\/|$)/i.test(path)
  ) return -100;

  let score = 0;
  const segments = path.split('/').filter(Boolean);
  if (segments.length >= 2) score += 2;
  if (/\b202[12]\b/.test(path)) score += 3;
  if (/press|release|news|statement|update|bill|budget|fund|legislat|senator|committee|school|health|tax|transport|public-safety/i.test(path)) score += 2;
  if (linkText.length >= 18) score += 2;
  if (/read more|continue reading/i.test(linkText)) score -= 1;
  return score;
}

function profileArticleLinks(rawHtml: string, archiveUrl: string, originalProfileUrl: string): Array<{
  url: string;
  linkText: string;
  score: number;
}> {
  const profileHost = normalizedHost(originalProfileUrl);
  const best = new Map<string, { url: string; linkText: string; score: number }>();
  for (const match of rawHtml.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const rawHref = decodeEntities(match[1] ?? '');
    let resolved: string;
    try {
      resolved = new URL(rawHref, archiveUrl).toString();
    } catch {
      continue;
    }
    const original = canonicalOriginalUrl(resolved);
    if (!original) continue;
    if (normalizedHost(original) !== profileHost) continue;
    const linkText = normalizeText(match[2] ?? '');
    const score = articleCandidateScore(original, linkText, originalProfileUrl);
    if (score < 0) continue;
    const prior = best.get(original);
    if (!prior || score > prior.score || linkText.length > prior.linkText.length) {
      best.set(original, { url: original, linkText, score });
    }
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score || b.linkText.length - a.linkText.length || a.url.localeCompare(b.url));
}

type TargetRow = {
  membership_id: string;
  legislator_id: string;
  member_name: string;
  party: string;
  district: string;
  external_key: string;
};

type AnchorRow = {
  membership_id: string;
  source_document_id: string;
  archive_url: string;
  original_url: string;
  archive_captured_at: string | null;
};

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('Production env file required');
  const env = parseRuntimeEnvironment(readFileSync(envFile, 'utf8'));
  secrets = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secrets.forEach(mask);

  process.env.DATABASE_URL = await chooseDb(env);
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  const { fetchPublicPage, publicPageMentionsPerson } = await import('../src/evidence/public-http.js');
  const { discoverWaybackCaptures, fetchWaybackSnapshot } = await import('../src/evidence/wayback.js');
  const {
    selectWaybackEvidenceCaptures,
    sessionArchiveWindow,
  } = await import('../src/evidence/wayback-public-evidence-backfill.js');

  try {
    const targets = (await pool.query<TargetRow>(`
      WITH substantive AS (
        SELECT
          m.id AS membership_id,
          count(ei.id) FILTER (
            WHERE (
              sd.source_kind='senate_member_primary_historical_article'
              OR sd.source_kind='wayback_campaign_site'
              OR (
                sd.source_kind='wayback_member_primary'
                AND coalesce(ei.metadata->>'subtype','') <> 'archived_member_primary_profile'
              )
            )
          )::int AS substantive_items,
          count(DISTINCT sd.id) FILTER (
            WHERE sd.source_kind='wayback_member_primary'
              AND ei.metadata->>'subtype'='archived_member_primary_profile'
          )::int AS profile_anchor_sources
        FROM memberships m
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
        LEFT JOIN evidence_items ei ON ei.membership_id=m.id
        LEFT JOIN source_documents sd ON sd.id=ei.source_document_id
        WHERE s.slug=$1
          AND c.slug='senate'
        GROUP BY m.id
      )
      SELECT
        m.id::text AS membership_id,
        m.legislator_id::text AS legislator_id,
        l.name AS member_name,
        m.party,
        m.district,
        l.external_key
      FROM memberships m
      JOIN legislators l ON l.id=m.legislator_id
      JOIN legislative_sessions s ON s.id=m.session_id
      JOIN chambers c ON c.id=m.chamber_id
      JOIN substantive sub ON sub.membership_id=m.id
      WHERE s.slug=$1
        AND c.slug='senate'
        AND sub.substantive_items=0
        AND sub.profile_anchor_sources>0
      ORDER BY l.name,m.id
    `, [SESSION])).rows;

    const membershipIds = targets.map((target) => target.membership_id);
    if (targets.length !== 7) {
      throw new Error('Expected exactly 7 zero-substantive Senate memberships with verified profile anchors; found ' + targets.length);
    }

    const anchors = (await pool.query<AnchorRow>(`
      SELECT
        ei.membership_id::text AS membership_id,
        sd.id::text AS source_document_id,
        sd.source_url AS archive_url,
        coalesce(sd.metadata->>'originalUrl',ei.metadata->>'originalUrl') AS original_url,
        coalesce(sd.metadata->>'archiveCapturedAt',ei.metadata->>'archiveCapturedAt') AS archive_captured_at
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id=ei.source_document_id
      WHERE ei.membership_id = ANY($1::uuid[])
        AND sd.source_kind='wayback_member_primary'
        AND ei.metadata->>'subtype'='archived_member_primary_profile'
        AND coalesce(sd.metadata->>'identityProof',ei.metadata->>'identityProof')='archived_profile_member_and_historical_district'
        AND coalesce(sd.metadata->>'originalUrl',ei.metadata->>'originalUrl') ~ '^https?://'
      ORDER BY ei.membership_id,archive_captured_at,sd.id
    `, [membershipIds])).rows;

    const anchorsByMembership = new Map<string, AnchorRow[]>();
    for (const anchor of anchors) {
      const list = anchorsByMembership.get(anchor.membership_id) ?? [];
      list.push(anchor);
      anchorsByMembership.set(anchor.membership_id, list);
    }

    const window = sessionArchiveWindow(SESSION);
    const results: Array<Record<string, unknown>> = [];
    let anchorPagesFetched = 0;
    let uniqueLinksDiscovered = 0;
    let articleCaptureQueries = 0;
    let articleSnapshotsFetched = 0;
    let verifiedPublicationCandidates = 0;
    let failures = 0;

    for (const target of targets) {
      const targetAnchors = anchorsByMembership.get(target.membership_id) ?? [];
      const candidateMap = new Map<string, {
        url: string;
        linkText: string;
        score: number;
        discoveredFrom: Set<string>;
      }>();
      const targetFailures: string[] = [];

      for (const anchor of targetAnchors) {
        try {
          const page = await fetchPublicPage(anchor.archive_url, {
            timeoutMs: 20_000,
            maxBytes: 2_500_000,
            userAgent: 'VotePredict/2.0 senate-publication-anchor-probe',
          });
          anchorPagesFetched += 1;
          for (const candidate of profileArticleLinks(page.rawContent, anchor.archive_url, anchor.original_url)) {
            const current = candidateMap.get(candidate.url);
            if (!current) {
              candidateMap.set(candidate.url, {
                ...candidate,
                discoveredFrom: new Set([anchor.source_document_id]),
              });
            } else {
              current.discoveredFrom.add(anchor.source_document_id);
              if (candidate.score > current.score) current.score = candidate.score;
              if (candidate.linkText.length > current.linkText.length) current.linkText = candidate.linkText;
            }
          }
        } catch (error) {
          failures += 1;
          if (targetFailures.length < 5) targetFailures.push('anchor_fetch: ' + safe(error));
        }
      }

      const rankedCandidates = [...candidateMap.values()]
        .sort((a, b) =>
          b.discoveredFrom.size - a.discoveredFrom.size
          || b.score - a.score
          || b.linkText.length - a.linkText.length
          || a.url.localeCompare(b.url))
        .slice(0, MAX_LINK_CANDIDATES_PER_MEMBER);
      uniqueLinksDiscovered += candidateMap.size;

      const verified: Array<Record<string, unknown>> = [];
      const probes: Array<Record<string, unknown>> = [];

      for (const candidate of rankedCandidates) {
        if (verified.length >= MAX_VERIFIED_PUBLICATIONS_PER_MEMBER) break;
        articleCaptureQueries += 1;
        try {
          const captures = await discoverWaybackCaptures({
            url: candidate.url,
            from: window.from,
            to: window.to,
            limit: 60,
          });
          const selected = selectWaybackEvidenceCaptures(captures, { maxCaptures: 1 });
          if (selected.length === 0) {
            probes.push({
              url: candidate.url,
              linkText: candidate.linkText,
              discoveredFromProfileAnchors: candidate.discoveredFrom.size,
              capturesDiscovered: captures.length,
              status: 'no_in_session_capture_selected',
            });
            continue;
          }

          const capture = selected[0];
          const page = await fetchWaybackSnapshot(capture);
          articleSnapshotsFetched += 1;
          const mentionsMember = publicPageMentionsPerson(page.text, target.member_name);
          const enoughText = page.text.length >= 250;
          const accepted = mentionsMember && enoughText;

          probes.push({
            url: candidate.url,
            linkText: candidate.linkText,
            discoveredFromProfileAnchors: candidate.discoveredFrom.size,
            capturesDiscovered: captures.length,
            selectedCapturedAt: capture.capturedAt,
            title: page.title ?? null,
            publishedAt: page.publishedAt ?? null,
            mentionsMember,
            readableCharacters: page.text.length,
            status: accepted ? 'verified_publication_candidate' : 'rejected_content_check',
          });

          if (!accepted) continue;
          verified.push({
            memberName: target.member_name,
            membershipId: target.membership_id,
            sourceUrl: candidate.url,
            archiveUrl: capture.archiveUrl,
            archiveCapturedAt: capture.capturedAt,
            archiveDigest: capture.digest,
            title: page.title ?? (candidate.linkText || null),
            nativePublishedAt: page.publishedAt ?? null,
            availabilityBound: capture.capturedAt,
            availabilityBoundKind: 'exact_archive_capture',
            discoveredFromProfileSourceDocumentIds: [...candidate.discoveredFrom],
            mentionsMember: true,
            textSha256: page.contentSha256,
            bytes: page.bytes,
          });
          verifiedPublicationCandidates += 1;
        } catch (error) {
          failures += 1;
          if (targetFailures.length < 5) targetFailures.push('article_probe: ' + safe(error));
          probes.push({
            url: candidate.url,
            linkText: candidate.linkText,
            discoveredFromProfileAnchors: candidate.discoveredFrom.size,
            status: 'probe_failed',
            error: safe(error),
          });
        }
      }

      results.push({
        membershipId: target.membership_id,
        memberName: target.member_name,
        party: target.party,
        district: target.district,
        verifiedProfileAnchors: targetAnchors.length,
        uniqueSameSiteLinksDiscovered: candidateMap.size,
        boundedLinksProbed: rankedCandidates.length,
        verifiedPublicationCandidates: verified.length,
        publications: verified,
        probes,
        failures: targetFailures,
      });
    }

    const output = {
      senate2021PublicationAnchorProbe: {
        schemaVersion: 'senate-2021-publication-anchor-probe-v1',
        session: SESSION,
        targets: results,
        totals: {
          targetMemberships: targets.length,
          profileAnchors: anchors.length,
          anchorPagesFetched,
          uniqueLinksDiscovered,
          articleCaptureQueries,
          articleSnapshotsFetched,
          verifiedPublicationCandidates,
          failures,
        },
        policy: {
          readOnly: true,
          verifiedProfileAnchorRequired: true,
          sameSiteLinksOnly: true,
          inSessionArchiveCaptureRequired: true,
          articleMustMentionMember: true,
          archiveCaptureIsAvailabilityUpperBound: true,
          firstPublicationNotInferredFromCapture: true,
          ambiguousIdentityOrContentFailsClosed: true,
          sameDayEligible: false,
          contextOnly: true,
          mechanicallyActionable: false,
          modelWeight: 0,
          servingChanged: false,
          productionAction: 'none',
        },
      },
    };

    const outputPath = argumentValue('--output');
    if (outputPath) {
      mkdirSync(dirname(resolve(outputPath)), { recursive: true });
      writeFileSync(resolve(outputPath), JSON.stringify(output, null, 2) + '\n', 'utf8');
    }
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
