import type { Rect, TemplateName } from "../types";
import { classifyTemplate } from "../geometry";
import { stackTemplate } from "./stack";
import { bandTemplate } from "./band";
import { posterTemplate } from "./poster";
import type { Template } from "./context";

const REGISTRY: Record<TemplateName, Template> = {
  stack: stackTemplate,
  band: bandTemplate,
  poster: posterTemplate,
};

/**
 * Picks the arrangement strategy for a content region. Selection is by geometry
 * alone (see {@link classifyTemplate}); adding a new template means adding an
 * entry here and a classification band — no surface ever names its template.
 */
export function selectTemplate(region: Rect): { name: TemplateName; template: Template } {
  const name = classifyTemplate(region);
  return { name, template: REGISTRY[name] };
}

export type { Template, LayoutContext, PlacedElement, LayoutAttempt } from "./context";
