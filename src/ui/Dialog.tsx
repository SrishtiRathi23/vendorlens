"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A modal built on the native `<dialog>` element: the browser traps focus and handles Escape.
 * Focus returns to whatever opened the dialog when it closes.
 */
export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      if (opener.current instanceof HTMLElement) opener.current.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(42rem,calc(100vw-2rem))] rounded-lg border border-cream bg-ivory p-0 text-charcoal shadow-xl backdrop:bg-charcoal/50"
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-6">
          <h2 id={titleId} className="font-display text-3xl font-semibold text-forest">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
