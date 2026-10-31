import type { Metadata } from "next";
import Link from "next/link";
import { Wizard } from "@/features/wizard/Wizard";

export const metadata: Metadata = { title: "Plan an event" };

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/" className="text-sm text-emerald underline underline-offset-4">
        VendorLens home
      </Link>
      <main id="content" className="mt-6 flex flex-col gap-6">
        <h1 className="font-display text-5xl font-semibold text-forest">Plan your event</h1>
        <p className="max-w-2xl">
          Three short steps. Gemini drafts the plan; every amount and date is then calculated by tested code, and you
          can change anything afterwards.
        </p>
        <Wizard />
      </main>
    </div>
  );
}
