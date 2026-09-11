import type { Rect } from "../types";
import { clamp } from "../geometry";
import { solveTrack, measureTrack, type FlexItem } from "../track";
import { fitText, fitImage, buttonBox } from "../sizing";
import { pick, type ElementOf, type LayoutContext, type PlacedElement, type Template } from "./context";

/**
 * POSTER — balanced / square surfaces (retail kiosk, social).
 *
 *     ┌────────────────┐
 *     │ logo           │  ← branding row (drops first under pressure)
 *     │  ▓▓▓▓▓▓▓▓▓▓▓▓  │
 *     │  ▓▓▓ hero ▓▓▓  │  ← image row, grows to fill
 *     │  ▓▓▓▓▓▓▓▓▓▓▓▓  │
 *     │  Headline       │
 *     │  Price   [CTA]  │  ← price + CTA share one row
 *     └────────────────┘
 *
 * A square gives no obvious main axis, so poster composes in two dimensions: a
 * vertical track of rows, with the hero row growing to claim leftover height,
 * and a nested horizontal track pairing price with the CTA. That 2D recomposition
 * — not a scaled phone layout — is what makes the kiosk visibly its own thing.
 */
export const posterTemplate: Template = (elements, ctx) => {
  const { region } = ctx;
  const pad = clamp(Math.min(region.width, region.height) * 0.07, 16, 64);
  const innerW = region.width - pad * 2;
  const innerH = region.height - pad * 2;
  const gap = clamp(region.height * 0.03, 10, 36);
  const x0 = region.x + pad;
  const y0 = region.y + pad;

  const branding = pick(elements, "branding");
  const hero = pick(elements, "hero");
  const primary = pick(elements, "primary");
  const secondary = pick(elements, "secondary");
  const action = pick(elements, "action");

  const rows: Row[] = [];
  if (branding) rows.push(brandingRow(branding, innerH));
  if (hero) rows.push(heroRow(hero, innerH));
  if (primary) rows.push(textRow(primary, innerW, innerH, ctx));
  if (secondary || action) rows.push(actionRow(secondary, action, innerW, ctx));

  const items: FlexItem[] = rows.map((r) => ({
    key: r.key,
    basis: r.basisH,
    min: r.minH,
    grow: r.grow,
    shrink: r.shrink,
  }));

  const fits = measureTrack(items, gap) <= innerH;
  const results = solveTrack(items, { available: innerH, gap, align: "start" });

  const placements: PlacedElement[] = [];
  let overflow = false;
  results.forEach((res, i) => {
    const rowY = y0 + res.offset;
    const { placed, didOverflow } = rows[i].place(x0, innerW, rowY, res.length);
    placements.push(...placed);
    overflow = overflow || didOverflow;
  });

  return { placements, fits: fits && !overflow };
};

interface Row {
  key: string;
  basisH: number;
  minH: number;
  grow: number;
  shrink: number;
  place: (x0: number, innerW: number, rowY: number, rowH: number) => {
    placed: PlacedElement[];
    didOverflow: boolean;
  };
}

function brandingRow(el: ElementOf<"branding">, innerH: number): Row {
  const aspect = el.content.aspectRatio;
  const targetH = clamp(innerH * 0.09, el.sizing?.minEdge ?? 22, innerH * 0.13);
  return {
    key: el.id,
    basisH: targetH,
    minH: targetH * 0.8,
    grow: 0,
    shrink: 0,
    place: (x0, w, rowY, rowH) => {
      const box = fitImage(aspect, w * 0.4, rowH);
      const frame: Rect = { x: x0, y: rowY, width: box.width, height: box.height };
      return { placed: [{ element: el, frame }], didOverflow: false };
    },
  };
}

function heroRow(el: ElementOf<"hero">, innerH: number): Row {
  const aspect = el.content.aspectRatio;
  return {
    key: el.id,
    basisH: innerH * 0.46,
    minH: innerH * 0.24,
    grow: 1,
    shrink: 1,
    place: (x0, w, rowY, rowH) => {
      const box = fitImage(aspect, w, rowH);
      const frame: Rect = {
        x: x0 + (w - box.width) / 2,
        y: rowY + (rowH - box.height) / 2,
        width: box.width,
        height: box.height,
      };
      return { placed: [{ element: el, frame }], didOverflow: false };
    },
  };
}

function textRow(el: ElementOf<"primary">, innerW: number, innerH: number, ctx: LayoutContext): Row {
  const { measurer, fontFamily, constraints } = ctx;
  const minFont = Math.max(constraints.minTextSize, el.sizing?.minFontSize ?? 14);
  const prefFont = el.sizing?.preferredFontSize ?? clamp(innerW * 0.09, minFont, 64);
  const prefFit = fitText(el.content.text, innerW, innerH, measurer, fontFamily, minFont, prefFont);
  const minFit = fitText(el.content.text, innerW, innerH, measurer, fontFamily, minFont, minFont);
  return {
    key: el.id,
    basisH: prefFit.height,
    minH: minFit.height,
    grow: 0,
    shrink: 1,
    place: (x0, w, rowY, rowH) => {
      const fit = fitText(el.content.text, w, rowH, measurer, fontFamily, minFont, prefFont);
      const frame: Rect = { x: x0, y: rowY, width: w, height: Math.min(fit.height, rowH) };
      return { placed: [{ element: el, frame, fontSize: fit.fontSize }], didOverflow: fit.overflow };
    },
  };
}

/** Price (left, grows) and CTA (right, fixed) sharing a horizontal sub-track. */
function actionRow(
  secondary: ElementOf<"secondary"> | undefined,
  action: ElementOf<"action"> | undefined,
  innerW: number,
  ctx: LayoutContext,
): Row {
  const { measurer, fontFamily, constraints } = ctx;
  const btnFont = clamp(innerW * 0.045, 14, 28);
  const btnBox = action
    ? buttonBox(action.content.label, btnFont, measurer, fontFamily, constraints.minTapTarget, innerW)
    : null;
  const secFont = clamp(innerW * 0.05, Math.max(constraints.minTextSize, 12), 32);
  const rowH = Math.max(btnBox?.height ?? 0, secFont * 1.5, constraints.minTapTarget);
  const anchorId = action?.id ?? secondary?.id ?? "action-row";

  return {
    key: anchorId,
    basisH: rowH,
    minH: rowH,
    grow: 0,
    shrink: 0,
    place: (x0, w, rowY, rowHeight) => {
      const placed: PlacedElement[] = [];
      const subItems: FlexItem[] = [];
      if (secondary) subItems.push({ key: secondary.id, basis: w * 0.4, min: 60, grow: 1, shrink: 1 });
      if (action && btnBox) subItems.push({ key: action.id, basis: btnBox.width, min: btnBox.width, grow: 0, shrink: 0 });

      const gap = clamp(w * 0.03, 8, 32);
      const results = solveTrack(subItems, { available: w, gap, align: subItems.length > 1 ? "space-between" : "end" });

      results.forEach((res) => {
        const cellX = x0 + res.offset;
        if (secondary && res.key === secondary.id) {
          const fit = fitText(
            secondary.content.text,
            res.length,
            rowHeight,
            measurer,
            fontFamily,
            Math.max(constraints.minTextSize, 12),
            secFont,
          );
          placed.push({
            element: secondary,
            frame: { x: cellX, y: rowY + (rowHeight - fit.height) / 2, width: res.length, height: fit.height },
            fontSize: fit.fontSize,
          });
        } else if (action && btnBox) {
          const height = clamp(btnBox.height, constraints.minTapTarget, rowHeight);
          placed.push({
            element: action,
            frame: {
              x: cellX + (res.length - btnBox.width),
              y: rowY + (rowHeight - height) / 2,
              width: btnBox.width,
              height,
            },
            fontSize: btnFont,
          });
        }
      });
      return { placed, didOverflow: false };
    },
  };
}
