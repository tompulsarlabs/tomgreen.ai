# tomgreen.ai

A personal site that is also the artifact it describes: a plain portfolio on
the surface, and a world behind the moon. This file is the glossary — the one
word for each thing, and the words to stop using. Commit subjects, PR bodies,
code comments and session notes use these terms. A concept that needs a word
this file lacks is a gap to flag, never a synonym to invent.

Terms marked **(inferred)** were named or defined here rather than found
stated in the code, the commits or the PR bodies. They are the ones to
confirm or rename first.

## Language

### The front door

**Home**:
The one primary route. It carries the opening, the masthead and the operating
record in that order; `/work` is a redirect to it, not a second page.
_Avoid_: the landing page (say the landing only for the opening's stage), the
front page, `/work`

**The opening**:
The three statements resolving on their own clock on first arrival, over the
page, with no scroll. Any click, key, wheel or focus skips it; below 769px,
under reduced motion and without JavaScript the statements render as a
resolved document instead.
_Avoid_: the intro, the hero animation, the landing sequence, the resolve

**The three statements**:
The lines the opening plays, named for the beats they belong to — the
**constraint** line, the **system** line, and the **release** line. Each is
authored with its own line breaks; no word may move between lines.
_Avoid_: the headlines, the taglines, the hero copy

**The masthead**:
The block under the opening: eyebrow, the positioning line set as the page's
one `h1`, and the introduction against it on the right. Shared with the Lab's
own opening block, so a change moves both.
_Avoid_: the hero, the personal hero, the banner

**The positioning line**:
"I build the teams, the operating model, and the agents to run it." One
string, read by the masthead and by the meta description, `og:description`,
`twitter:description` and the JSON-LD — so what a visitor sees first and what
a search result shows cannot drift.
_Avoid_: the tagline, the headline, the h1

**The operating record**:
The site's primary content: the grouped index of case studies under
"Weighed by opportunity cost." One implementation, rendered on Home.
_Avoid_: the work index, the portfolio, the archive, the work page

**Case study**:
One editorial record at `/work/<slug>`: mandate, decisions, operating model,
outcomes, evidence note, next action. The core content unit.
_Avoid_: project (a project is a Lab entry), story, post

**Tier**:
A case study's rank in the operating record: `flagship`, `supporting`,
`current` or `foundation`. It decides the group a record sits in and how
heavily its row is set.
_Avoid_: category, level, priority

**The Lab**:
The `/building` route: what is being built right now, in public — Ivy, this
site, Sybil and the rest.
_Avoid_: Systems (the route's former name, still used in older docs and in
several CSS class names), Building, Projects

**Voices**:
The references route. Its nav entry and its planet appear only once there is
real, attributed, sign-off'd testimony; the route itself is always served,
empty or not.
_Avoid_: testimonials, references (the page is Voices; the quotes inside are
references)

**The proof strip** (inferred):
The "Execution in public" band — Ivy's streak, the verified-through date and
the GitHub contribution record, beside a link to inspect Ivy. Live data,
refreshed hourly, degrading to a public link.
_Avoid_: the live band, the dashboard, the stats

**Live proof** (inferred):
Data read from Ivy's published state and the GitHub API rather than authored
in the repo. It is never allowed to gate rendering; a failure falls back to
static content.
_Avoid_: live data, live state, telemetry, metrics (metrics are the authored
figures inside a case study)

### The navigation

**The Moon**:
The one interactive object in the navigation — real lunar geometry on a
transparent canvas, built rather than sampled, baked once at mount. Hover or
focus opens the navigation row; a click opens the portal and navigates
nowhere. On touch the first tap opens the row and only a second opens the
portal.
_Avoid_: the sphere, the nav sphere, the orb, the carbon sphere, the bearing

**The island**:
The floating navigation surface the Moon sits at the leading edge of. It
takes no flow space; content that starts at the top clears it explicitly.
_Avoid_: the nav bar, the header, the pill, the capsule

**The navigation row**:
The links the island reveals — Home, Lab, Voices, About, Contact. Every
destination the site has is reachable here, without the portal.
_Avoid_: the menu, the nav links

### The world behind the moon

**The portal**:
The hidden second layer, opened only by clicking the Moon. It holds two
levels, never changes the URL, and restores the page, the scroll and the
focus when it closes.
_Avoid_: the overlay, the modal, the easter egg (it is one, but the word
names the surprise, not the thing)

**The planetary map**:
The portal's first level: every section of the site as a planet, orbiting the
core. The one place the whole system is visible at once.
_Avoid_: the solar-system map, the orbit nav, the nav map, the system diagram

**A section's system**:
The portal's second level: one section's own bodies orbiting its centre — the
operating record's case studies, the Lab's projects, About's stations,
Contact's channels. Reached by capturing a planet on the map. Every body is
derived from content already published elsewhere; nothing is authored twice.
_Avoid_: the sub-map, the detail view, the sub-page

**Planet** / **Body**:
A planet is a body on the planetary map — one section. A body is the general
term for anything on an orbit at either level. Every body is either
interactive with exactly one action or not interactive at all; there is no
third state.
_Avoid_: node, item, orb, marker

**Nameplate**:
A body's label: a real HTML link anchored to its planet by projection, set in
caps unless the name carries authored brand casing. It is what makes the map
navigable without the canvas.
_Avoid_: label (say nameplate when it is on a body), tooltip, caption

**The core**:
The dense body at the centre of every system, labelled **Talent** to the
visitor — the centre of gravity everything else orbits and captures fall
into. It is deliberately not interactive.
_Avoid_: the nucleus, the black hole, the centre, the sun

**Capture**:
Pressing a planet and having it spiral down into the core. A capture on the
map descends into that section's system; a capture inside a section travels.
A press is a click on the planet it went down on, resolved against the frame
the visitor was aiming at, not the latest one drawn.
_Avoid_: click, select, tap, activate

**Travel**:
The site actually navigating to a destination — after a capture inside a
section, or from a link with the route transition running. Also the corridor
moving between stations.
_Avoid_: navigate, transition, route change

**The burst**:
The fourteen-second event a capture sets off: photosphere, blast front,
ejecta, accretion disc, light echo and membrane wake, all reading one shared
light curve, temperature and blast law so nothing can disagree about how
bright the moment is. It outlives the scene that started it and is still
burning as the next one arrives.
_Avoid_: the flash, the explosion, the pop, the supernova (the physics is a
supernova; the thing on screen is the burst)

**The poster**:
The server-rendered SVG of a system at rest — a composed static frame with
every nameplate as a real link. It is what reduced-motion, Save-Data, no-JS
and no-WebGL visitors get, and it is present before the canvas replaces it.
_Avoid_: the fallback, the static image, the placeholder, the SVG

**The membrane**:
The gravity well the system rests on: concentric rings and meridians drawn as
hairlines in the same projection as the orbits, bending into a throat at the
core. One object in the scene, never a backdrop.
_Avoid_: the grid, the lattice, the sheet, the backdrop

**The deep field**:
The nebula behind the planetary map — extinction, domain-warped filaments,
parallax layers and hydrogen-alpha/oxygen colour. It renders behind
everything with depth off, so it never occludes a planet or takes a click.
_Avoid_: the background, the starfield (that is the corridor's), the space
texture

### The corridor

**The career corridor**:
About's interactive CV: the visitor travels through it by scroll or year
rail, motion lives between stops, and every arrival is a still. The same DOM
is the fallback — the complete linear career document, nothing gated.
_Avoid_: the timeline, the CV scroller, the career line

**Station**:
One stop in the corridor — one chapter of the career, addressable as
`#station-N`, which is where an About planet's click-through lands.
_Avoid_: stop, chapter, entry, job (About's planets are labelled by company;
the thing they land on is a station)

**Hyperspace**:
The volumetric star field behind the corridor: real XYZ positions in a deep
tunnel, drawn in blue ink on the page's own paper rather than glowing over
it. Atmosphere, never interface, and never part of the document fallback.
_Avoid_: the starfield background, the warp effect, the particles

### Type and ground

**Paper** / **Ink**:
Paper is the white ground every route uses; ink is the near-black reserved
for type, rules and compact controls. There are no dark bands and no
inverted routes.
_Avoid_: white/black, background/foreground, light mode

**The width axis**:
Archivo's `wdth` axis, the site's quiet motion channel, with named stops:
62 constraint, 82 prototype, 92 index rest, 100 resolved, 106 masthead, 125
release. The values are implementation detail and never shown to a visitor.
Display weight never animates and width never overshoots.
_Avoid_: the axis (ambiguous — say the width axis), font stretch, the wdth
value

**Record voice**:
The small tracked-uppercase mono style used for eyebrows, indices, periods
and labels — the site's instrument reading.
_Avoid_: the mono style, eyebrow, caption, kicker

**Live green** / **Clay**:
The site's only two semantic accents. Live green means running in production
and nothing else; clay marks a small case or source annotation and never
becomes a decorative field.
_Avoid_: the accent colour, the highlight, green/orange, brand colours

**The air scale** (inferred):
The one fluid vertical unit and its four multiples that carry every gap on
Home and the operating record: a label to the thing it labels, a thing to its
own prose, block to block within one movement, movement to movement. Spacing
is chosen from the scale, not by eye.
_Avoid_: the spacing scale, the rhythm, margins

**The alignment rule**:
Every split composition aligns to its first line: the mono label on the left
and the heading on the right start at the same optical line, rather than the
label being end-aligned to the block. One rule replaced four separately
stranded leads across Home, About, the Lab and the case studies.
_Avoid_: the split layout, the two-column rule, the grid

### Publishing

**The owner**:
Tom. The site's copy, figures and design verdicts are his; agents draft, he
rules.
_Avoid_: the client, the user, the stakeholder

**Owner ruling**:
A decision Tom has stated — copy, a figure, a layout verdict — carried into
the repo verbatim. A ruling supersedes any earlier design document; it is not
re-litigated in a later session.
_Avoid_: feedback, request, note, preference

**Named claim**:
Any named employer, client, person or metric on the site. Every one is signed
off before it reaches the public repo or a deploy; where in doubt it is
anonymised ("a global fashion platform" style) rather than softened. A push
to this repo is a publish.
_Avoid_: claim, fact, reference

**Content guard**:
The check that renders each route with JavaScript disabled and compares its
text against a committed baseline, failing when a route loses more than a
tenth of its lines. It exists because two routes once lost their content
silently.
_Avoid_: the snapshot test, the regression test, the baseline check

## Relationships

- **Home** carries the **opening**, the **masthead** and the **operating
  record**; the operating record lists **case studies** by **tier**, and each
  row travels to one.
- The **island** holds the **Moon** and reveals the **navigation row**. The
  row reaches every destination; the Moon reaches only the **portal**. The
  site navigates completely without the portal — that is the condition on it
  being hidden at all.
- The **portal** opens on the **planetary map**; a **capture** there descends
  into **a section's system**; a capture inside a section **travels**. Every
  capture sets off **the burst**, which outlives the scene it started in.
- A **planet** carries a **nameplate** and orbits the **core**. The **poster**
  draws that same system at rest, with the same nameplates as real links, so
  the map is navigable before and without the canvas.
- **A section's system** derives its bodies from the same content the pages
  publish: the operating record's **case studies**, the **Lab**'s projects,
  About's **stations**, Contact's channels. Renaming content in one place
  renames it everywhere.
- The **career corridor** moves between **stations** through **hyperspace**;
  an About planet's capture lands on the station its name points at.
- **Paper**, **ink**, the **width axis**, **record voice**, **live green**,
  **clay**, the **air scale** and the **alignment rule** are the design
  system. They apply on every route, portal included.
- An **owner ruling** decides copy and composition; a **named claim** cannot
  ship without sign-off; the **content guard** catches what neither notices.

## Flagged ambiguities

- **The core has three names in the code** — core (most used), nucleus (the
  geometry module's term, and the visitor-facing label is Talent), and black
  hole (the prose). One thing, one word needed. The contract that commissioned
  this file said "black-hole entrance", which could mean the Moon click that
  opens the portal or the core a capture falls into; it is defined above as
  the core, and the entrance is the Moon.
- **"Proof strip" and "live proof" are not stated anywhere in prose**, and the
  proof strip is currently not rendered by any route — it survives as a
  component with no mount point. Confirm whether it returns to Home, and
  whether the two are one term or two.
- **"Systems" still names the Lab** in DESIGN.md, DESIGN-MOTION.md and in the
  CSS class names Home borrows for its masthead. The route is the Lab.
- **DESIGN.md and DESIGN-MOTION.md describe a site that no longer exists** —
  no corridor on About, no WebGL on Home, a `/work` route with its own body,
  About hidden on production. All four are false at HEAD. They are historical
  design contracts, not current descriptions, and should say so.
- **"Two doors home" (PR #8) is superseded.** The Moon no longer navigates, so
  only one door remains: the Home label, which marks the opening as seen. The
  replay path exists in code with no caller.
- **"Stop" and "station"** both name a corridor position, and About's planets
  call the same thing a chapter. Station is used above; confirm.
- **"Body" is overloaded** — an orbiting object in the portal, and a case
  study's narrative paragraphs. Context has carried it so far.
- **"Handoff" names two unrelated things**: the outgoing scene passing its
  camera to the incoming one, and a work row's company name travelling into
  the case study's heading. The second is elsewhere called the travelling
  name; consider keeping handoff for the first only.
- **"Chapter 2" is a client's name, not an ordinal.** It reads as a section
  number in prose about the site's own structure.
- **"Work" survives as a planet name** on the planetary map, pointing at Home,
  while nothing else on the site is called Work any more — the operating
  record's own eyebrow reads "Evidence / selected operating records". Confirm
  whether Work is still the name of that body of evidence.
- **Voices' own source comment overstates the gate**, claiming the route
  appears only once there is testimony. The route always serves; only the nav
  entry and the planet are gated. Worth correcting at the source too.
