import type { CSSProperties } from "react";
import type { Placement, ResolvedLayout } from "../engine";

/**
 * DOM/React renderer.
 *
 * It consumes a {@link ResolvedLayout} and nothing else — no spec, no surface,
 * no knowledge of *how* the layout was decided. Every element is absolutely
 * positioned from its resolved frame. This is the whole payoff of the
 * spec → resolve → layout → render split: the renderer is a dumb, faithful
 * projection of the engine's output.
 *
 * One deliberate flourish: every element (even dropped ones) stays mounted and
 * keyed by id, and its frame is driven through CSS transitions. Switching
 * surfaces therefore *morphs* — elements glide to their new positions and
 * dropped ones fade out — which visibly demonstrates that it's the same content
 * being re-resolved, not five separate hardcoded layouts.
 */

const FONT_STACK = "'Space Grotesk', 'Inter', system-ui, sans-serif";

export interface SurfaceStageProps {
  layout: ResolvedLayout;
  /** Display scale — surfaces are rendered at natural px then scaled to fit. */
  scale: number;
}

export function SurfaceStage({ layout, scale }: SurfaceStageProps) {
  const { surface, placements } = layout;

  const stageStyle: CSSProperties = {
    position: "relative",
    width: surface.width,
    height: surface.height,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    background: "linear-gradient(160deg, #ffffff 0%, #f4f6ff 100%)",
    borderRadius: 6 / scale,
    overflow: "hidden",
    boxShadow: "0 0 0 1px rgba(15,23,42,0.06)",
  };

  return (
    <div style={{ width: surface.width * scale, height: surface.height * scale }}>
      <div style={stageStyle} data-template={layout.template}>
        {placements.map((p) => (
          <ElementView key={p.id} placement={p} />
        ))}
      </div>
    </div>
  );
}

function ElementView({ placement }: { placement: Placement }) {
  const { frame, visible } = placement;

  const base: CSSProperties = {
    position: "absolute",
    left: frame.x,
    top: frame.y,
    width: frame.width,
    height: frame.height,
    opacity: visible ? 1 : 0,
    transform: visible ? "scale(1)" : "scale(0.92)",
    transformOrigin: "center",
    transition:
      "left 480ms cubic-bezier(.2,.8,.2,1), top 480ms cubic-bezier(.2,.8,.2,1)," +
      "width 480ms cubic-bezier(.2,.8,.2,1), height 480ms cubic-bezier(.2,.8,.2,1)," +
      "opacity 300ms ease, transform 300ms ease, font-size 300ms ease",
    pointerEvents: visible ? "auto" : "none",
  };

  return <div style={base}>{renderContent(placement)}</div>;
}

function renderContent(p: Placement) {
  switch (p.role) {
    case "primary":
      return (
        <div style={textStyle(p, { weight: 700, color: "#0f172a", lineHeight: 1.05 })}>
          {(p.content as { text: string }).text}
        </div>
      );
    case "secondary":
      return (
        <div style={textStyle(p, { weight: 600, color: "#475569", lineHeight: 1.1 })}>
          {(p.content as { text: string }).text}
        </div>
      );
    case "hero":
    case "branding": {
      const c = p.content as { src: string; alt: string };
      return (
        <img
          src={c.src}
          alt={c.alt}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      );
    }
    case "action": {
      const c = p.content as { label: string };
      return (
        <button
          type="button"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            borderRadius: Math.min(frameRound(p), 999),
            background: "#2b6cff",
            color: "#fff",
            fontFamily: FONT_STACK,
            fontWeight: 600,
            fontSize: p.fontSize,
            cursor: "pointer",
            whiteSpace: "nowrap",
            padding: 0,
          }}
        >
          {c.label}
        </button>
      );
    }
  }
}

function textStyle(
  p: Placement,
  o: { weight: number; color: string; lineHeight: number },
): CSSProperties {
  return {
    fontFamily: FONT_STACK,
    fontSize: p.fontSize,
    fontWeight: o.weight,
    color: o.color,
    lineHeight: o.lineHeight,
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    overflow: "hidden",
    margin: 0,
  };
}

function frameRound(p: Placement): number {
  return p.frame.height / 2;
}
