export interface ParsedSalary {
  min?: number;
  max?: number;
  currency?: string;
  period?: "year" | "month" | "day" | "hour";
}

const CURRENCIES: Array<[RegExp, string]> = [
  [/\bUSD\b|\$/i, "USD"],
  [/\bEUR\b|€/i, "EUR"],
  [/\bGBP\b|£/i, "GBP"],
  [/\bINR\b|₹|\brs\.?\b/i, "INR"],
  [/\bCAD\b/i, "CAD"],
  [/\bAUD\b/i, "AUD"],
];

/**
 * Pull a pay range out of free text, e.g. "$120,000 - $150,000 per year",
 * "€60k–80k", "₹12,00,000 PA", "$65/hour".
 *
 * Deliberately conservative: if we can't find a currency-anchored number we
 * return nothing rather than guessing, since a wrong salary is worse than none.
 */
export function parseSalary(text: string): ParsedSalary | null {
  if (!text) return null;
  const sample = text.slice(0, 4000);

  const currency = CURRENCIES.find(([pattern]) => pattern.test(sample))?.[1];
  if (!currency) return null;

  const period = detectPeriod(sample);

  // Range first: two numbers joined by a dash/"to".
  const range =
    /([$€£₹]|\bUSD|\bEUR|\bGBP|\bINR)?\s?([0-9][0-9,.\s]{2,})\s?(k|K)?\s?(?:-|–|—|to)\s?([$€£₹])?\s?([0-9][0-9,.\s]{2,})\s?(k|K)?/.exec(
      sample,
    );
  if (range) {
    const min = normalizeAmount(range[2], range[3]);
    const max = normalizeAmount(range[5], range[6]);
    if (min && max && max >= min && plausible(min, period) && plausible(max, period)) {
      return { min, max, currency, ...(period ? { period } : {}) };
    }
  }

  const single = /([$€£₹])\s?([0-9][0-9,.\s]{2,})\s?(k|K)?/.exec(sample);
  if (single) {
    const value = normalizeAmount(single[2], single[3]);
    if (value && plausible(value, period)) {
      return { min: value, max: value, currency, ...(period ? { period } : {}) };
    }
  }

  return null;
}

function detectPeriod(text: string): ParsedSalary["period"] | undefined {
  if (/\b(per hour|hourly|\/\s?hr|\/\s?hour|an hour)\b/i.test(text)) return "hour";
  if (/\b(per day|daily|\/\s?day|day rate)\b/i.test(text)) return "day";
  if (/\b(per month|monthly|\/\s?month|pm\b)\b/i.test(text)) return "month";
  if (/\b(per year|per annum|annually|yearly|\/\s?yr|\/\s?year|\bpa\b|\bp\.a\.)\b/i.test(text)) return "year";
  return undefined;
}

function normalizeAmount(raw: string | undefined, kSuffix: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[,\s]/g, "");
  let value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return undefined;
  if (kSuffix) value *= 1000;
  return Math.round(value);
}

/** Reject matches that are obviously not pay (years, counts, phone numbers). */
function plausible(value: number, period: ParsedSalary["period"]): boolean {
  if (period === "hour") return value >= 5 && value <= 2000;
  if (period === "day") return value >= 50 && value <= 20000;
  if (period === "month") return value >= 500 && value <= 500000;
  return value >= 1000 && value <= 100000000;
}
