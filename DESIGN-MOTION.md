# tomgreen.ai — Load-Bearing Type contract

## Thesis

Typography behaves like an organisation under load. Archivo’s `wdth` axis is the expressive
channel: `62` constraint, `82` prototype, `92` index rest, `100` resolved, `106` masthead and
`125` release. Display weight never animates.

## Type

- Display and structure: Archivo variable, 800, width axis 62–125.
- Reading/UI: Geist 400/500, sentence case, 1.55–1.6 leading.
- Record voice: Geist Mono 400/500, 10–12px, tracked uppercase.
- Display: `clamp(56px, 11.8vw, 172px)`; index: `clamp(30px, 5.2vw, 64px)`.

## Palette and structure

- Paper `#fff`; ink `#101410`; reading `#4f554d`; ghost `#b9bdb4`; hairline `#deded8`.
- Live green `#3fa06c` means running in production only.
- Clay `#e45b3d` marks reconstruction/evidence and is paired with a text label.
- Twelve columns, 1360px max, 24px gutters, 6vw margins, 8px baseline.
- Display blocks are left-set. The right third is reserved for evidence, annotation or air.

## Motion

- Durations: 160 / 280 / 440 / 700ms.
- Properties: transform, opacity and `font-variation-settings` only.
- Width changes do not exceed 40 units per 100ms and occur on one display cluster at a time.
- Route exits compress and rise in 280ms; arrivals resolve in 440ms.
- Reduced motion and no-JS render the complete document linearly at `wdth 100`.

## Route rules

- Home: type resolve, verified proof, Work bridge, one dark Systems band, contact.
- Work: six full-row links; hover and focus both resolve `92→100`.
- Zalando: company masthead plus Evidence Object 1 and canonical body/evidence note.
- Systems: dark route, semantic field/index and labelled maturity widths.
- About: local-only linear career record; no corridor.
- Contact: direct mailto remains primary.

## Cut list

No operating field, pointer parallax, category colours, heat palette, About corridor, Home WebGL,
gradients in UI, sound, custom cursor, magnetic controls or letter-by-letter effects.
