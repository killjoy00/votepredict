export interface OfficialMembershipAlias {
  sourceSystem: 'mn_house_chamber_voting';
  sourceName: string;
  normalizedName: string;
  sourceUrl: string;
  metadata: Record<string, unknown>;
}

const OFFICIAL_ALIASES_BY_LRL_ID: Readonly<Record<string, readonly OfficialMembershipAlias[]>> = {
  '15409': [
    {
      sourceSystem: 'mn_house_chamber_voting',
      sourceName: "O'Neill",
      normalizedName: 'o neill',
      sourceUrl: 'https://www.lrl.mn.gov/legdb/fulldetail?id=15409',
      metadata: {
        provenance: "Minnesota LRL records Marion Rarick's former name as O'Neill; House rolls in the historical dataset use O'Neill.",
        houseMemberId: '15409',
      },
    },
  ],
  '15576': [
    {
      sourceSystem: 'mn_house_chamber_voting',
      sourceName: 'Lee, K.',
      normalizedName: 'lee k',
      sourceUrl: 'https://www.revisor.mn.gov/bills/status_result.php?author%5B%5D=&body=House&legid=15576&location=House&session=0942025&sort2=1',
      metadata: {
        provenance: 'Minnesota Revisor author search resolves the House clerk name Lee, K. to House member id 15576 (Liz Lee).',
        houseMemberId: '15576',
      },
    },
  ],
  '15610': [
    {
      sourceSystem: 'mn_house_chamber_voting',
      sourceName: 'Anderson, P. E.',
      normalizedName: 'anderson p e',
      sourceUrl: 'https://www.revisor.mn.gov/bills/status_result.php?author%5B%5D=&body=House&legid=15610&session=0942025',
      metadata: {
        provenance: 'Minnesota Revisor author search resolves the House clerk name Anderson, P. E. to House member id 15610 (Patti Anderson).',
        houseMemberId: '15610',
      },
    },
  ],
};

export function officialMembershipAliasesForLrlId(lrlId: string): readonly OfficialMembershipAlias[] {
  return OFFICIAL_ALIASES_BY_LRL_ID[lrlId] ?? [];
}
