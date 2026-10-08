/**
 * Offline only. Reads committed repository text and prints a deterministic
 * configuration audit. No GitHub API, Vercel API, database or network calls.
 *
 * node --import tsx scripts/audit-evidence-operating-posture.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auditEvidenceOperatingPosture } from '../src/operations/evidence-operating-posture.js';

const report = auditEvidenceOperatingPosture(
  path => readFileSync(resolve(process.cwd(), path), 'utf8'),
);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
