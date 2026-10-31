"use client";

import { type SyntheticEvent, useState } from "react";
import { ADJUST_SCOPES, type AdjustScope } from "@/domain/contracts";
import { formatINR } from "@/domain/money";
import { useAdjust } from "@/features/adjust/adjust-context";
import { Badge, Button, Field, inputClass } from "@/ui/controls";
import { Dialog } from "@/ui/Dialog";

const EXAMPLES = [
  "We now expect 20% more guests",
  "Add a mehendi function with henna artists",
  "Make the menu fully Jain",
  "Move everything one week later",
];

const SCOPE_LABEL: Record<AdjustScope, string> = {
  plan: "Whole plan",
  budget: "Budget",
  vendors: "Vendors",
  timeline: "Timeline",
  ideas: "Ideas",
};

/** One instruction box (not a chat): describe a change, review the preview, then apply or discard. */
export function AdjustBar() {
  const { busy, error, preview, request, apply, discard } = useAdjust();
  const [instruction, setInstruction] = useState("");
  const [scope, setScope] = useState<AdjustScope>("plan");

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (instruction.trim().length >= 3) void request(instruction.trim(), scope);
  };

  return (
    <section aria-labelledby="adjust-heading" className="rounded-lg border border-cream bg-sage/60 p-4 print:hidden">
      <h2 id="adjust-heading" className="font-display text-2xl font-semibold text-forest">
        Adjust with AI
      </h2>
      <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <Field label="What should change?" hint="Chosen vendors and locked amounts are never changed.">
          {(p) => (
            <input
              {...p}
              className={inputClass}
              value={instruction}
              maxLength={500}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={EXAMPLES[0]}
            />
          )}
        </Field>
        <Field label="Scope">
          {(p) => (
            <select
              {...p}
              className={inputClass}
              value={scope}
              onChange={(e) => setScope(e.target.value as AdjustScope)}
            >
              {ADJUST_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABEL[s]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Button type="submit" disabled={busy || instruction.trim().length < 3}>
          {busy ? "Working…" : "Preview change"}
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <Button
            key={example}
            variant="quiet"
            className="min-h-9 px-1 text-xs"
            onClick={() => setInstruction(example)}
          >
            {example}
          </Button>
        ))}
      </div>
      <p role="status" className="mt-2 text-sm">
        {busy ? (
          "Asking Gemini what would change…"
        ) : error ? (
          <span className="font-medium text-brick">{error}</span>
        ) : (
          ""
        )}
      </p>

      <Dialog open={preview !== null} title="Review the change" onClose={discard}>
        {preview && (
          <>
            <p>
              <span className="font-medium">Understood as: </span>
              {preview.interpretation}
            </p>
            {preview.changes.length === 0 ? (
              <p>Nothing in the plan would change.</p>
            ) : (
              <ul className="flex flex-col gap-1" aria-label="Changes">
                {preview.changes.map((change, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-2">
                    <Badge tone={change.kind === "removed" ? "bad" : change.kind === "added" ? "good" : "neutral"}>
                      {change.kind}
                    </Badge>
                    <span className="text-xs text-charcoal/70">{change.area}</span>
                    <span>{change.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="figures">
              Remaining budget: {formatINR(Math.max(0, preview.remainingBefore))}
              {preview.remainingBefore < 0 ? ` (over by ${formatINR(-preview.remainingBefore)})` : ""} →{" "}
              {formatINR(Math.max(0, preview.remainingAfter))}
              {preview.remainingAfter < 0 ? ` (over by ${formatINR(-preview.remainingAfter)})` : ""}
            </p>
            {preview.notDone.length > 0 && (
              <div>
                <h3 className="font-medium text-forest">Not changed</h3>
                <ul className="list-disc pl-5 text-sm">
                  {preview.notDone.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button onClick={apply} disabled={preview.changes.length === 0}>
                Apply changes
              </Button>
              <Button variant="secondary" onClick={discard}>
                Discard
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </section>
  );
}
