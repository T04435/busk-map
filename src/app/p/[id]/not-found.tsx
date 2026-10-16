import Link from "next/link";
import { StatusCard } from "@/components/status/status-card";
import { Button } from "@/components/ui/button";

/** An unknown or malformed short plan id. */
export default function PlanNotFound() {
  return (
    <StatusCard
      testId="plan-not-found"
      title="We can't find this busk"
      description="The link may be cut short or mistyped. Check you copied all of it, or start a new busk."
      actions={
        <Button asChild>
          <Link href="/">Go to Busk Map home</Link>
        </Button>
      }
    />
  );
}
