import type { Provenance } from "@/domain/schemas";
import { Badge } from "@/ui/controls";

const PROVENANCE: Record<Provenance, { tone: "good" | "warn" | "neutral" | "info"; label: string }> = {
  matched: { tone: "good", label: "Found in quote" },
  not_found: { tone: "warn", label: "Not found in quote: check it" },
  ai_unverified: { tone: "neutral", label: "AI suggestion, unverified" },
  user_confirmed: { tone: "info", label: "You entered this" },
};

/** Where one extracted value came from, plus the exact words the AI quoted as evidence. */
export function ProvenanceNote({ state, excerpt }: { state: Provenance | undefined; excerpt: string | undefined }) {
  if (!state) return null;
  const { tone, label } = PROVENANCE[state];
  return (
    <span className="flex flex-col gap-1 text-xs">
      <Badge tone={tone}>{label}</Badge>
      {excerpt && state !== "user_confirmed" && <span className="italic">From the quote: “{excerpt}”</span>}
    </span>
  );
}
