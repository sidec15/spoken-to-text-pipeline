import fs from "node:fs";
import path from "node:path";

/**
 * Loads context text from multiple file paths.
 * Paths are resolved relative to baseDir if provided, otherwise relative to process.cwd().
 *
 * @param paths - Array of file paths to load
 * @param baseDir - Optional base directory for resolving relative paths
 * @returns Concatenated content from all files, separated by "---"
 */
export function loadContextText(paths: string[] = [], baseDir?: string): string {
  if (paths.length === 0) return "";

  const resolvedBaseDir = baseDir ?? process.cwd();

  return paths
    .map((p) => {
      const abs = path.isAbsolute(p) ? p : path.resolve(resolvedBaseDir, p);
      return fs.readFileSync(abs, "utf-8");
    })
    .join("\n\n---\n\n");
}
