import * as cheerio from "cheerio";

/** Strip markup and collapse whitespace so descriptions are searchable text. */
export function toPlainText(html: string): string {
  if (!html) return "";
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();
  // Turn block boundaries into newlines before flattening, so bullet lists and
  // paragraphs don't run words together ("PythonExperience with...").
  $("br").replaceWith("\n");
  $("p, li, div, tr, h1, h2, h3, h4, h5, h6").append("\n");
  return $.root()
    .text()
    .replace(/\r/g, "")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/**
 * Some APIs (notably Greenhouse) return HTML with its entities escaped, so the
 * payload reads `&lt;p&gt;`. Decode once, then strip tags.
 */
export function decodeEscapedHtmlToText(escaped: string): string {
  if (!escaped) return "";
  const decoded = cheerio.load(`<div>${escaped}</div>`).text();
  return toPlainText(decoded);
}

export function absoluteUrl(base: string, href: string | undefined): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function parseDate(value: string | number | undefined | null): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export { cheerio };
