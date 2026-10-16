import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** Qloo could not match some (or all) of the act's artists. Keeps `unmatched-artists`. */
export function UnmatchedAlert({ unmatched, matched, mock }: { unmatched: string[]; matched: string[]; mock: boolean }) {
  return (
    <Alert variant="estimate" data-testid="unmatched-artists">
      <AlertTitle>Qloo couldn&apos;t match {list(unmatched)}</AlertTitle>
      <AlertDescription>
        {matched.length > 0
          ? `This plan uses the artists Qloo did match: ${list(matched)}.`
          : "Without a matched artist Busk Map can't map where your crowd's taste is, so taste is left out: the pitches below are ranked on foot traffic, events and weather only. Try better-known artists you sound like."}
        {mock ? " (Qloo test data: the local mock knows about 130 artists.)" : ""}
      </AlertDescription>
    </Alert>
  );
}
