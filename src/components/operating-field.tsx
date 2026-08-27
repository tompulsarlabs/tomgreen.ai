"use client";

import { useRef, type PointerEvent } from "react";

/**
 * The home page's spatial thesis in HTML and CSS. Pointer input tests the
 * depth of the field; it never hides content and requires no animation loop.
 */
export function OperatingField() {
  const fieldRef = useRef<HTMLElement>(null);

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const field = fieldRef.current;
    if (!field || event.pointerType === "touch") return;
    const bounds = field.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    field.style.setProperty("--field-x", `${(x * 8).toFixed(2)}px`);
    field.style.setProperty("--field-y", `${(y * 8).toFixed(2)}px`);
    field.style.setProperty("--field-x-back", `${(x * -4).toFixed(2)}px`);
    field.style.setProperty("--field-y-back", `${(y * -4).toFixed(2)}px`);
    field.style.setProperty("--field-rx", `${(y * -4.8).toFixed(2)}deg`);
    field.style.setProperty("--field-ry", `${(x * 6.4).toFixed(2)}deg`);
  };

  const settle = () => {
    fieldRef.current?.style.setProperty("--field-x", "0px");
    fieldRef.current?.style.setProperty("--field-y", "0px");
    fieldRef.current?.style.setProperty("--field-x-back", "0px");
    fieldRef.current?.style.setProperty("--field-y-back", "0px");
    fieldRef.current?.style.setProperty("--field-rx", "0deg");
    fieldRef.current?.style.setProperty("--field-ry", "0deg");
  };

  return (
    <figure
      ref={fieldRef}
      onPointerMove={onPointerMove}
      onPointerLeave={settle}
      className="operating-field relative isolate min-h-[34rem] overflow-hidden border border-ink bg-ink text-paper md:min-h-[40rem]"
    >
      <div className="absolute inset-x-5 top-5 z-20 flex items-center justify-between font-mono text-[0.62rem] uppercase tracking-[0.16em] text-paper/58">
        <span>Operating field / live model</span>
        <span>00—03</span>
      </div>

      <div className="field-world absolute inset-0">
        <div aria-hidden className="field-plane absolute inset-0">
          <span className="field-haze" />
          <span className="field-floor" />
          <span className="field-rule field-rule-a" />
          <span className="field-rule field-rule-b" />
          <span className="field-orbit field-orbit-a" />
          <span className="field-orbit field-orbit-b" />
          <span className="field-signal" />
        </div>

        <div className="field-core absolute left-1/2 top-1/2 z-10 w-52 text-center">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-paper/68">
            02 / Design
          </p>
          <p className="field-core-title mt-3 font-sans text-[2.65rem] font-semibold leading-[0.82] tracking-[-0.075em]">
            SHAPE<br />THE<br />SYSTEM
          </p>
          <div className="mt-5 flex justify-center gap-2 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-paper/62">
            <span className="border border-paper/20 px-2 py-1">People</span>
            <span className="border border-paper/20 px-2 py-1">Agents</span>
          </div>
        </div>

        <div className="field-output absolute bottom-16 right-5 z-10 max-w-44 border-r border-paper/40 pr-3 text-right">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-paper/54">
            03 / Motion
          </p>
          <p className="mt-2 font-sans text-3xl font-semibold leading-none tracking-[-0.06em]">
            0 → 120
          </p>
          <p className="mt-2 text-xs leading-snug text-paper/62">
            Six months. Four countries.
          </p>
        </div>
      </div>

      <figcaption className="absolute inset-x-5 bottom-5 z-10 border-t border-paper/14 pt-3 text-[0.68rem] leading-relaxed text-paper/62">
        A model of the work: constraint becomes structure; structure creates movement;
        evidence changes the next decision.
      </figcaption>
    </figure>
  );
}
