import type {
  AdElement,
  AdSpec,
  Placement,
  PlacementStatus,
  ResolvedLayout,
  SurfaceProfile,
  TraceEntry,
} from "./types";
import { contentRegion, effectiveConstraints } from "./geometry";
import { createEstimateMeasurer, type TextMeasurer } from "./measure";
import { selectTemplate, type LayoutContext, type PlacedElement } from "./templates";
import { dropOrder } from "./degrade";
import { findViolations } from "./validate";

export interface ResolveOptions {
  /** Injected text measurer. Defaults to the headless estimator. */
  measurer?: TextMeasurer;
  fontFamily?: string;
}

/**
 * Resolves one {@link AdSpec} against one {@link SurfaceProfile} into an
 * absolute, render-ready {@link ResolvedLayout}.
 *
 * The flow is four honest phases, mirrored by the trace the demo shows:
 *
 *   1. Region     – strip safe-area insets to get the usable rectangle.
 *   2. Template   – classify by aspect ratio (stack / band / poster).
 *   3. Degrade    – place all elements; if the template reports it doesn't fit,
 *                   shed the lowest-priority droppable element and retry, until
 *                   it fits or only required elements remain.
 *   4. Emit       – turn the surviving placement into typed Placements, mark the
 *                   dropped ones invisible, and verify no overlaps/clipping.
 *
 * Nothing here branches on a surface id. Swap in a surface never seen before and
 * the same four phases run.
 */
export function resolveLayout(spec: AdSpec, surface: SurfaceProfile, options: ResolveOptions = {}): ResolvedLayout {
  const measurer = options.measurer ?? createEstimateMeasurer();
  const fontFamily = options.fontFamily ?? "Inter, system-ui, sans-serif";
  const trace: TraceEntry[] = [];

  // 1. Region
  const region = contentRegion(surface);
  const constraints = effectiveConstraints(surface);
  trace.push({
    step: "region",
    detail: `Usable ${round(region.width)}×${round(region.height)} after safe area; ` +
      `min text ${constraints.minTextSize}px, min tap ${constraints.minTapTarget}px.`,
  });

  // 2. Template
  const { name: templateName, template } = selectTemplate(region);
  const aspect = (region.width / region.height).toFixed(2);
  trace.push({
    step: "template",
    detail: `Aspect ${aspect} → "${templateName}" arrangement.`,
  });

  const ctx: LayoutContext = { region, measurer, fontFamily, constraints };

  // 3. Degrade
  const all = [...spec.elements];
  const droppable = dropOrder(all);
  const dropped: AdElement[] = [];
  let survivors = all;
  let attempt = template(survivors, ctx);

  while (!attempt.fits && dropped.length < droppable.length) {
    const victim = droppable[dropped.length];
    dropped.push(victim);
    survivors = all.filter((el) => !dropped.includes(el));
    trace.push({
      step: "degrade",
      detail: `Space insufficient — dropped "${victim.id}" (${victim.role}, priority ${victim.priority}).`,
    });
    attempt = template(survivors, ctx);
  }

  if (attempt.fits) {
    trace.push({
      step: "degrade",
      detail: dropped.length
        ? `Fits after dropping ${dropped.length} element${dropped.length > 1 ? "s" : ""}.`
        : "All elements fit at full priority.",
    });
  } else {
    trace.push({
      step: "degrade",
      detail: "Only required elements remain; compressing them to their minimum.",
    });
  }

  // 4. Emit
  const placements = buildPlacements(all, attempt.placements, constraints.minTextSize);

  const violations = findViolations(placements, { x: 0, y: 0, width: surface.width, height: surface.height });
  if (violations.length) {
    for (const v of violations) trace.push({ step: "warning", detail: v.detail });
  } else {
    trace.push({ step: "verify", detail: "No overlaps or out-of-bounds placements." });
  }

  return {
    surfaceId: surface.id,
    surface: { width: surface.width, height: surface.height },
    contentRegion: region,
    template: templateName,
    placements,
    trace,
  };
}

function buildPlacements(
  all: readonly AdElement[],
  placed: PlacedElement[],
  minTextSize: number,
): Placement[] {
  const byId = new Map(placed.map((p) => [p.element.id, p]));

  return all.map((el) => {
    const p = byId.get(el.id);
    if (!p) {
      const status: PlacementStatus = { kind: "dropped", reason: dropReason(el) };
      return emptyPlacement(el, status);
    }

    // Accurate "shrunk" signal: *text* sitting at the legibility floor was forced
    // down by the surface, not chosen to be small. Buttons are governed by tap
    // target, not text size, so they're never flagged as shrunk.
    const atFloor = el.kind === "text" && p.fontSize !== undefined && p.fontSize <= minTextSize + 0.5;
    const status: PlacementStatus = atFloor
      ? { kind: "shrunk", reason: `at minimum legible size (${minTextSize}px)` }
      : { kind: "placed" };

    return {
      id: el.id,
      role: el.role,
      elementKind: el.kind,
      content: el.content,
      frame: p.frame,
      fontSize: p.fontSize,
      visible: true,
      status,
    };
  });
}

function dropReason(el: AdElement): string {
  return `not enough room; ${el.role} is priority ${el.priority} and droppable`;
}

function emptyPlacement(el: AdElement, status: PlacementStatus): Placement {
  return {
    id: el.id,
    role: el.role,
    elementKind: el.kind,
    content: el.content,
    frame: { x: 0, y: 0, width: 0, height: 0 },
    visible: false,
    status,
  };
}

function round(n: number): number {
  return Math.round(n);
}
