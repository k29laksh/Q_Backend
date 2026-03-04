export function calculateHSNScore(customerHSN: string, bidHSN: string): number {
  if (!customerHSN || !bidHSN) return 0;
  if (customerHSN.slice(0, 2) !== bidHSN.slice(0, 2)) return 0;

  let matchCount = 0;
  const minLen = Math.min(customerHSN.length, bidHSN.length, 8);

  for (let i = 0; i < minLen; i += 2) {
    if (customerHSN.slice(0, i + 2) === bidHSN.slice(0, i + 2)) {
      matchCount++;
    } else break;
  }

  return matchCount * 10;
}