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

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <header className="flex items-baseline justify-between border-b border-cream py-5">
        <span className="font-display text-2xl font-semibold text-forest">VendorLens</span>
        <span className="text-sm text-emerald">Weddings · Birthdays · Community events</span>
      </header>

      <main id="content" className="py-14">
        <h1 className="max-w-3xl font-display text-5xl leading-[1.05] font-semibold text-forest sm:text-7xl">
          The cheapest quote isn&apos;t always the cheapest event.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed">
          Plan your budget, timeline and vendor checklist, then compare offers on what they actually include.
        </p>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-cream bg-cream sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.verb} className="bg-ivory p-6">
              <p className="figures text-sm font-medium text-emerald">Step {index + 1}</p>
              <h2 className="mt-1 font-display text-3xl font-semibold text-forest">{step.verb}</h2>
              <p className="mt-3 leading-relaxed">{step.detail}</p>
            </li>
          ))}
        </ol>

        <p className="mt-10 border-l-4 border-saffron bg-sage px-4 py-3 text-sm text-forest">
          Everything you enter stays in this browser. VendorLens doesn&apos;t verify vendors, make bookings or take
          payments.
        </p>
      </main>
    </div>
  );
}
