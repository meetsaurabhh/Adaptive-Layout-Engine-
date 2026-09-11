import type { Placement, Rect } from "./types";
import { overlaps, contains } from "./geometry";

export interface Violation {
  kind: "overlap" | "out-of-bounds";
  ids: string[];
  detail: string;
}

/**
 * Independent safety net run after every resolve. The templates are built so
 * that overlaps and clipping can't happen, but "can't happen" is worth
 * verifying — this is the check the tests assert against, and it's what lets the
 * README promise "no overlaps or clipping under any tested surface" honestly.
 */
export function findViolations(placements: Placement[], bounds: Rect): Violation[] {
  const visible = placements.filter((p) => p.visible);
  const violations: Violation[] = [];

  for (const p of visible) {
    if (!contains(bounds, p.frame)) {
      violations.push({
        kind: "out-of-bounds",
        ids: [p.id],
        detail: `"${p.id}" extends outside the surface bounds.`,
      });
    }
  }

  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      if (overlaps(visible[i].frame, visible[j].frame)) {
        violations.push({
          kind: "overlap",
          ids: [visible[i].id, visible[j].id],
          detail: `"${visible[i].id}" overlaps "${visible[j].id}".`,
        });
      }
    }
  }
  return violations;
}
