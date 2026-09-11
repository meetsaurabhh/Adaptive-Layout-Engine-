import { resolveLayout } from "../src/engine";
import { sneakerAd } from "../src/demo/ad";
import { demoSurfaces } from "../src/demo/surfaces";

for (const surface of demoSurfaces) {
  const layout = resolveLayout(sneakerAd, surface);
  console.log(`\n=== ${surface.label} (${surface.width}×${surface.height}) → ${layout.template} ===`);
  for (const p of layout.placements) {
    if (p.visible) {
      const f = p.frame;
      const fs = p.fontSize ? ` font=${p.fontSize}` : "";
      console.log(
        `  ${p.id.padEnd(9)} ${p.status.kind.padEnd(7)} ` +
          `x=${Math.round(f.x)} y=${Math.round(f.y)} w=${Math.round(f.width)} h=${Math.round(f.height)}${fs}`,
      );
    } else {
      console.log(`  ${p.id.padEnd(9)} DROPPED (${p.status.kind === "dropped" ? p.status.reason : ""})`);
    }
  }
}
