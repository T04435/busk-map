import "server-only";

/**
 * Structured server logs (one JSON object per line, picked up by Vercel).
 *
 * Never pass secrets, full URLs with credentials, or raw provider payloads.
 * `redactUrl` strips query strings, which is where some providers take keys.
 */
type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function write(level: Level, message: string, fields: Fields = {}) {
  if (process.env.NODE_ENV === "test" && !process.env.BUSKMAP_LOG_IN_TESTS) return;
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (message: string, fields?: Fields) => write("debug", message, fields),
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};

/** Host and path only. Query strings can carry API keys (Ticketmaster, Last.fm). */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "invalid-url";
  }
}
