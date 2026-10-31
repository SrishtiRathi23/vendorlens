# Accessibility

Target: WCAG 2.2 AA.

## Automated

`e2e/journeys.spec.ts` runs axe (tags wcag2a, wcag2aa, wcag21aa, wcag22aa) on all 8 routes (`/new`, `/privacy` and the six workspace tabs) with a sample plan loaded, on a desktop and a phone. **0 serious or critical findings.** The same tests assert exactly one `<h1>` per page and no page-wide horizontal scroll. `e2e/landing.spec.ts` checks widths of 320, 390, 768 and 1440 px.

## Built in

- **Keyboard:** "Skip to main content" link; every action is a native button, link or form control; dialogs use the native `<dialog>`, so the browser handles focus and Escape, and focus returns to the opener (tested).
- **Forms:** every field has a visible label wired with `aria-describedby` to its hint and error. The wizard shows an error summary that receives focus (tested).
- **Status:** AI progress, saves, imports and verdicts are announced through `role="status"` regions. Comparison status, provenance and priorities are written in words ("Incomplete: 3 unknown", "Not found in quote: check it"), never shown by colour alone.
- **Tables:** captions, `scope` on headers, and a focusable, labelled scroll region on narrow screens.
- **Targets and motion:** 44 px minimum targets; all transitions are disabled under `prefers-reduced-motion`.
- **Pointer and scroll effects** (`src/ui/Interactions.tsx`): the custom cursor, magnetic buttons, card spotlight and scroll reveals are decorative and `aria-hidden`. The cursor appears only on mouse devices, the system cursor stays in text fields, and keyboard focus rings are unchanged. With reduced motion none of it runs and nothing is hidden waiting for a reveal (tested in Q19). Content is hidden for a reveal only after the script starts, so nothing is lost without JavaScript. Axe runs after every reveal and entrance animation has settled (`e2e/settle.ts`).
- **Colour:** measured palette, recorded in `src/app/globals.css`: forest on ivory 11.8:1, emerald on ivory 5.9:1, brick on ivory 5.9:1. Saffron and coral are used only for surfaces and rules, never small text. The focus ring stays in the palette.

## Manual checks still worth doing before the demo

- A screen-reader pass (NVDA or VoiceOver) through the wizard and a quote review.
- 200% browser zoom on the Compare tab.
