import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_BATCH_SIZE = 4;
const MAX_PDF_BYTES = 25_000_000;
let secrets: string[] = [];

function mask(value: string) {
  if (value.length > 3) {
    console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
  }
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter(item => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 900);
}

function batchSize(): number {
  const requested = Number.parseInt(process.env.VOTEPREDICT_CFB_FILING_PROOF_BATCH ?? '', 10);
  if (!Number.isFinite(requested)) return DEFAULT_BATCH_SIZE;
  return Math.min(12, Math.max(1, requested));
}

async function chooseDb(env: Record<string, string | undefined>) {
  const { Pool } = await import('pg');
  async function works(value: string) {
    const candidate = new Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 8000 });
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
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + secret },
  });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

async function fetchBoardMaterialsPdf(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'register.cfb.mn.gov') {
    throw new Error('Unsupported CFB Board materials host');
  }
  if (!/^\/pdf\/bdinfo\/agendas\/[^/]+\.pdf$/i.test(url.pathname)) {
    throw new Error('Unsupported CFB Board materials path');
  }

  const response = await fetch(url.toString(), {
    headers: { 'user-agent': 'VotePredict/2.0 cfb-filing-proof-backfill' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error('CFB Board materials HTTP ' + response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 1000 || bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error('CFB Board materials PDF has unexpected byte length: ' + bytes.byteLength);
  }

  const { CanvasFactory } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes, CanvasFactory });
  try {
    const parsed = await parser.getText();
    if (!parsed.text || parsed.text.length < 100) {
      throw new Error('CFB Board materials PDF text extraction returned too little text');
    }
    return {
      text: parsed.text,
      contentSha256: createHash('sha256').update(bytes).digest('hex'),
      fetchedAt: new Date().toISOString(),
      httpStatus: response.status,
      bytes: bytes.byteLength,
    };
  } finally {
    await parser.destroy();
  }
}

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
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  const { fetchPublicPage } = await import('../src/evidence/public-http.js');
  const { persistDurableEvidence } = await import('../src/evidence/durable-ingestion.js');
  const {
    CFB_BOARD_AGENDAS_URL,
    CFB_BOARD_FILING_HISTORY_VERSION,
    discoverCfbBoardMaterialsLinks,
    parseCfbBoardMaterialsFilingProofs,
  } = await import('../src/evidence/cfb-board-filing-history.js');

  try {
    const agendaPage = await fetchPublicPage(CFB_BOARD_AGENDAS_URL, {
      timeoutMs: 30_000,
      maxBytes: 3_000_000,
      userAgent: 'VotePredict/2.0 cfb-filing-proof-backfill',
    });
    const links = discoverCfbBoardMaterialsLinks(agendaPage.rawContent, agendaPage.canonicalUrl)
      .filter(link => link.meetingDate >= '2023-01-01' && link.meetingDate <= '2026-12-31');

    if (!links.length) throw new Error('No CFB Board meeting-material PDFs discovered');

    const size = batchSize();
    let processedDocuments = 0;
    let skippedDocuments = 0;
    let documentsWithProofs = 0;
    let proofsFound = 0;
    let proofsInserted = 0;
    let reused = 0;
    let failures = 0;
    const failureExamples: Array<{ meetingDate: string; error: string }> = [];

    for (const link of links) {
      const scanned = await pool.query<{ id: string }>(`
        SELECT id::text
          FROM source_documents
         WHERE source_kind = 'cfb_board_meeting_materials_filing_proof'
           AND source_url = $1
           AND metadata->>'parserVersion' = $2
           AND metadata->>'scanComplete' = 'true'
         LIMIT 1
      `, [link.sourceUrl, CFB_BOARD_FILING_HISTORY_VERSION]);

      if (scanned.rows[0]) {
        skippedDocuments += 1;
        continue;
      }
      if (processedDocuments >= size) break;

      try {
        const pdf = await fetchBoardMaterialsPdf(link.sourceUrl);
        const proofs = parseCfbBoardMaterialsFilingProofs(pdf.text, link.sourceUrl)
          .filter(proof => proof.filedOn >= '2021-01-01' && proof.filedOn <= '2026-12-31');

        const drafts = proofs.map(proof => ({
          kind: 'context' as const,
          stance: 'neutral' as const,
          claim:
            `Minnesota CFB Board materials retrospectively record ${proof.entityName} (${proof.registrationNumber}) filing ${proof.reportName} on ${proof.filedOn}.`,
          publishedAt: link.meetingDate + 'T12:00:00.000Z',
          sourceQuality: 'official' as const,
          relevance: 'low' as const,
          freshness: 'stale' as const,
          extractionMethod: 'deterministic-cfb-board-filing-date-table',
          extractionVersion: CFB_BOARD_FILING_HISTORY_VERSION,
          confidence: 1,
          metadata: {
            contextType: 'campaign_finance',
            subtype: 'campaign_finance_disclosure_proof',
            registrationNumber: proof.registrationNumber,
            entityName: proof.entityName,
            reportName: proof.reportName,
            dueOn: proof.dueOn,
            filedOn: proof.filedOn,
            provenAvailableOn: proof.availableOn,
            proofKind: proof.proofKind,
            proofUrl: proof.proofUrl,
            retrospectiveAvailabilityProof: true,
            dueDateIsAvailability: false,
            asOfEligible: false,
            contextOnly: true,
            mechanicallyActionable: false,
            modelWeight: 0,
            evidenceSeriesKey:
              `cfb_filing_proof:${proof.registrationNumber}:${proof.reportName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}:${proof.filedOn}`,
          },
        }));

        drafts.push({
          kind: 'context' as const,
          stance: 'neutral' as const,
          claim: `Minnesota CFB Board meeting materials dated ${link.meetingDate} were scanned for explicit historical campaign-finance filing dates.`,
          publishedAt: link.meetingDate + 'T12:00:00.000Z',
          sourceQuality: 'official' as const,
          relevance: 'low' as const,
          freshness: 'stale' as const,
          extractionMethod: 'deterministic-cfb-board-filing-date-scan-marker',
          extractionVersion: CFB_BOARD_FILING_HISTORY_VERSION,
          confidence: 1,
          metadata: {
            contextType: 'campaign_finance',
            subtype: 'campaign_finance_disclosure_proof_scan',
            meetingDate: link.meetingDate,
            proofCount: proofs.length,
            retrospectiveAvailabilityProof: false,
            asOfEligible: false,
            contextOnly: true,
            mechanicallyActionable: false,
            modelWeight: 0,
            evidenceSeriesKey: `cfb_filing_proof_scan:${link.meetingDate}:${link.sourceUrl}`,
          },
        });

        const persisted = await persistDurableEvidence({
          sourceKind: 'cfb_board_meeting_materials_filing_proof',
          sourceUrl: link.sourceUrl,
          contentSha256: pdf.contentSha256,
          fetchedAt: pdf.fetchedAt,
          httpStatus: pdf.httpStatus,
          metadata: {
            publisher: 'Minnesota Campaign Finance and Public Disclosure Board',
            meetingDate: link.meetingDate,
            parserVersion: CFB_BOARD_FILING_HISTORY_VERSION,
            scanComplete: true,
            proofCount: proofs.length,
            bytes: pdf.bytes,
            historicalAvailabilityPolicy:
              'explicit filed date only; due dates never treated as public availability',
          },
        }, drafts);

        processedDocuments += 1;
        if (proofs.length) documentsWithProofs += 1;
        proofsFound += proofs.length;
        proofsInserted += Math.min(persisted.inserted, proofs.length);
        reused += persisted.reused;

        console.log(JSON.stringify({
          cfbFilingProofProgress: {
            meetingDate: link.meetingDate,
            processedDocuments,
            batchSize: size,
            proofCount: proofs.length,
            proofsFound,
            proofsInserted,
            reused,
          },
        }));
      } catch (error) {
        processedDocuments += 1;
        failures += 1;
        if (failureExamples.length < 8) {
          failureExamples.push({ meetingDate: link.meetingDate, error: safe(error) });
        }
        console.warn(JSON.stringify({
          cfbFilingProofFailure: {
            meetingDate: link.meetingDate,
            error: safe(error),
          },
        }));
      }
    }

    const remaining = Math.max(0, links.length - skippedDocuments - processedDocuments);
    console.log(JSON.stringify({
      cfbFilingProofBackfill: {
        discoveredDocuments: links.length,
        processedDocuments,
        skippedDocuments,
        remainingDocuments: remaining,
        documentsWithProofs,
        proofsFound,
        proofsInserted,
        reused,
        failures,
        failureExamples,
        policy: {
          explicitFiledDateRequired: true,
          dueDateIsAvailability: false,
          reportAvailabilityRule: 'electronically filed report is available the next day',
          transactionDateIsAvailability: false,
          servingChanged: false,
          productionAction: 'none',
        },
      },
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(safe(error));
  process.exitCode = 1;
});
