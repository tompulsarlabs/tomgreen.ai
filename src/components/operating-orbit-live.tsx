"use client";

import type { MoonEntry } from "./orbit-moon-study";

import dynamic from "next/dynamic";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { OrbitBody } from "@/lib/orbit-nav";
import type { Flare } from "@/components/orbit-flare";
import type { SceneHandoff } from "@/components/operating-orbit-3d";

const OperatingOrbit3D = dynamic(
  () => import("./operating-orbit-3d").then((module) => module.OperatingOrbit3D),
  { ssr: false },
);

/** Import/render failures belong to this optional scene, not the page. */
class OrbitSceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type LiveScene = { field: HTMLElement; narrow: boolean; session: number };
type DataConnection = {
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

/** Keep a keyboard visitor on the same destination when the view changes. */
function transferFocus(field: HTMLElement, from: string, to: string) {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !active.matches(from) || !field.contains(active)) return;
  const destination = Array.from(field.querySelectorAll<HTMLAnchorElement>(to))
    .find((link) => link.dataset.body === active.dataset.body);
  destination?.focus({ preventScroll: true });
}

/**
 * Client gate for the WebGL orbit. The scene mounts only when motion is
 * allowed, data saving is off, and WebGL actually exists — otherwise the
 * server-rendered poster and destination list remain. A capable browser
 * keeps that fallback until the scene reports its first usable frame;
 * a failure restores it. Preference changes apply without a reload.
 */
export function OperatingOrbitLive({
  bodies,
  onCapture,
  onPress,
  flare,
  handoff,
  moonEntry,
  onMoonExpand,
}: {
  bodies: OrbitBody[];
  moonEntry?: MoonEntry | null;
  onMoonExpand?: (entry: MoonEntry) => void;
  onCapture?: (id: string) => void;
  onPress?: (id: string) => void;
  /** The core burst, owned by the portal so it outlives this scene. */
  flare?: Flare | null;
  /** The outgoing scene's camera and reveal, for the one replacing it. */
  handoff?: MutableRefObject<SceneHandoff | null>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LiveScene | null>(null);
  const nextSessionRef = useRef(0);
  const failedRef = useRef(false);
  const [live, setLive] = useState<LiveScene | null>(null);

  const showPoster = useCallback((field: HTMLElement) => {
    delete field.dataset.live;
    transferFocus(field, "a.orbit-label", "a.orbit-destination");
  }, []);

  const sceneReady = useCallback((session: number) => {
    const current = sceneRef.current;
    if (!current || current.session !== session) return;
    current.field.dataset.live = "true";
    transferFocus(current.field, "a.orbit-destination", "a.orbit-label");
  }, []);

  const sceneFailed = useCallback((session: number) => {
    const current = sceneRef.current;
    if (!current || current.session !== session) return;
    failedRef.current = true;
    sceneRef.current = null;
    showPoster(current.field);
    setLive(null);
  }, [showPoster]);

  useEffect(() => {
    const field = hostRef.current?.closest<HTMLElement>(".orbit-field");
    if (!field) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const width = window.matchMedia("(max-width: 699px)");
    const connection = (navigator as { connection?: DataConnection }).connection;

    const sync = () => {
      const current = sceneRef.current;
      if (motion.matches || connection?.saveData || failedRef.current) {
        sceneRef.current = null;
        showPoster(field);
        if (current) setLive(null);
        return;
      }
      if (current) {
        if (current.narrow !== width.matches) {
          const resized = { ...current, narrow: width.matches };
          sceneRef.current = resized;
          setLive(resized);
        }
        return;
      }
      try {
        const probe = document.createElement("canvas");
        const webgl =
          probe.getContext("webgl2") ??
          probe.getContext("webgl") ??
          probe.getContext("experimental-webgl");
        if (!webgl) {
          failedRef.current = true;
          return;
        }
        (webgl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        failedRef.current = true;
        return;
      }
      const next = { field, narrow: width.matches, session: ++nextSessionRef.current };
      sceneRef.current = next;
      setLive(next);
    };

    sync();
    motion.addEventListener("change", sync);
    width.addEventListener("change", sync);
    connection?.addEventListener?.("change", sync);
    return () => {
      motion.removeEventListener("change", sync);
      width.removeEventListener("change", sync);
      connection?.removeEventListener?.("change", sync);
      sceneRef.current = null;
      showPoster(field);
    };
  }, [showPoster]);

  const session = live?.session;
  const reportReady = useCallback(() => {
    if (session !== undefined) sceneReady(session);
  }, [session, sceneReady]);
  const reportFailure = useCallback(() => {
    if (session !== undefined) sceneFailed(session);
  }, [session, sceneFailed]);

  return (
    <div ref={hostRef} className="orbit-live" aria-hidden="true">
      {live ? (
        <OrbitSceneBoundary key={live.session} onFailure={reportFailure}>
          <OperatingOrbit3D
            field={live.field}
            narrow={live.narrow}
            bodies={bodies}
            onCapture={onCapture}
            onPress={onPress}
            flare={flare}
            handoff={handoff}
            moonEntry={moonEntry}
            onMoonExpand={onMoonExpand}
            onReady={reportReady}
            onFailure={reportFailure}
          />
        </OrbitSceneBoundary>
      ) : null}
    </div>
  );
}
