import { buildIcs } from "@/lib/ics";
import { planSearchParams } from "@/lib/plan-url";
import { localToday, zonedHourToUtc } from "@/lib/slot";
import { parseWeekParams } from "@/lib/week-url";
import { buildWeekPlan, WeekQlooUnavailableError } from "@/server/agent/week";
import { CITIES } from "@/server/cities";
import { adapterContextFor } from "@/server/request";

/**
 * GET /api/week/ics?<same params as /week>: the chosen sessions as an .ics
 * file. Uses the engine only (no model call), so it is free and repeatable.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  const today = localToday(CITIES.melbourne.timeZone);
  const parsed = parseWeekParams(params, today);
  if (!parsed.ok) return Response.json({ error: { code: "invalid_request", message: parsed.error } }, { status: 400 });

  try {
    const plan = await buildWeekPlan(parsed.request, adapterContextFor(url.searchParams.get("faults")), today, false);
    const req = parsed.request;
    const ics = buildIcs(
      plan.sessions.map((s) => {
        const planLink = `${url.origin}/plan?${planSearchParams({
          city: req.city,
          permit: req.permit,
          performer: req.performer,
          slot: { date: s.date, startHour: s.startHour, endHour: s.endHour },
        })}`;
        return {
          uid: `${s.key}-${s.pitch.id}@busk-map`,
          start: zonedHourToUtc(s.date, s.startHour, plan.timeZone),
          end: zonedHourToUtc(s.date, s.endHour, plan.timeZone),
          summary: `Busk: ${s.pitch.name}`,
          location: `${s.pitch.name}, ${plan.cityName}`,
          description: [`Score ${s.score}/100.`, s.why, ...s.pitch.cautions, "Busk Map never confirms a pitch is legal; check your permit.", planLink].join("\n"),
          geo: { lat: s.pitch.lat, lon: s.pitch.lon },
          url: planLink,
        };
      }),
      new Date(),
      `Busk Map: ${plan.performerName}`,
    );
    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="busk-map-week-${plan.startDate}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof WeekQlooUnavailableError) {
      return Response.json({ error: { code: "qloo_unavailable", message: "Qloo is not responding. Please try again shortly." } }, { status: 503 });
    }
    throw error;
  }
}
