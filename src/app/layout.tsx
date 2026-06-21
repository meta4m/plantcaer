import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plantcaer — Your Plant Care Tracker",
  description:
    "Track watering, fertilizing, repotting, and more for all your house plants.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a1f1a",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className="min-h-full antialiased"
        style={{
          backgroundColor: '#0a1f1a',
          backgroundImage: [
            'linear-gradient(135deg, #0a1f1a 0%, #0d281f 25%, #0f2d23 50%, #0d281f 75%, #0a1f1a 100%)',
            'radial-gradient(circle at 20% 50%, rgba(45,138,78,0.05) 0%, transparent 50%)',
            'radial-gradient(circle at 80% 20%, rgba(212,163,115,0.04) 0%, transparent 50%)',
            'radial-gradient(circle at 50% 80%, rgba(74,222,128,0.03) 0%, transparent 50%)',
          ].join(', '),
          backgroundSize: '400% 400%, auto, auto, auto',
          color: '#e2e8f0',
        }}>
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 pb-12 pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
