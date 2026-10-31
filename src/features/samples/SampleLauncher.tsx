"use client";

import { useRouter } from "next/navigation";
import { EVENT_KIND_LABEL, EVENT_KINDS } from "@/domain/categories";
import { istDate } from "@/domain/dates";
import { randomId } from "@/domain/ids";
import { buildSampleEvent } from "@/domain/samples";
import { usePlanStore } from "@/features/store/plan-store";
import { Button } from "@/ui/controls";

/** Opens a fully built, fictional sample plan, so everything can be explored without AI or typing. */
export function SampleLauncher({ heading = "Explore a sample" }: { heading?: string }) {
  const { replace } = usePlanStore();
  const router = useRouter();

  const open = (kind: (typeof EVENT_KINDS)[number]) => {
    replace(buildSampleEvent(kind, istDate(new Date()), randomId));
    router.push(kind === "wedding" ? "/workspace/compare" : "/workspace");
  };

  return (
    <section aria-labelledby="sample-heading" className="flex flex-col gap-3">
      <h2 id="sample-heading" className="text-sm font-medium text-emerald">
        {heading}
      </h2>
      <div className="flex flex-wrap gap-2">
        {EVENT_KINDS.map((kind) => (
          <Button key={kind} variant="secondary" onClick={() => open(kind)}>
            Sample {EVENT_KIND_LABEL[kind].toLowerCase()}
          </Button>
        ))}
      </div>
      <p className="text-xs text-charcoal/80">Samples use fictional vendors and prices, labelled “(sample)”.</p>
    </section>
  );
}
