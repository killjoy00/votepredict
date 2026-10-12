import { createHash } from 'node:crypto';

/**
 * Offline evidence-quality tools. These deliberately do not participate in
 * Revisor's live version selector, historical forecast replay, or DB writes.
 * A Revisor "Posted on" calendar date is not a proved first-public timestamp.
 */
export const MINNESOTA_VOTE_TEXT_AUDIT_VERSION = 'mn-vote-text-alignment-audit-v1' as const;

export type LegislativeTextFamily = 'engrossment' | 'unofficial_engrossment' | 'conference_report';
export interface OfficialBillTextVersionLead {
  versionKey: string;
  versionPath: string;
  family: LegislativeTextFamily;
  postedOn: string;
  textUrl: string;
  /** A displayed posting date is NOT independent historical availability proof. */
  independentlyVerifiedPublicBy: null;
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function officialRevisorStatusRoot(sourceUrl: string): URL {
  const url = new URL(sourceUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'www.revisor.mn.gov'
    || !/^\/bills\/\d{2,3}\/\d{4}\/0\/(?:HF|SF)\/\d+\/$/i.test(url.pathname)
    || url.search || url.hash) {
    throw new Error('Expected an exact official Revisor bill-status URL');
  }
  return url;
}

/**
 * Shadow-discover all three official text families without broadening the
 * production version selector, which has separate as-of behavior.
 * Does not claim a page-wide complete inventory if markup changes.
 */
export function discoverRevisorBillTextVersionLeads(
  html: string,
  statusUrl: string,
): OfficialBillTextVersionLead[] {
  const base = officialRevisorStatusRoot(statusUrl);
  const rows = new Map<string, OfficialBillTextVersionLead>();
  const pattern = /<a\b[^>]*href=["']([^"']*versions\/(?:\d+|ue\/\d+|ccr\/[a-z0-9]+)\/)["'][^>]*>([\s\S]*?)<\/a>[\s\S]{0,240}?Posted on\s*(\d{2})\/(\d{2})\/(\d{4})/gi;
  for (const match of html.matchAll(pattern)) {
    let link: URL;
    try {
      link = new URL(match[1], base);
    } catch {
      continue;
    }
    if (link.protocol !== 'https:' || link.hostname !== base.hostname || link.search || link.hash
      || !link.pathname.startsWith(base.pathname)) continue;
    const versionPath = link.pathname.slice(base.pathname.length);
    if (!/^versions\/(?:\d+|ue\/\d+|ccr\/[a-z0-9]+)\/$/i.test(versionPath)) continue;
    const postedOn = match[5] + '-' + match[3] + '-' + match[4];
    const versionKey = match[2].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
    if (!versionKey || !isDate(postedOn)) continue;
    const family: LegislativeTextFamily = versionPath.startsWith('versions/ue/')
      ? 'unofficial_engrossment'
      : versionPath.startsWith('versions/ccr/')
        ? 'conference_report'
        : 'engrossment';
    const row: OfficialBillTextVersionLead = {
      versionKey, versionPath, family, postedOn, textUrl: link.toString(),
      independentlyVerifiedPublicBy: null,
    };
    const previous = rows.get(versionPath);
    if (previous && (previous.versionKey !== row.versionKey || previous.postedOn !== postedOn)) {
      throw new Error('Conflicting official version-list entries for ' + versionPath);
    }
    rows.set(versionPath, row);
  }
  return [...rows.values()];
}

export interface VoteTextAuditEvent {
  eventKey: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billIdentifier: string | null;
  voteKind: 'passage' | 'amendment' | 'motion' | 'procedural' | 'other';
  motionText: string;
  amendmentRef?: string | null;
  officialSourceUrl: string;
  officialSourceSha256: string | null;
}

export interface AuditedLegislativeText {
  textId: string;
  session: string;
  billIdentifier: string;
  kind: 'bill_version' | 'amendment_text' | 'conference_report';
  amendmentRef?: string | null;
  versionKey: string;
  officialSourceUrl: string;
  contentSha256: string | null;
  postedOn: string | null;
  /** Null unless corroborated independently; never populated from postedOn. */
  independentlyVerifiedPublicBy: string | null;
  retrievedAt: string | null;
}

export interface ProposedVoteTextLink {
  eventKey: string;
  textId: string;
  /** A number match is not proof of a text-to-event link. */
  proofKind: 'bill_number_only' | 'reviewed_official_event_text_match';
  /** Independent primary record identifying the event and document, not a topic. */
  proofUrl?: string;
  proofLocator?: string;
  proofEventSourceSha256?: string;
  proofTextSha256?: string;
}

export type VoteTextLinkStatus =
  'bill_only' | 'no_text_link' | 'missing_text_document' | 'bill_conflict'
  | 'later_version_conflict' | 'missing_amendment_text' | 'ambiguous_text_links'
  | 'unproven_text_match' | 'reviewed_exact_text_link';

export interface VoteTextAuditResult {
  eventKey: string;
  status: VoteTextLinkStatus;
  linkedTextIds: string[];
  /** Motions and omnibus passage votes never establish provision-level support. */
  provisionSupportInferred: false;
  historicalCutoffEligibility: 'unknown' | 'proven_before_cutoff' | 'not_proven_before_cutoff';
  reasoning: string;
}

const SHA256 = /^[a-f0-9]{64}$/i;

export function auditVoteTextLinks(input: {
  events: readonly VoteTextAuditEvent[];
  texts: readonly AuditedLegislativeText[];
  links: readonly ProposedVoteTextLink[];
  cutoffAt?: string;
}): VoteTextAuditResult[] {
  const eventIds = new Set<string>();
  for (const event of input.events) {
    if (!event.eventKey || eventIds.has(event.eventKey) || !isDate(event.occurredOn)) {
      throw new Error('Duplicate or invalid vote event identity');
    }
    eventIds.add(event.eventKey);
  }
  const texts = new Map<string, AuditedLegislativeText>();
  for (const text of input.texts) {
    if (!text.textId || texts.has(text.textId)
      || (text.postedOn !== null && !isDate(text.postedOn))) {
      throw new Error('Duplicate text identity or invalid text date');
    }
    texts.set(text.textId, text);
  }
  for (const link of input.links) {
    if (!eventIds.has(link.eventKey)) throw new Error('Orphan proposed vote-text link');
  }
  const cutoffAt = input.cutoffAt;
  if (cutoffAt !== undefined && Number.isNaN(Date.parse(cutoffAt))) {
    throw new Error('Invalid cutoff timestamp');
  }

  return input.events.map((event) => {
    const proposals = input.links.filter((link) => link.eventKey === event.eventKey);
    const linkedTextIds = [...new Set(proposals.map((link) => link.textId))];
    const result = (
      status: VoteTextLinkStatus,
      reasoning: string,
      eligibility: VoteTextAuditResult['historicalCutoffEligibility'] = 'unknown',
    ): VoteTextAuditResult => ({
      eventKey: event.eventKey, status, linkedTextIds,
      provisionSupportInferred: false,
      historicalCutoffEligibility: eligibility, reasoning,
    });
    if (!proposals.length) return result(event.billIdentifier ? 'bill_only' : 'no_text_link', 'No event-specific text proof');
    const paired = proposals.map((link) => ({ link, text: texts.get(link.textId) }));
    if (paired.some((pair) => !pair.text)) return result('missing_text_document', 'Proposed text ID absent from archive');
    if (paired.some(({ text }) => text!.session !== event.session
      || text!.billIdentifier !== event.billIdentifier)) {
      return result('bill_conflict', 'Text session or bill does not match recorded event');
    }
    if (paired.some(({ text }) => text!.postedOn !== null && text!.postedOn > event.occurredOn)) {
      return result('later_version_conflict', 'Official version was posted after the event; exact text cannot be assumed');
    }
    if (event.voteKind === 'amendment'
      && !paired.some(({ text }) => text!.kind === 'amendment_text'
        && Boolean(event.amendmentRef)
        && text!.amendmentRef?.toUpperCase() === event.amendmentRef?.toUpperCase())) {
      return result('missing_amendment_text', 'Amendment decision requires its exact identified amendment text');
    }
    if (paired.filter(({ text }) => text!.kind === 'bill_version').length > 1
      || paired.filter(({ text }) => text!.kind === 'conference_report').length > 1) {
      return result('ambiguous_text_links', 'Multiple competing bill or conference texts; no single assumed version');
    }
    if (paired.some(({ link, text }) => link.proofKind !== 'reviewed_official_event_text_match'
      || !link.proofUrl || !link.proofLocator || !text!.contentSha256
      || !SHA256.test(text!.contentSha256)
      || !event.officialSourceSha256 || !SHA256.test(event.officialSourceSha256)
      || link.proofEventSourceSha256 !== event.officialSourceSha256
      || link.proofTextSha256 !== text!.contentSha256)) {
      return result('unproven_text_match', 'Bill/URL similarity or incomplete original-source review is insufficient');
    }
    // The independent-review assertions above are inputs, not automatic text
    // reconstruction. Proven historical availability is an orthogonal clock.
    let eligibility: VoteTextAuditResult['historicalCutoffEligibility'] = 'unknown';
    if (cutoffAt !== undefined) {
      const publicBy = paired.map(({ text }) => text!.independentlyVerifiedPublicBy);
      eligibility = publicBy.every((date) => date && !Number.isNaN(Date.parse(date))
        && Date.parse(date) < Date.parse(cutoffAt))
        ? 'proven_before_cutoff' : 'not_proven_before_cutoff';
    }
    return result('reviewed_exact_text_link', 'Consistent source-hashed, explicitly reviewed event-to-text evidence', eligibility);
  });
}

export interface SourceBackedTextChange {
  kind: 'added' | 'removed';
  line: number;
  excerpt: string;
}
export interface VersionTextComparison {
  algorithm: typeof MINNESOTA_VOTE_TEXT_AUDIT_VERSION;
  beforeSha256: string;
  afterSha256: string;
  status: 'compared' | 'needs_chunking';
  changedLines: number | null;
  changes: SourceBackedTextChange[];
  omittedChanges: number;
  /** No technical/substantive classifier is silently applied. */
  policyClassification: 'unclassified';
}

/** Bounded exact line comparison with original-content hashes and excerpts.
 * Larger omnibus texts explicitly require chunk/section-level comparison.
 */
export function compareLegislativeVersionTexts(
  before: string,
  after: string,
  maxLines = 1200,
  maxExcerpts = 80,
): VersionTextComparison {
  const beforeSha256 = createHash('sha256').update(before).digest('hex');
  const afterSha256 = createHash('sha256').update(after).digest('hex');
  const oldLines = before.replace(/\r\n/g, '\n').split('\n');
  const newLines = after.replace(/\r\n/g, '\n').split('\n');
  const baseline = {
    algorithm: MINNESOTA_VOTE_TEXT_AUDIT_VERSION, beforeSha256, afterSha256,
    changes: [] as SourceBackedTextChange[], omittedChanges: 0,
    policyClassification: 'unclassified' as const,
  };
  if (!Number.isInteger(maxLines) || maxLines < 1 || maxLines > 2000
    || !Number.isInteger(maxExcerpts) || maxExcerpts < 1 || maxExcerpts > 1000) {
    throw new Error('Invalid bounded text-diff limits');
  }
  if (oldLines.length > maxLines || newLines.length > maxLines) {
    return { ...baseline, status: 'needs_chunking', changedLines: null };
  }
  const width = newLines.length + 1;
  const dp = new Uint16Array((oldLines.length + 1) * width);
  for (let i = oldLines.length - 1; i >= 0; i--) {
    for (let j = newLines.length - 1; j >= 0; j--) {
      dp[i * width + j] = oldLines[i] === newLines[j]
        ? 1 + dp[(i + 1) * width + j + 1]
        : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
    }
  }
  let i = 0; let j = 0; let changedLines = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      i++; j++; continue;
    }
    const takeAddition = j < newLines.length && (i === oldLines.length
      || dp[i * width + j + 1] >= dp[(i + 1) * width + j]);
    const row: SourceBackedTextChange = takeAddition
      ? { kind: 'added', line: j + 1, excerpt: newLines[j].slice(0, 240) }
      : { kind: 'removed', line: i + 1, excerpt: oldLines[i].slice(0, 240) };
    changedLines++;
    if (baseline.changes.length < maxExcerpts) baseline.changes.push(row);
    if (takeAddition) j++; else i++;
  }
  return { ...baseline, status: 'compared', changedLines,
    omittedChanges: changedLines - baseline.changes.length };
}
