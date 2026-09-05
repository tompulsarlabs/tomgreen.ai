# Gentle colour and metric spacing — 5 September 2026

The previous outcome hover filled the whole cell, stopping flush against its caption.
The cells now remain white, the numbers stay still, and each figure receives only a
restrained blue, sage or rose ink tint. Balanced cell padding and a more generous line
height leave room around the figures and labels, including when stacked on a phone.

Home's near-white rose and the Lab's cool blue fade into the paper instead of covering
each record with the same violet rectangle. Focus keeps the same acknowledgement as hover.

- [Desktop metrics, final figure hovered](desktop-metrics.webp)
- [Phone metrics](phone-metrics.webp)
- [Home record hovered](home-hover.webp)
- [Lab record hovered](lab-hover.webp)

Validation: production build, ESLint, 263 unit tests and eight relevant browser tests passed.
The browser tests cover responsive layout, focus, case navigation, semantic fallbacks and
mobile accessibility. Additional Chrome checks at 320, 390, 768, 769, 1280, 1920 and 2560px
confirmed that figures and captions fit, hover does not move the numbers, and the pages do
not overflow. Touch, keyboard focus and reduced-motion states were checked.
Measurements are recorded in [visual-verification.json](visual-verification.json).
