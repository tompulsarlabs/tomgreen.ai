'use client';

import { useEffect, useRef, useState } from 'react';
import { OperatingOrbit } from '@/components/operating-orbit';
import { mapBodies } from '@/lib/orbit-worlds';
import { openOrbitPortal } from '@/lib/orbit-portal-bus';
import ui from './journey.module.css';

/** The existing public planetary system, presented as part of the demo. */
export default function InterstellarMap() {
  const host = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting));
    const resume = () => setPaused(false);
    observer.observe(root); root.addEventListener('orbit-resume', resume);
    return () => { observer.disconnect(); root.removeEventListener('orbit-resume', resume); };
  }, []);
  return <section className={ui.mapBlock} aria-label="Interstellar map">
    <div ref={host} className={`${ui.mapField} orbit-portal-field`} data-paused={paused || offscreen ? 'true' : undefined}>
      <OperatingOrbit bodies={mapBodies}/>
    </div>
    <div className={ui.mapActions}>
      <button type="button" onClick={() => { setPaused(true); openOrbitPortal(); }}>Explore full map ↗</button>
      <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Resume motion' : 'Pause motion'}</button>
    </div>
    <p className={ui.mapCredit}><a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noreferrer">NASA lunar data</a> · <a href="https://esahubble.org/images/potw2113a/" target="_blank" rel="noreferrer">ESA/Hubble &amp; NASA, Z. Levay</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p>
  </section>;
}
