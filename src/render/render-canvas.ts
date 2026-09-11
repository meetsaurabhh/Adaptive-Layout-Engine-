import type { Placement, ResolvedLayout } from "../engine";

/**
 * Canvas renderer.
 *
 * This exists to make the architecture claim testable rather than aspirational:
 * it consumes the exact same {@link ResolvedLayout} the DOM renderer does, and
 * the resolver has no idea it exists. Adding a rendering backend is purely
 * additive — no line of resolution logic changes to support it.
 */

const FONT_STACK = "'Space Grotesk', 'Inter', system-ui, sans-serif";
const LINE_HEIGHT = 1.25;

export type ImageCache = Map<string, HTMLImageElement>;

/** Preload every image referenced by the layout, resolving once all are ready. */
export function preloadImages(layout: ResolvedLayout, cache: ImageCache): Promise<void> {
  const srcs = layout.placements
    .filter((p) => p.elementKind === "image")
    .map((p) => (p.content as { src: string }).src)
    .filter((src) => !cache.has(src));

  return Promise.all(
    srcs.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            cache.set(src, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = src;
        }),
    ),
  ).then(() => undefined);
}

export function renderToCanvas(
  canvas: HTMLCanvasElement,
  layout: ResolvedLayout,
  images: ImageCache,
  scale: number,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const { width, height } = layout.surface;
  canvas.width = width * scale * dpr;
  canvas.height = height * scale * dpr;
  canvas.style.width = `${width * scale}px`;
  canvas.style.height = `${height * scale}px`;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);

  // Artboard background.
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, "#f4f6ff");
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, width, height, 6);
  ctx.fill();

  for (const p of layout.placements) {
    if (!p.visible) continue;
    drawPlacement(ctx, p, images);
  }
}

function drawPlacement(ctx: CanvasRenderingContext2D, p: Placement, images: ImageCache): void {
  const f = p.frame;

  if (p.elementKind === "image") {
    const img = images.get((p.content as { src: string }).src);
    if (img) ctx.drawImage(img, f.x, f.y, f.width, f.height);
    return;
  }

  if (p.role === "action") {
    const label = (p.content as { label: string }).label;
    ctx.fillStyle = "#2b6cff";
    roundRect(ctx, f.x, f.y, f.width, f.height, Math.min(f.height / 2, f.width / 2));
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${p.fontSize}px ${FONT_STACK}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, f.x + f.width / 2, f.y + f.height / 2 + 1);
    ctx.textAlign = "left";
    return;
  }

  // text (primary / secondary)
  const text = (p.content as { text: string }).text;
  const size = p.fontSize ?? 16;
  ctx.fillStyle = p.role === "primary" ? "#0f172a" : "#475569";
  ctx.font = `${p.role === "primary" ? 700 : 600} ${size}px ${FONT_STACK}`;
  ctx.textBaseline = "top";
  const lines = wrapLines(ctx, text, f.width);
  const lineH = size * LINE_HEIGHT;
  const blockH = lines.length * lineH;
  // Vertically centre the text block within its frame, matching the DOM renderer.
  let y = f.y + Math.max(0, (f.height - blockH) / 2);
  for (const line of lines) {
    ctx.fillText(line, f.x, y);
    y += lineH;
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
