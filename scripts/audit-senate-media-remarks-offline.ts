/** Compatibility path pinned by historical source-to-DB readiness records. */
const archived = new URL('../research/scripts/audit-senate-media-remarks-offline.ts', import.meta.url);
await import(archived.href);
