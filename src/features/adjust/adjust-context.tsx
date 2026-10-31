"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { adjustContext, applyAdjustment } from "@/domain/adjust";
import { summarizeBudget } from "@/domain/budget";
import type { AdjustScope } from "@/domain/contracts";
import { type Change, diffEvents } from "@/domain/diff";
import { randomId } from "@/domain/ids";
import type { EventPlan } from "@/domain/schemas";
import { usePlanStore } from "@/features/store/plan-store";
import { ai } from "@/lib/api";

export interface AdjustPreview {
  interpretation: string;
  after: EventPlan;
  changes: Change[];
  notDone: string[];
  remainingBefore: number;
  remainingAfter: number;
}

interface AdjustState {
  busy: boolean;
  error: string | null;
  preview: AdjustPreview | null;
  /** Sends one change request to Gemini and prepares a preview; nothing is applied yet. */
  request: (instruction: string, scope: AdjustScope) => Promise<void>;
  apply: () => void;
  discard: () => void;
}

const AdjustContext = createContext<AdjustState | null>(null);

/** Owns the adjust → preview → apply flow so any screen (e.g. "More ideas like these") can start it. */
export function AdjustProvider({ children }: { children: ReactNode }) {
  const { plan, today, update } = usePlanStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdjustPreview | null>(null);

  const request = useCallback(
    async (instruction: string, scope: AdjustScope) => {
      if (!plan || !today) return;
      setBusy(true);
      setError(null);
      const { context, refs } = adjustContext(plan);
      const result = await ai.adjust({ instruction, scope, context });
      setBusy(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      const outcome = applyAdjustment(plan, result.data.operations, { scope, refs, today, newId: randomId });
      setPreview({
        interpretation: result.data.interpretation,
        after: outcome.event,
        changes: diffEvents(plan, outcome.event),
        notDone: [...result.data.cannotDo, ...outcome.skipped.map((s) => s.reason)],
        remainingBefore: summarizeBudget(plan).remainingPaise,
        remainingAfter: summarizeBudget(outcome.event).remainingPaise,
      });
    },
    [plan, today],
  );

  const value = useMemo<AdjustState>(
    () => ({
      busy,
      error,
      preview,
      request,
      apply: () => {
        if (preview) update(() => preview.after);
        setPreview(null);
      },
      discard: () => setPreview(null),
    }),
    [busy, error, preview, request, update],
  );

  return <AdjustContext.Provider value={value}>{children}</AdjustContext.Provider>;
}

export function useAdjust(): AdjustState {
  const state = useContext(AdjustContext);
  if (!state) throw new Error("useAdjust must be used inside <AdjustProvider>");
  return state;
}
