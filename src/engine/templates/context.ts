import type { AdElement, Rect, Role } from "../types";
import type { TextMeasurer } from "../measure";
import type { EffectiveConstraints } from "../geometry";

/** Everything a template needs to place a set of elements, and nothing else. */
export interface LayoutContext {
  region: Rect;
  measurer: TextMeasurer;
  fontFamily: string;
  constraints: EffectiveConstraints;
}

/** A single element resolved to an absolute frame (+ font size for text). */
export interface PlacedElement {
  element: AdElement;
  frame: Rect;
  fontSize?: number;
}

/**
 * A template's best effort for a given element set. `fits` is the template's own
 * honest verdict: false means some content had to overflow or drop below a
 * hard floor. The resolver uses it to decide whether to shed an element and
 * retry — templates never clip or drop on their own.
 */
export interface LayoutAttempt {
  placements: PlacedElement[];
  fits: boolean;
}

/** A template is a pure function from (elements, context) to a placement attempt. */
export type Template = (elements: AdElement[], ctx: LayoutContext) => LayoutAttempt;

/** The concrete element variant for a given role (role locks kind + content). */
export type ElementOf<R extends Role> = Extract<AdElement, { role: R }>;

/**
 * Pull the one element with a given role out of a set, fully narrowed. The cast
 * is sound precisely because the type system guarantees role → kind → content:
 * an element whose `role` is "hero" *is* the image variant, so callers get
 * `content.aspectRatio` without guards.
 */
export function pick<R extends Role>(elements: AdElement[], role: R): ElementOf<R> | undefined {
  return elements.find((e) => e.role === role) as ElementOf<R> | undefined;
}
