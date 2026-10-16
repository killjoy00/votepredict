/**
 * Isolate only the exact LRL committee meeting date section. Never classify
 * site-wide navigation / other meetings' agendas or media as target evidence.
 *
 * This is deliberately fail-closed: if no unique heading can be located,
 * return null instead of guessing an HTML neighborhood.
 */
export function findExactOfficialMeetingDateSection(
  html: string, meetingDate: string,
): { sectionHtml: string | null; headingMatches: number; scopeVerified: boolean } {
  if(!/^202[2-5]-\d\d-\d\d$/.test(meetingDate))
    return {sectionHtml:null,headingMatches:0,scopeVerified:false};
  const [year,month,day]=meetingDate.split('-');
  const expected=Number(month)+'/'+Number(day)+'/'+year;
  const headings=Array.from(html.matchAll(
    /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi
  )).map(m=>({
    level:Number(m[1]),
    title:m[2]!.replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ')
      .replace(/\s+/g,' ').trim(),
    start:m.index??0,end:(m.index??0)+m[0].length,
  }));
  const matches=headings.filter(h=>h.title===expected);
  if(matches.length!==1)
    return {sectionHtml:null,headingMatches:matches.length,scopeVerified:false};
  const current=matches[0]!;
  const next=headings.find(h=>h.start>current.start && h.level<=current.level);
  const until=next?.start??html.length;
  if(until<=current.end)
    return {sectionHtml:null,headingMatches:1,scopeVerified:false};
  return {
    sectionHtml:html.slice(current.end,until),
    headingMatches:1,
    scopeVerified:true,
  };
}
