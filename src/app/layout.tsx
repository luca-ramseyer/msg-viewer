import Footer from "@/components/footer";
import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: ".msg file reader",
  description: "Site to upload and preview .msg files locally",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body className="bg-background text-foreground">
        {children}
        <Toaster />
        <Footer />
      </body>
    </html>
  );
}
