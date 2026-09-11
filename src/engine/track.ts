/**
 * A one-dimensional flex solver, written from scratch.
 *
 * Every template arranges elements along a main axis (a column for `stack`, a
 * row for `band`, nested tracks for `poster`). Rather than hand-place pixels in
 * each template, they all describe their children as flex items and hand them to
 * this solver, which distributes free space or absorbs overflow exactly the way
 * CSS flexbox does — grow to fill, shrink toward min, never below min.
 *
 * Keeping this as the single placement primitive is what makes the layouts
 * *computed* rather than hardcoded: change the region or the item set and the
 * positions fall out of the same arithmetic.
 */

export interface FlexItem {
  /** Opaque tag so callers can map results back to their elements. */
  key: string;
  /** Preferred main-axis length before growing/shrinking. */
  basis: number;
  /** Never shrink below this. */
  min: number;
  /** Never grow beyond this. */
  max?: number;
  /** Share of free space this item claims (0 = fixed at basis). */
  grow?: number;
  /** Willingness to give up length under overflow (0 = rigid). */
  shrink?: number;
}

export interface TrackResult {
  key: string;
  /** Offset from the start of the track (before adding the track's own origin). */
  offset: number;
  /** Resolved main-axis length. */
  length: number;
}

export type Align = "start" | "center" | "end" | "space-between";

export interface TrackOptions {
  available: number;
  gap?: number;
  align?: Align;
}

/**
 * Resolves item lengths along a track of length `available`, then positions them
 * according to `align`. Returns one result per item, in input order.
 *
 * Overflow contract: the solver shrinks shrinkable items toward their minimums,
 * but it will *not* clip. If even the minimums don't fit, it reports the true
 * (overflowing) length via {@link measureTrack} so the resolver can drop an
 * element and retry — clipping is never this layer's decision.
 */
export function solveTrack(items: FlexItem[], opts: TrackOptions): TrackResult[] {
  const gap = opts.gap ?? 0;
  const totalGap = gap * Math.max(0, items.length - 1);
  const basisSum = items.reduce((s, it) => s + it.basis, 0);
  const free = opts.available - totalGap - basisSum;

  const lengths = items.map((it) => it.basis);

  if (free > 0) {
    distributeGrow(items, lengths, free);
  } else if (free < 0) {
    absorbShrink(items, lengths, -free);
  }

  return position(items, lengths, gap, opts.available, opts.align ?? "start");
}

/** Total main-axis length the items need at their minimums, including gaps. */
export function measureTrack(items: FlexItem[], gap = 0): number {
  const totalGap = gap * Math.max(0, items.length - 1);
  return items.reduce((s, it) => s + it.min, 0) + totalGap;
}

function distributeGrow(items: FlexItem[], lengths: number[], free: number): void {
  // Iterative distribution: hand out free space by grow weight, but clamp any
  // item that hits its max and redistribute the remainder to the rest.
  let remaining = free;
  const frozen = new Array(items.length).fill(false);

  for (let guard = 0; guard < items.length && remaining > 0.01; guard++) {
    const growSum = items.reduce((s, it, i) => (frozen[i] ? s : s + (it.grow ?? 0)), 0);
    if (growSum <= 0) break;

    let distributedThisPass = 0;
    for (let i = 0; i < items.length; i++) {
      if (frozen[i]) continue;
      const grow = items[i].grow ?? 0;
      if (grow === 0) {
        frozen[i] = true;
        continue;
      }
      const add = (remaining * grow) / growSum;
      const max = items[i].max ?? Infinity;
      const next = Math.min(lengths[i] + add, max);
      distributedThisPass += next - lengths[i];
      if (next >= max) frozen[i] = true;
      lengths[i] = next;
    }
    remaining -= distributedThisPass;
    if (distributedThisPass < 0.01) break;
  }
}

function absorbShrink(items: FlexItem[], lengths: number[], overflow: number): void {
  // Shrink by shrink-weighted basis (flexbox's scaled-shrink), never past min.
  let remaining = overflow;
  const frozen = new Array(items.length).fill(false);

  for (let guard = 0; guard < items.length && remaining > 0.01; guard++) {
    const weightSum = items.reduce(
      (s, it, i) => (frozen[i] ? s : s + (it.shrink ?? 0) * it.basis),
      0,
    );
    if (weightSum <= 0) break;

    let absorbedThisPass = 0;
    for (let i = 0; i < items.length; i++) {
      if (frozen[i]) continue;
      const weight = (items[i].shrink ?? 0) * items[i].basis;
      if (weight === 0) {
        frozen[i] = true;
        continue;
      }
      const take = (remaining * weight) / weightSum;
      const next = Math.max(lengths[i] - take, items[i].min);
      absorbedThisPass += lengths[i] - next;
      if (next <= items[i].min) frozen[i] = true;
      lengths[i] = next;
    }
    remaining -= absorbedThisPass;
    if (absorbedThisPass < 0.01) break;
  }
}

function position(
  items: FlexItem[],
  lengths: number[],
  gap: number,
  available: number,
  align: Align,
): TrackResult[] {
  const used = lengths.reduce((s, l) => s + l, 0) + gap * Math.max(0, items.length - 1);
  const slack = Math.max(0, available - used);

  let cursor = 0;
  let between = gap;
  if (align === "center") cursor = slack / 2;
  else if (align === "end") cursor = slack;
  else if (align === "space-between" && items.length > 1) between = gap + slack / (items.length - 1);

  const out: TrackResult[] = [];
  for (let i = 0; i < items.length; i++) {
    out.push({ key: items[i].key, offset: cursor, length: lengths[i] });
    cursor += lengths[i] + between;
  }
  return out;
}
