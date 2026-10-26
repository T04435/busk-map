import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  CALLS_PER_LEARN_RUN,
  callKinds,
  calls,
  dataPoints,
  edges,
  facts,
  featureCount,
  features,
  featuresTouchedBy,
  isNodeId,
  next,
  nodeKind,
  quotaNote,
  secondarySources,
  trace,
  traceSummary,
  type NodeId,
} from "@/lib/qloo-map";

const LASTFM_CLIENT = path.resolve(__dirname, "../../../src/server/adapters/songs/client.ts");
const ROOT = path.resolve(__dirname, "../../..");
const QLOO_DIR = path.join(ROOT, "src/server/adapters/qloo");
/** Where a `file.ts:function` reference in the map lives. */
const FILES: Record<string, string> = {
  "client.ts": path.join(QLOO_DIR, "client.ts"),
  "index.ts": path.join(QLOO_DIR, "index.ts"),
  "context.ts": path.join(ROOT, "src/server/agent/context.ts"),
  "learn/context.ts": path.join(ROOT, "src/server/learn/context.ts"),
  "learn/tools.ts": path.join(ROOT, "src/server/learn/tools.ts"),
  "own-artist.ts": path.join(ROOT, "src/server/playlist/own-artist.ts"),
  "research/run.ts": path.join(ROOT, "src/server/research/run.ts"),
  "songs/client.ts": LASTFM_CLIENT,
  "songs/index.ts": path.join(ROOT, "src/server/adapters/songs/index.ts"),
};

const parse = (file: string) => ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);

function visit(node: ts.Node, fn: (n: ts.Node) => void) {
  fn(node);
  node.forEachChild((child) => visit(child, fn));
}

const calleeName = (call: ts.CallExpression) => (ts.isIdentifier(call.expression) ? call.expression.text : undefined);
const stringArg = (call: ts.CallExpression, i: number) => {
  const arg = call.arguments[i];
  return arg && ts.isStringLiteralLike(arg) ? arg.text : undefined;
};

/** A string-literal property of an object literal, e.g. params["filter.type"]. */
function literalProp(object: ts.Node | undefined, key: string): string | undefined {
  if (!object || !ts.isObjectLiteralExpression(object)) return undefined;
  for (const prop of object.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = ts.isStringLiteral(prop.name) || ts.isIdentifier(prop.name) ? prop.name.text : undefined;
    if (name === key && ts.isStringLiteralLike(prop.initializer)) return prop.initializer.text;
  }
  return undefined;
}

type Request = { lookup: string; path: string; type: string | undefined };

/**
 * Every Qloo request in the adapter, read from its syntax tree (not regexes over text).
 *
 * Every request goes through `qlooGet(backend, "<path>", params, schema)`. A request site sits in a cached body that
 * runs `lookupScope("<name>", …)`, the counting wrapper from usage.ts; its exported twin calls `countLookup("<name>",
 * …)`. So for each top-level function that calls qlooGet, the lookupScope name is the client function the map's
 * codeRef must name, and `params` (the object literal bound in the same function) gives `filter.type` (or `types`).
 */
function qlooRequests(): Request[] {
  const out: Request[] = [];
  for (const name of readdirSync(QLOO_DIR).filter((f) => f.endsWith(".ts"))) {
    const source = parse(path.join(QLOO_DIR, name));
    for (const statement of source.statements) {
      if (!ts.isFunctionDeclaration(statement) || !statement.body) continue;
      if (statement.name?.text === "qlooGet") continue; // the wrapper itself
      let lookup: string | undefined;
      const params = new Map<string, ts.Expression>();
      const gets: ts.CallExpression[] = [];
      visit(statement.body, (n) => {
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) params.set(n.name.text, n.initializer);
        if (!ts.isCallExpression(n)) return;
        if (calleeName(n) === "lookupScope") lookup = stringArg(n, 0);
        if (calleeName(n) === "qlooGet") gets.push(n);
      });
      for (const get of gets) {
        const arg = get.arguments[2];
        const object = arg && ts.isIdentifier(arg) ? params.get(arg.text) : arg;
        expect(lookup, `${name}:${statement.name?.text} calls qlooGet outside a lookupScope (uncounted, uncached)`).toBeDefined();
        out.push({ lookup: lookup!, path: stringArg(get, 1)!, type: literalProp(object, "filter.type") ?? literalProp(object, "types") });
      }
    }
  }
  return out;
}

/** Names of `countLookup("<name>", …)` wrappers, keyed by the exported function that holds them. */
function countedWrappers(): Map<string, string> {
  const out = new Map<string, string>();
  const source = parse(FILES["client.ts"]);
  for (const statement of source.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.body || !statement.name) continue;
    const exported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    visit(statement.body, (n) => {
      if (ts.isCallExpression(n) && calleeName(n) === "countLookup" && exported) out.set(statement.name!.text, stringArg(n, 0)!);
    });
  }
  return out;
}

type LastfmRequest = { fn: string; method: string };

/**
 * Every Last.fm request in the songs adapter, read from its syntax tree. A request site is a top-level function that
 * calls `fetchJson` with a `new URLSearchParams({ method: "<api method>", … })` literal bound in the same function.
 */
function lastfmRequests(): LastfmRequest[] {
  const out: LastfmRequest[] = [];
  for (const statement of parse(LASTFM_CLIENT).statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.body || !statement.name) continue;
    let sends = false;
    const methods: string[] = [];
    visit(statement.body, (n) => {
      if (!ts.isCallExpression(n) && !ts.isNewExpression(n)) return;
      if (ts.isCallExpression(n) && calleeName(n) === "fetchJson") sends = true;
      if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "URLSearchParams") {
        const method = literalProp(n.arguments?.[0], "method");
        if (method) methods.push(method);
      }
    });
    if (!sends) continue;
    expect(methods, `${statement.name.text} calls fetchJson without a literal Last.fm method`).toHaveLength(1);
    expect(statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword), `${statement.name.text} is not exported`).toBe(true);
    out.push({ fn: statement.name.text, method: methods[0] });
  }
  return out;
}

/** Function, method and `const f = () =>` names declared in a file. */
function declaredNames(file: string): Set<string> {
  const names = new Set<string>();
  visit(parse(file), (n) => {
    if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.name && ts.isIdentifier(n.name)) names.add(n.name.text);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) {
      names.add(n.name.text);
    }
    // An agent tool: `name: tool({ … })` in the object a tools builder returns.
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && ts.isCallExpression(n.initializer) && calleeName(n.initializer) === "tool") names.add(n.name.text);
  });
  return names;
}

const fnOf = (ref: string) => ref.split(":")[1];

describe("qloo map: drift against the Qloo adapter", () => {
  const requests = qlooRequests();

  it("finds the adapter's requests (the parser still understands client.ts)", () => {
    expect(requests.length).toBeGreaterThanOrEqual(10);
  });

  it("names exactly the client functions that send a Qloo request", () => {
    const inCode = new Set(requests.map((r) => r.lookup));
    const inMap = new Set(calls.map((c) => fnOf(c.codeRef)));
    expect([...inMap].sort()).toEqual([...inCode].sort());
    // One function per kind of call: variants reuse their kind's function.
    expect(inMap.size).toBe(callKinds);
  });

  it("each counted lookup is the exported function of the same name", () => {
    for (const [fn, lookup] of countedWrappers()) expect(lookup, `${fn} counts itself under another name`).toBe(fn);
    for (const call of calls) expect(countedWrappers().has(fnOf(call.codeRef)), `${call.codeRef} is not an exported, counted function`).toBe(true);
  });

  it("each call's endpoint and type match what its function sends", () => {
    for (const call of calls) {
      const sent = requests.filter((r) => r.lookup === fnOf(call.codeRef));
      expect(sent.map((r) => r.path), call.id).toContain(call.endpoint);
      const types = sent.map((r) => r.type).filter(Boolean);
      if (types.length) expect(types, `${call.id} urnType`).toContain(call.urnType);
      else expect(call.urnType, `${call.id} sends no type`).toBeUndefined();
    }
  });

  it("qlooGet is used only inside the adapter's client", () => {
    const users: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && full !== FILES["client.ts"]) {
          visit(parse(full), (n) => {
            if (ts.isIdentifier(n) && n.text === "qlooGet") users.push(path.relative(ROOT, full));
          });
        }
      }
    };
    walk(path.join(ROOT, "src"));
    expect([...new Set(users)]).toEqual([]);
  });

  it("every `via` reference names a function that exists", () => {
    const names = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, declaredNames(f)]));
    for (const call of calls) {
      for (const ref of [call.codeRef, ...call.via]) {
        const [file, fn] = ref.split(":");
        expect(names[file], `${call.id}: unknown file in ${ref}`).toBeDefined();
        expect(names[file].has(fn), `${call.id}: ${ref} not found`).toBe(true);
      }
    }
  });
});

describe("qloo map: drift against the Last.fm adapter", () => {
  const requests = lastfmRequests();
  const lastfm = secondarySources.find((s) => s.id === "lastfm");
  const inMap = (lastfm?.lookups ?? []).map((l) => `${l.codeRef.split(":")[1]}:${l.method}`);

  it("finds the adapter's requests (the parser still understands songs/client.ts)", () => {
    expect(requests.length).toBeGreaterThanOrEqual(2);
  });

  it("names exactly the Last.fm requests the client sends, function and API method", () => {
    expect(inMap.sort()).toEqual(requests.map((r) => `${r.fn}:${r.method}`).sort());
  });

  it("Last.fm is reached only through songs/client.ts", () => {
    const users: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && full !== LASTFM_CLIENT) {
          visit(parse(full), (n) => {
            if (ts.isStringLiteralLike(n) && /ws\.audioscrobbler\.com/i.test(n.text)) users.push(path.relative(ROOT, full));
          });
        }
      }
    };
    walk(path.join(ROOT, "src"));
    expect([...new Set(users)]).toEqual([]);
  });

  it("every Last.fm `via` reference names a function that exists, and the source feeds the songs data points", () => {
    for (const l of lastfm?.lookups ?? []) {
      for (const ref of [l.codeRef, ...l.via]) {
        const [file, fn] = ref.split(":");
        expect(FILES[file], `unknown file in ${ref}`).toBeDefined();
        expect(declaredNames(FILES[file]).has(fn), `${ref} not found`).toBe(true);
      }
    }
    expect(lastfm?.dataPoints.map((d) => d.id).sort()).toEqual(["d_own_songs", "d_plays", "d_tracks"]);
  });
});

describe("qloo map: referential integrity", () => {
  const allIds: NodeId[] = [...calls, ...secondarySources, ...dataPoints, ...features].map((n) => n.id);

  it("ids are unique", () => {
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("has the documented shape: 18 kinds (25 with 5b, 5c, 7b, 11b, 12b, 12c and 9b), 27 data points, 10 features, Spotify, Ticketmaster and Last.fm", () => {
    expect(callKinds).toBe(18);
    expect(calls).toHaveLength(25);
    expect(calls.filter((c) => c.variantOf).map((c) => c.id)).toEqual(["c5b", "c5c", "c7b", "c11b", "c12b", "c12c", "c_fans"]);
    expect(dataPoints).toHaveLength(27);
    expect(featureCount).toBe(10);
    expect(secondarySources.map((s) => s.label)).toEqual(["Spotify", "Ticketmaster", "Last.fm"]);
  });

  it("every link target exists and points to the next column", () => {
    for (const e of edges) {
      expect(isNodeId(e.to), `${e.from} → ${e.to}`).toBe(true);
      const step = `${nodeKind(e.from)}→${nodeKind(e.to)}`;
      expect(["call→dataPoint", "source→dataPoint", "dataPoint→feature"]).toContain(step);
      expect(e.how.length).toBeGreaterThan(0);
    }
    for (const c of calls) if (c.variantOf) expect(calls.find((x) => x.id === c.variantOf)?.codeRef).toBe(c.codeRef);
  });

  it("no link is listed twice", () => {
    const keys = edges.map((e) => `${e.from}>${e.to}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("no orphans: every call and source produces, every data point is produced and feeds, every feature is fed", () => {
    for (const c of [...calls, ...secondarySources]) expect(c.dataPoints.length, c.id).toBeGreaterThan(0);
    for (const d of dataPoints) {
      expect(edges.some((e) => e.to === d.id), `${d.id} has no producer`).toBe(true);
      expect(d.features.length, `${d.id} feeds nothing`).toBeGreaterThan(0);
      expect(d.fields.length, `${d.id} fields`).toBeGreaterThan(0);
    }
    for (const f of features) expect(edges.some((e) => e.to === f.id), `${f.id} is fed by nothing`).toBe(true);
  });

  it("every feature has a place in the app, and combined or diff features say with what", () => {
    for (const f of features) {
      expect(f.location.length).toBeGreaterThan(0);
      if (f.how === "direct") expect(f.with).toBeUndefined();
      else expect(f.with?.length, f.id).toBeGreaterThan(0);
    }
  });

  it("every feature reaches at least one Qloo call", () => {
    for (const f of features) expect([...trace(f.id).nodes].some((n) => nodeKind(n) === "call"), f.id).toBe(true);
  });

  it("next lists only what isn't built", () => {
    expect(next).toHaveLength(3);
    for (const n of next) expect(n.built).toBe(false);
  });
});

describe("qloo map: facts and trace", () => {
  it("derives the counts and states the quota", () => {
    expect(facts.map((f) => f.value)).toEqual(["18", "28–37", "0", "10", "≤ 25"]);
    expect(CALLS_PER_LEARN_RUN).toBe("≤ 25");
    // Busk Map's own pacing and cache only: never a Qloo rate limit or plan quota.
    expect(quotaNote).toBe("Answers are cached for 24 hours, and Busk Map paces its own calls to 3 a second, so a rerun makes no new calls.");
    expect(quotaNote).not.toMatch(/10,000|a month|Qloo allows|5 a second/);
  });

  it("a call lights its data points and the features downstream, nothing upstream of those", () => {
    const { nodes } = trace("c3");
    expect([...nodes].sort()).toEqual(["c3", "d_cells", "f_agent", "f_map", "f_plain", "f_rank"].sort());
    expect(nodes.has("c4")).toBe(false);
  });

  it("a feature lights everything that feeds it", () => {
    const { nodes, edges: lit } = trace("f_fans");
    expect([...nodes].sort()).toEqual(["c11", "c5b", "d_contrast", "d_usual", "f_fans"].sort());
    expect(lit.size).toBe(4);
  });

  it("Songs to learn lights the learn calls, the crowd variant, Spotify's songs and the shared data points", () => {
    const { nodes } = trace("f_learn");
    for (const id of ["c12", "c5c", "c1", "c2", "c8", "c9", "spotify", "d_taste_artists", "d_tracks", "d_id", "d_trend", "d_demo"] as const) expect(nodes.has(id), id).toBe(true);
    expect(nodes.has("ticketmaster")).toBe(false);
    expect(calls.find((c) => c.id === "c5c")).toMatchObject({ variantOf: "c5", codeRef: "client.ts:localArtists", via: ["learn/tools.ts:crowd_at"] });
    expect(calls.find((c) => c.id === "c12")).toMatchObject({ num: "12", codeRef: "client.ts:tasteArtists", urnType: "urn:entity:artist" });
    expect(featuresTouchedBy("spotify")).toContain("f_learn");
  });

  it("the local scene lights its two compare inputs, its scene list, the re-score, and the crowd panel, set and agent it feeds", () => {
    const { nodes } = trace("d_scene");
    for (const id of ["c14", "c7b", "f_crowd", "f_setlist", "f_agent"] as const) expect(nodes.has(id), id).toBe(true);
    const over = trace("d_overindex").nodes;
    for (const id of ["c11b", "c13", "c5b", "f_crowd"] as const) expect(over.has(id), id).toBe(true);
    // The re-score and the compare are variants of calls that already exist (same client function), so they are not new kinds.
    expect(calls.find((c) => c.id === "c7b")).toMatchObject({ variantOf: "c7", codeRef: "client.ts:affinityFor" });
    expect(calls.find((c) => c.id === "c11b")).toMatchObject({ variantOf: "c11", codeRef: "client.ts:compareGenres", endpoint: "/v2/analysis/compare" });
    expect(calls.find((c) => c.id === "c13")).toMatchObject({ codeRef: "client.ts:globalArtists", urnType: "urn:entity:artist" });
    expect(calls.find((c) => c.id === "c14")).toMatchObject({ codeRef: "client.ts:sceneArtists", urnType: "urn:entity:artist" });
    expect(calls.find((c) => c.id === "c14")!.keyParams.join(" ")).toContain("signal.interests.tags");
  });

  it("Repertoire research lights its own calls, the shared ones it reuses, Spotify, Last.fm and every step's data point", () => {
    const { nodes } = trace("f_research");
    for (const id of ["c2", "c15", "c12b", "c_fans", "c12c", "c16", "spotify", "lastfm", "d_profile", "d_own_songs", "d_sound_alikes", "d_fans", "d_fans_love", "d_tracks", "d_act_genres"] as const) expect(nodes.has(id), id).toBe(true);
    expect(nodes.has("ticketmaster")).toBe(false);
    expect(calls.find((c) => c.id === "c15")).toMatchObject({ endpoint: "/entities", codeRef: "client.ts:entityDetail" });
    expect(calls.find((c) => c.id === "c16")).toMatchObject({ urnType: "urn:tag", codeRef: "client.ts:artistGenres" });
    for (const id of ["c12b", "c12c"]) expect(calls.find((c) => c.id === id)).toMatchObject({ variantOf: "c12", codeRef: "client.ts:tasteArtists" });
    // Your genres feed the busk's local scene (the crowd panel).
    expect(trace("d_act_genres").nodes.has("f_crowd")).toBe(true);
  });

  it("a data point lights both ways", () => {
    const { nodes } = trace("d_headliner");
    expect(nodes.has("c7")).toBe(true);
    expect(nodes.has("ticketmaster")).toBe(true);
    expect(nodes.has("f_events")).toBe(true);
    expect(nodes.has("d_events")).toBe(false);
  });

  it("secondary sources touch the features their data points feed", () => {
    expect(featuresTouchedBy("ticketmaster").sort()).toEqual(["f_agent", "f_events", "f_plain", "f_rank"]);
    expect(featuresTouchedBy("spotify")).toContain("f_setlist");
    expect(featuresTouchedBy("lastfm").sort()).toEqual(["f_agent", "f_learn", "f_research", "f_setlist"]);
  });

  it("Last.fm backs up the song lookups: plays for the Suggested set, top tracks for Songs to learn", () => {
    const { nodes } = trace("lastfm");
    for (const id of ["d_plays", "d_tracks", "f_setlist", "f_learn", "f_agent"] as const) expect(nodes.has(id), id).toBe(true);
    expect(nodes.has("ticketmaster")).toBe(false);
    expect(nodes.has("d_cells")).toBe(false);
    expect(trace("d_tracks").nodes.has("spotify")).toBe(true);
    expect(trace("f_learn").nodes.has("lastfm")).toBe(true);
  });

  it("uses the Repertoire words for the renamed features", () => {
    expect(features.find((f) => f.id === "f_setlist")).toMatchObject({ label: "Set and songs to learn", location: "Pitch card: the suggested set, and Songs you should learn" });
    expect(features.find((f) => f.id === "f_learn")).toMatchObject({ label: "Songs you should learn", location: "Repertoire page: To learn" });
    for (const text of [...features.flatMap((f) => [f.label, f.sub, f.location]), ...edges.map((e) => e.how)]) expect(text).not.toMatch(/\bsetlist|learn these|playlist/i);
  });

  it("summarises a trace in one sentence", () => {
    expect(traceSummary("c3")).toBe("Taste heatmap feeds 1 data point and 4 parts of your busk.");
    expect(traceSummary("f_events")).toBe("Event weighting comes from 1 Qloo call, 1 other source and 2 data points.");
    expect(traceSummary("d_headliner")).toBe("Headliner taste match comes from 1 Qloo call and 1 other source, and feeds 4 parts of your busk.");
  });
});
