import Link from "next/link";
import { StatusCard } from "@/components/status/status-card";
import { Button } from "@/components/ui/button";

/** An unknown or malformed short plan id. */
export default function PlanNotFound() {
  return (
    <StatusCard
      testId="plan-not-found"
      title="Plan not found"
      description="This link doesn't match a saved plan. Check that the whole link was copied, or start a new plan."
      actions={
        <Button asChild>
          <Link href="/">Go to Busk Map home</Link>
        </Button>
      }
    />
  );
}
