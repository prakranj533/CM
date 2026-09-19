import { env } from "../../env.js";
import { parseDate, toPlainText } from "../html.js";
import { parseSalary } from "../salary.js";
import type { JobSource, RawJob, ScrapeContext } from "../types.js";
import { prettifyBoard, splitList } from "./greenhouse.js";

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  description?: string;
  descriptionPlain?: string;
  lists?: Array<{ text?: string; content?: string }>;
  categories?: { location?: string; team?: string; commitment?: string };
  workplaceType?: string;
}

/** Lever's public postings endpoint, the same one Lever-hosted career pages call. */
export const leverSource: JobSource = {
  key: "lever",
  name: "Lever company boards",
  homepage: "https://jobs.lever.co",
  kind: "board",

  async collect(ctx: ScrapeContext): Promise<RawJob[]> {
    const boards = splitList(env.LEVER_BOARDS);
    const jobs: RawJob[] = [];

    for (const board of boards) {
      if (jobs.length >= ctx.maxJobs) break;
      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json`;

      let postings: LeverPosting[];
      try {
        postings = await ctx.fetchJson<LeverPosting[]>(url);
      } catch (error) {
        ctx.log(`lever board "${board}" failed: ${(error as Error).message}`);
        continue;
      }
      if (!Array.isArray(postings)) continue;

      const perBoard = Math.max(1, Math.floor(ctx.maxJobs / Math.max(boards.length, 1)));
      let taken = 0;

      for (const posting of postings) {
        if (taken >= perBoard || jobs.length >= ctx.maxJobs) break;
        const link = posting.hostedUrl ?? posting.applyUrl;
        if (!posting.text || !link) continue;

        // Requirements usually live in `lists` (the bulleted sections), so append
        // them to the body — dropping them would lose most of the skill signal.
        const lists = (posting.lists ?? [])
          .map((list) => `${list.text ?? ""}\n${toPlainText(list.content ?? "")}`)
          .join("\n\n");
        const description = [posting.descriptionPlain ?? toPlainText(posting.description ?? ""), lists]
          .filter(Boolean)
          .join("\n\n")
          .trim();

        const salary = parseSalary(`${posting.text}\n${description}`);
        const location = posting.categories?.location;

        jobs.push({
          externalId: `${board}:${posting.id}`,
          url: link,
          title: posting.text,
          company: prettifyBoard(board),
          location,
          isRemote: /remote/i.test(posting.workplaceType ?? "") || /remote/i.test(location ?? ""),
          description,
          postedAt: parseDate(posting.createdAt),
          salaryMin: salary?.min,
          salaryMax: salary?.max,
          salaryCurrency: salary?.currency,
          salaryPeriod: salary?.period,
        });
        taken += 1;
      }
    }

    return jobs;
  },
};
