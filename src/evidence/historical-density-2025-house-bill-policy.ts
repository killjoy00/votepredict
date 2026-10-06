export type BillPolicyTermHit = {
  topic: string;
  phrase: string;
  index: number;
};

const TOPIC_ALIASES: Record<string, readonly string[]> = {
  'hazardous chemicals': ['hazardous chemical', 'chemical release'],
  refineries: ['refinery'],
  'electric vehicles': ['electric vehicle', 'EV'],
  'road funding': ['road funding', 'roads and bridges', 'highway funding'],
  telework: ['telework', 'remote work'],
  lobbying: ['lobbyist', 'lobbying'],
  'duty to retreat': ['duty to retreat', 'retreat'],
  'self defense': ['self-defense', 'self defense', 'deadly force'],
  pfas: ['PFAS', 'perfluoro'],
  zoning: ['zoning'],
  housing: ['housing'],
  abortion: ['abortion'],
  'pro-life': ['unborn', 'pro-life'],
  'nuclear energy': ['nuclear'],
  'parental rights': ['parental rights', 'parent rights'],
  'school sports': ['school sports', 'athletic', 'athletics'],
  'sex-based athletics': ['biological sex', 'male', 'female', 'athletic'],
  'transgender policy': ['transgender', 'gender identity'],
  'transgender rights': ['transgender', 'gender identity'],
  antitrust: ['antitrust'],
  competition: ['competition', 'competitive'],
  monopoly: ['monopoly', 'monopsony'],
  'human trafficking': ['human trafficking', 'sex trafficking'],
  'inspector general': ['inspector general'],
  'fraud prevention': ['fraud'],
  'government oversight': ['oversight', 'accountability'],
  'government accountability': ['accountability', 'oversight'],
  'criminal penalties': ['criminal penalty', 'criminal penalties', 'felony', 'misdemeanor'],
  'law enforcement': ['law enforcement', 'peace officer', 'police'],
  'paid family leave': ['paid family', 'family and medical leave'],
  dwi: ['DWI', 'driving while impaired'],
  'ignition interlock': ['ignition interlock', 'interlock'],
  medicaid: ['Medicaid', 'medical assistance'],
  taxation: ['tax', 'taxes'],
  'emergency powers': ['emergency powers', 'peacetime emergency'],
  'executive authority': ['governor', 'executive'],
  'teacher pensions': ['teacher pension', 'teacher retirement', 'teachers retirement'],
  retirement: ['retirement', 'pension'],
  'earned sick time': ['earned sick', 'sick time'],
  agriculture: ['farm', 'agriculture', 'agricultural'],
  'ez pass': ['EZ Pass', 'E-ZPass', 'MnPASS', 'toll lane'],
  tolls: ['toll', 'tolls'],
  'off-highway vehicles': ['off-highway vehicle', 'snowmobile', 'all-terrain vehicle'],
  'environmental regulation': ['environmental regulation', 'restriction'],
  'gun violence': ['gun violence', 'firearm'],
  research: ['research'],
  'manufactured homes': ['manufactured home', 'mobile home'],
  rent: ['rent', 'rental'],
  'school mandates': ['school mandate', 'mandate'],
  'education funding': ['education funding', 'school funding', 'aid'],
  'racial profiling': ['racial profiling'],
  'traffic stops': ['traffic stop', 'vehicle stop'],
  'disability rights': ['disability', 'disabled'],
  'human services': ['human services'],
  'civil rights': ['civil rights', 'civil liberties'],
  'civil liberties': ['civil liberties', 'civil rights'],
  'lgbtq rights': ['LGBTQ', 'sexual orientation', 'gender identity'],
  immigration: ['immigration', 'immigrant'],
  curriculum: ['curriculum'],
  schools: ['school', 'schools'],
  education: ['education', 'school'],
  healthcare: ['health care', 'healthcare'],
  'public health': ['public health'],
  'public safety': ['public safety'],
  labor: ['employee', 'employer', 'labor'],
  'state employees': ['state employee', 'state employees'],
  ethics: ['ethics', 'ethical'],
  transportation: ['transportation', 'highway', 'road'],
  affordability: ['affordability', 'affordable'],
  environment: ['environment', 'environmental'],
  energy: ['energy'],
  'energy policy': ['energy'],
};

const DISTINCTIVE_SINGLE_TOPICS = new Set([
  'hazardous chemicals',
  'refineries',
  'electric vehicles',
  'telework',
  'lobbying',
  'duty to retreat',
  'pfas',
  'zoning',
  'abortion',
  'pro-life',
  'nuclear energy',
  'parental rights',
  'transgender policy',
  'transgender rights',
  'antitrust',
  'monopoly',
  'human trafficking',
  'inspector general',
  'paid family leave',
  'dwi',
  'ignition interlock',
  'medicaid',
  'emergency powers',
  'teacher pensions',
  'earned sick time',
  'ez pass',
  'off-highway vehicles',
  'gun violence',
  'manufactured homes',
  'racial profiling',
  'traffic stops',
  'disability rights',
]);

function normalized(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function aliasesForTopic(topic: string): string[] {
  const key = topic.toLowerCase();
  return [...new Set([topic, ...(TOPIC_ALIASES[key] ?? [])])]
    .map(normalized)
    .filter(Boolean);
}

export function billPolicyTermHits(
  text: string,
  topics: readonly string[],
): BillPolicyTermHit[] {
  const haystack = normalized(text);
  const hits: BillPolicyTermHit[] = [];
  for (const topic of topics) {
    const seen = new Set<string>();
    for (const phrase of aliasesForTopic(topic)) {
      if (seen.has(phrase)) continue;
      seen.add(phrase);
      const index = haystack.indexOf(phrase);
      if (index >= 0) hits.push({ topic, phrase, index });
    }
  }
  return hits.sort(
    (a, b) =>
      a.index - b.index
      || a.topic.localeCompare(b.topic)
      || a.phrase.localeCompare(b.phrase),
  );
}

export function billPolicyNomination(
  text: string,
  topics: readonly string[],
): {
  nominated: boolean;
  matchedTopics: string[];
  distinctiveTopicMatched: boolean;
  hits: BillPolicyTermHit[];
} {
  const hits = billPolicyTermHits(text, topics);
  const matchedTopics = [...new Set(hits.map((hit) => hit.topic))].sort();
  const distinctiveTopicMatched = matchedTopics.some((topic) =>
    DISTINCTIVE_SINGLE_TOPICS.has(topic.toLowerCase()),
  );
  return {
    nominated: distinctiveTopicMatched || matchedTopics.length >= 2,
    matchedTopics,
    distinctiveTopicMatched,
    hits,
  };
}

export function billPolicySnippet(
  text: string,
  phrase: string,
  radius = 220,
): string {
  const lower = text.toLowerCase();
  const needle = phrase.toLowerCase();
  const index = lower.indexOf(needle);
  if (index < 0) return text.slice(0, Math.min(text.length, radius * 2)).trim();
  return text
    .slice(Math.max(0, index - radius), Math.min(text.length, index + needle.length + radius))
    .replace(/\s+/g, ' ')
    .trim();
}
