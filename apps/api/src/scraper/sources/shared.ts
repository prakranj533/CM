/** Helpers shared by the per-company board adapters. */

export function splitList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function prettifyBoard(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Even share of the per-source cap across boards, so one company with hundreds of
 * openings cannot crowd out the rest.
 */
export function perBoardBudget(maxJobs: number, boardCount: number): number {
  return Math.max(1, Math.floor(maxJobs / Math.max(boardCount, 1)));
}

const INDIA_PATTERN =
  /\b(india|bangalore|bengaluru|mumbai|new delhi|delhi|gurgaon|gurugram|noida|hyderabad|chennai|pune|kolkata|ahmedabad|jaipur|chandigarh|kochi|coimbatore|indore|trivandrum|thiruvananthapuram)\b/i;

/** True when a location string looks Indian — used for reporting coverage. */
export function looksIndian(location: string | undefined | null): boolean {
  return location ? INDIA_PATTERN.test(location) : false;
}
