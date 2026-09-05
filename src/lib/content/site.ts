export const site = {
  name: "Tom Green",
  domain: "tomgreen.ai",
  location: "Berlin",
  email: "tom@tomgreen.ai",
  headline: "Building in Founder Mode",
  /** The concrete claim, also used for search and sharing. */
  positioning:
    "I build teams, operating models, and agents to run them.",
  intro:
    "Executive talent leader and systems builder. I’ve built a 120-person AI organization in six months, led global talent teams, and redesigned operations around agent workflows.",
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
