/**
 * Core type vocabulary for the layout engine.
 *
 * The whole engine is built around three data shapes that never leak into each
 * other's concerns:
 *
 *   AdSpec          – what the ad *is* (content + intent), surface-agnostic.
 *   SurfaceProfile  – what we're rendering *onto* (geometry + hard constraints).
 *   ResolvedLayout  – where every element *ended up* (absolute px, per element).
 *
 * A renderer only ever sees a ResolvedLayout. It never sees the spec or the
 * surface, which is what lets us swap DOM for Canvas without touching a line of
 * resolution logic.
 */

/* ------------------------------------------------------------------ *
 * Roles
 *
 * A role is the *semantic job* an element does in the ad, not its visual
 * treatment. The resolver reasons about roles ("where does the hero go on a
 * wide surface"), never about specific element ids. Roles are a closed set so
 * that templates can exhaustively pattern-match on them.
 * ------------------------------------------------------------------ */
export type Role =
  | "primary" // the headline — the one line that must always land
  | "hero" // the dominant product visual
  | "action" // the call-to-action (a tappable/clickable target)
  | "secondary" // supporting text, e.g. price
  | "branding"; // the logo / brand mark

/**
 * Each role is locked to exactly one element kind. This is the first line of
 * type defence: `{ role: "hero", kind: "text" }` is a compile error, because a
 * hero is always an image. Templates rely on this — a hero slot can assume it
 * is laying out an image and nothing else.
 */
export interface RoleKind {
  primary: "text";
  hero: "image";
  action: "button";
  secondary: "text";
  branding: "image";
}

/** The content payload each element kind carries. */
export interface KindContent {
  text: { text: string };
  image: { src: string; /** intrinsic w/h ratio, used to preserve proportion */ aspectRatio: number; alt: string };
  button: { label: string; href?: string };
}

/* ------------------------------------------------------------------ *
 * Priority
 *
 * Lower number = more important. Priority drives *degradation order*: when a
 * surface can't hold everything, the engine sheds the highest-numbered
 * (least important) elements first. `required` elements are never dropped —
 * they compress to their minimum instead.
 * ------------------------------------------------------------------ */
export type Priority = 1 | 2 | 3 | 4 | 5;

/**
 * Optional per-element sizing intent. These are *hints* the resolver honours
 * where the surface allows, not fixed pixel values — the whole point is that
 * pixels are decided per surface.
 */
export interface SizingIntent {
  /** For text: preferred font size before surface scaling. */
  preferredFontSize?: number;
  /** For text: never render smaller than this, even under pressure. */
  minFontSize?: number;
  /** For images: preferred longest-edge length as a fraction of the region's short side (0–1). */
  heroScale?: number;
  /** Hard floor on the element's longest edge in px (e.g. a logo that stops being legible below 24px). */
  minEdge?: number;
}

/**
 * One element in the spec. The `role` field is the discriminant: TypeScript
 * narrows `kind` and `content` from the role, so the five element variants are
 * mutually exclusive and each is fully typed.
 */
export type AdElement = {
  [R in Role]: {
    id: string;
    role: R;
    kind: RoleKind[R];
    content: KindContent[RoleKind[R]];
    priority: Priority;
    /** If true, the element is never dropped — it degrades to its minimum instead. */
    required?: boolean;
    sizing?: SizingIntent;
  };
}[Role];

/** A validated ad specification. The brand ensures it came through `defineAd`. */
export interface AdSpec {
  readonly __brand: "AdSpec";
  readonly name: string;
  readonly elements: readonly AdElement[];
}

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

/** Inset margins that content must stay clear of (broadcast title-safe, notches, print bleed). */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * A surface is pure description: how big, and what's non-negotiable about it.
 * Crucially there is no "layout" field and no surface *name* the resolver keys
 * off — the engine derives everything it does from this geometry + constraints,
 * which is why an unseen surface handed over in an interview just works.
 */
export interface SurfaceProfile {
  readonly __brand: "SurfaceProfile";
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly safeArea: Insets;
  readonly constraints: SurfaceConstraints;
}

/**
 * Hard constraints. These are floors the resolver may never cross; if honouring
 * one means an element can't fit, the element is dropped rather than shrunk past
 * the floor. `viewingDistance` widens minimums (you read broadcast from a sofa).
 */
export interface SurfaceConstraints {
  /** Minimum edge length for any tappable target. Enforced when `touchOnly`. */
  minTapTarget?: number;
  /** Text is never rendered below this, whatever the pressure. */
  minTextSize?: number;
  /** Touch surface: pointer targets must satisfy `minTapTarget`. */
  touchOnly?: boolean;
  /** Far viewing lifts the effective text/target minimums (see resolver). */
  viewingDistance?: "near" | "far";
}

/* ------------------------------------------------------------------ *
 * Resolved layout (the renderer's only input)
 * ------------------------------------------------------------------ */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How an element fared during resolution — surfaced in the demo's trace panel. */
export type PlacementStatus =
  | { kind: "placed" }
  | { kind: "shrunk"; reason: string }
  | { kind: "dropped"; reason: string };

/** The absolute, render-ready position of one element on one surface. */
export interface Placement {
  id: string;
  role: Role;
  elementKind: RoleKind[Role];
  content: KindContent[RoleKind[Role]];
  /** Absolute pixel box within the surface (only meaningful when `visible`). */
  frame: Rect;
  /** Resolved font size in px, for text elements. */
  fontSize?: number;
  visible: boolean;
  status: PlacementStatus;
}

/** Everything a renderer needs, and nothing it doesn't. */
export interface ResolvedLayout {
  surfaceId: string;
  surface: { width: number; height: number };
  /** The content region after safe-area insets — useful for renderers that draw guides. */
  contentRegion: Rect;
  /** Which arrangement strategy the geometry selected. */
  template: TemplateName;
  placements: Placement[];
  /** Ordered, human-readable record of the decisions the resolver made. */
  trace: TraceEntry[];
}

export type TemplateName = "stack" | "band" | "poster";

export interface TraceEntry {
  step: string;
  detail: string;
}
