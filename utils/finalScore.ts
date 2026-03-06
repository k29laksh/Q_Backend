import { calculateHSNScore } from "./hsnMatch";
import { calculateTokenScore } from "./tokenMatch";
import { calculateFuzzyScore } from "./fuzzyMatch";

interface Bid {
  hsn_code: string;
  bid_items: string;
  [key: string]: any;
}

interface SegmentScoreResult {
  hsnScore: number;
  tokenScore: number;
  fuzzyScore: number;
  bestSegment: string;
  finalScore: number;
}

export const calculateFinalScore = (
  hsnScore: number,
  tokenScore: number,
  fuzzyScore: number,
  semanticScore: number = 0
): number => {
  const HSN_WEIGHT = 0.5;
  const TOKEN_WEIGHT = 0.35;
  const FUZZY_WEIGHT = 0.15;
  const SEMANTIC_WEIGHT = 0;

  const finalScore =
    hsnScore * HSN_WEIGHT +
    tokenScore * TOKEN_WEIGHT +
    fuzzyScore * FUZZY_WEIGHT +
    semanticScore * SEMANTIC_WEIGHT;

  return Number(finalScore.toFixed(2));
};

export const calculateBestSegmentScore = (
  hsnCode: string,
  keyword: string,
  bid: Bid,
  calculateHSNScoreFn: (customerHSN: string, bidHSN: string) => number,
  calculateTokenScoreFn: (keyword: string, text: string, preNormalizedText?: string | null) => number,
  calculateFuzzyScoreFn: (keyword: string, text: string, preNormalizedText?: string | null) => number
): SegmentScoreResult => {
  const hsnScore = calculateHSNScoreFn(hsnCode, bid.hsn_code);

  const segments = bid.bid_items
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (segments.length <= 1 || bid.bid_items.length < 50) {
    const tokenScore = calculateTokenScoreFn(keyword, bid.bid_items);
    const fuzzyScore = calculateFuzzyScoreFn(keyword, bid.bid_items);

    return {
      hsnScore,
      tokenScore,
      fuzzyScore,
      bestSegment: bid.bid_items,
      finalScore: calculateFinalScore(hsnScore, tokenScore, fuzzyScore, 0),
    };
  }

  let bestTokenScore = 0;
  let bestFuzzyScore = 0;
  let bestSegment = segments[0];
  let bestCombinedScore = 0;

  for (const segment of segments) {
    const tokenScore = calculateTokenScoreFn(keyword, segment);
    const fuzzyScore = calculateFuzzyScoreFn(keyword, segment);

    const combinedScore = tokenScore * 0.7 + fuzzyScore * 0.3;

    if (combinedScore > bestCombinedScore) {
      bestCombinedScore = combinedScore;
      bestTokenScore = tokenScore;
      bestFuzzyScore = fuzzyScore;
      bestSegment = segment;
    }
  }

  return {
    hsnScore,
    tokenScore: bestTokenScore,
    fuzzyScore: bestFuzzyScore,
    bestSegment,
    finalScore: calculateFinalScore(hsnScore, bestTokenScore, bestFuzzyScore, 0),
  };
};