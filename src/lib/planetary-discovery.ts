/** Remember discovery for this tab's visit, including route changes and reloads. */
export const PLANETARY_DISCOVERY_KEY = "tg-orbit-discovered";
const DISCOVERED_EVENT = "orbit-portal:discovered";
let discoveredInPage = false;

export function hasPlanetaryDiscovery() {
  if (typeof window === "undefined") return false;
  try {
    return discoveredInPage || window.sessionStorage.getItem(PLANETARY_DISCOVERY_KEY) === "1";
  } catch {
    return discoveredInPage;
  }
}

export function rememberPlanetaryDiscovery() {
  if (discoveredInPage) return;
  discoveredInPage = true;
  try {
    window.sessionStorage.setItem(PLANETARY_DISCOVERY_KEY, "1");
  } catch {
    // Storage may be blocked; discovery still lasts until this document closes.
  }
  document.documentElement.dataset.orbitDiscovered = "true";
  window.dispatchEvent(new Event(DISCOVERED_EVENT));
}

export function subscribePlanetaryDiscovery(listener: () => void) {
  window.addEventListener(DISCOVERED_EVENT, listener);
  return () => window.removeEventListener(DISCOVERED_EVENT, listener);
}

export function undiscoveredOnServer() {
  return false;
}
