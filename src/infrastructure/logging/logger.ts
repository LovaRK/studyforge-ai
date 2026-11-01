type Level = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY = /pass(word)?|secret|token|key|cookie|authorization/i;

/** Replaces values under sensitive-looking keys so secrets never reach the logs. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [key, SENSITIVE_KEY.test(key) ? "[redacted]" : redact(inner, depth + 1)]),
  );
}

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

/** Structured JSON-lines logger. */
export function createLogger(
  bindings: Record<string, unknown> = {},
  write: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
): Logger {
  const log = (level: Level, message: string, fields: Record<string, unknown> = {}) => {
    const entry = { time: new Date().toISOString(), level, message, ...(redact({ ...bindings, ...fields }) as object) };
    write(JSON.stringify(entry));
  };
  return {
    debug: (message, fields) => log("debug", message, fields),
    info: (message, fields) => log("info", message, fields),
    warn: (message, fields) => log("warn", message, fields),
    error: (message, fields) => log("error", message, fields),
    child: (more) => createLogger({ ...bindings, ...more }, write),
  };
}

export const logger = createLogger({ app: "studyforge-ai" });
