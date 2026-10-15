import { normalizeMemberName } from '@/sources/minnesota/house-votes';

export const MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION =
  'mn-senate-committee-minutes-v3' as const;

export interface SenateCommitteeMemberVote {
  sourceName: string;
  normalizedName: string;
  choice: 'yea' | 'nay';
}

export interface SenateCommitteeVoteObservation {
  billIdentifier?: string;
  amendmentRef?: string;
  motionText: string;
  voteKind: 'amendment' | 'motion' | 'other';
  yeaCount: number;
  nayCount: number;
  passed?: boolean;
  memberVotes: SenateCommitteeMemberVote[];
  individualVotesAvailable: boolean;
}

export const MN_SENATE_COMMITTEE_ACTIONS_PARSER_VERSION =
  'mn-senate-committee-actions-v1' as const;

export interface SenateCommitteeContextAction {
  billIdentifier?: string;
  amendmentRef?: string;
  motionText: string;
  voteKind: 'amendment' | 'motion' | 'other';
  actionKind: 'voice_vote' | 'unanimous_action' | 'motion_result_only';
  passed: boolean;
  individualVotesAvailable: false;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function textFromHtml(html: string): string {
  return decodeHtml(
    html
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>|<\/div>|<\/li>|<\/tr>|<\/h\d>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function canonicalBill(value: string): string | undefined {
  const match = value.match(/\b([HS])\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?(\d+)\b/i);
  return match ? match[1].toUpperCase() + 'F' + Number(match[2]) : undefined;
}

function nearestBill(context: string): string | undefined {
  const matches = [...context.matchAll(/\b(?:S\s*\.?\s*F\s*\.?|H\s*\.?\s*F\s*\.?)\s*(?:No\.?\s*)?\d+\b/gi)];
  return matches.length ? canonicalBill(matches[matches.length - 1][0]) : undefined;
}

function nearestAmendment(context: string): string | undefined {
  // The Senate also numbers amendments as "10 amendment", not just A10.
  // Preserve the source spelling of letter-coded refs; numeric-only refs
  // must never collide with an "A10" reference.
  const refs = [
    ...[...context.matchAll(/\b(?:amendment\s+)?([A-Z]\d{1,3}(?:-\d+)?)\b/gi)]
      .map(m => ({at:m.index ?? -1,ref:m[1]!.toUpperCase()})),
    ...[...context.matchAll(/\b(\d{1,2})\s+amendment\b/gi)]
      .map(m => ({at:m.index ?? -1,ref:'#'+Number(m[1])})),
  ];
  refs.sort((a,b) => a.at - b.at);
  return refs.at(-1)?.ref;
}

/** Distinct explicit roll-call requests are distinct source actions even when
 * bill, amendment and every voter/side repeat. This is ephemeral parser state:
 * no offset is exported to stored identifiers or public evidence receipts.
 */
function recordedMotionAnchor(text:string, tallyStart:number):number|undefined {
  const left=Math.max(0,tallyStart-2500);
  const preceding=text.slice(left,tallyStart);
  const requests=[...preceding.matchAll(
    /\brequested\s+(?:a\s+)?roll\s+call(?:\s+vote)?\b/gi,
  )];
  const last=requests.at(-1);
  if(!last)return undefined;
  return left+(last.index??0);
}

export function normalizeSenateCommitteeMemberSourceName(value:string):string{
  const compact=value.replace(/\s+/g,' ').trim();
  // Official 2022 Senate Finance minutes repeatedly use this misspelling for Bill Ingebrigtsen.
  if(/^Ingebrightsen$/i.test(compact))return 'Ingebrigtsen';
  return compact;
}

function names(value: string, choice: 'yea' | 'nay'): SenateCommitteeMemberVote[] {
  return value
    .split(/\s*(?:,|;|\band\b)\s*/i)
    .map((name) => name.replace(/^(?:(?:Vice\s+)?Chair|Senator|Minority\s+Lead|Ranking(?:\s+Minority)?\s+Member)\s+/i, '').trim())
    .filter((name) => /^[A-Za-zÀ-ž][A-Za-zÀ-ž .'-]{0,80}$/.test(name))
    .map((sourceName) => ({
      sourceName,
      normalizedName: normalizeMemberName(sourceName),
      choice,
    }));
}


/** A Rules-style printed list contains individually labeled "Senator Name"
 * entries on each side. Neither a motion's mover nor nearby attendance counts.
 * If any text is ambiguous, return no inferred named positions.
 */
function senatorPrefixedRollSide(value:string,choice:'yea'|'nay'):SenateCommitteeMemberVote[]{
 const clean=value.replace(/--\s*\d+\s+of\s+\d+\s*--/gi,' ').replace(/\s+/g,' ').trim();
 if(!/^Senator\s+/i.test(clean))return [];
 const parts=clean.split(/\bSenator\s+/i).slice(1);
 if(parts.length<1||parts.length>30)return [];
 const side:SenateCommitteeMemberVote[]=[];
 for(const part of parts){
  const sourceName=part.replace(/^[\s,;:]+|[\s,;:.]+$/g,'').trim();
  if(!/^[\p{L}\p{M}][\p{L}\p{M} .'-]{0,80}$/u.test(sourceName)||
   /\b(?:Senator|Member|voting|Absent|roll call)\b/i.test(sourceName))return [];
  side.push({sourceName,normalizedName:normalizeMemberName(sourceName),choice});
 }
 return new Set(side.map(x=>x.normalizedName)).size===side.length?side:[];
}

function voteKind(context: string): SenateCommitteeVoteObservation['voteKind'] {
  if (/\bamend(?:ment|ed)\b/i.test(context)) return 'amendment';
  if (/\bmotion\b|recommended\s+to\s+pass|re-?refer/i.test(context)) return 'motion';
  return 'other';
}

function explicitOutcome(value: string): boolean | undefined {
  if (/\b(?:motion|amendment)\s+(?:failed|did not prevail|was not adopted|did not carry)\b/i.test(value)) return false;
  if (/\b(?:motion|amendment)(?:\s+for\s+final\s+passage)?\s+(?:passed|prevails|prevailed|was adopted|carried)\b/i.test(value)) return true;
  if (/\bnot adopted\b|\bmotion failed\b|\bdid not carry\b/i.test(value)) return false;
  if (/\badopted\b|\bmotion passed\b|\bmotion carried\b/i.test(value)) return true;
  return undefined;
}

export function parseSenateCommitteeMinuteVotes(html: string): SenateCommitteeVoteObservation[] {
  const text = textFromHtml(html);
  const observations: SenateCommitteeVoteObservation[] = [];
  const seen = new Set<string>();

  const namedPatterns = [
    /(\d+)\s*\/\s*(\d+)\s*\(\s*Ayes?\s*:\s*([^)]*?)\s*;\s*Nays?\s*:\s*([^)]*?)\)\s*([^\n]{0,120})/gi,
    /(?:roll call vote[^\d]{0,80})?(\d+)\s+(?:yes|ayes?)\s+and\s+(\d+)\s+(?:no|nays?)[\s\S]{0,220}?\(\s*Yes\s*-\s*([^)]*?)\)\s*\(\s*No\s*-\s*([^)]*?)\)\s*([^\n]{0,120})/gi,
    /(\d+)\s+(?:ayes?|yes)\s*,?\s*(\d+)\s+(?:nays?|no)\b[\s\S]{0,180}?\(\s*(?:Ayes?|Yes)\s*[-–:]\s*([^;)]*?)\s*;\s*(?:Nays?|No)\s*[-–:]\s*([^;)]*?)(?:\s*;\s*Absent\s*[-–:][^)]*)?\)\s*([^\n]{0,160})/gi,
  ];

  for (const pattern of namedPatterns) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const context = text.slice(Math.max(0, start - 900), start + match[0].length);
      const yeaCount = Number(match[1]);
      const nayCount = Number(match[2]);
      const yeaVotes = names(match[3], 'yea');
      const nayVotes = names(match[4], 'nay');
      if (yeaVotes.length !== yeaCount || nayVotes.length !== nayCount) continue;
      const key = [
        nearestBill(context) ?? 'none',
        nearestAmendment(context) ?? 'none',
        yeaVotes.map((row) => row.normalizedName).join(','),
        nayVotes.map((row) => row.normalizedName).join(','),
      recordedMotionAnchor(text,start) ?? 'unanchored',
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      observations.push({
        billIdentifier: nearestBill(context),
        amendmentRef: nearestAmendment(context),
        motionText: context.replace(/\s+/g, ' ').trim().slice(-900),
        voteKind: voteKind(context),
        yeaCount,
        nayCount,
        passed: explicitOutcome(match[5] + ' ' + context.slice(-180)),
        memberVotes: [...yeaVotes, ...nayVotes],
        individualVotesAvailable: true,
      });
    }
  }


  const labeledRollCallPattern =
    /(?:roll\s+call(?:\s+vote)?[\s\S]{0,100}?|adopted\s+by\s+roll\s+call\s*\(?)(\d+)\s+(?:aye|ayes|yes)\s*(?:,|and)\s*(\d+)\s+(?:nay|nays|no)\b/gi;
  for (const match of text.matchAll(labeledRollCallPattern)) {
    const start = match.index ?? 0;
    const after = text.slice(start, start + match[0].length + 700);
    const context = text.slice(Math.max(0, start - 900), start + match[0].length + 700);
    const yeaCount = Number(match[1]);
    const nayCount = Number(match[2]);
    const ayeLabel = after.match(/\bAyes?\s*[:\-–—]\s*([^\n\r)]+)/i);
    const nayLabel = after.match(/\bNays?\s*[:\-–—]\s*([^\n\r)]+)/i);
    if ((yeaCount > 0 && !ayeLabel) || (nayCount > 0 && !nayLabel)) continue;
    const yeaVotes = ayeLabel ? names(ayeLabel[1], 'yea') : [];
    const nayVotes = nayLabel ? names(nayLabel[1], 'nay') : [];
    if (yeaVotes.length !== yeaCount || nayVotes.length !== nayCount) continue;
    const key = [
      nearestBill(context) ?? 'none',
      nearestAmendment(context) ?? 'none',
      yeaVotes.map((row) => row.normalizedName).join(','),
      nayVotes.map((row) => row.normalizedName).join(','),
      recordedMotionAnchor(text,start) ?? 'unanchored',
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    observations.push({
      billIdentifier: nearestBill(context),
      amendmentRef: nearestAmendment(context),
      motionText: context.replace(/\s+/g, ' ').trim().slice(-900),
      voteKind: voteKind(context),
      yeaCount,
      nayCount,
      passed: explicitOutcome(context),
      memberVotes: [...yeaVotes, ...nayVotes],
      individualVotesAvailable: true,
    });
  }

  const zeroNayNamedPattern=/(\d+)\s*\/\s*0\s*\(\s*Ayes?\s*:\s*([^)]*?)\s*;\s*Nays?\s*\)\s*([^\n]{0,160})/gi;
  for(const match of text.matchAll(zeroNayNamedPattern)){
    const start=match.index??0;
    const context=text.slice(Math.max(0,start-900),start+match[0].length+180);
    const yeaCount=Number(match[1]);
    const yeaVotes=names(match[2],'yea');
    if(yeaVotes.length!==yeaCount)continue;
    const key=[
      nearestBill(context)??'none',
      nearestAmendment(context)??'none',
      yeaVotes.map(row=>row.normalizedName).join(','),
      '',
      recordedMotionAnchor(text,start) ?? 'unanchored',
    ].join('|');
    if(seen.has(key))continue;
    seen.add(key);
    observations.push({
      billIdentifier:nearestBill(context),
      amendmentRef:nearestAmendment(context),
      motionText:context.replace(/\s+/g,' ').trim().slice(-900),
      voteKind:voteKind(context),
      yeaCount,
      nayCount:0,
      passed:explicitOutcome(match[3]+' '+context.slice(-240)),
      memberVotes:yeaVotes,
      individualVotesAvailable:true,
    });
  }

  const countsBeforeListsPattern=/(?:roll\s+call[^\n]{0,220}?)(\d+)\s*\/\s*(\d+)[^\n]{0,220}\n\s*Ayes?\s*:\s*([^\n]+)\n\s*Nays?\s*:\s*([^\n]*)(?:\n|$)/gi;
  for(const match of text.matchAll(countsBeforeListsPattern)){
    const start=match.index??0;
    const context=text.slice(Math.max(0,start-900),start+match[0].length+180);
    const yeaCount=Number(match[1]);
    const nayCount=Number(match[2]);
    const yeaVotes=names(match[3],'yea');
    const nayVotes=names(match[4],'nay');
    if(yeaVotes.length!==yeaCount||nayVotes.length!==nayCount)continue;
    const key=[
      nearestBill(context)??'none',
      nearestAmendment(context)??'none',
      yeaVotes.map(row=>row.normalizedName).join(','),
      nayVotes.map(row=>row.normalizedName).join(','),
      recordedMotionAnchor(text,start) ?? 'unanchored',
    ].join('|');
    if(seen.has(key))continue;
    seen.add(key);
    observations.push({
      billIdentifier:nearestBill(context),
      amendmentRef:nearestAmendment(context),
      motionText:context.replace(/\s+/g,' ').trim().slice(-900),
      voteKind:voteKind(context),
      yeaCount,
      nayCount,
      passed:explicitOutcome(context),
      memberVotes:[...yeaVotes,...nayVotes],
      individualVotesAvailable:true,
    });
  }

  const resultsBlockPattern=/AYES?\s*:\s*([\s\S]{1,600}?)\s*NAYS?\s*:\s*([\s\S]{1,900}?)(?:\s*ABSENT\s*:\s*[^\n]*)?\s*On\s+a\s+vote\s+of\s+(\d+)\s+AYES?\s*(?:,|and)\s*(\d+)\s+NAYS?\b([^\n]{0,220})/gi;
  for(const match of text.matchAll(resultsBlockPattern)){
    const start=match.index??0;
    const context=text.slice(Math.max(0,start-900),start+match[0].length+180);
    const yeaCount=Number(match[3]);
    const nayCount=Number(match[4]);
    const yeaVotes=names(match[1],'yea');
    const nayVotes=names(match[2],'nay');
    if(yeaVotes.length!==yeaCount||nayVotes.length!==nayCount)continue;
    const key=[
      nearestBill(context)??'none',
      nearestAmendment(context)??'none',
      yeaVotes.map(row=>row.normalizedName).join(','),
      nayVotes.map(row=>row.normalizedName).join(','),
      recordedMotionAnchor(text,start) ?? 'unanchored',
    ].join('|');
    if(seen.has(key))continue;
    seen.add(key);
    observations.push({
      billIdentifier:nearestBill(context),
      amendmentRef:nearestAmendment(context),
      motionText:context.replace(/\s+/g,' ').trim().slice(-900),
      voteKind:voteKind(context),
      yeaCount,
      nayCount,
      passed:explicitOutcome(match[5]+' '+context.slice(-240)),
      memberVotes:[...yeaVotes,...nayVotes],
      individualVotesAvailable:true,
    });
  }


  // Official Rules minutes print individually identified "Members voting
  // AYE/NO" sides *before* the final numeric tally. Distinct roll-call
  // requests must retain independent motion anchors, including two SF1
  // decisions on the same meeting day. Never infer a choice from a count.
  const memberNarrativeRollPattern=
   /\bMembers\s+voting\s+AYE\s*:\s*([\s\S]{1,1000}?)\bMembers\s+voting\s+NO\s*:\s*([\s\S]{1,1000}?)\bOn\s+a\s+vote\s+of\s+(\d{1,2})\s+AYES?\s*,?\s*and\s+(\d{1,2})\s+NO\b([^\n]{0,180})/gi;
  for(const match of text.matchAll(memberNarrativeRollPattern)){
   const start=match.index??0;
   const yeaCount=Number(match[3]),nayCount=Number(match[4]);
   const yeaVotes=senatorPrefixedRollSide(match[1],'yea');
   const nayVotes=senatorPrefixedRollSide(match[2],'nay');
   const sides=[...yeaVotes,...nayVotes];
   if(yeaVotes.length!==yeaCount||nayVotes.length!==nayCount||
    !sides.length||new Set(sides.map(x=>x.normalizedName)).size!==sides.length)continue;
   const context=text.slice(Math.max(0,start-750),start+match[0].length+180);
   const nearbyMotion=text.slice(Math.max(0,start-370),start);
   // Printed Rules minutes also spell the bill out as "Senate File 1".
   const proseBill=[...context.matchAll(/\bSenate\s+File\s+(\d{1,5})\b/gi)].at(-1);
   const billIdentifier=proseBill?'SF'+Number(proseBill[1]):nearestBill(context);
   const amendmentRef=nearestAmendment(nearbyMotion);
   const anchor=recordedMotionAnchor(text,start)??'unanchored';
   const key=[billIdentifier??'none',amendmentRef??'none',
    yeaVotes.map(x=>x.normalizedName).join(','),
    nayVotes.map(x=>x.normalizedName).join(','),anchor].join('|');
   if(seen.has(key))continue;
   seen.add(key);
   const committeeReport=/\bmoved\s+to\s+adopt\s+(?:the\s+)?committee\b[\s\S]{0,150}?\breport\b/i
    .test(nearbyMotion);
   const printedOutcome=explicitOutcome(match[5]);
   // Rules committee reports are parliamentary *motions*, not amendments.
   // A committee report expressly "was adopted" is affirmative. Do not
   // infer an outcome from a preceding failed amendment in the context.
   const passed=printedOutcome??(
    committeeReport&&/\bcommittee\s+report\s+was\s+adopted\b/i.test(match[5])?
    true:undefined);
   observations.push({
    billIdentifier,amendmentRef,
    motionText:context.replace(/\s+/g,' ').trim().slice(-900),
    voteKind:committeeReport?'motion':voteKind(nearbyMotion),
    yeaCount,nayCount,passed,
    memberVotes:sides,individualVotesAvailable:true,
   });
  }

  const countOnlyPatterns = [
    /(?:roll call vote[^\n]{0,220}?)?(?:vote was|roll call(?: vote)?(?: was)?)\s*(\d+)\s*[-–]\s*(\d+)\b/gi,
    /(?:roll\s+call(?:\s+vote)?[\s\S]{0,100}?|adopted\s+by\s+roll\s+call\s*\(?)(\d+)\s+(?:aye|ayes|yes)\s*(?:,|and)\s*(\d+)\s+(?:nay|nays|no)\b/gi,
    /there were\s+(\d+)\s+(?:hands\s+shown\s+for\s+)?(?:yes|ayes?)\s+and\s+(\d+)\s+(?:hands\s+shown\s+for\s+)?(?:no|nays?)\b/gi,
    /On\s+a\s+vote\s+of\s+(\d+)\s+(?:ayes?|yes)\s*(?:,|and)\s*(\d+)\s+(?:nays?|no)\b/gi,
    /(?:requested\s+(?:a\s+)?division|called\s+for\s+division|division)[^\n]{0,160}?(\d+)\s+(?:yes|ayes?)\s*[,;]?\s*(\d+)\s+(?:no|nays?)\b/gi,
  ];
  // Count-only recorded divisions are not person votes. Still, distinct
  // explicit requests are distinct committee actions even when totals repeat.
  // Keep this key independent from the named-vote dedup set.
  const seenCountOnlyActions = new Set<string>();
  for (const countOnly of countOnlyPatterns) {
    for (const match of text.matchAll(countOnly)) {
    const start = match.index ?? 0;
    const context = text.slice(Math.max(0, start - 900), start + match[0].length + 180);
    const billIdentifier = nearestBill(context);
    const amendmentRef = nearestAmendment(context);
    const yeaCount = Number(match[1]);
    const nayCount = Number(match[2]);
    const anchor=recordedMotionAnchor(text,start) ?? 'unanchored';
    const countKey=[billIdentifier??'none',amendmentRef??'none',
      yeaCount,nayCount,anchor].join('|');
    if(seenCountOnlyActions.has(countKey))continue;
    // Never turn a named roll's aggregate tally into a second count-only
    // record. This guard is conservative where a source has no request anchor.
    if(observations.some(row=>row.individualVotesAvailable
      &&row.billIdentifier===billIdentifier
      &&row.amendmentRef===amendmentRef
      &&row.yeaCount===yeaCount&&row.nayCount===nayCount))continue;
    seenCountOnlyActions.add(countKey);
      observations.push({
        billIdentifier,
        amendmentRef,
        motionText: context.replace(/\s+/g, ' ').trim().slice(-900),
        voteKind: voteKind(context),
        yeaCount,
        nayCount,
        passed: explicitOutcome(context),
        memberVotes: [],
        individualVotesAvailable: false,
      });
    }
  }

  return observations;
}


function recordedVoteSignal(value:string):boolean{
  return /\broll\s+call\b|\bAyes?\s*[:\-–—]|\bNays?\s*[:\-–—]|\b(?:vote\s+was|vote\s+of)\s*\d+|\b\d+\s*\/\s*\d+\b|\bdivision\b[^\n]{0,160}\d+\s+(?:yes|ayes?)/i.test(value);
}

export function parseSenateCommitteeMinuteContextActions(html:string):SenateCommitteeContextAction[]{
  const text=textFromHtml(html);
  const lines=text.split('\n').map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean);
  const actions:SenateCommitteeContextAction[]=[];
  const seen=new Set<string>();

  for(let index=0;index<lines.length;index+=1){
    const line=lines[index];
    const context=lines.slice(Math.max(0,index-2),Math.min(lines.length,index+2)).join(' ');
    const passed=explicitOutcome(line);
    if(passed===undefined)continue;

    let actionKind:SenateCommitteeContextAction['actionKind']|undefined;
    if(/\bvoice\s+vote\b/i.test(line)){
      actionKind='voice_vote';
    }else if(/\bunanimous(?:ly)?\b/i.test(line)){
      actionKind='unanimous_action';
    }else if(
      /\b(?:motion|amendment)\b/i.test(line)
      && !recordedVoteSignal(context)
    ){
      actionKind='motion_result_only';
    }
    if(!actionKind)continue;

    const billIdentifier=nearestBill(context);
    const amendmentRef=nearestAmendment(context);
    const compact=context.slice(-900);
    const key=[
      billIdentifier??'none',
      amendmentRef??'none',
      actionKind,
      passed?'passed':'failed',
      compact.toLowerCase(),
    ].join('|');
    if(seen.has(key))continue;
    seen.add(key);
    actions.push({
      billIdentifier,
      amendmentRef,
      motionText:compact,
      voteKind:voteKind(context),
      actionKind,
      passed,
      individualVotesAvailable:false,
    });
  }
  return actions;
}
