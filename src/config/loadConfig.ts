import fs from "node:fs";
import path from "node:path";
import type { PipelineConfig } from "./config.types.js";

export function loadConfig(configPath: string): PipelineConfig {
  const absolutePath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, "utf-8");

  try {
    return JSON.parse(raw) as PipelineConfig;
  } catch {
    throw new Error(`Invalid JSON in config file: ${absolutePath}`);
  }
}
