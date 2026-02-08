import { loadConfig } from "../config/loadConfig.js";
import type { PipelineConfig } from "../config/config.types.js";

/**
 * Parsed CLI arguments.
 */
export interface CliArgs {
  /** Path to the configuration file */
  configPath: string;
  /** Base directory for resolving relative paths in configuration */
  baseDir?: string;
  /** If true, run in dry-run mode (validate config and show plan without executing) */
  dryRun?: boolean;
}

/**
 * Parses command line arguments and returns the configuration.
 *
 * @param argv - Command line arguments (typically process.argv.slice(2))
 * @returns Parsed CLI arguments
 */
export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    configPath: "pipeline.config.json", // Default config path
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--config" || arg === "-c") {
      if (i + 1 < argv.length) {
        args.configPath = argv[i + 1];
        i++; // Skip next argument as it's the value
      } else {
        throw new Error(`Missing value for option ${arg}`);
      }
    } else if (arg === "--base-dir" || arg === "-b") {
      if (i + 1 < argv.length) {
        args.baseDir = argv[i + 1];
        i++; // Skip next argument as it's the value
      } else {
        throw new Error(`Missing value for option ${arg}`);
      }
    } else if (arg === "--dry-run" || arg === "-d") {
      args.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}. Use --help for usage information.`);
    } else {
      // Positional argument - treat as config path
      args.configPath = arg;
    }
  }

  return args;
}

/**
 * Loads the pipeline configuration from the specified path.
 *
 * @param configPath - Path to the configuration file
 * @param baseDir - Optional base directory for resolving relative paths
 * @returns Pipeline configuration
 */
export function loadPipelineConfig(configPath: string, baseDir?: string): PipelineConfig {
  return loadConfig(configPath, baseDir);
}

function printHelp(): void {
  console.log(`
Usage: spoken-to-text [OPTIONS] [CONFIG_PATH]

Options:
  -c, --config PATH      Path to the pipeline configuration file (default: pipeline.config.json)
  -b, --base-dir PATH     Base directory for resolving relative paths in configuration (default: current working directory)
  -d, --dry-run           Run in dry-run mode: validate configuration and show execution plan without executing
  -h, --help              Show this help message

Arguments:
  CONFIG_PATH            Path to the pipeline configuration file (alternative to --config)

Examples:
  spoken-to-text
  spoken-to-text --config my-config.json
  spoken-to-text -c ./configs/production.json
  spoken-to-text --base-dir /path/to/project --config config.json
  spoken-to-text -b ./project -c config.json
  spoken-to-text --dry-run --config config.json
  spoken-to-text -d -c config.json
`);
}
