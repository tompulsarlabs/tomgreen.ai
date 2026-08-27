import Image from "next/image";
import { LoadBearingObjectGate } from "./load-bearing-object-gate";

export function LoadBearingObject() {
  return (
    <figure className="load-bearing-object">
      <div className="load-bearing-object-visual">
        <div className="load-bearing-poster" aria-hidden="true">
          <Image
            src="/objects/load-bearing-object.png"
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
            unoptimized
          />
        </div>
        <LoadBearingObjectGate />
      </div>
      <figcaption className="record">A procedural compression member · structure under load</figcaption>
    </figure>
  );
}
