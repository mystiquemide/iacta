"use client";

import { useEffect, useRef } from "react";

/**
 * Attaches altitude-style scroll reveals: each [data-reveal] child starts
 * hidden and fades/rises into view once, with staggered delay per index.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const el of targets) el.dataset.visible = "true";
      return;
    }

    for (const el of targets) el.classList.add("reveal");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const index = Number(el.dataset.reveal ?? "0");
            el.style.transitionDelay = `${Math.min(index, 6) * 60}ms`;
            el.dataset.visible = "true";
            observer.unobserve(el);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    for (const el of targets) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
