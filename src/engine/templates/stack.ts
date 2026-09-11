import type { AdElement, Rect } from "../types";
import { clamp } from "../geometry";
import { solveTrack, measureTrack, type FlexItem } from "../track";
import { fitText, fitImage, buttonBox } from "../sizing";
import type { LayoutContext, PlacedElement, Template } from "./context";

/**
 * STACK — tall, narrow surfaces (mobile portrait, digital signage).
 *
 * Reading is top-to-bottom, so elements become a single vertical flex track:
 *
 *     ┌──────────────┐
 *     │  ▓▓▓ hero ▓▓▓ │  ← image, grows to absorb slack
 *     │  Headline     │
 *     │  Price        │
 *     │  [  CTA  ]     │
 *     │  logo         │
 *     └──────────────┘
 *
 * The hero carries `grow`, so leftover vertical space enlarges the image rather
 * than scattering gaps — the text block stays tight and the composition reads as
 * deliberate at any height.
 */
export const stackTemplate: Template = (elements, ctx) => {
  const { region } = ctx;
  const pad = clamp(Math.min(region.width, region.height) * 0.06, 12, 48);
  const innerW = region.width - pad * 2;
  const innerH = region.height - pad * 2;
  const gap = clamp(region.height * 0.025, 8, 32);
  const x0 = region.x + pad;
  const y0 = region.y + pad;

  const order = ["hero", "primary", "secondary", "action", "branding"] as const;
  const present = order
    .map((role) => elements.find((e) => e.role === role))
    .filter((e): e is AdElement => Boolean(e));

  // Size each element vertically at the full inner width (cross axis is fixed).
  const measured = present.map((el) => measureVertical(el, innerW, innerH, ctx));

  const items: FlexItem[] = measured.map((m) => ({
    key: m.element.id,
    basis: m.prefHeight,
    min: m.minHeight,
    grow: m.grow,
    shrink: m.shrink,
  }));

  const fits = measureTrack(items, gap) <= innerH;
  // Distribute any leftover height as even spacing between elements (a full-bleed
  // vertical rhythm). When content overflows, there's no slack and this behaves
  // exactly like top alignment.
  const align = present.length > 1 ? "space-between" : "start";
  const results = solveTrack(items, { available: innerH, gap, align });

  const placements: PlacedElement[] = [];
  let overflow = false;

  results.forEach((res, i) => {
    const m = measured[i];
    const slotTop = y0 + res.offset;
    const { placement, didOverflow } = m.place(slotTop, res.length, x0, innerW);
    placements.push(placement);
    overflow = overflow || didOverflow;
  });

  return { placements, fits: fits && !overflow };
};

/* --- per-role vertical sizing ------------------------------------- */

interface MeasuredElement {
  element: AdElement;
  prefHeight: number;
  minHeight: number;
  grow: number;
  shrink: number;
  place: (top: number, slotHeight: number, x0: number, innerW: number) => {
    placement: PlacedElement;
    didOverflow: boolean;
  };
}

function measureVertical(el: AdElement, innerW: number, innerH: number, ctx: LayoutContext): MeasuredElement {
  const { measurer, fontFamily, constraints } = ctx;

  if (el.role === "hero" || el.role === "branding") {
    const aspect = el.content.aspectRatio;
    const isHero = el.role === "hero";
    const scale = el.sizing?.heroScale ?? (isHero ? 0.42 : 0.1);
    // The image is width-limited on a narrow surface, so its natural height is
    // capped by innerW / aspect. Sizing the slot to the *achievable* image
    // height keeps the slot flush with the picture instead of leaving a gap.
    const wantH = innerH * scale;
    const widthCapH = innerW / aspect;
    const prefH = clamp(Math.min(wantH, widthCapH), isHero ? 80 : 20, innerH * (isHero ? 0.55 : 0.16));
    const minH = isHero ? prefH * 0.6 : Math.max(el.sizing?.minEdge ?? 18, prefH * 0.7);
    return {
      element: el,
      prefHeight: prefH,
      minHeight: minH,
      grow: 0,
      shrink: 1,
      place: (top, slotHeight, x0, w) => {
        const box = fitImage(aspect, w, slotHeight);
        const frame: Rect = {
          x: x0 + (w - box.width) / 2,
          y: top,
          width: box.width,
          height: box.height,
        };
        return { placement: { element: el, frame }, didOverflow: false };
      },
    };
  }

  if (el.role === "action") {
    const prefFont = clamp(innerW * 0.055, 14, 30);
    const minFont = Math.max(constraints.minTextSize, 12);
    const box = buttonBox(el.content.label, prefFont, measurer, fontFamily, constraints.minTapTarget, innerW);
    return {
      element: el,
      prefHeight: box.height,
      minHeight: Math.max(constraints.minTapTarget, box.height * 0.8),
      grow: 0,
      shrink: 0,
      place: (top, slotHeight, x0, w) => {
        const font = Math.max(minFont, prefFont);
        const b = buttonBox(el.content.label, font, measurer, fontFamily, constraints.minTapTarget, w);
        const height = clamp(b.height, constraints.minTapTarget, slotHeight);
        const frame: Rect = { x: x0, y: top, width: Math.min(b.width, w), height };
        return { placement: { element: el, frame, fontSize: font }, didOverflow: false };
      },
    };
  }

  // text: primary / secondary
  const isHeadline = el.role === "primary";
  const prefFont = el.sizing?.preferredFontSize ?? clamp(innerW * (isHeadline ? 0.11 : 0.06), 14, isHeadline ? 72 : 40);
  const minFont = Math.max(constraints.minTextSize, el.sizing?.minFontSize ?? 12);
  const prefFit = fitText(el.content.text, innerW, innerH, measurer, fontFamily, minFont, prefFont);
  const minFit = fitText(el.content.text, innerW, innerH, measurer, fontFamily, minFont, minFont);

  return {
    element: el,
    prefHeight: prefFit.height,
    minHeight: minFit.height,
    grow: 0,
    shrink: 1,
    place: (top, slotHeight, x0, w) => {
      const fit = fitText(el.content.text, w, slotHeight, measurer, fontFamily, minFont, prefFont);
      const frame: Rect = { x: x0, y: top, width: w, height: Math.min(fit.height, slotHeight) };
      return { placement: { element: el, frame, fontSize: fit.fontSize }, didOverflow: fit.overflow };
    },
  };
}
