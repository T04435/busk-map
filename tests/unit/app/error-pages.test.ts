import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GlobalError from "@/app/global-error";
import RouteError from "@/app/error";

// error.tsx is covered end to end (tests/e2e/error-pages.spec.ts, faults=render). A root-layout
// error can't be forced from a request without a test route, so global-error.tsx is rendered here.
function boom() {
  const error = new Error("SECRET_DETAIL from a provider") as Error & { digest?: string };
  error.digest = "1234567890";
  error.stack = "Error: SECRET_DETAIL\n    at secretFunction (src/server/secret.ts:1:1)";
  return error;
}

const noop = () => {};

describe("global-error.tsx", () => {
  const html = renderToStaticMarkup(createElement(GlobalError, { error: boom(), retry: noop }));

  it("renders its own document with the error copy and both actions", () => {
    expect(html.startsWith("<html")).toBe(true);
    expect(html).toContain("<body");
    expect(html).toContain("<h1>Something went wrong</h1>");
    expect(html).toContain("Something went wrong loading Busk Map");
    expect(html).toContain(">Try again</button>");
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*>Go home<\/a>/);
  });

  it("is self-contained: system fonts for every family token and a plain link home (no router, no brand faces)", () => {
    expect(html).toMatch(/<html[^>]*--font-display:system-ui/);
    expect(html).toMatch(/<html[^>]*--font-mono:ui-monospace/);
    expect(html).not.toContain("font-display-src");
    expect(html).not.toContain("/_next/static/media");
  });

  it("shows the digest as a reference, never the message or stack", () => {
    expect(html).toContain("Reference: <code>1234567890</code>");
    expect(html).not.toContain("SECRET_DETAIL");
    expect(html).not.toContain("secretFunction");
  });
});

describe("error.tsx", () => {
  it("has the same copy and actions as global-error.tsx, without a document", () => {
    const html = renderToStaticMarkup(createElement(RouteError, { error: boom(), retry: noop }));
    expect(html).not.toContain("<html");
    expect(html).toContain("<h1>Something went wrong</h1>");
    expect(html).toContain(">Try again</button>");
    expect(html).toContain("Go home</a>");
    expect(html).not.toContain("SECRET_DETAIL");
  });

  it("leaves out the reference when there is no digest", () => {
    const html = renderToStaticMarkup(createElement(RouteError, { error: new Error("x"), retry: noop }));
    expect(html).not.toContain("Reference:");
  });
});
