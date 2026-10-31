import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy and AI use" };

const sections = [
  {
    heading: "What stays in your browser",
    body: "Your event, budget, vendor needs, contacts, notes, pasted quotes and decisions are stored only in this browser (IndexedDB). VendorLens has no accounts and no database; the server keeps nothing. Use Export backup to move a plan, and Delete from this browser to remove it.",
  },
  {
    heading: "What is sent to Google Gemini, and when",
    body: "Only when you press a button: Generate my plan sends your event details and description; Adjust with AI sends your request with a summary of the plan (no contacts, notes or quote text); Extract details with AI sends the quote you pasted. Email addresses, phone numbers and links are removed before anything is sent. Gemini runs on Google Cloud Vertex AI.",
  },
  {
    heading: "What the AI does and doesn't do",
    body: "Gemini suggests structure (budget shares, tasks, vendor needs, ideas) and reads quotes into fields, quoting the words it used. Tested code does every calculation, checks that every quoted excerpt is really in your text, and never counts an unknown cost as ₹0. You confirm quotes and approve every change before it is applied.",
  },
  {
    heading: "What VendorLens never does",
    body: "It doesn't verify vendors, check availability, make bookings, take payments or recommend named businesses. Amounts labelled as estimates are planning figures, not quotes. Samples use fictional vendors.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/" className="text-sm text-emerald underline underline-offset-4">
        VendorLens home
      </Link>
      <main id="content" className="mt-6 flex flex-col gap-8">
        <h1 className="font-display text-5xl font-semibold text-forest">Privacy and AI use</h1>
        {sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-2">
            <h2 className="font-display text-3xl font-semibold text-forest">{section.heading}</h2>
            <p className="leading-relaxed">{section.body}</p>
          </section>
        ))}
      </main>
    </div>
  );
}
