interface DeduplicateItem {
  bidNumber: string;
  matchedKeyword: string;
  [key: string]: any;
}

export const deduplicate = <T extends DeduplicateItem>(results: T[]): T[] => {
  const map = new Map<string, T>();
  for (const item of results) {
    const key = `${item.bidNumber}-${item.matchedKeyword}`;
    if (!map.has(key)) map.set(key, item);
  }
  return Array.from(map.values());
};