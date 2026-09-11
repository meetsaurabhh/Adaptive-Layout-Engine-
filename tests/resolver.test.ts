import { describe, it, expect } from "vitest";
import { resolveLayout, defineSurface, findViolations, classifyTemplate, contentRegion } from "../src/engine";
import type { SurfaceProfile } from "../src/engine";
import { sneakerAd } from "../src/demo/ad";
import { demoSurfaces, mobilePortrait, broadcastLowerThird, retailKiosk, mobileBanner } from "../src/demo/surfaces";

function idsVisible(layout: ReturnType<typeof resolveLayout>): string[] {
  return layout.placements.filter((p) => p.visible).map((p) => p.id);
}
function isDropped(layout: ReturnType<typeof resolveLayout>, id: string): boolean {
  const p = layout.placements.find((x) => x.id === id);
  return Boolean(p && !p.visible);
}

describe("layout correctness — no overlaps or clipping", () => {
  for (const surface of demoSurfaces) {
    it(`produces no overlaps or out-of-bounds on ${surface.label}`, () => {
      const layout = resolveLayout(sneakerAd, surface);
      const violations = findViolations(layout.placements, {
        x: 0,
        y: 0,
        width: surface.width,
        height: surface.height,
      });
      expect(violations).toEqual([]);
    });
  }
});

describe("genuine per-surface adaptation", () => {
  it("selects different templates for different aspect ratios", () => {
    expect(resolveLayout(sneakerAd, mobilePortrait).template).toBe("stack");
    expect(resolveLayout(sneakerAd, broadcastLowerThird).template).toBe("band");
    expect(resolveLayout(sneakerAd, retailKiosk).template).toBe("poster");
  });

  it("places the headline at a genuinely different position across surfaces (not uniform scaling)", () => {
    const a = resolveLayout(sneakerAd, mobilePortrait).placements.find((p) => p.id === "headline")!;
    const b = resolveLayout(sneakerAd, broadcastLowerThird).placements.find((p) => p.id === "headline")!;
    // Normalise by surface size; if it were uniform scaling these would match.
    const relA = { x: a.frame.x / mobilePortrait.width, y: a.frame.y / mobilePortrait.height };
    const relB = { x: b.frame.x / broadcastLowerThird.width, y: b.frame.y / broadcastLowerThird.height };
    const moved = Math.hypot(relA.x - relB.x, relA.y - relB.y);
    expect(moved).toBeGreaterThan(0.15);
  });
});

describe("priority-based degradation", () => {
  it("drops branding before price before hero on a cramped surface", () => {
    const layout = resolveLayout(sneakerAd, mobileBanner);
    // Banner keeps only the required headline + CTA.
    expect(idsVisible(layout).sort()).toEqual(["cta", "headline"]);
    expect(isDropped(layout, "logo")).toBe(true);
    expect(isDropped(layout, "price")).toBe(true);
    expect(isDropped(layout, "product")).toBe(true);
  });

  it("never drops a required element", () => {
    for (const surface of demoSurfaces) {
      const layout = resolveLayout(sneakerAd, surface);
      expect(isDropped(layout, "headline")).toBe(false); // primary, required
      expect(isDropped(layout, "cta")).toBe(false); // action, required
    }
  });

  it("sheds in priority order as space shrinks", () => {
    // Shrink a band's height progressively and record the *onset height* at which
    // each element first disappears. Because drops are cumulative and ordered,
    // the more-important element must survive to a smaller height than the less
    // important one: onset(logo) ≥ onset(price) ≥ onset(product).
    const onset: Record<string, number> = {};
    for (let h = 320; h >= 30; h -= 5) {
      const s = defineSurface({
        id: `probe-${h}`,
        label: "probe",
        width: 900,
        height: h,
        constraints: { minTextSize: 12 },
      });
      const layout = resolveLayout(sneakerAd, s);
      for (const p of layout.placements) {
        if (!p.visible && onset[p.id] === undefined) onset[p.id] = h; // highest h where dropped
      }
    }
    expect(onset.logo).toBeGreaterThanOrEqual(onset.price);
    expect(onset.price).toBeGreaterThanOrEqual(onset.product);
    expect(onset.product).toBeGreaterThan(0); // the hero does eventually drop
    expect(onset.headline).toBeUndefined(); // required — never drops
    expect(onset.cta).toBeUndefined();
  });
});

describe("hard constraints", () => {
  it("never renders text below the surface's minimum text size", () => {
    for (const surface of demoSurfaces) {
      const min = surface.constraints.minTextSize ?? 0;
      const layout = resolveLayout(sneakerAd, surface);
      for (const p of layout.placements) {
        if (p.visible && p.elementKind === "text" && p.fontSize !== undefined) {
          expect(p.fontSize).toBeGreaterThanOrEqual(min - 0.01);
        }
      }
    }
  });

  it("keeps the CTA at or above the tap-target size on touch surfaces", () => {
    const layout = resolveLayout(sneakerAd, retailKiosk);
    const cta = layout.placements.find((p) => p.id === "cta")!;
    const min = retailKiosk.constraints.minTapTarget!;
    expect(Math.min(cta.frame.width, cta.frame.height)).toBeGreaterThanOrEqual(min - 0.01);
  });
});

describe("generalisation to unseen surfaces", () => {
  // The interview will hand over a surface the engine has never seen. Assert the
  // same code path resolves arbitrary geometries with no overlaps and a template
  // consistent with the aspect ratio.
  const randoms: Array<[number, number]> = [
    [500, 1600],
    [1600, 500],
    [900, 900],
    [1280, 400],
    [240, 240],
    [2560, 1080],
    [360, 780],
  ];

  for (const [w, h] of randoms) {
    it(`resolves an arbitrary ${w}×${h} surface cleanly`, () => {
      const s: SurfaceProfile = defineSurface({
        id: `rand-${w}x${h}`,
        label: `${w}×${h}`,
        width: w,
        height: h,
        constraints: { minTextSize: 12, minTapTarget: 44 },
      });
      const layout = resolveLayout(sneakerAd, s);
      expect(findViolations(layout.placements, { x: 0, y: 0, width: w, height: h })).toEqual([]);
      // Template matches what geometry dictates.
      expect(layout.template).toBe(classifyTemplate(contentRegion(s)));
      // The required elements always survive.
      expect(layout.placements.find((p) => p.id === "headline")!.visible).toBe(true);
      expect(layout.placements.find((p) => p.id === "cta")!.visible).toBe(true);
    });
  }
});
