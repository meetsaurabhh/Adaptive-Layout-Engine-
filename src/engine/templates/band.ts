import type { Rect } from "../types";
import { clamp } from "../geometry";
import { solveTrack, measureTrack, type FlexItem } from "../track";
import { fitText, fitImage, buttonBox } from "../sizing";
import { pick, type ElementOf, type LayoutContext, type PlacedElement, type Template } from "./context";

/**
 * BAND — wide, short surfaces (broadcast lower-third, leaderboard banners,
 * landscape mobile).
 *
 *     ┌─────────────────────────────────────────────┐
 *     │ logo │ ▓hero▓ │ Headline        │  [ CTA ]   │
 *     │      │        │ Price           │            │
 *     └─────────────────────────────────────────────┘
 *
 * Here the scarce axis is *height*, so columns flow left-to-right and the text
 * column carries `grow` to soak up horizontal slack. The band is what makes the
 * cramped-surface story work: on a 320×50 banner the column minimums don't all
 * fit, so the resolver sheds logo, then price, then the hero, until headline +
 * CTA remain — the same code that comfortably lays out a 1920×250 lower-third.
 */
export const bandTemplate: Template = (elements, ctx) => {
  const { region } = ctx;
  const pad = clamp(Math.min(region.width, region.height) * 0.06, 6, 32);
  const innerW = region.width - pad * 2;
  const ch = region.height - pad * 2;
  const gap = clamp(region.width * 0.02, 10, 40);
  const x0 = region.x + pad;
  const y0 = region.y + pad;

  // Left-to-right reading order: brand, product, message, action.
  const branding = pick(elements, "branding");
  const hero = pick(elements, "hero");
  const primary = pick(elements, "primary");
  const secondary = pick(elements, "secondary");
  const action = pick(elements, "action");

  const columns: Column[] = [];
  if (branding) columns.push(imageColumn(branding, ch, innerW));
  if (hero) columns.push(imageColumn(hero, ch, innerW));
  if (primary) columns.push(textColumn(primary, secondary, innerW, ctx));
  if (action) columns.push(buttonColumn(action, ch, innerW, ctx));

  const items: FlexItem[] = columns.map((c) => ({
    key: c.key,
    basis: c.basisW,
    min: c.minW,
    grow: c.grow,
    shrink: c.shrink,
  }));

  const fits = measureTrack(items, gap) <= innerW;
  const results = solveTrack(items, { available: innerW, gap, align: "start" });

  const placements: PlacedElement[] = [];
  let overflow = false;
  results.forEach((res, i) => {
    const colX = x0 + res.offset;
    const { placed, didOverflow } = columns[i].place(colX, res.length, y0, ch);
    placements.push(...placed);
    overflow = overflow || didOverflow;
  });

  return { placements, fits: fits && !overflow };
};

interface Column {
  key: string;
  basisW: number;
  minW: number;
  grow: number;
  shrink: number;
  place: (colX: number, colW: number, y0: number, ch: number) => {
    placed: PlacedElement[];
    didOverflow: boolean;
  };
}

/** A hero or logo, sized to the band height (hero capped to a third of width). */
function imageColumn(el: ElementOf<"hero"> | ElementOf<"branding">, ch: number, innerW: number): Column {
  const aspect = el.content.aspectRatio;
  const isHero = el.role === "hero";
  const widthCap = isHero ? innerW * 0.33 : innerW;
  const targetH = isHero ? ch : ch * 0.55;
  const box = fitImage(aspect, widthCap, targetH);

  return {
    key: el.id,
    basisW: box.width,
    minW: isHero ? box.width * 0.55 : box.width,
    grow: 0,
    shrink: isHero ? 1 : 0,
    place: (colX, colW, yTop, chh) => {
      const b = fitImage(aspect, Math.min(colW, widthCap), isHero ? chh : chh * 0.55);
      const frame: Rect = { x: colX, y: yTop + (chh - b.height) / 2, width: b.width, height: b.height };
      return { placed: [{ element: el, frame }], didOverflow: false };
    },
  };
}

/** The call-to-action, height-filling but never below the tap-target floor. */
function buttonColumn(el: ElementOf<"action">, ch: number, innerW: number, ctx: LayoutContext): Column {
  const { measurer, fontFamily, constraints } = ctx;
  const font = clamp(ch * 0.3, 12, 28);
  const box = buttonBox(el.content.label, font, measurer, fontFamily, constraints.minTapTarget, innerW);

  return {
    key: el.id,
    basisW: box.width,
    minW: box.width,
    grow: 0,
    shrink: 0,
    place: (colX, colW, yTop, chh) => {
      const height = clamp(box.height, constraints.minTapTarget, chh);
      const frame: Rect = {
        x: colX,
        y: yTop + (chh - height) / 2,
        width: Math.min(box.width, colW),
        height,
      };
      return { placed: [{ element: el, frame, fontSize: font }], didOverflow: false };
    },
  };
}

/** Headline column that also stacks the (optional) price beneath it. */
function textColumn(
  primary: ElementOf<"primary">,
  secondary: ElementOf<"secondary"> | undefined,
  innerW: number,
  ctx: LayoutContext,
): Column {
  const { measurer, fontFamily, constraints } = ctx;
  const basisW = clamp(innerW * 0.38, 120, innerW);
  const minW = clamp(innerW * 0.2, 90, innerW);

  return {
    key: primary.id,
    basisW,
    minW,
    grow: 1,
    shrink: 1,
    place: (colX, colW, yTop, chh) => {
      const placed: PlacedElement[] = [];
      let overflow = false;
      const innerGap = clamp(chh * 0.08, 2, 12);

      let secH = 0;
      let secFit: ReturnType<typeof fitText> | null = null;
      if (secondary) {
        const secMin = Math.max(constraints.minTextSize, secondary.sizing?.minFontSize ?? 12);
        const secPref = secondary.sizing?.preferredFontSize ?? clamp(chh * 0.24, secMin, 28);
        secFit = fitText(secondary.content.text, colW, chh * 0.45, measurer, fontFamily, secMin, secPref);
        secH = secFit.height;
      }

      const primMin = Math.max(constraints.minTextSize, primary.sizing?.minFontSize ?? 12);
      const primPref = primary.sizing?.preferredFontSize ?? clamp(chh * 0.5, primMin, 56);
      const primBudget = chh - secH - (secFit ? innerGap : 0);
      const primFit = fitText(primary.content.text, colW, primBudget, measurer, fontFamily, primMin, primPref);
      overflow = overflow || primFit.overflow;

      const blockH = primFit.height + (secFit ? innerGap + secH : 0);
      let cursorY = yTop + (chh - blockH) / 2;

      placed.push({
        element: primary,
        frame: { x: colX, y: cursorY, width: colW, height: primFit.height },
        fontSize: primFit.fontSize,
      });
      cursorY += primFit.height + innerGap;

      if (secondary && secFit) {
        placed.push({
          element: secondary,
          frame: { x: colX, y: cursorY, width: colW, height: secH },
          fontSize: secFit.fontSize,
        });
      }
      return { placed, didOverflow: overflow };
    },
  };
}
