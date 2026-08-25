// Server-side only — used by Vercel API routes, not imported by frontend
import Anthropic from '@anthropic-ai/sdk';
import type { Legislator } from './openStates.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface LegislatorPrediction {
  legislatorId: string;
  vote: 'yes' | 'no' | 'abstain';
  confidence: number;
  reasoning: string;
}

export interface VotePredictionResult {
  billTitle: string;
  billNumber?: string;
  analysis: string;
  houseYes: number;
  houseNo: number;
  houseAbstain: number;
  senateYes: number;
  senateNo: number;
  senateAbstain: number;
  likelyToPass: boolean;
  passageConfidence: number;
  keyFactors: string[];
  predictions: LegislatorPrediction[];
  generatedAt: string;
}

interface ClaudeOutput {
  analysis: string;
  dflStance: 'yes' | 'no' | 'split';
  republicanStance: 'yes' | 'no' | 'split';
  dflYesPercent: number;
  republicanYesPercent: number;
  independentYesPercent: number;
  houseYes: number;
  houseNo: number;
  houseAbstain: number;
  senateYes: number;
  senateNo: number;
  senateAbstain: number;
  likelyToPass: boolean;
  passageConfidence: number;
  keyFactors: string[];
  exceptions: Array<{
    name: string;
    vote: 'yes' | 'no' | 'abstain';
    confidence: number;
    reasoning: string;
  }>;
}

export async function predictVotes(input: {
  billTitle: string;
  billNumber?: string;
  billDescription: string;
  subjects?: string[];
  sponsors?: string[];
  legislators: Legislator[];
}): Promise<VotePredictionResult> {
  const { billTitle, billNumber, billDescription, subjects, sponsors, legislators } = input;

  const house = legislators.filter((l) => l.chamber === 'house');
  const senate = legislators.filter((l) => l.chamber === 'senate');

  const systemPrompt = `You are an expert analyst of Minnesota state legislature politics with deep knowledge of:
- The DFL (Minnesota's Democratic-Farmer-Labor Party) and Republican party platforms and voting patterns
- Minnesota's political geography (Twin Cities metro = DFL strongholds; Greater Minnesota = Republican-leaning; suburbs = competitive)
- Current legislative session dynamics, committee leadership, and swing legislators
- How specific policy areas (education, environment, taxes, healthcare, public safety) break down along party lines in MN

Your predictions must be data-driven and politically realistic.`;

  const userMsg = `Analyze this Minnesota bill and predict how the legislature will vote.

## Bill
Title: ${billTitle}
${billNumber ? `Number: ${billNumber}` : ''}
${subjects?.length ? `Policy Areas: ${subjects.join(', ')}` : ''}
${sponsors?.length ? `Sponsors: ${sponsors.join(', ')}` : ''}

Description:
${billDescription}

## Legislature Breakdown
House: ${house.length} members (${house.filter((l) => l.party === 'DFL').length} DFL, ${house.filter((l) => l.party === 'Republican').length} Republican, ${house.filter((l) => l.party !== 'DFL' && l.party !== 'Republican').length} other)
Senate: ${senate.length} members (${senate.filter((l) => l.party === 'DFL').length} DFL, ${senate.filter((l) => l.party === 'Republican').length} Republican, ${senate.filter((l) => l.party !== 'DFL' && l.party !== 'Republican').length} other)

## Full Legislator List
${JSON.stringify(legislators.map((l) => ({ id: l.id, name: l.name, party: l.party, chamber: l.chamber, district: l.district })))}

## Task
1. Analyze the bill's political implications
2. Predict party-level stance (DFL and Republican percentage likely to vote yes)
3. Identify up to 15 NOTABLE EXCEPTIONS — specific legislators who will likely deviate from their party line (based on district type, known positions, or committee role)
4. Provide accurate vote count predictions for each chamber

The server will apply party-line rules for all legislators not listed as exceptions.

Return ONLY valid JSON (no markdown, no extra text):
{
  "analysis": "<2-3 sentences on bill politics and key dynamics>",
  "dflStance": "yes|no|split",
  "republicanStance": "yes|no|split",
  "dflYesPercent": <0-100>,
  "republicanYesPercent": <0-100>,
  "independentYesPercent": <0-100>,
  "houseYes": <number>,
  "houseNo": <number>,
  "houseAbstain": <number>,
  "senateYes": <number>,
  "senateNo": <number>,
  "senateAbstain": <number>,
  "likelyToPass": <boolean>,
  "passageConfidence": <0-100>,
  "keyFactors": ["<factor1>", "<factor2>", "<factor3>"],
  "exceptions": [
    {
      "name": "<exact legislator name>",
      "vote": "yes|no|abstain",
      "confidence": <0-100>,
      "reasoning": "<one sentence>"
    }
  ]
}`;

  // Skip thinking for speed — this is a pattern-matching task with a 60s timeout
  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMsg }],
  });

  const text = response.content.filter((b) => b.type === 'text').map((b) => (b as { type: 'text'; text: string }).text).join('');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to extract JSON from Claude response');

  const parsed: ClaudeOutput = JSON.parse(jsonMatch[0]);

  // Build exception lookup by name (fuzzy)
  const exceptionMap = new Map<string, ClaudeOutput['exceptions'][0]>();
  for (const ex of parsed.exceptions ?? []) {
    exceptionMap.set(ex.name.toLowerCase().trim(), ex);
  }

  // Apply predictions: exception overrides party-line rule
  const predictions: LegislatorPrediction[] = legislators.map((leg) => {
    const exKey = leg.name.toLowerCase().trim();
    const exception = exceptionMap.get(exKey);

    if (exception) {
      return {
        legislatorId: leg.id,
        vote: exception.vote,
        confidence: exception.confidence,
        reasoning: exception.reasoning,
      };
    }

    // Party-line default
    let yesPercent: number;
    if (leg.party === 'DFL') yesPercent = parsed.dflYesPercent;
    else if (leg.party === 'Republican') yesPercent = parsed.republicanYesPercent;
    else yesPercent = parsed.independentYesPercent ?? 50;

    const vote: 'yes' | 'no' | 'abstain' = yesPercent >= 60 ? 'yes' : yesPercent <= 40 ? 'no' : 'abstain';
    const confidence = Math.abs(yesPercent - 50) + 50; // higher confidence when further from 50

    const partyLabel = leg.party === 'DFL' ? 'DFL' : leg.party === 'Republican' ? 'Republican' : 'Independent';
    return {
      legislatorId: leg.id,
      vote,
      confidence: Math.min(95, Math.round(confidence)),
      reasoning: `${partyLabel} party-line vote based on ${parsed.dflStance === 'yes' ? 'support' : 'opposition'} from their caucus.`,
    };
  });

  return {
    billTitle,
    billNumber,
    analysis: parsed.analysis,
    houseYes: parsed.houseYes,
    houseNo: parsed.houseNo,
    houseAbstain: parsed.houseAbstain,
    senateYes: parsed.senateYes,
    senateNo: parsed.senateNo,
    senateAbstain: parsed.senateAbstain,
    likelyToPass: parsed.likelyToPass,
    passageConfidence: parsed.passageConfidence,
    keyFactors: parsed.keyFactors ?? [],
    predictions,
    generatedAt: new Date().toISOString(),
  };
}
