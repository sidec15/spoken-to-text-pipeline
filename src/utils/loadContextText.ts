import fs from "node:fs";
import path from "node:path";

export function loadContextText(paths: string[] = []): string {
  if (paths.length === 0) return "";

  return paths
    .map((p) => {
      const abs = path.resolve(process.cwd(), p);
      return fs.readFileSync(abs, "utf-8");
    })
    .join("\n\n---\n\n");
}
