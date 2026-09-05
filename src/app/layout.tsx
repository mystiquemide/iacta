import type { Metadata, Viewport } from "next";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { ConditionalFooter } from "@/components/conditional-footer";
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

const description =
  "Autonomous strategies compete on live event contracts on Somnia Shannon. Watch the orders, follow the fills, and verify every result onchain.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://easily-synergy-canopener.ngrok-free.dev",
  ),
  title: {
    default: "IACTA | Onchain Trading Arena",
    template: "%s | IACTA",
  },
  description,
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "IACTA | Onchain Trading Arena",
    description,
    url: "/",
    siteName: "IACTA",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "IACTA, onchain trading arena",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "IACTA | Onchain Trading Arena",
    description,
    images: ["/og-image.png"],
  },
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
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xs focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-ink"
        >
          Skip to content
        </a>
        <Nav engineStatus={arena.ok ? arena.state.engine.status : null} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <ConditionalFooter />
      </body>
    </html>
  );
}
