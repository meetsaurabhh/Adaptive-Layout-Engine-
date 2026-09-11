import type { AdElement } from "./types";

/**
 * Degradation policy — the single source of truth for *what gets sacrificed
 * first* when a surface can't hold everything.
 *
 * The order is deterministic and explainable, which is exactly what the live
 * interview asks for ("walk through why this element dropped"):
 *
 *   1. `required` elements are never candidates. Headline and CTA carry this —
 *      an ad with neither has failed at its job, so we compress them to minimum
 *      instead of dropping them.
 *   2. Among the rest, drop the *lowest priority* first (highest number).
 *   3. Ties break by a fixed role weight so the order is stable run-to-run:
 *      branding leaves before secondary before hero. No randomness, no
 *      dependence on array order.
 */

const ROLE_TIEBREAK: Record<AdElement["role"], number> = {
  branding: 0, // sheds first
  secondary: 1,
  hero: 2,
  action: 3,
  primary: 4, // clings longest
};

/** Elements eligible to be dropped, in the exact order they will be dropped. */
export function dropOrder(elements: readonly AdElement[]): AdElement[] {
  return elements
    .filter((el) => !el.required)
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority; // lower priority (higher number) first
      return ROLE_TIEBREAK[a.role] - ROLE_TIEBREAK[b.role];
    });
}
