/**
 * Text measurement is pulled out behind an interface for one reason: the
 * resolver must stay pure TypeScript with no DOM dependency, yet still make
 * wrapping and truncation decisions from *real* text dimensions rather than
 * character-count guesses.
 *
 * In the browser we hand it a Canvas-backed measurer (pixel-accurate). In Node
 * and in tests we hand it a deterministic estimator. Same resolver, either way.
 */

export interface TextMetrics {
  width: number;
  height: number;
  lines: number;
}

export interface TextMeasurer {
  /**
   * Measures `text` wrapped to at most `maxWidth`, returning the tight bounding
   * box and the number of lines used.
   */
  measure(text: string, fontSize: number, fontFamily: string, maxWidth: number): TextMetrics;
}

const LINE_HEIGHT_RATIO = 1.25;

/**
 * Greedy word-wrap shared by both measurers: fill a line until the next word
 * would exceed `maxWidth`, then break. `widthOf` is the only thing that differs
 * between the canvas and estimate implementations.
 */
function wrap(text: string, maxWidth: number, widthOf: (s: string) => number): { lines: string[]; width: number } {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let widest = 0;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (widthOf(candidate) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      widest = Math.max(widest, widthOf(line));
      line = word;
    }
  }
  if (line) {
    lines.push(line);
    widest = Math.max(widest, widthOf(line));
  }
  return { lines: lines.length ? lines : [""], width: Math.min(widest, maxWidth) };
}

/**
 * Canvas-backed measurer. One shared offscreen context; font string rebuilt per
 * call. `measureText().width` is exact for the given font, so wrapping matches
 * what the browser will actually paint.
 */
export function createCanvasMeasurer(): TextMeasurer {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable for text measurement.");

  return {
    measure(text, fontSize, fontFamily, maxWidth) {
      ctx.font = `${fontSize}px ${fontFamily}`;
      const { lines, width } = wrap(text, maxWidth, (s) => ctx.measureText(s).width);
      return {
        width: Math.ceil(width),
        height: Math.ceil(lines.length * fontSize * LINE_HEIGHT_RATIO),
        lines: lines.length,
      };
    },
  };
}

/**
 * Deterministic estimator for headless environments. Uses a per-glyph average
 * width (0.52em is a good mean for humanist sans text). Not pixel-perfect, but
 * stable and monotonic, which is all the resolver's fitting maths needs — and it
 * lets the full engine run and be tested with zero browser.
 */
export function createEstimateMeasurer(avgGlyphEm = 0.52): TextMeasurer {
  return {
    measure(text, fontSize, _fontFamily, maxWidth) {
      const glyph = fontSize * avgGlyphEm;
      const widthOf = (s: string) => s.length * glyph;
      const { lines, width } = wrap(text, maxWidth, widthOf);
      return {
        width: Math.ceil(width),
        height: Math.ceil(lines.length * fontSize * LINE_HEIGHT_RATIO),
        lines: lines.length,
      };
    },
  };
}
