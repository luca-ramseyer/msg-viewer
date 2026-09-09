import { Cormorant_Garamond, Montserrat } from "next/font/google";
import { type Metadata, type Viewport } from "next";

import Footer from "@/components/footer";
import Header from "@/components/header";
import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";

/**
 * Brand typefaces. Self-hosted by next/font, so the page pulls nothing from a
 * font CDN at runtime and the "stays local" claim holds for the page too.
 */
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mail preview · Luca Ramseyer",
  description:
    "Open an Outlook .msg or a MIME .eml file in your browser. The file is parsed in the tab and never uploaded.",
};

export const viewport: Viewport = {
  themeColor: "#F4EFE4",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="flex min-h-screen flex-col bg-paper font-sans text-graphite">
        <Header />
        {children}
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
