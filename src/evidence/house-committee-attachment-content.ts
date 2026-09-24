import { canonicalPublicUrl } from './public-http';

export const HOUSE_COMMITTEE_ATTACHMENT_CONTENT_VERSION = 'house-committee-attachment-content-v1' as const;

export function canonicalHouseCommitteeAttachmentPdfUrl(value: string): string {
  const canonical = canonicalPublicUrl(value);
  const url = new URL(canonical);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !['house.mn.gov', 'www.house.mn.gov'].includes(host)) {
    throw new Error('House committee attachment PDF must use an official Minnesota House HTTPS host');
  }
  if (!/\.pdf$/i.test(url.pathname)) {
    throw new Error('House committee attachment content collector currently supports PDF attachments only');
  }
  return canonical;
}

export function officialHouseCommitteeAttachmentPublishedAt(postedOn: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postedOn)) {
    throw new Error('House committee attachment posted date must be YYYY-MM-DD');
  }
  const parsed = new Date(postedOn + 'T00:00:00.000Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== postedOn) {
    throw new Error('House committee attachment posted date must be a real calendar date');
  }
  return postedOn + 'T12:00:00.000Z';
}

export function normalizeHouseCommitteeAttachmentExcerpt(value: string, maxLength = 1600): string | undefined {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}
