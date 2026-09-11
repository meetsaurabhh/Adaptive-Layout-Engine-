// Public surface of the layout engine. Consumers (renderers, the demo, tests)
// import from here and never reach into internal modules.

export { defineAd, SpecError } from "./spec";
export { defineSurface, SurfaceError } from "./surfaces";
export { resolveLayout, type ResolveOptions } from "./resolver";
export { createCanvasMeasurer, createEstimateMeasurer, type TextMeasurer } from "./measure";
export { findViolations, type Violation } from "./validate";
export { classifyTemplate, contentRegion } from "./geometry";

export type {
  AdSpec,
  AdElement,
  Role,
  Priority,
  SurfaceProfile,
  SurfaceConstraints,
  Insets,
  ResolvedLayout,
  Placement,
  PlacementStatus,
  TemplateName,
  Rect,
  TraceEntry,
} from "./types";
