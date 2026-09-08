export interface OsbProceduralVoteRecord {
  identifier: 'SF3414';
  occurredOn: '2025-04-23';
  choice: 'yea' | 'nay';
  supportsOsb: true | undefined;
  tally: '15-50';
  motion: string;
  billTitle: string;
  billUrl: string;
  journalUrl: string;
}

export const SF3414_OSB_PROCEDURAL_VOTE = {
  identifier: 'SF3414' as const,
  occurredOn: '2025-04-23' as const,
  tally: '15-50' as const,
  motion: 'Withdraw SF3414 from State and Local Government and re-refer it to Commerce and Consumer Protection',
  billTitle: 'Sports betting and fantasy contests authorization provision, sports betting and fantasy contests taxation provision, licenses establishment, and appropriation',
  billUrl: 'https://www.revisor.mn.gov/bills/94/2025/0/SF/3414/',
  journalUrl: 'https://www.senate.mn/journals/2025-2026/20250423023.pdf',
  yesNames: [
    'Bobby Joe Champion',
    'Steve A. Cwodzinski',
    'Nick A. Frentz',
    'Heather Gustafson',
    'Grant Hauschild',
    'Matt D. Klein',
    'Robert Kupec',
    'Ronald Steven Latz',
    'Erin P. Murphy',
    'Sandra L. Pappas',
    'Aric Putnam',
    'Ann H. Rest',
    'Judy Seeberger',
    'Bonnie Westlin',
    'Tou Xiong',
  ] as const,
  noNames: [
    'Jim J. Abeler',
    'Bruce D. Anderson',
    'Cal K. Bahr',
    'Liz Boldon',
    'Jim Carlson',
    'Doron Clark',
    'Julia E. Coleman',
    'Gary H. Dahms',
    'D. Scott Dibble',
    'Gene Dornink',
    'Rich Draheim',
    'Steve Drazkowski',
    'Zach Duckworth',
    'Robert Farnsworth',
    'Omar Fateh',
    'Steve Green',
    'Glenn Gruenhagen',
    'Foung Hawj',
    'John A. Hoffman',
    'Karin Housley',
    'Jeff Howe',
    'John R. Jasinski',
    'Mark T. Johnson',
    'Ann M Johnson Stewart',
    'Mark W. Koran',
    'Michael E. Kreun',
    'Mary K. Kunesh',
    'Andrew R. Lang',
    'Bill Lieske',
    'Warren E. Limmer',
    'Eric Lucero',
    'Alice Mann',
    'John J. Marty',
    'Andrew Mathews',
    'Erin K. Maye Quade',
    'Jennifer A McEwen',
    'Jeremy R. Miller',
    'Nicole L. Mitchell',
    'Zaynab Mohamed',
    'Carla J. Nelson',
    'Clare Oumou Verbeten',
    'Susan Pha',
    'Lindsey Port',
    'Eric R. Pratt',
    'Jason Rarick',
    'Jordan Rasmusson',
    'Paul J. Utke',
    'Bill Weber',
    'Nathan Wesenberg',
    'Melissa Halvorson Wiklund',
  ] as const,
};

// Senate journal spellings differ from VotePredict's normalized legislator names for a few members.
// Keep aliases explicit so this source can be audited rather than relying on fuzzy name matching.
const NO_NAME_ALIASES = new Map<string, string>([
  ['Jim J. Abeler', 'Jim Abeler'],
  ['Bruce D. Anderson', 'Bruce Anderson'],
  ['Cal K. Bahr', 'Cal Bahr'],
  ['Jim Carlson', 'James Carlson'],
  ['Gary H. Dahms', 'Gary Dahms'],
  ['John R. Jasinski', 'John Jasinski'],
  ['Mark W. Koran', 'Mark Koran'],
  ['Paul J. Utke', 'Paul Utke'],
]);

function normalizedMatch(memberName: string, sourceName: string): boolean {
  if (memberName === sourceName) return true;
  const alias = NO_NAME_ALIASES.get(sourceName);
  return alias === memberName;
}

export function getSf3414OsbProceduralVote(memberName: string): OsbProceduralVoteRecord | undefined {
  const shared = {
    identifier: SF3414_OSB_PROCEDURAL_VOTE.identifier,
    occurredOn: SF3414_OSB_PROCEDURAL_VOTE.occurredOn,
    tally: SF3414_OSB_PROCEDURAL_VOTE.tally,
    motion: SF3414_OSB_PROCEDURAL_VOTE.motion,
    billTitle: SF3414_OSB_PROCEDURAL_VOTE.billTitle,
    billUrl: SF3414_OSB_PROCEDURAL_VOTE.billUrl,
    journalUrl: SF3414_OSB_PROCEDURAL_VOTE.journalUrl,
  };

  if (SF3414_OSB_PROCEDURAL_VOTE.yesNames.some((name) => normalizedMatch(memberName, name))) {
    return { ...shared, choice: 'yea', supportsOsb: true };
  }
  if (SF3414_OSB_PROCEDURAL_VOTE.noNames.some((name) => normalizedMatch(memberName, name))) {
    return { ...shared, choice: 'nay', supportsOsb: undefined };
  }
  return undefined;
}

export function sf3414OsbSupportNames(): readonly string[] {
  return SF3414_OSB_PROCEDURAL_VOTE.yesNames;
}
