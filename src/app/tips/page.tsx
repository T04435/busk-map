import type { Metadata } from "next";
import Link from "next/link";
import { TipLogView } from "@/components/tips/tip-log-view";

export const metadata: Metadata = {
  title: "Tip log · Busk Map",
  description: "What you earned per pitch and session, kept in this browser, and how it adjusts your plans.",
};

export default function TipsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <nav className="mb-6 text-sm">
        <Link className="underline" href="/">
          Busk Map home
        </Link>
      </nav>
      <TipLogView />
    </main>
  );
}
