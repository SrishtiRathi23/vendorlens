import { type Comparison } from "@/domain/compare";
import type { NormalizedQuote, QuoteStatus } from "@/domain/quote-normalize";
import { Badge } from "@/ui/controls";
import { Money } from "@/ui/Money";

const STATUS: Record<QuoteStatus, { tone: "good" | "warn" | "bad"; label: string }> = {
  comparable: { tone: "good", label: "Comparable" },
  incomplete: { tone: "warn", label: "Incomplete" },
  mismatch: { tone: "bad", label: "Mismatch" },
};

function StatusBadge({ quote }: { quote: NormalizedQuote }) {
  const { tone, label } = STATUS[quote.status];
  const blocking = quote.unknowns.filter((u) => u.blocking).length + quote.missingTags.length;
  return <Badge tone={tone}>{quote.status === "incomplete" ? `${label}: ${String(blocking)} unknown` : label}</Badge>;
}

const ROWS: { label: string; render: (q: NormalizedQuote) => React.ReactNode }[] = [
  { label: "Status", render: (q) => <StatusBadge quote={q} /> },
  {
    label: "Known total",
    render: (q) => (
      <span className="flex flex-col">
        <Money paise={q.knownTotalPaise} className="text-lg font-semibold" />
        {q.status !== "comparable" && <span className="text-xs">known subtotal only</span>}
      </span>
    ),
  },
  { label: "Per guest", render: (q) => <Money paise={q.perGuestPaise} /> },
  { label: "Base price", render: (q) => <Money paise={q.basePaise} /> },
  { label: "Known extras", render: (q) => <Money paise={q.knownExtrasPaise} /> },
  { label: "Tax", render: (q) => <Money paise={q.knownTaxPaise} /> },
  {
    label: "Unknown costs",
    render: (q) =>
      q.unknowns.length === 0 ? (
        "None"
      ) : (
        <ul className="list-disc pl-4">
          {q.unknowns.map((u) => (
            <li key={u.field}>
              {u.label}
              {u.blocking ? " (required)" : ""}
            </li>
          ))}
        </ul>
      ),
  },
  {
    label: "Required items not covered",
    render: (q) => (q.missingTags.length === 0 ? "None" : q.missingTags.join(", ")),
  },
  { label: "Mismatches", render: (q) => (q.mismatches.length === 0 ? "None" : q.mismatches.join(" ")) },
];

/**
 * Side-by-side comparison. A scrollable, keyboard-focusable region on narrow screens, so the page
 * itself never scrolls sideways. Status is always written out, never shown by colour alone.
 */
export function CompareTable({ comparison, caption }: { comparison: Comparison; caption: string }) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto rounded-lg border border-cream">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-sage">
            <th scope="col" className="w-44 p-3 text-left font-medium">
              Term
            </th>
            {comparison.quotes.map((q) => (
              <th key={q.quoteId} scope="col" className="p-3 text-left font-display text-lg font-semibold text-forest">
                {q.vendorAlias}
                {comparison.lowestKnownTotalId === q.quoteId && (
                  <span className="mt-1 block">
                    <Badge tone="info">Lowest known total</Badge>
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label} className="border-t border-cream align-top">
              <th scope="row" className="p-3 text-left font-medium text-forest">
                {row.label}
              </th>
              {comparison.quotes.map((q) => (
                <td key={q.quoteId} className="p-3">
                  {row.render(q)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
