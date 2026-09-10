/** Authored identities, independent of ordering, routes and orbital motion. */
export type PlanetFamily = "lunar" | "terrain" | "gas" | "ice" | "ocean" | "dunes" | "volcanic" | "mineral";

export type PlanetTheme = {
  name: string;
  family: PlanetFamily;
  /** Shadow, characteristic surface, and lit highlands/clouds; sRGB. */
  palette: readonly [string, string, string];
  atmosphere: string;
  rings?: { inner: number; outer: number; tilt: readonly [number, number, number] };
};

function theme(name: string, family: PlanetFamily, dark: string, mid: string, light: string, atmosphere = "#000000"): PlanetTheme {
  return { name, family, palette: [dark, mid, light], atmosphere };
}

// Colour and geography both change between neighbours. These are mineral
// palettes under the same light, not emissive paint or random per-visit hues.
const copper = theme("Copper rifts", "terrain", "#45241e", "#bf764e", "#dba171");
const amethyst = theme("Amethyst crystal", "mineral", "#3d3448", "#9985b3", "#d3c4e3");
const amber = theme("Amber belts", "gas", "#674126", "#c8975f", "#f3dcb1", "#675947");
amber.rings = { inner: 1.32, outer: 2.12, tilt: [0.58, 0.12, -0.30] };
const verdant = theme("Verdant seas", "ocean", "#102e33", "#4f9472", "#c1d7a5", "#356b75");
const azure = theme("Azure ice", "ice", "#133550", "#589ed0", "#c9e9f6", "#294b69");
const cobalt = theme("Cobalt archipelago", "ocean", "#101e48", "#476ea8", "#a4c7d5", "#31579c");
const jade = theme("Jade tectonics", "mineral", "#173d34", "#70a78d", "#d0e4c3");
const coral = theme("Coral badlands", "terrain", "#53292c", "#c57472", "#f0c0a0");
const saffron = theme("Saffron dunes", "dunes", "#65462c", "#cea34b", "#f3dea0");
const glacial = theme("Turquoise glaciers", "ice", "#184849", "#60b4ba", "#c3ece2", "#285c63");
const obsidian = theme("Obsidian embers", "volcanic", "#24232c", "#62616c", "#ea9a57");
const rose = theme("Rose cloud bands", "gas", "#663447", "#bc839e", "#ebcbd4", "#65465c");
const ivory = theme("Ivory ridges", "dunes", "#5e5543", "#b9b096", "#eee7cf");
const indigo = theme("Indigo storms", "gas", "#202d58", "#687fac", "#bdcde8", "#3a4c79");
const ochre = theme("Ochre faultlands", "terrain", "#483c27", "#aa955b", "#dfc997");
const garnet = theme("Garnet veins", "mineral", "#472230", "#a75e79", "#e3a7ad");
const periwinkle = theme("Periwinkle frost", "ice", "#373454", "#999ccd", "#dcddf2", "#4d517c");
const sulphur = theme("Sulphur calderas", "volcanic", "#36352b", "#7c8062", "#e1cc67");
const terracotta = theme("Terracotta sands", "dunes", "#533128", "#bd795e", "#e5b79a");
const lagoon = theme("Lagoon world", "ocean", "#0e363d", "#409e9c", "#b1d2b0", "#226b74");
const violet = theme("Violet seas", "ocean", "#252241", "#8174a8", "#c5b4c6", "#584a7c");
const basalt = theme("Basalt and silver", "mineral", "#282e35", "#7b8998", "#c5d2db");
const sienna = theme("Sienna storms", "gas", "#482f25", "#9c6447", "#dcb08a", "#654938");
const olive = theme("Olivine highlands", "terrain", "#303b25", "#889664", "#c9cca1");

/** Matching projects keep their identity when reached through another section. */
export const planetThemes: Readonly<Record<string, PlanetTheme>> = {
  work: copper, lab: amethyst, demos: amber, about: verdant, contact: azure,
  "ai-organisation": cobalt,
  "interviewer-training": jade,
  "new-business": coral,
  "agent-people-ops": amethyst,
  "product-operations": saffron,
  bootstrapped: obsidian,
  "founding-team": glacial,
  "quant-search": rose,
  "lab-ivy": verdant,
  "lab-this-site": basalt,
  "lab-sybil": amethyst,
  "lab-writing-voice-skill": rose,
  "lab-brightpaws": saffron,
  "lab-building-practice": coral,
  "lab-recruiting-practice": azure,
  "lab-operations-practice": sulphur,
  "lab-tom-green-labs": ivory,
  "lab-stop-hiding-behind-culture": indigo,
  "demo-radar": copper,
  "demo-ivy": verdant,
  "demo-sybil": amethyst,
  "chapter-0": glacial,
  "chapter-1": coral,
  "chapter-2": cobalt,
  "chapter-3": saffron,
  "chapter-4": obsidian,
  "chapter-5": rose,
  "chapter-6": olive,
  "chapter-7": periwinkle,
  email: lagoon, calendly: terracotta, linkedin: indigo, github: garnet,
};

// Future, as-yet-unpublished bodies still receive a stable complete material.
const fallbackThemes = [ochre, violet, sienna, jade, periwinkle, obsidian];

export function planetTheme(id: string): PlanetTheme {
  const authored = planetThemes[id];
  if (authored) return authored;
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return fallbackThemes[hash % fallbackThemes.length];
}

export const planetFamilyIndex: Readonly<Record<PlanetFamily, number>> = {
  lunar: 0, terrain: 1, gas: 2, ice: 3, ocean: 4, dunes: 5, volcanic: 6, mineral: 7,
};

/** Fit and label the full silhouette, including a ring system. */
export function planetExtent(id: string): number {
  return planetTheme(id).rings?.outer ?? 1;
}
