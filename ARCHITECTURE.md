# Architecture

This document explains *how the pieces fit* and, more importantly, *how they stay decoupled* — because the two things the brief evaluates hardest are the resolution algorithm and clean separation of concerns.

The whole system is one directed pipeline with a single rule: **dependencies only ever point downstream.**

```
   AdSpec ────────┐
                  ├──►  Resolver  ──►  ResolvedLayout  ──►  Renderer
   SurfaceProfile ┘        (pure)         (plain data)      (DOM | Canvas)
```

- The **spec** doesn't know surfaces exist.
- The **surface** doesn't know the ad's content.
- The **resolver** knows both but is a pure function — no DOM, no framework, no I/O.
- The **renderer** knows only the `ResolvedLayout` — never the spec, never the surface, never the algorithm.

Everything below follows from that one rule.

---

## The four stages, and where each lives

| Stage | Module | Responsibility | Knows about |
|---|---|---|---|
| Author | `spec.ts`, `surfaces.ts` | Validate & brand inputs | Content / geometry respectively |
| ① Region | `geometry.ts` (`contentRegion`, `effectiveConstraints`) | Usable rect after safe-area; lift minimums for far viewing | Surface only |
| ② Template | `geometry.ts` (`classifyTemplate`) + `templates/` | Pick an arrangement by aspect ratio; compose it | Region + constraints |
| ③ Degrade | `resolver.ts` + `degrade.ts` | Fit-or-shed loop in priority order | Spec + template result |
| ④ Emit | `resolver.ts` + `validate.ts` | Typed placements; verify no overlap/clip | Placements only |

`resolver.ts` is the only module that imports across the whole engine; every other module is a self-contained unit it composes. That's deliberate — the orchestration lives in exactly one readable place.

---

## Shared primitives (why templates aren't bespoke)

The three templates could each be hand-rolled pixel math. They aren't. They're thin arrangements over four shared, separately-tested primitives, which is what keeps them consistent and short:

- **`track.ts` — a 1-D flex solver.** Given items with `basis / min / grow / shrink` and a gap + alignment, it distributes a length exactly like a single flexbox row/column would (grow shares free space; shrink absorbs deficits weighted by basis, respecting per-item minimums). `stack` runs it vertically; `band` runs it horizontally; `poster` runs it vertically for rows and again horizontally for the price+CTA sub-row.
- **`measure.ts` — an injected `TextMeasurer`.** Text width is *measured*, not guessed. The browser passes a Canvas-backed measurer; Node/tests pass a deterministic estimator. Neither the templates nor the resolver know which one they got.
- **`sizing.ts` — fitters.** `fitText` binary-walks font sizes to the largest whose measured wrapped height fits a box (and flags overflow); `fitImage` does aspect-preserving contain; `buttonBox` sizes a tap target around a label with a floor.
- **`validate.ts` — the referee.** Overlap + bounds checks used both to self-verify every resolve and directly by the test suite.

A template's whole job is to declare *which* elements go into *which* track with *what* grow/shrink intent. The primitives do the arithmetic.

---

## Extensibility — the two "add without touching the resolver" cases

These are the scenarios the brief calls out, and the architecture is shaped around passing them.

### Adding a surface (including one invented at interview time)

A surface is pure data validated by `defineSurface`:

```ts
export const ultrawide = defineSurface({
  id: "ultrawide", label: "Ultrawide", width: 2560, height: 1080,
  constraints: { minTextSize: 18 },
});
resolveLayout(sneakerAd, ultrawide);   // just works
```

**No resolver change, no template change, no new branch.** The resolver derives the region, `classifyTemplate` maps aspect 2.37 to `band`, the band template composes it. This is exactly what the demo's "Add a surface" form exercises at runtime — the unknown-5th-surface bonus is not a special code path, it's the *only* code path.

The reason this holds: the resolver keys off `width / height / constraints`, never off `surface.id` or `surface.label`. There is no lookup table from surface to layout to fall out of date. Adding surfaces is strictly additive.

### Adding a renderer

`render-canvas.ts` was written *after* `render-dom.tsx` specifically to prove the boundary. It consumes the identical `ResolvedLayout`:

```ts
const layout = resolveLayout(spec, surface);   // unchanged
renderToCanvas(canvas, layout, imageCache, scale);  // new backend, zero resolver edits
```

Because a `Placement` is just `{ frame, fontSize, content, status, visible }`, any backend that can draw a box and some text can be a renderer — React, Canvas, an SVG string emitter, a PDF writer. None of them can reach back into the algorithm, so none of them can perturb it. The DOM/Canvas toggle in the demo is the visible proof: two renderers, one resolver output, pixel-for-pixel the same composition.

### Adding a template

Selection is a registry keyed by the classifier (`templates/index.ts`). A fourth strategy — say a `strip` for absurdly wide ticker surfaces — means writing one `Template` function over the shared primitives and adding one classifier branch. The resolver's degrade/emit loop is untouched because it treats a template as a black box with a `{ placements, fits }` contract.

---

## Degradation as policy, not special-casing

Degradation deserves its own note because it's where ad-hoc `if` statements usually breed. Here it's a single mechanism:

```
dropOrder = droppable elements sorted by (priority desc, role tiebreak)
attempt   = template(all elements)
while attempt doesn't fit and something is still droppable:
    drop the next element in dropOrder
    attempt = template(remaining elements)
```

- **One policy, all surfaces.** The banner, the lower-third, and an unseen surface all use this identical loop. A surface never gets custom drop rules.
- **`fits` is the template's honest verdict.** A template returns `fits: false` when its main-axis minimums overflow the region *or* when text can't fit its box without dropping below the legibility floor. The resolver never second-guesses it; it just sheds and retries.
- **Required is a hard boundary.** `required` elements are excluded from `dropOrder` entirely, so the loop can never remove the headline or CTA — it exhausts the droppable set and then lets them compress to their minimums.
- **Explainable by construction.** Because the order is precomputed and deterministic, the trace can state exactly which element left and why, and you can predict the outcome for any surface by hand. That's the property the live interview is testing.

---

## Data-flow summary

```
defineAd(spec)            defineSurface(profile)
      │                          │
      └───────────┬──────────────┘
                  ▼
           resolveLayout()
                  │
     ┌────────────┼───────────────────────────┐
     │ ① contentRegion(surface)                │  geometry.ts
     │ ② classifyTemplate(region) → template   │  geometry.ts + templates/
     │ ③ while !fits: drop(dropOrder[n])        │  resolver.ts + degrade.ts
     │ ④ buildPlacements + findViolations       │  resolver.ts + validate.ts
     └────────────┬───────────────────────────┘
                  ▼
           ResolvedLayout                         (plain, serialisable data)
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
  SurfaceStage (DOM)   renderToCanvas (Canvas)     render/
```

The `ResolvedLayout` in the middle is the contract that makes the whole thing modular: everything to its left is "decide", everything to its right is "draw", and neither side can see across it.
