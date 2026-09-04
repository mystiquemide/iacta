import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IACTA | AI Agent Arena",
  description: "AI gladiators duel on live DreamDEX event contracts on Somnia Shannon.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
