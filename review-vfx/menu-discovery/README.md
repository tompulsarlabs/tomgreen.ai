# Menu discovery — September 5, 2026

A fresh visit starts with two understated menu lines in the existing 44px target. The first click or tap opens navigation as the lines gather into the Moon. The Moon then opens the planetary world.

Closing navigation restores the lines until the world has actually opened. Discovery is remembered in session storage for the tab's visit, across route changes and reloads. With storage blocked, it lasts for the current document and client-side navigation. A fresh session starts with the familiar menu again. A pre-paint attribute preserves the remembered Moon on reload.

Keyboard activation follows the same two steps. After discovery, desktop hover/focus still opens the navigation; touch still opens it on the first tap. Escape and tapping away dismiss navigation. Reduced motion resolves the icon immediately.

## Verification

- Production build, lint and 264 unit tests pass.
- 16 focused Chrome browser checks and 3 WebKit checks pass: mouse/touch/keyboard disclosure, dismissal, real-world discovery, persistence, blocked storage, navigation accessibility, portal entry, reduced motion and no-JavaScript content access.
- All 12 routes pass the server-rendered content guard.
- Visual review at 320px, 430px and 1440px shows the shared anchor, 44px target and no horizontal overflow. WebKit and mobile checks use browser emulation, not physical iPhone hardware.

Each morph strip shows the resting menu, transition and open navigation:

- [Narrow phone transition](morph-320.webp)
- [Phone transition](morph-430.webp)
- [Desktop transition](morph-1440.webp)
- [Phone landing with menu](mobile-430-menu.webp)
- [Phone landing with Moon](mobile-430-moon.webp)
- [Measured geometry](geometry.json)
