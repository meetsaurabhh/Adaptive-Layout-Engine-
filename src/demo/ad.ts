import { defineAd } from "../engine";
import { heroSneaker, atlasLogo } from "./assets/art";

/**
 * A single, realistic product ad — a sneaker drop. Defined exactly once, with
 * no notion of where it will be shown. Every surface in the demo re-resolves
 * *this* spec; nothing about the ad changes per surface.
 *
 * Priorities and `required` flags encode the ad's intent, which is what the
 * resolver degrades against:
 *   - headline + CTA are `required` (an ad that loses either has failed),
 *   - price is priority 2 (nice to keep, first text to go),
 *   - branding is priority 3 (the first thing to drop on a cramped surface).
 */
export const sneakerAd = defineAd({
  name: "ATLAS — Drift 2 launch",
  elements: [
    {
      id: "headline",
      role: "primary",
      kind: "text",
      content: { text: "The Drift 2 lands today" },
      priority: 1,
      required: true,
      sizing: { minFontSize: 16 },
    },
    {
      id: "product",
      role: "hero",
      kind: "image",
      content: { src: heroSneaker, aspectRatio: 1.4, alt: "The Drift 2 running shoe" },
      priority: 1,
      sizing: { heroScale: 0.46 },
    },
    {
      id: "cta",
      role: "action",
      kind: "button",
      content: { label: "Get first pair", href: "https://example.com" },
      priority: 2,
      required: true,
    },
    {
      id: "price",
      role: "secondary",
      kind: "text",
      content: { text: "From $140" },
      priority: 2,
    },
    {
      id: "logo",
      role: "branding",
      kind: "image",
      content: { src: atlasLogo, aspectRatio: 3.2, alt: "ATLAS logo" },
      priority: 3,
      sizing: { minEdge: 20 },
    },
  ],
});
