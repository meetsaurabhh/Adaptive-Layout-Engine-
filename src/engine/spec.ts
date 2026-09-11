import type { AdElement, AdSpec, Role } from "./types";

/**
 * Builds a validated {@link AdSpec} from a flat element list.
 *
 * The element *types* are already guaranteed by TypeScript (role locks kind,
 * kind locks content). What the compiler can't see are cross-element invariants
 * — duplicate ids, an empty spec, a missing headline — so those are checked here
 * and reported as loud, specific errors rather than surfacing later as a
 * mis-drawn ad. Invalid input never becomes a silent bad layout.
 */
export function defineAd(input: { name: string; elements: AdElement[] }): AdSpec {
  const { name, elements } = input;

  if (elements.length === 0) {
    throw new SpecError("An ad spec must declare at least one element.");
  }

  const seen = new Set<string>();
  for (const el of elements) {
    if (seen.has(el.id)) {
      throw new SpecError(`Duplicate element id "${el.id}". Every element id must be unique.`);
    }
    seen.add(el.id);
  }

  // A headline is the one element every ad is assumed to carry — the resolver
  // treats "primary" as the anchor everything else arranges around.
  const hasPrimary = elements.some((el) => el.role === "primary");
  if (!hasPrimary) {
    throw new SpecError('An ad spec must include exactly one element with role "primary" (the headline).');
  }

  assertAtMostOne(elements, "primary");
  assertAtMostOne(elements, "hero");
  assertAtMostOne(elements, "action");
  assertAtMostOne(elements, "branding");

  return {
    __brand: "AdSpec",
    name,
    elements: Object.freeze([...elements]),
  };
}

function assertAtMostOne(elements: AdElement[], role: Role): void {
  const count = elements.filter((el) => el.role === role).length;
  if (count > 1) {
    throw new SpecError(`Role "${role}" may appear at most once, found ${count}.`);
  }
}

export class SpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpecError";
  }
}
