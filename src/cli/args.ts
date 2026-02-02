import { loadConfig } from "../config/loadConfig.js";
import type { PipelineConfig } from "../config/config.types.js";

/**
 * Parsed CLI arguments.
 */
export interface CliArgs {
  /** Path to the configuration file */
  configPath: string;
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
 * @returns Pipeline configuration
 */
export function loadPipelineConfig(configPath: string): PipelineConfig {
  return loadConfig(configPath);
}

function printHelp(): void {
  console.log(`
Usage: spoken-to-text [OPTIONS] [CONFIG_PATH]

Options:
  -c, --config PATH    Path to the pipeline configuration file (default: pipeline.config.json)
  -h, --help           Show this help message

Arguments:
  CONFIG_PATH          Path to the pipeline configuration file (alternative to --config)

Examples:
  spoken-to-text
  spoken-to-text --config my-config.json
  spoken-to-text -c ./configs/production.json
`);
}
