/**
 * Mechanically merges independently drafted handout parts (Stage-1 batch drafts)
 * into one document with a single, global, hierarchical heading numbering.
 *
 * Each draft is generated in isolation and uses LOCAL heading numbers (every
 * draft tends to restart from `## 1.`). This concatenates the ordered drafts and
 * renumbers all headings in one continuous pass, replacing the previous Stage-2
 * AI merge call that timed out on large sessions.
 *
 * It does NOT attempt cross-seam de-duplication or transition smoothing — those
 * are quality concerns handled (if needed) by a later optional AI seam pass.
 *
 * Heading scheme reproduced (see profilePresets handout numbering rules):
 *   ## 1. Main Section      (top level: number + trailing dot)
 *   ### 1.1 Subsection      (sub levels: dotted number, no trailing dot)
 *   #### 1.1.1 Detail
 *
 * Markdown level → numbering depth: `##` = depth 1, `###` = depth 2, etc.
 * (depth = number of `#` minus 1).
 */

/** Matches a heading line: 2–6 hashes, whitespace, then the title text. */
const HEADING_RE = /^(#{2,6})\s+(.*)$/;
/** Matches a leading numeric prefix on a heading title, e.g. "1.", "2.3", "1.1.1 ". */
const NUMBER_PREFIX_RE = /^\d+(?:\.\d+)*\.?\s*/;
/** Matches a fenced code-block delimiter (``` or ~~~), possibly indented. */
const FENCE_RE = /^\s*(```|~~~)/;

export function mergeHandoutDrafts(drafts: string[]): string {
  const document = drafts
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
    .join("\n\n");

  const counters: number[] = [];
  let inFence = false;

  const lines = document.split("\n").map((line) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) {
      return line;
    }

    const match = HEADING_RE.exec(line);
    if (!match) {
      return line;
    }

    const hashes = match[1];
    const depth = hashes.length - 1; // ## -> 1, ### -> 2, ...

    // Open this level, reset deeper levels.
    counters.length = depth;
    counters[depth - 1] = (counters[depth - 1] ?? 0) + 1;
    // Guard against an orphan sub-heading appearing before its parent: never
    // emit a "0.x" number — promote any unopened ancestor to 1.
    for (let i = 0; i < depth; i++) {
      if (!counters[i]) counters[i] = 1;
    }

    const title = match[2].replace(NUMBER_PREFIX_RE, "");
    const numbering =
      depth === 1
        ? `${counters[0]}.`
        : counters.slice(0, depth).join(".");

    return `${hashes} ${numbering} ${title}`;
  });

  return lines.join("\n");
}
