import { defineSurface } from "../engine";

/**
 * The demo's surface set. The first four are the assignment's required profiles;
 * the leaderboard is the deliberately-cramped one that can't hold every element,
 * so it exercises priority degradation. None of them tells the engine how to lay
 * itself out — each is pure geometry + constraints.
 */

export const mobilePortrait = defineSurface({
  id: "mobile-portrait",
  label: "Mobile portrait",
  width: 390,
  height: 844,
  safeArea: { top: 47, bottom: 34, left: 0, right: 0 }, // notch + home indicator
  constraints: { touchOnly: true, minTapTarget: 44, minTextSize: 12, viewingDistance: "near" },
});

export const mobileLandscape = defineSurface({
  id: "mobile-landscape",
  label: "Mobile landscape",
  width: 844,
  height: 390,
  safeArea: { top: 0, bottom: 21, left: 47, right: 47 },
  constraints: { touchOnly: true, minTapTarget: 44, minTextSize: 12, viewingDistance: "near" },
});

export const broadcastLowerThird = defineSurface({
  id: "broadcast-lower-third",
  label: "Broadcast lower-third",
  width: 1920,
  height: 250,
  safeArea: { top: 16, bottom: 16, left: 96, right: 96 }, // title-safe margins
  constraints: { minTextSize: 32, viewingDistance: "far" },
});

export const retailKiosk = defineSurface({
  id: "retail-kiosk",
  label: "Retail kiosk",
  width: 1080,
  height: 1080,
  safeArea: { top: 24, bottom: 24, left: 24, right: 24 },
  constraints: { touchOnly: true, minTapTarget: 60, minTextSize: 18, viewingDistance: "near" },
});

// The deliberately-cramped surface. A 320×50 mobile banner is the classic ad
// unit that simply can't hold five elements — it's here to show the degradation
// order in action: logo goes, then price, leaving the headline and CTA intact.
export const mobileBanner = defineSurface({
  id: "mobile-banner",
  label: "Mobile banner (cramped)",
  width: 320,
  height: 50,
  safeArea: { top: 4, bottom: 4, left: 6, right: 6 },
  constraints: { touchOnly: true, minTapTarget: 36, minTextSize: 11, viewingDistance: "near" },
});

export const demoSurfaces = [
  mobilePortrait,
  mobileLandscape,
  broadcastLowerThird,
  retailKiosk,
  mobileBanner,
];
