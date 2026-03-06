import { normalizeText } from "./normalize";

const levenshtein = (a: string, b: string): number => {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
};

export const calculateFuzzyScore = (
  keyword: string,
  text: string,
  preNormalizedText: string | null = null
): number => {
  const normKeyword = normalizeText(keyword);
  const normText = preNormalizedText || normalizeText(text);

  if (!normKeyword || !normText) return 0;

  const lengthDiff = Math.abs(normKeyword.length - normText.length);
  const maxLength = Math.max(normKeyword.length, normText.length);

  if (lengthDiff / maxLength > 0.8) {
    return Math.max(0, (1 - lengthDiff / maxLength) * 100);
  }

  const distance = levenshtein(normKeyword, normText);
  const similarity = 1 - distance / maxLength;

  return Math.max(0, similarity * 100);
};