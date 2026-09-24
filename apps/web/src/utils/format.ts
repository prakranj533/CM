const INR_PER_UNIT: Record<string, number> = {
  INR: 1,
  USD: 84,
  EUR: 91,
  GBP: 108,
  CAD: 62,
  AUD: 55,
};

/** "₹12 lakh – ₹15 lakh / year", or null when the posting had no usable salary. */
export function formatSalary(job: {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
}): string | null {
  const { salaryMin, salaryMax, salaryCurrency, salaryPeriod } = job;
  if ((!salaryMin && !salaryMax) || !salaryCurrency) return null;
  const rate = INR_PER_UNIT[salaryCurrency.toUpperCase()];
  if (!rate) return null;

  const low = salaryMin ? formatInr(salaryMin * rate) : null;
  const high = salaryMax && salaryMax !== salaryMin ? formatInr(salaryMax * rate) : null;
  const range = [low, high].filter(Boolean).join(" – ");
  const approximate = salaryCurrency.toUpperCase() === "INR" ? "" : "≈ ";
  return `${approximate}${range}${salaryPeriod ? ` / ${salaryPeriod}` : ""}`;
}

export function formatInr(value: number): string {
  if (value >= 10_000_000) return `₹${Number.parseFloat((value / 10_000_000).toFixed(1))} crore`;
  if (value >= 100_000) return `₹${Number.parseFloat((value / 100_000).toFixed(1))} lakh`;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
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
