import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/** An unknown or malformed short plan id. */
export default function PlanNotFound() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
    <Card className="max-w-xl" data-testid="plan-not-found">
      <CardHeader>
        <CardTitle>
          <h1>Plan not found</h1>
        </CardTitle>
        <CardDescription>This link doesn&apos;t match a saved plan. Check that the whole link was copied, or start a new plan.</CardDescription>
      </CardHeader>
      <CardContent />
      <CardFooter>
        <Button asChild>
          <Link href="/">Go to Busk Map home</Link>
        </Button>
      </CardFooter>
    </Card>
    </main>
  );
}
