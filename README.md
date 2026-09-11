# Adaptive Layout Engine for Multi-Surface Ads

One declarative ad spec, resolved into a **genuinely different** layout for every surface it's poured into — a tall phone, a wide broadcast lower-third, a square kiosk, a tiny banner — by a constraint-based resolver, not per-surface branches or CSS breakpoints.

The core claim this project makes, and backs up: **the same code path produces every layout.** There is no `if (surface === "mobile")` anywhere. Hand the engine a surface it has never seen and it resolves it by the same four phases as the built-in ones — you can prove this yourself in the demo by inventing a surface live.

---

## Setup

Requires Node 18+.

```bash
npm install
npm run dev      # start the demo (Vite prints a local URL, usually http://localhost:5173)
```

Other scripts:

```bash
npm run build      # type-check the whole project and produce a production bundle
npm run test       # run the resolver test suite (19 tests, headless)
npm run typecheck  # tsc --noEmit only
```

---

## Using the demo

The demo is a small **layout inspector**, deliberately — it doesn't just show the ad, it shows the engine _thinking_.

- **Switch surfaces** with the list on the left. The same `sneakerAd` spec re-resolves and the artboard **morphs** into its new arrangement (elements glide to new positions; dropped ones fade out).
- **Watch the Resolution trace** on the right. Every switch prints the actual decisions: the usable region after safe-area, which template the aspect ratio selected, every element the resolver had to drop and why, and a final no-overlap verification. This is the anti-hardcoding receipt.
- **Inspect each element.** The Elements panel shows every element's status (`placed` / `shrunk` / `dropped`) and its resolved frame + font size in pixels.
- **Add a surface it has never seen.** The "Add a surface" form lets you type any width/height and constraints (min text size, min tap target, touch-only, far-viewing) and resolve it live. This is the "unknown 5th surface" case from the brief — no code changes, it just resolves.
- **Toggle DOM / Canvas.** The same resolved layout is drawn by two completely independent renderers, to show the resolver output is renderer-agnostic.

### The five built-in surfaces

| Surface                 | Size      | What it demonstrates                                                                                 |
| ----------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| Mobile portrait         | 390×844   | `stack` — vertical composition, even rhythm                                                          |
| Mobile landscape        | 844×390   | `band` — horizontal composition; logo drops (branding is lowest priority)                            |
| Broadcast lower-third   | 1920×250  | `band` at far viewing distance; price pinned at its 32px legibility floor (`shrunk`)                 |
| Retail kiosk            | 1080×1080 | `poster` — 2D composition, large hero, price + CTA share a row; tap targets ≥ 60px                   |
| Mobile banner (cramped) | 320×50    | **degradation showcase** — can't hold five elements, sheds logo → price → hero, keeps headline + CTA |

---

## Layout algorithm

The resolver (`src/engine/resolver.ts`) runs **four phases**. None of them look at the surface's identity; they read only its geometry and constraints.

```
Ad Spec + Surface Profile
        │
        ▼
  ①  Region      strip safe-area insets → usable rectangle
        │
        ▼
  ②  Template    classify by aspect ratio → stack | band | poster
        │
        ▼
  ③  Degrade     place everything; if it doesn't fit, drop the
        │        lowest-priority droppable element and retry
        ▼
  ④  Emit        typed Placements (absolute px) + verify no overlaps
        │
        ▼
   Resolved Layout ──► Renderer (DOM or Canvas)
```

### ① Region

Safe-area insets (notch, broadcast title-safe, print bleed) are subtracted from the raw surface to get the rectangle content is actually allowed to occupy. Everything downstream works inside this region.

### ② Template selection — the key to generalisation

Instead of matching a surface _name_, the engine classifies the region by **aspect ratio**, a continuous input, into one of three arrangement strategies (`src/engine/geometry.ts`):

- **aspect ≥ 1.8** → `band` — wide and short. The scarce axis is height, so elements flow **left-to-right**: `logo | hero | headline+price | CTA`.
- **aspect ≤ 0.8** → `stack` — tall and narrow. Elements flow **top-to-bottom** with slack distributed as even vertical spacing.
- **otherwise** → `poster` — squarish. No dominant axis, so it composes in **2D**: a vertical track of rows with the hero row growing to fill, and price + CTA nested in a horizontal sub-track.

Because the boundary is a number, not a lookup, any surface lands in a sensible template — including one invented at interview time. A 2560×1080 ultrawide is a `band`; a 500×1600 pillar is a `stack`; a 900×900 tile is a `poster`.

Each template is built on shared primitives, not bespoke code: a **from-scratch flexbox-style 1-D track solver** (`src/engine/track.ts`) that handles grow / shrink / min-size / gap / alignment, and a **text-measurement-aware font fitter** (`src/engine/sizing.ts` + `measure.ts`) that picks the largest font size whose _measured_ wrapped height fits the box. In the browser that measurement is real Canvas `measureText`; in Node it's a deterministic estimator injected in its place — same code, swappable measurer.

### ③ Priority and degradation

Every element carries a `priority` (1 = most important) and may be `required`. When a template reports that the content **doesn't fit** (main-axis minimums overflow, or text can't fit its box at the legibility floor), the resolver sheds one element and retries:

1. Compute the **drop order** once (`src/engine/degrade.ts`): sort droppable elements by priority descending (least important first), with a stable role tiebreak (`branding → secondary → hero → action → primary`) for equal priorities.
2. Place all elements. If it fits, done.
3. If not, drop the **first** element in the drop order, and re-run the _same_ template with the smaller set.
4. Repeat until it fits or only `required` elements remain (which are then compressed to their minimums rather than dropped).

So on the 320×50 banner the order is precisely: drop `logo` (priority 3) → still doesn't fit → drop `price` (priority 2) → still tight → drop `hero` (priority 1, droppable) → headline + CTA remain and fit. The headline (`primary`) and CTA (`action`) are `required`, so they're never dropped — exactly the brief's expectation that branding disappears cleanly while headline/CTA stay intact.

Two invariants are enforced, not hoped for:

- **Hard constraints are floors, never crossed.** Text is never rendered below `minTextSize`; a tappable target on a touch surface is never smaller than `minTapTarget`. If honouring the floor means an element can't fit, it's dropped — never quietly shrunk past the floor.
- **No overlaps or clipping, ever.** After emitting placements, an independent pass (`src/engine/validate.ts`) checks every pair for overlap and every frame against the surface bounds. The test suite asserts zero violations across the built-in surfaces and a batch of arbitrary random ones.

### ④ Emit

The surviving placement becomes a list of typed `Placement`s — absolute pixel frames plus resolved font sizes and a `placed` / `shrunk` / `dropped` status per element. Dropped elements are marked invisible (kept in the list so a renderer can animate them). A renderer consumes this and nothing else.

---

## TypeScript design

The type system is used to make invalid specs and surfaces **hard to construct**, and to give the renderer output it can consume without guessing.

**Role locks kind locks content.** A `Role` (`primary`, `hero`, `action`, `secondary`, `branding`) is mapped to exactly one element kind, and each kind to exactly one content shape:

```ts
interface RoleKind {
  hero: "image";
  primary: "text";
  action: "button"; /* … */
}
interface KindContent {
  image: { src: string; aspectRatio: number; alt: string }; /* … */
}
```

`AdElement` is then a distributive mapped type over `Role`, producing a discriminated union where `role` narrows both `kind` and `content`. The practical effect:

- `{ role: "hero", kind: "text", … }` is a **compile error** — a hero is always an image.
- Inside a template, `pick(elements, "hero")` returns a value whose `content.aspectRatio` is available with no casts or guards, because the role guarantees the shape.

**Validated, branded outputs.** `defineAd` and `defineSurface` return `AdSpec` / `SurfaceProfile` types carrying a private brand, so a raw object literal can't masquerade as a validated spec. They also enforce semantic rules at the boundary and throw a clear, typed error (`SpecError` / `SurfaceError`) otherwise: unique element ids, exactly one of each singleton role, a `primary` must exist; positive dimensions, insets that leave a usable region, `touchOnly` requires a `minTapTarget`. Invalid combinations are reported where they're introduced, not deep in the resolver.

**Surfaces carry no layout.** A `SurfaceProfile` has geometry and constraints but no "layout" field and no name the resolver switches on — the type itself makes hardcoding-by-surface impossible to express.

**The resolved layout is self-describing.** `ResolvedLayout` gives the renderer absolute frames, font sizes, and per-element status — everything it needs and nothing about _how_ the layout was decided.

---

## Architecture at a glance

```
src/
├── engine/                 ← framework-agnostic, plain TypeScript
│   ├── types.ts            role→kind→content locking, branded spec/surface, ResolvedLayout
│   ├── spec.ts             defineAd + validation (SpecError)
│   ├── surfaces.ts         defineSurface + validation (SurfaceError)
│   ├── geometry.ts         safe-area region, aspect→template classification, constraint lifting
│   ├── measure.ts          injectable TextMeasurer (Canvas in browser, estimator in Node)
│   ├── track.ts            from-scratch 1-D flex track solver (grow/shrink/min/gap/align)
│   ├── sizing.ts           measurement-aware font fitting, image contain, button box
│   ├── templates/          stack | band | poster — all built on the shared primitives
│   ├── degrade.ts          priority-ordered drop order
│   ├── validate.ts         overlap + out-of-bounds verification
│   └── resolver.ts         the four-phase orchestration
├── render/
│   ├── render-dom.tsx      React/DOM renderer (with morph transitions)
│   └── render-canvas.ts    Canvas renderer — same ResolvedLayout, zero resolver changes
└── demo/
    ├── ad.ts               the single sneakerAd spec
    ├── surfaces.ts         the five demo surfaces
    └── App.tsx             the inspector UI
```

The dependency arrow is strictly one-directional: `spec → resolver → layout → renderer`. See **ARCHITECTURE.md** for how a new surface or a new renderer slots in without touching the resolution algorithm.

> Note: the brief's example structure lists `spec.ts`, `surfaces.ts`, `resolver.ts`, `render-dom.ts`, `App.tsx` flat under `src/`. They're all here, grouped into `engine/`, `render/`, and `demo/` to make the separation-of-concerns boundary explicit — which is one of the things being evaluated.

---

## Known limitations

- **Fixed element-type set.** Five roles (headline, hero, price, CTA, logo). Adding a new _kind_ of element means extending the role→kind→content map; adding a new _element of an existing role_ is just spec data. The brief explicitly prefers a small spec that adapts correctly over a large type library, so this was a deliberate scope choice.
- **Greedy, single-pass degradation.** The engine drops one element at a time in priority order and re-runs the template. It doesn't backtrack or explore "what if I shrank the hero instead of dropping the logo" trade-offs — priority order is the whole policy, which keeps degradation predictable and explainable (the thing the brief asks to be able to defend).
- **Line-based text wrapping.** Wrapping is greedy word-by-word using measured widths; it doesn't do hyphenation, kerning-aware justification, or balanced ragged lines.
- **No per-element rotation or free-form anchoring.** Templates compose along tracks; there's no absolute "pin this to the corner" escape hatch (by design, that's where hardcoding creeps in).
- **Morph animation is best-effort.** Elements transition by CSS on frame changes; a dropped-then-re-added element animates from its new position rather than its old one.

---

## Time spent

Roughly **three days** of focused work: about half a day on the type model and validation, a day and a half on the resolver, track solver, and three templates (most of it tuning degradation and the fit/overflow logic so surfaces recompose rather than uniformly scale), and the remainder on the two renderers, the inspector demo, and these docs.

---

## AI tools disclosure

Per the brief's FAQ: I used an AI assistant (Claude) as a pair-programmer while building this for talking through the template-selection and degradation design, drafting boilerplate, and speeding up the demo UI and documentation. I reviewed and understand every line; the algorithm design (aspect-ratio template selection, priority-ordered greedy degradation with a required floor, the injectable measurer, the shared track solver) is the core of the submission and I can walk through and defend any part of it, extend it to a new surface live, and explain why any given element ended up where it did.
