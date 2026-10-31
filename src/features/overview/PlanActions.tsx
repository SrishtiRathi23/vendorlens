"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, useRef, useState } from "react";
import type { EventPlan } from "@/domain/schemas";
import { usePlanStore } from "@/features/store/plan-store";
import { download, downloadCalendar, fileSlug } from "@/lib/download";
import { exportPlan, importPlan } from "@/lib/local-db/backup";
import { Button } from "@/ui/controls";
import { Dialog } from "@/ui/Dialog";

/** Backup, calendar export, print and "clear this browser" — all local, none of it uses AI. */
export function PlanActions({ plan }: { plan: EventPlan }) {
  const { replace, clearAll } = usePlanStore();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = importPlan(await file.text());
    if (result.ok) {
      replace(result.plan);
      setMessage(`Imported “${result.plan.title}”.`);
    } else {
      setMessage(`${result.reason} Your current plan was not changed.`);
    }
  };

  return (
    <section aria-labelledby="actions-heading" className="flex flex-col gap-3 print:hidden">
      <h2 id="actions-heading" className="font-display text-2xl font-semibold text-forest">
        Your data
      </h2>
      <p className="text-sm">This plan is stored only in this browser. Export a backup to move it or keep it safe.</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() =>
            download(
              `${fileSlug(plan.title)}.vendorlens.json`,
              exportPlan(plan, new Date().toISOString()),
              "application/json",
            )
          }
        >
          Export backup
        </Button>
        <Button variant="secondary" onClick={() => fileInput.current?.click()}>
          Import backup
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => void onImport(e)}
        />
        <Button variant="secondary" onClick={() => downloadCalendar(plan)}>
          Download calendar (.ics)
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          Print plan
        </Button>
        <Button variant="danger" onClick={() => setConfirmClear(true)}>
          Delete from this browser
        </Button>
      </div>
      <p role="status" className="text-sm">
        {message}
      </p>
      <Dialog open={confirmClear} title="Delete this plan?" onClose={() => setConfirmClear(false)}>
        <p>
          This removes the plan, its quotes and contacts from this browser. Export a backup first if you might need it.
        </p>
        <div className="flex gap-3">
          <Button
            variant="danger"
            onClick={() => {
              setConfirmClear(false);
              void clearAll().then(() => router.push("/"));
            }}
          >
            Delete everything
          </Button>
          <Button variant="secondary" onClick={() => setConfirmClear(false)}>
            Keep my plan
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
