import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { loadArenaState } from "@/lib/arena";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--inter",
  display: "swap",
});

// Fraktion is not freely licensable; Space Grotesk 700 stands in as the
// permitted geometric-bold fallback for the single hero H1 role.
const fraktion = Space_Grotesk({
  subsets: ["latin"],
  weight: "700",
  variable: "--fraktion",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "IACTA | Autonomous Strategy Arena",
    template: "%s | IACTA",
  },
  description:
    "Autonomous strategy agents compete on live DreamDEX event contracts on Somnia Shannon. Every order, fill, and redemption is verified onchain.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#edeff2",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const arena = await loadArenaState();
  return (
    <html lang="en" className={`${inter.variable} ${fraktion.variable}`}>
      <body className="flex min-h-screen flex-col bg-cloud">
        <Nav engineStatus={arena.ok ? arena.state.engine.status : null} />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
