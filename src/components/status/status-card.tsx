import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The plain card behind every not-found and error page (site-wide 404, /p/<id> not found,
 * error.tsx, global-error.tsx), so they match. No hooks: usable from server and client components.
 */
export function StatusCard({
  title,
  description,
  actions,
  footnote,
  testId,
}: {
  title: string;
  description: string;
  actions: ReactNode;
  /** A small line under the description, e.g. an error reference code. */
  footnote?: ReactNode;
  testId: string;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Card className="max-w-xl" data-testid={testId}>
        <CardHeader>
          <CardTitle>
            <h1>{title}</h1>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{footnote ? <p className="text-xs text-muted-foreground">{footnote}</p> : null}</CardContent>
        <CardFooter className="flex flex-wrap gap-2">{actions}</CardFooter>
      </Card>
    </main>
  );
}
