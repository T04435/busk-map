/**
 * Minimal RFC 5545 calendar export for chosen busking sessions. No reminders
 * or sync (out of scope): a file the performer imports once.
 */
export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location: string;
  description: string;
  geo?: { lat: number; lon: number };
  url?: string;
};

/** Escape TEXT values (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + charSize > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += charSize;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(events: IcsEvent[], now: Date, calendarName = "Busk Map sessions"): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Busk Map//Plan my week//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(event.start)}`,
      `DTEND:${stamp(event.end)}`,
      `SUMMARY:${escapeText(event.summary)}`,
      `LOCATION:${escapeText(event.location)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
    );
    if (event.geo) lines.push(`GEO:${event.geo.lat.toFixed(6)};${event.geo.lon.toFixed(6)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
