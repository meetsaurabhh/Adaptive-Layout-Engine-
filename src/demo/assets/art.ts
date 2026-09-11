/**
 * Product art as inline SVG data URIs. Keeping the assets self-contained means
 * the demo has no external image dependencies and never shows a broken hero —
 * and the resolver only ever sees a `src` string plus an aspect ratio, so it
 * treats these exactly as it would a photographed product shot.
 */

function dataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Stylised side-profile trainer. viewBox 280×200 → aspectRatio ≈ 1.4.
const HERO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200">
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b6cff"/>
      <stop offset="1" stop-color="#0b3fb0"/>
    </linearGradient>
    <linearGradient id="sole" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#eef2ff"/>
      <stop offset="1" stop-color="#c7d2fe"/>
    </linearGradient>
  </defs>
  <ellipse cx="140" cy="182" rx="118" ry="10" fill="#000" opacity="0.14"/>
  <path d="M22 150 C20 128 44 120 70 120 C96 120 108 96 138 92
           C176 86 196 104 236 116 C256 122 262 134 258 150 Z"
        fill="url(#body)"/>
  <path d="M70 120 C96 120 108 96 138 92 C150 90 160 92 170 96
           L150 122 C120 126 96 126 70 120 Z" fill="#eaf0ff" opacity="0.85"/>
  <path d="M18 150 C16 164 26 170 44 170 L246 170 C262 170 268 160 260 150 Z"
        fill="url(#sole)"/>
  <path d="M18 158 L262 158" stroke="#94a3d8" stroke-width="3" fill="none"/>
  <g stroke="#eaf0ff" stroke-width="6" stroke-linecap="round" opacity="0.9">
    <line x1="118" y1="108" x2="132" y2="126"/>
    <line x1="134" y1="104" x2="150" y2="122"/>
    <line x1="150" y1="102" x2="166" y2="120"/>
  </g>
  <circle cx="210" cy="150" r="9" fill="#0b3fb0"/>
</svg>`;

// ATLAS wordmark. viewBox 320×100 → aspectRatio ≈ 3.2.
const LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100">
  <g fill="none" stroke="#0f172a" stroke-width="9" stroke-linejoin="round">
    <path d="M20 78 L40 26 L60 78 M28 60 L52 60"/>
  </g>
  <text x="74" y="72" font-family="'Space Grotesk', system-ui, sans-serif"
        font-size="60" font-weight="700" letter-spacing="2" fill="#0f172a">TLAS</text>
</svg>`;

export const heroSneaker = dataUri(HERO_SVG);
export const atlasLogo = dataUri(LOGO_SVG);
