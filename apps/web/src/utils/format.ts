const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };

/** "$120k – $150k / year", or null when the posting had no usable salary. */
export function formatSalary(job: {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
}): string | null {
  const { salaryMin, salaryMax, salaryCurrency, salaryPeriod } = job;
  if (!salaryMin && !salaryMax) return null;

  const symbol = salaryCurrency ? (CURRENCY_SYMBOLS[salaryCurrency] ?? `${salaryCurrency} `) : "";
  const low = salaryMin ? `${symbol}${compact(salaryMin)}` : null;
  const high = salaryMax && salaryMax !== salaryMin ? `${symbol}${compact(salaryMax)}` : null;
  const range = [low, high].filter(Boolean).join(" – ");
  return salaryPeriod ? `${range} / ${salaryPeriod}` : range;
}

function compact(value: number): string {
  if (value >= 1_000_000) return `${Number.parseFloat((value / 1_000_000).toFixed(1))}m`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}

/** "3 days ago" — postings are only meaningful with recency attached. */
export function relativeTime(value: string | null): string {
  if (!value) return "date unknown";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "date unknown";

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["minute", 60],
    ["hour", 3600],
    ["day", 86400],
    ["week", 604800],
    ["month", 2592000],
    ["year", 31536000],
  ];

  let chosen: [Intl.RelativeTimeFormatUnit, number] = ["minute", 60];
  for (const unit of units) if (seconds >= unit[1]) chosen = unit;

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  return formatter.format(-Math.round(seconds / chosen[1]), chosen[0]);
}

/** Drop trailing zeros: 2.50 -> "2.5", 3.00 -> "3". */
export function formatYears(value: number): string {
  return Number.parseFloat(value.toFixed(2)).toString();
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Earthy palette chosen to sit alongside the brand green and amber — the earlier
 * indigo/pink set fought with the logo colours.
 */
const SKILL_COLORS: Record<string, string> = {
  language: "green-darken-3",
  framework: "teal-darken-2",
  cloud: "blue-grey-darken-1",
  data: "cyan-darken-3",
  tooling: "brown-darken-1",
  design: "deep-orange-darken-1",
  business: "amber-darken-4",
  engineering: "brown-darken-3",
  healthcare: "red-darken-3",
  finance: "light-green-darken-3",
  soft: "grey-darken-1",
  curriculum: "green-darken-1",
};

export function skillColor(category: string): string {
  return SKILL_COLORS[category] ?? "grey";
}
