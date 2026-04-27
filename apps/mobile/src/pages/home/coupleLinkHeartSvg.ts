/**
 * 中间爱心：单层白底柔光 + 对称贝塞尔心形（无多层大光晕、无材质风 path），避免真机上「挤、糊、廉价」。
 * 横线在 TSX。
 */
export function coupleLinkHeartDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 108" width="160" height="108">
<defs>
  <linearGradient id="momoyaHeartFill" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#D6A2AD" stop-opacity="0.95"/>
    <stop offset="100%" stop-color="#D6A2AD" stop-opacity="0.72"/>
  </linearGradient>
</defs>
<circle cx="80" cy="50" r="36" fill="#ffffff" fill-opacity="0.94" stroke="#D6A2AD" stroke-opacity="0.22" stroke-width="1"/>
<path fill="url(#momoyaHeartFill)" stroke="#D6A2AD" stroke-width="1.15" stroke-linejoin="round" stroke-linecap="round"
  d="M80 96 C34 62 26 44 48 28 C60 18 74 22 80 38 C86 22 100 18 112 28 C134 44 126 62 80 96 Z"/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
