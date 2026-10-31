"use client";

import { IDEA_SECTION_LABEL, IDEA_SECTIONS, tagLabel } from "@/domain/categories";
import type { Idea } from "@/domain/schemas";
import { useAdjust } from "@/features/adjust/adjust-context";
import { usePlanStore } from "@/features/store/plan-store";
import { Badge, Button } from "@/ui/controls";

function IdeaCard({ idea }: { idea: Idea }) {
  const { update } = usePlanStore();
  const patchIdeas = (change: (ideas: Idea[]) => Idea[]) => update((p) => ({ ...p, ideas: change(p.ideas) }));
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-cream bg-white/60 p-4">
      <h3 className="text-lg font-semibold text-forest">{idea.title}</h3>
      {idea.description && <p className="text-sm">{idea.description}</p>}
      {idea.whyItFits && (
        <p className="text-sm">
          <span className="font-medium">Why it fits: </span>
          {idea.whyItFits}
        </p>
      )}
      {idea.dietTags.length > 0 && (
        <p className="flex flex-wrap gap-1" aria-label="Suits">
          {idea.dietTags.map((tag) => (
            <Badge key={tag}>{tagLabel(tag)}</Badge>
          ))}
        </p>
      )}
      <div className="flex gap-2 print:hidden">
        <Button
          variant="secondary"
          aria-pressed={idea.pinned}
          onClick={() => patchIdeas((ideas) => ideas.map((i) => (i.id === idea.id ? { ...i, pinned: !i.pinned } : i)))}
        >
          {idea.pinned ? "Pinned" : "Pin"}
        </Button>
        <Button variant="quiet" onClick={() => patchIdeas((ideas) => ideas.filter((i) => i.id !== idea.id))}>
          Remove<span className="sr-only"> “{idea.title}”</span>
        </Button>
      </div>
    </article>
  );
}

export function IdeasView() {
  const { plan } = usePlanStore();
  const { request, busy } = useAdjust();
  if (!plan) return null;
  const pinned = plan.ideas.filter((i) => i.pinned);
  const basis = (pinned.length > 0 ? pinned : plan.ideas).slice(0, 5).map((i) => i.title);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl font-semibold text-forest">Ideas</h1>
        <Button
          className="print:hidden"
          disabled={busy || basis.length === 0}
          onClick={() => void request(`Suggest three more ideas in the same spirit as: ${basis.join("; ")}.`, "ideas")}
        >
          {busy ? "Thinking…" : pinned.length > 0 ? "More like my pinned ideas" : "More ideas like these"}
        </Button>
      </div>
      <p className="max-w-3xl">
        Themes, decor, food and activities chosen for this event. Pin the ones you like; new suggestions arrive as a
        preview you can accept or discard.
      </p>
      {IDEA_SECTIONS.map((section) => {
        const ideas = [...plan.ideas.filter((i) => i.section === section)].sort(
          (a, b) => Number(b.pinned) - Number(a.pinned),
        );
        if (ideas.length === 0) return null;
        return (
          <section key={section} aria-labelledby={`ideas-${section}`} className="flex flex-col gap-3">
            <h2 id={`ideas-${section}`} className="font-display text-3xl font-semibold text-forest">
              {IDEA_SECTION_LABEL[section]}
            </h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {ideas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
