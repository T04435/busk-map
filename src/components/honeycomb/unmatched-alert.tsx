import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/**
 * Qloo could not match some (or all) of the act's artists: ONE alert (B-045). When none matched it says taste is left out and
 * the page header carries the way out, "Pick your artists from Spotify" (plan again from the form). Keeps `unmatched-artists`.
 */
export function UnmatchedAlert({ unmatched, matched }: { unmatched: string[]; matched: string[] }) {
  const none = matched.length === 0;
  return (
    <Alert variant="estimate" data-testid="unmatched-artists">
      <AlertTitle>{none ? "Qloo couldn't match any of your artists" : `Qloo couldn't match ${list(unmatched)}`}</AlertTitle>
      <AlertDescription>
        {none
          ? "The pitches use events and weather only."
          : `This plan uses the artists Qloo did match: ${list(matched)}.`}
      </AlertDescription>
    </Alert>
  );
}
