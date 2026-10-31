"use client";

import { useState } from "react";
import { CATEGORY_LABEL, type CategoryKey } from "@/domain/categories";
import { emptyQuote } from "@/domain/extraction";
import { randomId } from "@/domain/ids";
import { SAMPLE_QUOTE_TEXTS } from "@/domain/samples";
import type { Quote } from "@/domain/schemas";
import { QuoteReview } from "@/features/vendors/QuoteReview";
import { usePlanStore } from "@/features/store/plan-store";
import { ai } from "@/lib/api";
import { Button, Field, inputClass } from "@/ui/controls";

/**
 * Add a quote by pasting it (Gemini extracts, you review) or by typing it in. Pasted text leaves the
 * browser only when "Extract details with AI" is pressed; manual entry never contacts any server.
 */
export function QuoteIntake({ category, onDone }: { category: CategoryKey; onDone: () => void }) {
  const { plan, update } = usePlanStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<Quote | null>(null);

  if (!plan) return null;

  const extract = async () => {
    setBusy(true);
    setError("");
    const result = await ai.extract({ quoteText: text, category, guestCount: plan.guestCount });
    setBusy(false);
    if (result.ok) setReview({ ...result.data.quote, sourceText: text });
    else setError(result.error.message);
  };

  const save = (quote: Quote) => {
    update((p) => ({
      ...p,
      quotes: [...p.quotes.filter((q) => q.id !== quote.id), quote],
      requirements: p.requirements.map((r) =>
        r.category === category && !r.decided && r.status !== "confirmed" ? { ...r, status: "quoted" } : r,
      ),
    }));
    onDone();
  };

  if (review) return <QuoteReview initial={review} onConfirm={save} onCancel={onDone} />;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-cream bg-white/60 p-4">
      <h3 className="font-medium text-forest">Add a {CATEGORY_LABEL[category].toLowerCase()} quote</h3>
      <Field
        label="Paste the vendor's quote"
        hint="Up to 10,000 characters. When you press Extract, this text (with phone numbers and emails removed) is sent to Google Gemini. Use quotes you're happy to share."
      >
        {(p) => (
          <textarea
            {...p}
            rows={8}
            maxLength={10_000}
            className={inputClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
      </Field>
      {category === "catering" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Try a fictional sample:</span>
          <Button variant="quiet" onClick={() => setText(SAMPLE_QUOTE_TEXTS.offerA)}>
            Quote A
          </Button>
          <Button variant="quiet" onClick={() => setText(SAMPLE_QUOTE_TEXTS.offerB)}>
            Quote B
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void extract()} disabled={busy || text.trim().length < 20}>
          {busy ? "Reading the quote…" : "Extract details with AI"}
        </Button>
        <Button variant="secondary" onClick={() => setReview(emptyQuote(category, text, randomId))} disabled={busy}>
          Enter it manually
        </Button>
        <Button variant="quiet" onClick={onDone}>
          Cancel
        </Button>
      </div>
      <p role="status" className="text-sm">
        {busy ? (
          "Gemini is reading the quote. Every value will be checked against your text."
        ) : error ? (
          <span className="font-medium text-brick">{error} You can enter the quote manually instead.</span>
        ) : (
          ""
        )}
      </p>
    </div>
  );
}
