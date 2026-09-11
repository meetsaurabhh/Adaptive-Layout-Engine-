import type { TextMeasurer } from "./measure";
import { clamp } from "./geometry";

/**
 * Element-level sizing primitives shared by every template. Templates decide
 * *where* a slot goes; these functions decide *how big* the content inside it
 * can be while respecting the slot and the surface's hard floors.
 */

export interface FittedText {
  fontSize: number;
  width: number;
  height: number;
  lines: number;
  /** True when even the minimum font size overflows the height budget. */
  overflow: boolean;
}

/**
 * Largest font size in [minSize, prefSize] whose wrapped text fits inside
 * (maxWidth × maxHeight). This is what makes wrapping decisions real: we ask the
 * measurer for the actual box at each candidate size and step down until it
 * fits, rather than assuming a character budget.
 *
 * If the minimum size still overflows the height, we return it flagged as
 * `overflow` — the caller (resolver) treats that as "this element can't fit
 * here" and drops something, instead of letting text spill.
 */
export function fitText(
  text: string,
  maxWidth: number,
  maxHeight: number,
  measurer: TextMeasurer,
  fontFamily: string,
  minSize: number,
  prefSize: number,
): FittedText {
  const hi = Math.max(minSize, Math.floor(prefSize));
  const lo = Math.max(1, Math.floor(minSize));

  for (let size = hi; size >= lo; size--) {
    const m = measurer.measure(text, size, fontFamily, maxWidth);
    if (m.height <= maxHeight) {
      return { fontSize: size, width: m.width, height: m.height, lines: m.lines, overflow: false };
    }
  }
  const m = measurer.measure(text, lo, fontFamily, maxWidth);
  return { fontSize: lo, width: m.width, height: m.height, lines: m.lines, overflow: true };
}

export interface Box {
  width: number;
  height: number;
}

/** Contain an image of the given aspect ratio inside a box, preserving proportion. */
export function fitImage(aspectRatio: number, maxWidth: number, maxHeight: number): Box {
  let width = maxWidth;
  let height = width / aspectRatio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }
  return { width, height };
}

/**
 * A button's box: wide enough for its label plus padding, tall enough to read,
 * and never smaller than the surface's tap-target floor on either axis when the
 * target is interactive.
 */
export function buttonBox(
  label: string,
  fontSize: number,
  measurer: TextMeasurer,
  fontFamily: string,
  minTapTarget: number,
  maxWidth: number,
): Box {
  const padX = fontSize * 1.1;
  const padY = fontSize * 0.7;
  const textW = measurer.measure(label, fontSize, fontFamily, maxWidth).width;
  const width = clamp(textW + padX * 2, minTapTarget, maxWidth);
  const height = Math.max(fontSize + padY * 2, minTapTarget);
  return { width, height };
}
