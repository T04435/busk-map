"use client";

import { useState, type ReactNode } from "react";

/** A picture clipped to a honeycomb cell. If it fails to load, the cell's own content shows instead. */
export function CellImage({ src, fallback, eager }: { src: string; fallback: ReactNode; /** Load at once (small inline mentions, which a lazy load left as empty hexes). */ eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote pictures (Spotify) in a clipped cell; alt is empty by design (the name is next to it)
    <img
      className="absolute inset-0 size-full object-cover [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]"
      src={src}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
