export const site = {
  name: "Tom Green",
  domain: "tomgreen.ai",
  location: "Berlin",
  email: "tom@tomgreen.ai",
  /**
   * The page's opening headline.
   */
  headline: "Building organizations, talent systems, and operating models, in founder mode.",
  /**
   * The claim the site is indexed and shared under — description,
   * og:description, twitter:description and the JSON-LD in layout.tsx all
   * read this, so it is deliberately independent of whichever block of
   * copy happens to open the page. It also appears on the page, under the
   * operating record's masthead.
   */
  positioning: "I build the teams, the operating model, and the agents to run it.",
  intro:
    "Executive talent leader and systems builder. I’ve built a 120-person AI organization in six months, led global talent teams, and redesigned Operations around agent workflows.",
  links: {
    calendly: "https://calendly.com/tom-tomgreen",
    github: "https://github.com/tompulsarlabs",
    linkedin: "https://linkedin.com/in/tomegreen",
    substack: "https://tomgreenlabs.substack.com",
  },
  nav: [
    // Home is the operating record now — /work redirects here, so it is
    // not a second destination in the row.
    { href: "/", label: "Home" },
    { href: "/building", label: "Lab" },
    { href: "/voices", label: "Voices" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ],
} as const;
