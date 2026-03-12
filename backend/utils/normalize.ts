const stopwords: string[] = [
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "of",
  "to",
  "in",
  "on",
  "with",
  "by",
  "is",
  "are",
  "at",
  "this",
  "that",
  "it",
  "from",
  "as",
  "be",
  "been",
  "has",
  "have",
  "was",
  "were",
];

export const normalizeText = (text: string): string => {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !stopwords.includes(word))
    .join(" ");
};