import type { Insets, SurfaceConstraints, SurfaceProfile } from "./types";

const ZERO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export interface SurfaceInput {
  id: string;
  label: string;
  width: number;
  height: number;
  safeArea?: Partial<Insets>;
  constraints?: SurfaceConstraints;
}

/**
 * Builds a validated {@link SurfaceProfile}.
 *
 * Surfaces are the extension point of the whole engine: adding a new one is
 * *only* a call to this function. There is deliberately no place to attach a
 * layout — a surface can describe its constraints but never dictate an
 * arrangement, so a new surface can't smuggle in a hardcoded layout.
 *
 * Validation catches the constraint combinations that would otherwise produce a
 * quietly-wrong layout: a touch surface with no tap-target floor, insets that
 * consume the whole surface, a non-positive size.
 */
export function defineSurface(input: SurfaceInput): SurfaceProfile {
  const { id, label, width, height } = input;
  const safeArea: Insets = { ...ZERO_INSETS, ...input.safeArea };
  const constraints: SurfaceConstraints = { ...input.constraints };

  if (width <= 0 || height <= 0) {
    throw new SurfaceError(`Surface "${id}" must have positive dimensions, got ${width}×${height}.`);
  }

  if (safeArea.left + safeArea.right >= width || safeArea.top + safeArea.bottom >= height) {
    throw new SurfaceError(`Surface "${id}" safe-area insets leave no usable content region.`);
  }

  // A touch surface with no tap-target floor is almost always a mistake — the
  // engine can't guarantee reachable buttons, so we fail fast and say so.
  if (constraints.touchOnly && !constraints.minTapTarget) {
    throw new SurfaceError(
      `Surface "${id}" is touchOnly but sets no minTapTarget. Touch targets need a minimum reachable size.`,
    );
  }

  return {
    __brand: "SurfaceProfile",
    id,
    label,
    width,
    height,
    safeArea,
    constraints,
  };
}

export class SurfaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SurfaceError";
  }
}
