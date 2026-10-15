/**
 * Compatibility entrypoint retained because historical evaluation readiness
 * records pin this source-to-existing-DB audit tool path. The implementation
 * and its audit fixtures live in research/. No DB/network action is added.
 */
const archived = new URL('../research/scripts/reconcile-senate-media-offline-private.ts', import.meta.url);
await import(archived.href);
