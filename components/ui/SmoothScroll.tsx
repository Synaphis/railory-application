"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Using a lightweight lerp (linear interpolation) for a snappy, weightless scroll
    const lenis = new Lenis({
      lerp: 0.1, // Lower is smoother/slower, 0.1 is standard snappy
      wheelMultiplier: 1,
      smoothWheel: true,
      orientation: "vertical",
      gestureOrientation: "vertical",
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
