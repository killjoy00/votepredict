import { createHash } from 'node:crypto';
import campaignSnapshotJson from '../../data/cfb-2025-2026-snapshot.json';
import gamblingManifestJson from '../../data/evidence/gambling-curated-v1.json';
import { pool } from '@/lib/db';
import { auditBillFeature } from '@/features/feature-audit';
import { BILL_FEATURE_SCHEMA_VERSION, DETERMINISTIC_EXTRACTOR_VERSION } from '@/features/bills';
import { fetchRevisorBill } from '@/sources/minnesota/revisor';
import { getCampaignFinanceContexts } from '@/evidence/campaign-finance-snapshot';
import {
  persistDurableEvidence,
  type DurableEvidenceDraft,
  type DurableEvidenceFreshness,
  type DurableEvidenceKind,
  type DurableEvidenceRelevance,
  type DurableEvidenceSourceQuality,
  type DurableEvidenceStance,
} from '@/evidence/durable-ingestion';

type CampaignSnapshot = {
  schemaVersion: string;
  generatedAt: string;
  cycleYears: number[];
  provenance: {
    contributions: { url: string; contentSha256: string; cycleRows: number; bytes?: number };
    independentExpenditures: { url: string; contentSha256: string; cycleRows: number; bytes?: number };
  };
};

type ManifestSource = {
  sourceKind: string;
  sourceUrl: string;
  sessionSlug?: string;
  chamberSlug?: string;
  publisher?: string;
};

type ManifestTarget = {
  memberName?: string;
  memberNames?: string[];
  billIdentifier?: string;
  sessionSlug?: string;
  chamberSlug?: string;
  occurredOn?: string;
};

type ManifestRecord = {
  source: ManifestSource;
  target?: ManifestTarget;
  kind: DurableEvidenceKind;
  stance?: DurableEvidenceStance;
  claim: string;
  excerpt?: string;
  publishedAt?: string;
  sourceQuality: DurableEvidenceSourceQuality;
  relevance: DurableEvidenceRelevance;
  freshness?: DurableEvidenceFreshness;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

type EvidenceManifest = {
  sourceSystem: string;
  version: string;
  jurisdictionSlug?: string;
  records: ManifestRecord[];
};

type FetchedSource = {
  contentSha256: string;
  fetchedAt: string;
  httpStatus: number;
  bytes: number;
  contentType?: string;
};

type MembershipRow = { membership_id: string; name: string; chamber_slug: string };

const campaignSnapshot = campaignSnapshotJson as CampaignSnapshot;
const gamblingManifest = gamblingManifestJson as EvidenceManifest;

function money(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function freshness(dateValue: string | undefined): DurableEvidenceFreshness {
  if (!dateValue) return 'unknown';
  const date = new Date(dateValue.includes('T') ? dateValue : `${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const ageDays = (Date.now() - date.getTime()) / 86_400_000;
  if (ageDays <= 365) return 'current';
  if (ageDays <= 1095) return 'recent';
  return 'stale';
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 1800);
}

async function startRun(sourceSystem: string, scope: string, metadata: Record<string, unknown>): Promise<string> {
  const result = await pool.query<{ id: string }>(`
    INSERT INTO ingestion_runs (source_system, scope, status, metadata)
    VALUES ($1,$2,'running',$3::jsonb)
    RETURNING id::text`, [sourceSystem, scope, JSON.stringify(metadata)]);
  return result.rows[0].id;
}

async function completeRun(id: string, metadata: Record<string, unknown>, sourceDocuments?: number, unresolvedMembers?: number): Promise<void> {
  await pool.query(`
    UPDATE ingestion_runs
       SET status='complete', finished_at=now(),
           source_documents=COALESCE($2,source_documents),
           unresolved_members=COALESCE($3,unresolved_members),
           metadata=metadata || $4::jsonb
     WHERE id=$1::uuid`, [id, sourceDocuments ?? null, unresolvedMembers ?? null, JSON.stringify(metadata)]);
}

async function failRun(id: string, error: unknown): Promise<void> {
  await pool.query(`
    UPDATE ingestion_runs SET status='failed', finished_at=now(), error_summary=$2
    WHERE id=$1::uuid`, [id, safeMessage(error)]).catch(() => undefined);
}

async function persistCampaignFinanceEvidence() {
  const runId = await startRun('mn-cfb', `campaign-finance:${campaignSnapshot.cycleYears.join('-')}`, {
    snapshotSchemaVersion: campaignSnapshot.schemaVersion,
    snapshotGeneratedAt: campaignSnapshot.generatedAt,
    execution: 'vercel-runtime',
  });
  try {
    const memberships = await pool.query<MembershipRow>(`
      SELECT m.id::text AS membership_id, l.name, c.slug AS chamber_slug
        FROM memberships m
        JOIN legislators l ON l.id=m.legislator_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
       WHERE s.is_current=true
         AND (m.starts_on IS NULL OR m.starts_on<=current_date)
         AND (m.ends_on IS NULL OR m.ends_on>=current_date)
       ORDER BY c.slug,l.name`);
    const contexts = getCampaignFinanceContexts(memberships.rows.map((membership) => ({
      membershipId: membership.membership_id,
      memberName: membership.name,
      chamber: membership.chamber_slug,
    })));

    const contributionDrafts: DurableEvidenceDraft[] = contexts.flatMap((context) => context.contributions ? [{
      target: { membershipId: context.membershipId },
      kind: 'context',
      stance: 'neutral',
      claim: `${campaignSnapshot.cycleYears.join('-')} campaign committee receipts total ${money(context.contributions.totalAmount)} across ${context.contributions.transactionCount.toLocaleString('en-US')} itemized records.`,
      publishedAt: context.contributions.latestReceiptDate ? `${context.contributions.latestReceiptDate}T00:00:00.000Z` : undefined,
      sourceQuality: 'official',
      relevance: 'low',
      freshness: freshness(context.contributions.latestReceiptDate),
      extractionMethod: 'deterministic-cfb-bulk-aggregate',
      extractionVersion: campaignSnapshot.schemaVersion,
      confidence: 1,
      metadata: {
        contextType: 'campaign_finance',
        subtype: 'candidate_contributions',
        contextOnly: true,
        mechanicallyActionable: false,
        committeeName: context.committeeName,
        candidateName: context.candidateName,
        registrationNumber: context.registrationNumber,
        cycleYears: campaignSnapshot.cycleYears,
        totalAmount: context.contributions.totalAmount,
        transactionCount: context.contributions.transactionCount,
        latestReceiptDate: context.contributions.latestReceiptDate,
        topContributors: context.contributions.topContributors,
        byContributorType: context.contributions.byContributorType,
        topEmployers: context.contributions.topEmployers,
      },
    }] : []);

    const independentDrafts: DurableEvidenceDraft[] = contexts.flatMap((context) => context.independentExpenditures ? [{
      target: { membershipId: context.membershipId },
      kind: 'context',
      stance: 'neutral',
      claim: `${campaignSnapshot.cycleYears.join('-')} independent expenditures affecting this candidate total ${money(context.independentExpenditures.totalAmount)} across ${context.independentExpenditures.transactionCount.toLocaleString('en-US')} records (${money(context.independentExpenditures.forAmount)} supporting; ${money(context.independentExpenditures.againstAmount)} opposing).`,
      publishedAt: context.independentExpenditures.latestDate ? `${context.independentExpenditures.latestDate}T00:00:00.000Z` : undefined,
      sourceQuality: 'official',
      relevance: 'low',
      freshness: freshness(context.independentExpenditures.latestDate),
      extractionMethod: 'deterministic-cfb-bulk-aggregate',
      extractionVersion: campaignSnapshot.schemaVersion,
      confidence: 1,
      metadata: {
        contextType: 'campaign_finance',
        subtype: 'independent_expenditures',
        contextOnly: true,
        mechanicallyActionable: false,
        committeeName: context.committeeName,
        candidateName: context.candidateName,
        registrationNumber: context.registrationNumber,
        cycleYears: campaignSnapshot.cycleYears,
        totalAmount: context.independentExpenditures.totalAmount,
        transactionCount: context.independentExpenditures.transactionCount,
        forAmount: context.independentExpenditures.forAmount,
        againstAmount: context.independentExpenditures.againstAmount,
        latestDate: context.independentExpenditures.latestDate,
        topSpenders: context.independentExpenditures.topSpenders,
      },
    }] : []);

    const contributions = await persistDurableEvidence({
      sourceKind: 'campaign_finance_bulk',
      sourceUrl: campaignSnapshot.provenance.contributions.url,
      contentSha256: campaignSnapshot.provenance.contributions.contentSha256,
      fetchedAt: campaignSnapshot.generatedAt,
      metadata: {
        publisher: 'Minnesota Campaign Finance and Public Disclosure Board',
        dataset: 'candidate_contributions',
        cycleYears: campaignSnapshot.cycleYears,
        snapshotSchemaVersion: campaignSnapshot.schemaVersion,
        rows: campaignSnapshot.provenance.contributions.cycleRows,
        bytes: campaignSnapshot.provenance.contributions.bytes,
      },
    }, contributionDrafts);
    const independent = await persistDurableEvidence({
      sourceKind: 'campaign_finance_bulk',
      sourceUrl: campaignSnapshot.provenance.independentExpenditures.url,
      contentSha256: campaignSnapshot.provenance.independentExpenditures.contentSha256,
      fetchedAt: campaignSnapshot.generatedAt,
      metadata: {
        publisher: 'Minnesota Campaign Finance and Public Disclosure Board',
        dataset: 'independent_expenditures',
        cycleYears: campaignSnapshot.cycleYears,
        snapshotSchemaVersion: campaignSnapshot.schemaVersion,
        rows: campaignSnapshot.provenance.independentExpenditures.cycleRows,
        bytes: campaignSnapshot.provenance.independentExpenditures.bytes,
      },
    }, independentDrafts);

    const result = {
      currentMemberships: memberships.rows.length,
      matchedMemberships: contexts.length,
      unmatchedMemberships: memberships.rows.length - contexts.length,
      contributionEvidence: contributionDrafts.length,
      independentExpenditureEvidence: independentDrafts.length,
      inserted: contributions.inserted + independent.inserted,
      reused: contributions.reused + independent.reused,
      snapshotGeneratedAt: campaignSnapshot.generatedAt,
    };
    await completeRun(runId, result, 2, result.unmatchedMemberships);
    return result;
  } catch (error) {
    await failRun(runId, error);
    throw error;
  }
}

function evidenceBillTargets(): Array<{ identifier: string; sessionSlug: string }> {
  const unique = new Map<string, { identifier: string; sessionSlug: string }>();
  for (const record of gamblingManifest.records) {
    if (record.source.sourceKind !== 'official_bill_status') continue;
    const identifier = record.target?.billIdentifier?.trim().toUpperCase();
    const sessionSlug = record.target?.sessionSlug?.trim();
    if (!identifier || !sessionSlug) throw new Error('official_bill_status evidence requires billIdentifier and sessionSlug');
    unique.set(`${sessionSlug}:${identifier}`, { identifier, sessionSlug });
  }
  return [...unique.values()].sort((a, b) => `${a.sessionSlug}:${a.identifier}`.localeCompare(`${b.sessionSlug}:${b.identifier}`));
}

async function seedEvidenceBills() {
  const targets = evidenceBillTargets();
  const runId = await startRun('mn-revisor-evidence-bills', `manifest:${gamblingManifest.version}`, {
    manifestVersion: gamblingManifest.version,
    requestedBills: targets.length,
    execution: 'vercel-runtime',
  });
  let inserted = 0;
  let updated = 0;
  try {
    for (const target of targets) {
      const official = await fetchRevisorBill(target.sessionSlug, target.identifier, true);
      if (!official.text || !official.textSha256) throw new Error(`Revisor text missing for ${target.identifier}`);
      const latestVersion = official.versions.at(-1);
      if (!latestVersion?.postedOn) throw new Error(`Revisor version date missing for ${target.identifier}`);
      const title = official.description || official.title;
      const chamberSlug = target.identifier.startsWith('HF') ? 'house' : 'senate';
      const scope = await pool.query<{ session_id: string; chamber_id: string }>(`
        SELECT s.id::text AS session_id,c.id::text AS chamber_id
          FROM legislative_sessions s
          JOIN jurisdictions j ON j.id=s.jurisdiction_id
          JOIN chambers c ON c.jurisdiction_id=j.id AND c.slug=$2
         WHERE j.slug='us-mn' AND s.slug=$1
         LIMIT 2`, [target.sessionSlug, chamberSlug]);
      if (scope.rows.length !== 1) throw new Error(`Session/chamber scope could not be resolved for ${target.sessionSlug} ${target.identifier}`);

      const existing = await pool.query<{ id: string }>(`SELECT id::text FROM bills WHERE session_id=$1::uuid AND identifier=$2`, [scope.rows[0].session_id, target.identifier]);
      const bill = await pool.query<{ id: string }>(`
        INSERT INTO bills (session_id,originating_chamber_id,identifier,title,status,source_url,metadata)
        VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7::jsonb)
        ON CONFLICT (session_id,identifier) DO UPDATE SET
          originating_chamber_id=COALESCE(bills.originating_chamber_id,EXCLUDED.originating_chamber_id),
          title=EXCLUDED.title,status=EXCLUDED.status,source_url=EXCLUDED.source_url,
          metadata=(bills.metadata || (EXCLUDED.metadata - 'revisor')) || jsonb_build_object(
            'revisor',COALESCE(bills.metadata->'revisor','{}'::jsonb) || COALESCE(EXCLUDED.metadata->'revisor','{}'::jsonb)
          ),updated_at=now()
        RETURNING id::text`, [
        scope.rows[0].session_id,
        scope.rows[0].chamber_id,
        target.identifier,
        title,
        official.currentVersion || 'Official Revisor record',
        official.sourceUrl,
        JSON.stringify({
          revisor: {
            legislature: official.legislature,
            sessionStartYear: official.sessionStartYear,
            currentVersion: official.currentVersion,
            latestTextUrl: official.latestTextUrl,
            companionIdentifier: official.companionIdentifier,
            versionCount: official.versions.length,
          },
          evidenceBillSeed: { manifestVersion: gamblingManifest.version, source: 'official_bill_status' },
        }),
      ]);
      if (existing.rows.length === 0) inserted += 1;
      else updated += 1;

      const versionKey = official.currentVersion || latestVersion.versionKey;
      const billVersion = await pool.query<{ id: string }>(`
        INSERT INTO bill_versions (bill_id,version_key,published_at,text_url,text_hash,raw_text,source_url)
        VALUES ($1::uuid,$2,$3::date,$4,$5,$6,$4)
        ON CONFLICT (bill_id,version_key) DO UPDATE SET
          published_at=EXCLUDED.published_at,text_url=EXCLUDED.text_url,text_hash=EXCLUDED.text_hash,
          raw_text=EXCLUDED.raw_text,source_url=EXCLUDED.source_url
        RETURNING id::text`, [bill.rows[0].id, versionKey, latestVersion.postedOn, official.latestTextUrl, official.textSha256, official.text]);
      const audited = auditBillFeature({
        id: billVersion.rows[0].id,
        bill_id: bill.rows[0].id,
        identifier: target.identifier,
        session_slug: target.sessionSlug,
        title,
        version_key: versionKey,
        published_at: latestVersion.postedOn,
        raw_text: official.text,
        source_url: official.latestTextUrl,
      });
      await pool.query(`
        INSERT INTO bill_feature_sets (
          bill_version_id,feature_schema_version,extractor_kind,extractor_version,features,confidence,provenance,generated_at
        ) VALUES ($1::uuid,$2,'deterministic',$3,$4::jsonb,'{}'::jsonb,$5::jsonb,now())
        ON CONFLICT (bill_version_id,feature_schema_version,extractor_kind,extractor_version)
        DO UPDATE SET features=EXCLUDED.features,provenance=EXCLUDED.provenance,generated_at=now()`, [
        billVersion.rows[0].id,
        BILL_FEATURE_SCHEMA_VERSION,
        DETERMINISTIC_EXTRACTOR_VERSION,
        JSON.stringify(audited.features),
        JSON.stringify(audited.provenance),
      ]);
    }
    const result = { requested: targets.length, inserted, updated, extractorVersion: DETERMINISTIC_EXTRACTOR_VERSION };
    await completeRun(runId, result);
    return result;
  } catch (error) {
    await failRun(runId, error);
    throw error;
  }
}

function sourceGroupKey(source: ManifestSource): string {
  return [source.sourceKind, source.sourceUrl, source.sessionSlug ?? '', source.chamberSlug ?? ''].join('|');
}

async function fetchEvidenceSource(sourceUrl: string): Promise<FetchedSource> {
  if (!/^https:\/\//i.test(sourceUrl)) throw new Error(`Evidence source must use HTTPS: ${sourceUrl}`);
  const response = await fetch(sourceUrl, {
    headers: { 'user-agent': 'VotePredict/2.0 durable-evidence-ingestion' },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Evidence source returned ${response.status}: ${sourceUrl}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error(`Evidence source was empty: ${sourceUrl}`);
  return {
    contentSha256: createHash('sha256').update(bytes).digest('hex'),
    fetchedAt: new Date().toISOString(),
    httpStatus: response.status,
    bytes: bytes.length,
    contentType: response.headers.get('content-type') ?? undefined,
  };
}

function curatedDrafts(record: ManifestRecord): DurableEvidenceDraft[] {
  const names = record.target?.memberNames?.length
    ? record.target.memberNames
    : [record.target?.memberName].filter((value): value is string => Boolean(value));
  const targets = names.length > 0 ? names : [undefined];
  return targets.map((memberName) => ({
    target: record.target ? {
      memberName,
      billIdentifier: record.target.billIdentifier,
      sessionSlug: record.target.sessionSlug ?? record.source.sessionSlug,
      chamberSlug: record.target.chamberSlug,
      occurredOn: record.target.occurredOn ?? record.publishedAt,
    } : undefined,
    kind: record.kind,
    stance: record.stance,
    claim: record.claim,
    excerpt: record.excerpt,
    publishedAt: record.publishedAt,
    sourceQuality: record.sourceQuality,
    relevance: record.relevance,
    freshness: record.freshness ?? freshness(record.publishedAt),
    extractionMethod: 'curated-source-manifest',
    extractionVersion: gamblingManifest.version,
    confidence: record.confidence,
    metadata: {
      ...(record.metadata ?? {}),
      manifestVersion: gamblingManifest.version,
      publisher: record.source.publisher,
      mechanicallyActionable: record.metadata?.mechanicallyActionable === true,
    },
  }));
}

async function persistCuratedEvidence() {
  const groups = new Map<string, { source: ManifestSource; records: ManifestRecord[] }>();
  for (const record of gamblingManifest.records) {
    const key = sourceGroupKey(record.source);
    const group = groups.get(key) ?? { source: record.source, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }
  const runId = await startRun(gamblingManifest.sourceSystem, `manifest:${gamblingManifest.version}`, {
    manifestVersion: gamblingManifest.version,
    records: gamblingManifest.records.length,
    uniqueSourceGroups: groups.size,
    execution: 'vercel-runtime',
  });
  try {
    const uniqueUrls = [...new Set([...groups.values()].map((group) => group.source.sourceUrl))];
    const fetched = new Map<string, FetchedSource>(await Promise.all(uniqueUrls.map(async (url) => [url, await fetchEvidenceSource(url)] as const)));
    let inserted = 0;
    let reused = 0;
    const unresolved: Array<{ claim: string; reason: string }> = [];
    for (const { source, records } of groups.values()) {
      const fetchedSource = fetched.get(source.sourceUrl);
      if (!fetchedSource) throw new Error(`Evidence fetch missing for ${source.sourceUrl}`);
      const result = await persistDurableEvidence({
        sourceKind: source.sourceKind,
        sourceUrl: source.sourceUrl,
        contentSha256: fetchedSource.contentSha256,
        jurisdictionSlug: gamblingManifest.jurisdictionSlug ?? 'us-mn',
        sessionSlug: source.sessionSlug,
        chamberSlug: source.chamberSlug,
        fetchedAt: fetchedSource.fetchedAt,
        httpStatus: fetchedSource.httpStatus,
        metadata: {
          publisher: source.publisher,
          manifestVersion: gamblingManifest.version,
          bytes: fetchedSource.bytes,
          contentType: fetchedSource.contentType,
        },
      }, records.flatMap(curatedDrafts));
      inserted += result.inserted;
      reused += result.reused;
      unresolved.push(...result.unresolvedTargets);
    }
    const result = { sources: fetched.size, records: gamblingManifest.records.length, inserted, reused, unresolved };
    await completeRun(runId, result, fetched.size, unresolved.filter((item) => item.reason.startsWith('membership:')).length);
    return result;
  } catch (error) {
    await failRun(runId, error);
    throw error;
  }
}

export async function runProductionEvidenceRefresh() {
  if (!campaignSnapshot.schemaVersion || !gamblingManifest.version) throw new Error('Bundled evidence inputs are invalid');
  const campaignFinance = await persistCampaignFinanceEvidence();
  const bills = await seedEvidenceBills();
  const curated = await persistCuratedEvidence();
  return { campaignFinance, bills, curated };
}
