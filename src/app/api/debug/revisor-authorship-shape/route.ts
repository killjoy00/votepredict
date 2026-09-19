import { NextResponse } from 'next/server';
import { fetchRevisorStatusXml } from '@/sources/minnesota/revisor-actions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function tagNames(xml: string): string[] {
  const names = [...xml.matchAll(/<\/?(?:[A-Z0-9_.-]+:)?([A-Z][A-Z0-9_.-]*)\b[^>]*>/gi)]
    .map((match) => match[1].toUpperCase());
  return [...new Set(names)];
}

function snippets(xml: string, token: RegExp, limit = 12): string[] {
  const out: string[] = [];
  for (const match of xml.matchAll(token)) {
    const start = Math.max(0, (match.index ?? 0) - 160);
    const end = Math.min(xml.length, (match.index ?? 0) + match[0].length + 320);
    out.push(xml.slice(start, end).replace(/\s+/g, ' ').trim());
    if (out.length >= limit) break;
  }
  return out;
}

export async function GET() {
  const sourceUrl = 'https://www.revisor.mn.gov/bills/92/2021/0/HF/39/';
  const xml = await fetchRevisorStatusXml(sourceUrl);
  const names = tagNames(xml);
  return NextResponse.json({
    bytes: xml.length,
    rootTags: names.slice(0, 120),
    authorTags: names.filter((name) => name.includes('AUTHOR')),
    actionTags: names.filter((name) => name.includes('ACTION')),
    authorSnippets: snippets(xml, /AUTHOR/gi),
    actionSnippets: snippets(xml, /ACTION/gi),
  });
}
