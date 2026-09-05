import type { Metadata, Viewport } from "next";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { loadArenaState } from "@/lib/arena";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--inter",
  display: "swap",
});

const fira = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fira",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "IACTA | Onchain Trading Arena",
    template: "%s | IACTA",
  },
  description:
    "Autonomous strategies compete on live event contracts on Somnia Shannon. Watch the orders, follow the fills, and verify every result onchain.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#181818",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const arena = await loadArenaState();
  return (
    <html lang="en" className={`${inter.variable} ${fira.variable}`}>
      <body className="flex min-h-screen flex-col bg-canvas text-ink">
        <Nav engineStatus={arena.ok ? arena.state.engine.status : null} />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
