import type { Metadata } from "next";
import { PageHeader } from "@/components/honeycomb/page-header";

export const metadata: Metadata = {
  title: "Privacy · Busk Map",
  description: "What Busk Map stores, and what it does not.",
};

const ITEMS = [
  {
    title: "A device cookie",
    body: "One small cookie (buskmap_tips) keeps the tip summary your plans use for the personal bonus. It is set by you logging a session, it stays on your device, and it holds no name or contact details.",
  },
  {
    title: "Tips, in this browser only",
    body: "The tip log is saved in your browser's own storage. It is never sent to a server as an account and never appears in a link.",
  },
  {
    title: "No accounts, no tracking",
    body: "There is nothing to sign up for. Busk Map has no advertising, no analytics profile and no tracking cookies.",
  },
  {
    title: "What a plan sends out",
    body: "To make a plan, the act name, artists and the time you pick go to the data sources listed on the Terms page. Each plan is stored under its short link (the request, never your tips) so the link opens again.",
  },
];

export default function PrivacyPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 md:py-12">
      <PageHeader meta="Privacy" title="What Busk Map keeps" />
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {ITEMS.map((item) => (
          <li key={item.title} className="flex flex-col gap-1 border-2 border-rule bg-card p-4">
            <h2 className="m-0 font-display text-[24px] leading-none font-extrabold uppercase">{item.title}</h2>
            <p className="m-0 text-base leading-6">{item.body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
