import type { Metadata } from "next";
import { TipLogView } from "@/components/tips/tip-log-view";

export const metadata: Metadata = {
  title: "Tip log · Busk Map",
  description: "Log what you earned per pitch and session, kept in this browser, and see how it adjusts your plans.",
};

export default function TipsPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:py-12">
      <TipLogView />
    </main>
  );
}
