import { useEffect, useMemo, useRef, useState } from "react";
import {
  resolveLayout,
  defineSurface,
  createCanvasMeasurer,
  SurfaceError,
  type SurfaceProfile,
  type ResolvedLayout,
  type TextMeasurer,
} from "../engine";
import { sneakerAd } from "./ad";
import { demoSurfaces } from "./surfaces";
import { SurfaceStage } from "../render/render-dom";
import { preloadImages, renderToCanvas, type ImageCache } from "../render/render-canvas";

const FONT_FAMILY = "Space Grotesk, Inter, system-ui, sans-serif";
const STAGE_MAX_W = 640;
const STAGE_MAX_H = 560;

type RendererKind = "dom" | "canvas";

export default function App() {
  // A single Canvas-backed measurer, shared by every resolve so wrapping is
  // pixel-accurate in the browser. In Node the engine falls back to an estimator.
  const measurer = useMemo<TextMeasurer>(() => createCanvasMeasurer(), []);

  const [surfaces, setSurfaces] = useState<SurfaceProfile[]>(demoSurfaces);
  const [selectedId, setSelectedId] = useState<string>(demoSurfaces[0].id);
  const [renderer, setRenderer] = useState<RendererKind>("dom");

  const surface = surfaces.find((s) => s.id === selectedId) ?? surfaces[0];

  const layout = useMemo<ResolvedLayout>(
    () => resolveLayout(sneakerAd, surface, { measurer, fontFamily: FONT_FAMILY }),
    [surface, measurer],
  );

  const scale = useMemo(() => {
    const s = Math.min(STAGE_MAX_W / surface.width, STAGE_MAX_H / surface.height);
    return Math.min(s, 1.8);
  }, [surface]);

  function addCustomSurface(profile: SurfaceProfile) {
    setSurfaces((prev) => [...prev.filter((s) => s.id !== profile.id), profile]);
    setSelectedId(profile.id);
  }

  return (
    <div className="workbench">
      <aside className="rail">
        <header className="brand">
          <div className="brand-mark" aria-hidden />
          <div>
            <h1>Adaptive Layout Engine</h1>
            <p>One ad spec, resolved per surface</p>
          </div>
        </header>

        <section className="panel">
          <h2>Surfaces</h2>
          <ul className="surface-list">
            {surfaces.map((s) => (
              <li key={s.id}>
                <button
                  className={s.id === selectedId ? "surface-item active" : "surface-item"}
                  onClick={() => setSelectedId(s.id)}
                >
                  <span className="surface-name">{s.label}</span>
                  <span className="surface-dims">
                    {s.width}×{s.height}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <CustomSurfaceForm onAdd={addCustomSurface} />
      </aside>

      <main className="stage-area">
        <div className="stage-header">
          <div>
            <span className="stage-title">{surface.label}</span>
            <span className="stage-meta">
              {surface.width}×{surface.height} · aspect {(surface.width / surface.height).toFixed(2)} ·{" "}
              <span className="template-badge">{layout.template}</span>
            </span>
          </div>
          <div className="renderer-toggle" role="group" aria-label="Renderer">
            <button className={renderer === "dom" ? "active" : ""} onClick={() => setRenderer("dom")}>
              DOM
            </button>
            <button className={renderer === "canvas" ? "active" : ""} onClick={() => setRenderer("canvas")}>
              Canvas
            </button>
          </div>
        </div>

        <div className="stage-frame">
          {renderer === "dom" ? (
            <SurfaceStage layout={layout} scale={scale} />
          ) : (
            <CanvasStage layout={layout} scale={scale} />
          )}
        </div>

        <p className="stage-note">
          The same <code>sneakerAd</code> spec resolved live — no per-surface layout code. Switch surfaces to watch it
          re-compose; add one of your own below to see it resolve a surface it has never met.
        </p>
      </main>

      <aside className="trace">
        <TracePanel layout={layout} />
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CanvasStage({ layout, scale }: { layout: ResolvedLayout; scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<ImageCache>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    preloadImages(layout, cacheRef.current).then(() => {
      if (!cancelled && canvasRef.current) renderToCanvas(canvasRef.current, layout, cacheRef.current, scale);
    });
    return () => {
      cancelled = true;
    };
  }, [layout, scale]);

  return <canvas ref={canvasRef} className="canvas-stage" />;
}

/* ------------------------------------------------------------------ */

function TracePanel({ layout }: { layout: ResolvedLayout }) {
  return (
    <>
      <section className="panel">
        <h2>Resolution trace</h2>
        <ol className="trace-list">
          {layout.trace.map((t, i) => (
            <li key={i} className={`trace-step trace-${t.step}`}>
              <span className="trace-tag">{t.step}</span>
              <span className="trace-detail">{t.detail}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <h2>Elements</h2>
        <ul className="element-list">
          {layout.placements.map((p) => (
            <li key={p.id} className={`element element-${p.status.kind}`}>
              <div className="element-head">
                <span className="element-id">{p.id}</span>
                <span className="element-status">{statusLabel(p.status)}</span>
              </div>
              <div className="element-body">
                <span className="element-role">
                  {p.role} · {p.elementKind}
                </span>
                {p.visible ? (
                  <span className="element-frame">
                    {Math.round(p.frame.x)},{Math.round(p.frame.y)} · {Math.round(p.frame.width)}×
                    {Math.round(p.frame.height)}
                    {p.fontSize ? ` · ${Math.round(p.fontSize)}px` : ""}
                  </span>
                ) : (
                  <span className="element-frame muted">removed</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function statusLabel(status: ResolvedLayout["placements"][number]["status"]): string {
  if (status.kind === "placed") return "placed";
  if (status.kind === "shrunk") return "shrunk";
  return "dropped";
}

/* ------------------------------------------------------------------ */

function CustomSurfaceForm({ onAdd }: { onAdd: (s: SurfaceProfile) => void }) {
  const [width, setWidth] = useState("1440");
  const [height, setHeight] = useState("360");
  const [minText, setMinText] = useState("14");
  const [minTap, setMinTap] = useState("44");
  const [touch, setTouch] = useState(false);
  const [far, setFar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    try {
      const w = parseInt(width, 10);
      const h = parseInt(height, 10);
      const surface = defineSurface({
        id: `custom-${w}x${h}-${Date.now().toString().slice(-4)}`,
        label: `Custom ${w}×${h}`,
        width: w,
        height: h,
        constraints: {
          minTextSize: parseInt(minText, 10) || undefined,
          minTapTarget: parseInt(minTap, 10) || undefined,
          touchOnly: touch,
          viewingDistance: far ? "far" : "near",
        },
      });
      onAdd(surface);
    } catch (e) {
      setError(e instanceof SurfaceError ? e.message : "Could not build that surface.");
    }
  }

  return (
    <section className="panel custom-form">
      <h2>Add a surface</h2>
      <p className="form-hint">Give the engine a surface it has never seen. It resolves the same spec, live.</p>
      <div className="field-row">
        <label>
          Width
          <input value={width} onChange={(e) => setWidth(e.target.value)} inputMode="numeric" />
        </label>
        <label>
          Height
          <input value={height} onChange={(e) => setHeight(e.target.value)} inputMode="numeric" />
        </label>
      </div>
      <div className="field-row">
        <label>
          Min text
          <input value={minText} onChange={(e) => setMinText(e.target.value)} inputMode="numeric" />
        </label>
        <label>
          Min tap
          <input value={minTap} onChange={(e) => setMinTap(e.target.value)} inputMode="numeric" />
        </label>
      </div>
      <div className="field-row checks">
        <label className="check">
          <input type="checkbox" checked={touch} onChange={(e) => setTouch(e.target.checked)} /> touch only
        </label>
        <label className="check">
          <input type="checkbox" checked={far} onChange={(e) => setFar(e.target.checked)} /> far viewing
        </label>
      </div>
      <button className="resolve-btn" onClick={submit}>
        Resolve surface
      </button>
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
