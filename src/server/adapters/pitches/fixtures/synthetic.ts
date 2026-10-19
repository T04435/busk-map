// SYNTHETIC FIXTURE: invented busking sites and zones for tests and offline mode.
// Shapes mirror the City of Melbourne layers; names, rules and coordinates are made up.
import type { PitchData } from "../schema";

export function syntheticPitches(): PitchData {
  return {
    sites: [
      { id: "syn-1", name: "Synthetic Mall pitch A", lat: -37.8138, lon: 144.9641, permit: "premium", buskingAllowed: true, musicAllowed: true, circleActs: null, rules: "Synthetic: premium permit holders only.", rulesUrl: null },
      { id: "syn-2", name: "Synthetic riverside circle", lat: -37.8209, lon: 144.9612, permit: "circle-act", buskingAllowed: true, musicAllowed: true, circleActs: true, rules: "Synthetic: circle acts have priority.", rulesUrl: null },
      { id: "syn-3", name: "Synthetic library lawn", lat: -37.8098, lon: 144.9652, permit: "chess-board", buskingAllowed: true, musicAllowed: true, circleActs: null, rules: "Synthetic: amplification after 5:30 pm only.", rulesUrl: null },
      { id: "syn-4", name: "Synthetic station entrance", lat: -37.8183, lon: 144.9671, permit: "no-busking", buskingAllowed: false, musicAllowed: false, circleActs: null, rules: "Synthetic: no busking.", rulesUrl: null },
      { id: "syn-5", name: "Synthetic parkland", lat: -37.8196, lon: 144.9745, permit: "general", buskingAllowed: true, musicAllowed: true, circleActs: null, rules: "Synthetic: busking permitted.", rulesUrl: null },
      { id: "syn-6", name: "Synthetic shopping centre", lat: -37.8102, lon: 144.9628, permit: "private", buskingAllowed: null, musicAllowed: null, circleActs: null, rules: "Synthetic: contact the centre.", rulesUrl: "https://example.com/synthetic" },
    ],
    zones: [
      { id: "no-busking-syn-1", kind: "no-busking", lines: [[{ lat: -37.8158, lon: 144.9440 }, { lat: -37.8160, lon: 144.9455 }]] },
      { id: "unamplified-syn-1", kind: "unamplified", lines: [[{ lat: -37.8205, lon: 144.9630 }, { lat: -37.8205, lon: 144.9660 }]] },
    ],
  };
}

/** Raw provider-shaped payloads, for client tests. */
export const SYNTHETIC_RAW = {
  points: {
    layers: [
      {
        featureSet: {
          features: [
            { geometry: { x: 16137000, y: -4553500 }, attributes: { FID: 0, Location: "Synthetic Mall", Permit_Typ: "Premium Permit Holder", Descriptio: "Synthetic premium site", Busking_Al: "Y", Music_Allo: "Y", Circle_Act: " " } },
            { geometry: { x: 16137100, y: -4553600 }, attributes: { FID: 1, Location: "Synthetic Centre", Permit_Typ: "Privately Managed", Descriptio: "<a href='https://example.com/synthetic'>Contact</a> directly.", Busking_Al: null, Music_Allo: null, Circle_Act: null } },
            { geometry: { x: 16137200, y: -4553700 }, attributes: { FID: 2, Location: null, Permit_Typ: " ", Descriptio: null, Busking_Al: "Y", Music_Allo: "N", Circle_Act: " " } },
          ],
        },
      },
    ],
  },
  noBusking: {
    type: "FeatureCollection",
    features: [
      { properties: { FID: 1, Descriptio: "No Busking" }, geometry: { type: "LineString", coordinates: [[144.957, -37.8136], [144.9567, -37.8128]] } },
    ],
  },
  unamplified: {
    type: "FeatureCollection",
    features: [
      { properties: { FID: 1, Descriptio: "Unamplified Busking" }, geometry: { type: "MultiLineString", coordinates: [[[144.9651, -37.8182], [144.967, -37.8177]], [[144.968, -37.818], [144.969, -37.8181]]] } },
    ],
  },
};
