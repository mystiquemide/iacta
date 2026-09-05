"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/footer";

const APP_ROUTES = ["/arena", "/standings", "/battles", "/agents", "/docs"];

/**
 * The marketing footer renders on landing and error surfaces only. Dense app
 * routes (arena, standings, battles, agents, docs) keep the console layout.
 */
export function ConditionalFooter() {
  const pathname = usePathname();
  const isAppRoute = APP_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (isAppRoute) return null;
  return <Footer />;
}
