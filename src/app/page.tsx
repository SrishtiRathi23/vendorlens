import type { CSSProperties } from "react";
import Link from "next/link";
import { compareQuotes } from "@/domain/compare";
import { sequentialIds } from "@/domain/ids";
import { normalizeQuote } from "@/domain/quote-normalize";
import { buildSampleEvent } from "@/domain/samples";
import { CompareTable } from "@/features/compare/CompareTable";
import { SampleLauncher } from "@/features/samples/SampleLauncher";

const HEADLINE = "The cheapest quote isn't always the cheapest event.";

/** Per-element CSS custom properties (stagger index or delay) for the entrance animations. */
const cssVars = (vars: Record<string, string | number>) => vars as CSSProperties;

const steps = [
  {
    verb: "Read",
    detail:
      "Paste a vendor's quote. Gemini pulls out prices, inclusions, tax and payment terms, and shows the exact line each one came from.",
  },
  {
    verb: "Verify",
    detail:
      "You confirm or correct every figure. A fee the quote never mentions stays unknown. It is never counted as ₹0.",
  },
  {
    verb: "Decide",
    detail:
      "Quotes are compared on their known all-in cost and what they cover. No “cheapest” badge appears while a required cost is missing.",
  },
];

/** The landing comparison uses the real engine on the fictional sample quotes (built at render, no AI). */
function sampleComparison() {
  const reference = "2026-01-01";
  const event = buildSampleEvent("wedding", reference, sequentialIds("landing"));
  const context = {
    guestCount: event.guestCount,
    eventDate: event.date,
    today: reference,
    requirements: event.requirements,
  };
  return compareQuotes(event.quotes.map((quote) => normalizeQuote(quote, context)));
}

export default function LandingPage() {
  const comparison = sampleComparison();
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-cream py-5">
        <span className="font-display text-2xl font-semibold text-forest">VendorLens</span>
        <nav aria-label="Site" className="flex gap-4 text-sm">
          <Link className="link-sweep text-emerald" href="/workspace">
            My plan
          </Link>
          <Link className="link-sweep text-emerald" href="/privacy">
            Privacy & AI use
          </Link>
        </nav>
      </header>

      <main id="content" className="flex flex-col gap-12 py-12">
        <section className="relative isolate flex flex-col gap-6">
          <div aria-hidden="true" className="hero-aura">
            <div />
          </div>
          <p className="hero-rise text-sm font-medium text-emerald" style={cssVars({ "--delay": "0s" })}>
            Weddings · Birthdays · Community events
          </p>
          <h1 className="max-w-3xl font-display text-5xl leading-[1.05] font-semibold text-forest sm:text-7xl">
            {HEADLINE.split(" ").map((word, i) => (
              <span key={word + String(i)}>
                <span className="hero-word">
                  <span style={cssVars({ "--i": i })}>{word}</span>
                </span>{" "}
              </span>
            ))}
          </h1>
          <p className="hero-rise max-w-2xl text-lg leading-relaxed" style={cssVars({ "--delay": "0.55s" })}>
            Describe your celebration and get a budget, timeline, vendor checklist and ideas in seconds. Then compare
            vendor offers on what they actually include.
          </p>
          <div className="hero-rise flex flex-wrap gap-3" style={cssVars({ "--delay": "0.7s" })}>
            <Link
              href="/new"
              data-magnetic=""
              className="group inline-flex min-h-11 items-center gap-2 rounded-md bg-forest px-5 font-medium text-ivory shadow-sm hover:bg-emerald hover:shadow-md"
            >
              Plan my event
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
          <div className="hero-rise" style={cssVars({ "--delay": "0.85s" })}>
            <SampleLauncher />
          </div>
        </section>

        <ol className="grid gap-px overflow-hidden rounded-lg border border-cream bg-cream sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.verb}
              data-reveal=""
              style={cssVars({ "--reveal-i": index })}
              className="spotlight bg-ivory p-6"
            >
              <p className="figures text-sm font-medium text-emerald">Step {index + 1}</p>
              <h2 className="mt-1 font-display text-3xl font-semibold text-forest">{step.verb}</h2>
              <p className="mt-3 leading-relaxed">{step.detail}</p>
            </li>
          ))}
        </ol>

        <section aria-labelledby="live-sample" data-reveal="" className="flex flex-col gap-4">
          <h2 id="live-sample" className="font-display text-4xl font-semibold text-forest">
            Two catering quotes, compared honestly
          </h2>
          <p className="max-w-2xl">
            Shubh Rasoi looks cheaper at ₹850 a plate, but its tax, staff and transport are unknown. VendorLens shows
            its known subtotal and refuses to call a winner until those are answered. (Fictional sample for 150 guests.)
          </p>
          <p className="rounded-md border-l-4 border-saffron bg-sage px-4 py-3 font-medium text-forest">
            {comparison.verdict}
          </p>
          <CompareTable comparison={comparison} caption="Sample comparison of two fictional catering quotes" />
        </section>

        <p data-reveal="" className="border-l-4 border-saffron bg-sage px-4 py-3 text-sm text-forest">
          Everything you enter stays in this browser. VendorLens doesn&apos;t verify vendors, make bookings or take
          payments.
        </p>
      </main>
    </div>
  );
}
