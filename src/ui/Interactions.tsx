"use client";

import { useEffect, useRef } from "react";

const INTERACTIVE = 'a[href], button:not(:disabled), summary, label, select, [role="button"]';
const TEXT_ENTRY = 'input:not([type="checkbox"], [type="radio"], [type="range"]), textarea, [contenteditable="true"]';
const MAX_PULL_PX = 6;

/**
 * The decorative motion layer: a small cursor with a light trailing ring, gently magnetic buttons,
 * a soft spotlight on cards and reveal-on-scroll. All of it is aria-hidden or cosmetic, skips touch
 * screens, and switches off entirely when the visitor prefers reduced motion.
 */
export function Interactions() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    const stops = [revealOnScroll(root)];
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && dot.current && ring.current)
      stops.push(followPointer(root, dot.current, ring.current));
    return () => {
      for (const stop of stops) stop();
    };
  }, []);

  return (
    <div aria-hidden="true" className="vl-cursor">
      <div ref={ring} className="vl-cursor-ring">
        <span />
      </div>
      <div ref={dot} className="vl-cursor-dot">
        <span />
      </div>
    </div>
  );
}

/** Fades `[data-reveal]` elements up as they scroll into view. Anything already on screen stays put. */
function revealOnScroll(root: HTMLElement): () => void {
  const seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-revealed");
        seen.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -6% 0px" },
  );
  const watch = (scope: ParentNode) => {
    for (const el of scope.querySelectorAll("[data-reveal]:not(.is-revealed)")) seen.observe(el);
  };
  for (const el of document.querySelectorAll("[data-reveal]"))
    if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-revealed");
  root.classList.add("motion-ok");
  watch(document);
  // Workspace screens mount new content on navigation; reveal that too.
  const added = new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches("[data-reveal]")) seen.observe(node);
        watch(node);
      }
  });
  added.observe(document.body, { childList: true, subtree: true });
  return () => {
    added.disconnect();
    seen.disconnect();
    root.classList.remove("motion-ok");
  };
}

const clamp = (value: number) => Math.max(-MAX_PULL_PX, Math.min(MAX_PULL_PX, value));

/** Moves the dot with the mouse and lets the ring ease after it; also drives magnets and spotlights. */
function followPointer(root: HTMLElement, dot: HTMLElement, ring: HTMLElement): () => void {
  let x = 0;
  let y = 0;
  let ringX = 0;
  let ringY = 0;
  let last = 0;
  let frame = 0;
  let magnet: HTMLElement | null = null;

  const release = (el: HTMLElement) => {
    el.style.removeProperty("--pull-x");
    el.style.removeProperty("--pull-y");
  };

  const tick = (now: number) => {
    // The ring closes 18% of the gap per 60 Hz frame, scaled so it feels the same at any refresh rate.
    const ease = 1 - Math.pow(0.82, Math.min(now - last, 100) / 16.67);
    last = now;
    ringX += (x - ringX) * ease;
    ringY += (y - ringY) * ease;
    dot.style.transform = `translate3d(${String(x)}px, ${String(y)}px, 0)`;
    ring.style.transform = `translate3d(${String(ringX)}px, ${String(ringY)}px, 0)`;
    frame = Math.abs(x - ringX) + Math.abs(y - ringY) > 0.1 ? requestAnimationFrame(tick) : 0;
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    x = event.clientX;
    y = event.clientY;
    if (!root.classList.contains("cursor-visible")) {
      ringX = x;
      ringY = y;
      root.classList.add("has-cursor", "cursor-visible");
    }
    if (!frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }

    const target = event.target instanceof Element ? event.target : null;
    root.dataset.cursor = target?.closest(TEXT_ENTRY) ? "text" : target?.closest(INTERACTIVE) ? "link" : "";

    const card = target?.closest<HTMLElement>(".spotlight");
    if (card) {
      const box = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${String(x - box.left)}px`);
      card.style.setProperty("--my", `${String(y - box.top)}px`);
    }

    const pull = target?.closest<HTMLElement>("[data-magnetic]") ?? null;
    if (magnet && magnet !== pull) release(magnet);
    magnet = pull;
    if (pull) {
      const box = pull.getBoundingClientRect();
      pull.style.setProperty("--pull-x", `${String(clamp((x - box.left - box.width / 2) * 0.2))}px`);
      pull.style.setProperty("--pull-y", `${String(clamp((y - box.top - box.height / 2) * 0.3))}px`);
    }
  };

  const onLeave = () => {
    root.classList.remove("cursor-visible");
    if (magnet) release(magnet);
    magnet = null;
  };
  const onDown = () => root.classList.add("cursor-down");
  const onUp = () => root.classList.remove("cursor-down");

  document.addEventListener("pointermove", onMove, { passive: true });
  root.addEventListener("pointerleave", onLeave);
  document.addEventListener("pointerdown", onDown);
  document.addEventListener("pointerup", onUp);
  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener("pointermove", onMove);
    root.removeEventListener("pointerleave", onLeave);
    document.removeEventListener("pointerdown", onDown);
    document.removeEventListener("pointerup", onUp);
    root.classList.remove("has-cursor", "cursor-visible", "cursor-down");
    delete root.dataset.cursor;
  };
}
