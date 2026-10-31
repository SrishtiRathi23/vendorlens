"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { EVENT_KIND_LABEL } from "@/domain/categories";
import { formatDate } from "@/domain/dates";
import { AdjustBar } from "@/features/adjust/AdjustBar";
import { AdjustProvider } from "@/features/adjust/adjust-context";
import { SampleLauncher } from "@/features/samples/SampleLauncher";
import { usePlanStore } from "@/features/store/plan-store";
import { Badge, Button } from "@/ui/controls";

const TABS = [
  { href: "/workspace", label: "Overview" },
  { href: "/workspace/budget", label: "Budget" },
  { href: "/workspace/vendors", label: "Vendors" },
  { href: "/workspace/compare", label: "Compare" },
  { href: "/workspace/timeline", label: "Timeline" },
  { href: "/workspace/ideas", label: "Ideas" },
];

const ORIGIN = {
  ai: { tone: "info", label: "AI-drafted plan" },
  template: { tone: "warn", label: "Template plan (AI was unavailable)" },
  sample: { tone: "neutral", label: "Sample (fictional)" },
} as const;

/** Frame for every workspace screen: event header, tabs, the adjust bar and undo. */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { status, plan, canUndo, undo } = usePlanStore();
  const pathname = usePathname();

  if (status === "loading") {
    return (
      <main id="content" className="mx-auto max-w-6xl px-4 py-10" aria-busy="true">
        <p role="status">Opening your plan…</p>
      </main>
    );
  }

  if (!plan) {
    return (
      <main id="content" className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
        <h1 className="font-display text-5xl font-semibold text-forest">No plan open yet</h1>
        <p>Plans are stored in this browser. Start a new one, or open a sample to look around.</p>
        <Link
          href="/new"
          className="inline-flex min-h-11 w-fit items-center rounded-md bg-forest px-5 font-medium text-ivory hover:bg-emerald"
        >
          Plan my event
        </Link>
        <SampleLauncher heading="Or explore a sample" />
      </main>
    );
  }

  const origin = ORIGIN[plan.origin];
  return (
    <AdjustProvider>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <header className="flex flex-col gap-3 border-b border-cream pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="font-display text-2xl font-semibold text-forest">
              VendorLens
            </Link>
            {canUndo && (
              <Button variant="secondary" onClick={undo} className="print:hidden">
                Undo last change
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="font-display text-3xl font-semibold text-forest">{plan.title}</p>
            <p className="text-sm">
              {EVENT_KIND_LABEL[plan.kind]} · {formatDate(plan.date)} · {plan.city} · {plan.guestCount} guests
            </p>
            <Badge tone={origin.tone}>{origin.label}</Badge>
          </div>
          <nav aria-label="Workspace" className="print:hidden">
            <ul className="flex flex-wrap gap-1">
              {TABS.map((tab) => {
                const current = pathname === tab.href;
                return (
                  <li key={tab.href}>
                    <Link
                      href={tab.href}
                      aria-current={current ? "page" : undefined}
                      className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium ${current ? "bg-forest text-ivory" : "text-forest hover:bg-sage"}`}
                    >
                      {tab.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </header>
        <AdjustBar />
        <main id="content" className="flex flex-col gap-6">
          {children}
        </main>
      </div>
    </AdjustProvider>
  );
}
