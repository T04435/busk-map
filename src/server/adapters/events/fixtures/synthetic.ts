// SYNTHETIC FIXTURE: invented events for tests and offline mode. Not Ticketmaster data.
import type { CrowdEvent } from "../schema";

export function syntheticEvents(): CrowdEvent[] {
  return [
    {
      id: "syn-ev-1",
      name: "Synthetic Stadium Football",
      url: null,
      venue: { id: "syn-v-1", name: "Synthetic Stadium", lat: -37.8165, lon: 144.9475 },
      start: "2026-10-17T05:30:00Z",
      localTime: "16:30",
      end: "2026-10-17T08:30:00Z",
      endEstimated: true,
      segment: "Sports",
      genre: "Football",
      artists: [],
      status: "onsale",
    },
    {
      id: "syn-ev-2",
      name: "Synthetic Folk Night",
      url: null,
      venue: { id: "syn-v-2", name: "Synthetic Hall", lat: -37.8152, lon: 144.9690 },
      start: "2026-10-17T08:00:00Z",
      localTime: "19:00",
      end: "2026-10-17T10:30:00Z",
      endEstimated: false,
      segment: "Music",
      genre: "Folk",
      artists: [{ id: "syn-att-1", name: "Synthetic Folk Band" }],
      status: "onsale",
    },
  ];
}

/** Raw provider-shaped payload, for client tests. */
export const SYNTHETIC_RAW = {
  _embedded: {
    events: [
      {
        id: "syn-raw-1",
        name: "Synthetic Concert",
        url: "https://example.com/synthetic-concert",
        dates: { start: { localDate: "2026-10-17", localTime: "19:30:00", dateTime: "2026-10-17T08:30:00Z" }, status: { code: "onsale" } },
        classifications: [{ primary: true, segment: { name: "Music" }, genre: { name: "Rock" } }],
        _embedded: {
          venues: [{ id: "syn-v", name: "Synthetic Arena", location: { latitude: "-37.8216", longitude: "144.9785" } }],
          attractions: [{ id: "syn-a", name: "Synthetic Rock Band" }],
        },
      },
      {
        id: "syn-raw-2",
        name: "Synthetic Match",
        dates: { start: { dateTime: "2026-10-17T06:00:00Z" }, end: { dateTime: "2026-10-17T08:00:00Z" } },
        classifications: [{ segment: { name: "Sports" } }],
        _embedded: { venues: [{ id: "syn-v2", location: { latitude: -37.82, longitude: 144.98 } }], attractions: [{ id: "t", name: "Team" }] },
      },
      { id: "syn-raw-3", name: "No venue location", dates: { start: { dateTime: "2026-10-17T06:00:00Z" } }, _embedded: { venues: [{ id: "x" }] } },
      { id: "syn-raw-4", name: "No start time", dates: { start: { localDate: "2026-10-17" } }, _embedded: { venues: [{ id: "y", location: { latitude: 1, longitude: 2 } }] } },
      { id: "syn-raw-5", broken: true },
    ],
  },
  page: { totalElements: 5 },
};
