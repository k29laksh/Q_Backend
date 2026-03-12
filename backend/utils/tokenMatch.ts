import { normalizeText } from "./normalize";

export function calculateTokenScore(
  keyword: string,
  text: string,
  preNormalizedText: string | null = null
): number {
  const normKeyword = normalizeText(keyword);
  const normText = preNormalizedText || normalizeText(text);

  const keywordTokens = new Set(normKeyword.split(/\s+/));
  const textTokens = new Set(normText.split(/\s+/));

  const intersection = new Set([...keywordTokens].filter((t) => textTokens.has(t)));
  const union = new Set([...keywordTokens, ...textTokens]);

  if (union.size === 0) return 0;
  return (intersection.size / union.size) * 100;
}