import "server-only";
import { fansCityQuery, nearestCityOption, parseFansCityParam, type CityOption } from "@/lib/city";
import { findCities } from "@/server/adapters/geocode";
import type { AdapterContext } from "@/server/adapters/core";

/**
 * `?fans=Bogota~4.711~-74.0721` on /busks (the Repertoire's "Plan a busk here"): the fans city as the form's starting city,
 * found through the geocoder (cached a week) as the geocoded city nearest the map marker. Null when the link is unreadable or
 * no city is near it: the form then starts on Melbourne, as it does without the link.
 */
export async function fansCityOption(param: string | undefined, context: AdapterContext): Promise<CityOption | null> {
  const fans = parseFansCityParam(param);
  const query = fans ? fansCityQuery(fans.name) : "";
  if (!fans || query.length < 2) return null;
  const found = await findCities(query, context).catch(() => null);
  return found ? nearestCityOption(found.data, fans) : null;
}
