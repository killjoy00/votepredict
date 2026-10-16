# Archived workflow definitions

These YAML files are plain text preserved by `git mv` outside `.github/workflows/`; GitHub Actions will not dispatch them. Findings, data and old scripts remain in their original locations.

| Archived file | Superseding workflow | Exact equivalent |
|---|---|---|
| `source-smoke.yml` | `.github/workflows/evidence-acquire.yml` or `evidence-audit.yml` | official-source-smoke, session 302/300/257, member_or_batch all, dry_run true |
| `revisor-source-passage-audit.yml` | `.github/workflows/evidence-acquire.yml` | revisor-source-passage, session all, member_or_batch all, dry_run false, same snapshot and artifact |

See [PR 3 consolidation details](../../docs/evidence-workflow-consolidation.md) for the protected workflows and unsuperseded historical artifact pipelines that deliberately remain active. Never archive automatic, called or protected workflow YAML on filenames alone.

## Historical workflow retirement, batch 1: `historical-density-*` (2026-10-16)

102 `historical-density-*` workflow files were moved here unchanged. All were one-off historical research pipelines last modified on or before 2026-10-12, with no references from tests, source, scripts, `package.json` or other workflows. Restore any of them with `git mv research/workflows-archive/<file> .github/workflows/`.
