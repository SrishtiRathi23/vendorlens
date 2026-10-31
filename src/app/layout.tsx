import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Space_Grotesk } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VendorLens — know what you're paying for",
  description:
    "Plan a wedding, birthday or community event and compare vendor quotes honestly: AI reads the fine print, you confirm it, and the maths is done by tested code.",
};

export const viewport: Viewport = { themeColor: "#faf7ec" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${grotesk.variable} ${cormorant.variable}`}>
      <body className="min-h-dvh bg-ivory text-charcoal">
        <a
          className="sr-only rounded bg-forest px-4 py-2 text-ivory focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
          href="#content"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
