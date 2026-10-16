import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
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

const ROOT = path.resolve(__dirname, "../../..");
const QLOO_DIR = path.join(ROOT, "src/server/adapters/qloo");
/** Where a `file.ts:function` reference in the map lives. */
const FILES: Record<string, string> = {
  "client.ts": path.join(QLOO_DIR, "client.ts"),
  "index.ts": path.join(QLOO_DIR, "index.ts"),
  "context.ts": path.join(ROOT, "src/server/agent/context.ts"),
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

/** Function, method and `const f = () =>` names declared in a file. */
function declaredNames(file: string): Set<string> {
  const names = new Set<string>();
  visit(parse(file), (n) => {
    if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.name && ts.isIdentifier(n.name)) names.add(n.name.text);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) {
      names.add(n.name.text);
    }
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

describe("qloo map: referential integrity", () => {
  const allIds: NodeId[] = [...calls, ...secondarySources, ...dataPoints, ...features].map((n) => n.id);

  it("ids are unique", () => {
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("has the documented shape: 11 kinds (12 with 5b), 15 data points, 9 features, Spotify and Ticketmaster only", () => {
    expect(callKinds).toBe(11);
    expect(calls).toHaveLength(12);
    expect(calls.filter((c) => c.variantOf).map((c) => c.id)).toEqual(["c5b"]);
    expect(dataPoints).toHaveLength(15);
    expect(featureCount).toBe(9);
    expect(secondarySources.map((s) => s.label)).toEqual(["Spotify", "Ticketmaster"]);
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
    expect(facts.map((f) => f.value)).toEqual(["11", "24–33", "0", "9"]);
    expect(quotaNote).toContain("10,000 requests a month per key, at 5 a second");
    expect(quotaNote).toContain("24 h");
  });

  it("a call lights its data points and the features downstream, nothing upstream of those", () => {
    const { nodes } = trace("c3");
    expect([...nodes].sort()).toEqual(["c3", "d_cells", "f_agent", "f_map", "f_plain", "f_rank", "f_week"].sort());
    expect(nodes.has("c4")).toBe(false);
  });

  it("a feature lights everything that feeds it", () => {
    const { nodes, edges: lit } = trace("f_fans");
    expect([...nodes].sort()).toEqual(["c11", "c5b", "d_contrast", "d_usual", "f_fans"].sort());
    expect(lit.size).toBe(4);
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
  });

  it("summarises a trace in one sentence", () => {
    expect(traceSummary("c3")).toBe("Taste heatmap feeds 1 data point and 5 parts of your busk.");
    expect(traceSummary("f_events")).toBe("Event weighting comes from 1 Qloo call, 1 other source and 2 data points.");
    expect(traceSummary("d_headliner")).toBe("Headliner taste match comes from 1 Qloo call and 1 other source, and feeds 4 parts of your busk.");
  });
});
