import winston from "winston";
import { EOL } from "node:os";

export interface LoggerContext {
  profile?: string;
  step?: string;
  file?: string;
  service?: string;
}

export interface LoggerOptions {
  /** Minimum log level to display */
  level?: string;
  /** If true, logs are displayed in single-line format */
  singleLine?: boolean;
  /** Base context to include in all log messages */
  baseContext?: LoggerContext;
  /** If true, suppresses all log output. Defaults to checking NODE_ENV and JEST_WORKER_ID */
  silent?: boolean;
}

export interface Logger {
  error(message: string, err?: unknown): void;
  warn(message: string): void;
  info(message: string): void;
  debug(message: string): void;
  silly(message: string): void;
  withContext(ctx: LoggerContext): Logger;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const {
    level = "info",
    singleLine = true,
    baseContext = {},
    silent = process.env.SILENT === 'true',
  } = options;

  const format = winston.format.printf((info) => {
    const ctx = info.context ?? {};
    const ctxString = Object.entries(ctx)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");

    let msg = `${info.timestamp} [${info.level}]`;
    if (ctxString) msg += ` | ${ctxString}`;
    msg += ` | ${info.message}`;

    if (typeof info.stack === "string") {
      msg += singleLine ? ` | ${info.stack.replace(/\n/g, " --> ")}` : `${EOL}${info.stack}`;
    }

    return msg;
  });

  const logger = winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.colorize(),
      format,
    ),
    transports: [
      new winston.transports.Console({
        silent,
      }),
    ],
  });

  function withContext(extra: LoggerContext): Logger {
    const merged = { ...baseContext, ...extra };
    return createLogger({ level, singleLine, baseContext: merged, silent });
  }

  return {
    error: (m, e) => logger.error(m, { context: baseContext, error: e }),
    warn: (m) => logger.warn(m, { context: baseContext }),
    info: (m) => logger.info(m, { context: baseContext }),
    debug: (m) => logger.debug(m, { context: baseContext }),
    silly: (m) => logger.silly(m, { context: baseContext }),
    withContext,
  };
}
