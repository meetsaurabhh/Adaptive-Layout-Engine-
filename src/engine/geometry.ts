import type { Rect, SurfaceProfile, TemplateName } from "./types";

/** The usable region after removing safe-area insets. */
export function contentRegion(surface: SurfaceProfile): Rect {
  const { safeArea: s, width, height } = surface;
  return {
    x: s.left,
    y: s.top,
    width: width - s.left - s.right,
    height: height - s.top - s.bottom,
  };
}

/**
 * Selects an arrangement strategy purely from the *shape* of the content
 * region. This is the heart of "adaptation from geometry, not from identity":
 * the input is a single continuous number (the aspect ratio), so any surface —
 * including one first seen in an interview — lands in a band by its proportions
 * alone. There is no surface id anywhere in this decision.
 *
 *   aspect ≥ 1.8   → band    (wide & short: broadcast lower-third, banners, landscape)
 *   aspect ≤ 0.8   → stack   (tall & narrow: mobile portrait, digital signage)
 *   otherwise      → poster  (balanced: square kiosk, social)
 *
 * The thresholds sit in the genuinely ambiguous zone around 4:5–5:4, so the
 * classification is stable: nudging a 16:9 surface by a few pixels never flips
 * it, and a square is never mistaken for a band.
 */
export function classifyTemplate(region: Rect): TemplateName {
  const aspect = region.width / region.height;
  if (aspect >= 1.8) return "band";
  if (aspect <= 0.8) return "stack";
  return "poster";
}

/**
 * Turns soft surface facts into hard pixel minimums the resolver enforces.
 *
 * Viewing distance is the interesting one: broadcast is read from across a room,
 * so a "far" surface lifts both the text floor and the tap-target floor. This is
 * why the same headline that shrinks freely on a phone refuses to go below 32px
 * on a lower-third — and why, when the lower-third is also short, something has
 * to give.
 */
export interface EffectiveConstraints {
  minTextSize: number;
  minTapTarget: number;
  enforceTapTarget: boolean;
}

export function effectiveConstraints(surface: SurfaceProfile): EffectiveConstraints {
  const c = surface.constraints;
  const far = c.viewingDistance === "far";

  // Sensible defaults so a bare surface still produces legible output.
  const baseText = c.minTextSize ?? (far ? 32 : 12);
  const baseTap = c.minTapTarget ?? 44;

  return {
    minTextSize: far ? Math.max(baseText, 28) : baseText,
    minTapTarget: far ? Math.max(baseTap, 56) : baseTap,
    enforceTapTarget: Boolean(c.touchOnly || c.minTapTarget),
  };
}

/** Clamp helper used throughout sizing math. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** True if two rectangles overlap by more than a sub-pixel rounding epsilon. */
export function overlaps(a: Rect, b: Rect, epsilon = 0.5): boolean {
  return (
    a.x < b.x + b.width - epsilon &&
    a.x + a.width - epsilon > b.x &&
    a.y < b.y + b.height - epsilon &&
    a.y + a.height - epsilon > b.y
  );
}

/** True if `inner` is fully contained by `outer` (within epsilon). */
export function contains(outer: Rect, inner: Rect, epsilon = 0.5): boolean {
  return (
    inner.x >= outer.x - epsilon &&
    inner.y >= outer.y - epsilon &&
    inner.x + inner.width <= outer.x + outer.width + epsilon &&
    inner.y + inner.height <= outer.y + outer.height + epsilon
  );
}
