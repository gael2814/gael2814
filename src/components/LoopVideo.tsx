"use client";
import { useEffect, useRef } from "react";

/** Short silent looping clip. Respects "reduce motion": shows the still poster with controls instead. */
export function LoopVideo({ src, poster, label, className = "" }: { src: string; poster: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      v.pause();
      v.controls = true;
    } else v.play().catch(() => {});
  }, []);
  return (
    <video ref={ref} className={className} src={src} poster={poster} muted loop playsInline preload="metadata" aria-label={label} />
  );
}
