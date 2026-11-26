/** Offline recovery of the one byte-pinned September 23 ZIP. Not a general ZIP reader.
 * Verify the entire archive before using the known local-entry offsets. No network,
 * filesystem extraction, external decompressor, or model fitting/scoring.
 */
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { P8_FROZEN_MODEL_ARCHIVE_SHA256, verifyPinnedP8FrozenModelJson } from './lifecycle-p8-frozen-model-verify';
import { LIFECYCLE_P8_FROZEN_MODEL_CONTENT_SHA256, LIFECYCLE_P8_FROZEN_PLAN_SHA256, LIFECYCLE_P8_REVEAL_NOT_BEFORE } from './lifecycle-p8-prospective';

export const P8_RETAINED_ARCHIVE_PATH = 'data/evaluation/frozen-lifecycle-p8-2027-2028-original.zip' as const;
export const P8_RETAINED_SUMMARY_SHA256 = 'b25381b1cd705bce9b94f3a4a210ba8b4eddc2d4b34cc010c4672ea7795977c8' as const;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export function verifyRetainedP8Archive(bytes: Uint8Array) {
  const archive = Buffer.from(bytes);
  if (archive.length !== 42997 || sha(archive) !== P8_FROZEN_MODEL_ARCHIVE_SHA256) {
    throw new Error('P8 original ZIP bytes do not match the pinned archive SHA-256');
  }
  // Offsets/sizes independently inspected from the original archive, and usable
  // only after the preceding exact-byte verification. Both entries use deflate.
  const extract = (name: string, offset: number, compressed: number, uncompressed: number) => {
    if (archive.readUInt32LE(offset) !== 0x04034b50 || archive.readUInt16LE(offset+8) !== 8) {
      throw new Error('Unexpected pinned ZIP local header');
    }
    const nameLength = archive.readUInt16LE(offset+26);
    const extraLength = archive.readUInt16LE(offset+28);
    if (archive.subarray(offset+30,offset+30+nameLength).toString('utf8') !== name) throw new Error('Unexpected pinned ZIP entry');
    const start = offset+30+nameLength+extraLength;
    const result = inflateRawSync(archive.subarray(start,start+compressed),{maxOutputLength:uncompressed});
    if (result.length !== uncompressed) throw new Error('Unexpected pinned ZIP entry size');
    return result;
  };
  const modelJson = extract('model.json',0,42081,661697);
  const summaryJson = extract('summary.json',42137,666,1223);
  if (sha(summaryJson) !== P8_RETAINED_SUMMARY_SHA256) throw new Error('Original P8 summary hash mismatch');
  const verified = verifyPinnedP8FrozenModelJson(modelJson);
  const summary = JSON.parse(summaryJson.toString('utf8'));
  if (summary.modelContentSha256 !== LIFECYCLE_P8_FROZEN_MODEL_CONTENT_SHA256 ||
      summary.planSha256 !== LIFECYCLE_P8_FROZEN_PLAN_SHA256 ||
      summary.targetSession !== verified.artifact.modelContent.targetSession ||
      summary.revealNotBefore !== LIFECYCLE_P8_REVEAL_NOT_BEFORE ||
      summary.servingChanged !== false || summary.automaticPromotionAllowed !== false ||
      JSON.stringify(summary.preActivation) !== JSON.stringify(verified.artifact.preActivation)) {
    throw new Error('Original P8 summary disagrees with verified model');
  }
  return { ...verified, modelJson, summaryJson,
    archiveVerification: { archiveSha256:P8_FROZEN_MODEL_ARCHIVE_SHA256, archiveBytes:archive.length,
      modelBytes:modelJson.length, summaryBytes:summaryJson.length,
      summarySha256:P8_RETAINED_SUMMARY_SHA256, repositoryRetained:true as const, independentWormVerified:false as const } };
}

export async function loadRetainedP8Archive(path = P8_RETAINED_ARCHIVE_PATH) {
  return verifyRetainedP8Archive(await readFile(path));
}
