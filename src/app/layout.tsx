import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { BottomNav } from "@/components/bottom-nav";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

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
  themeColor: "#f5f0e8",
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
        <link rel="apple-touch-icon" href="/icon-192.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Plantcaer" />
      </head>
      <body
        className="min-h-full antialiased"
        style={{
          backgroundColor: '#f5f0e8',
          backgroundImage: [
            'linear-gradient(135deg, #f5f0e8 0%, #f0ebe0 25%, #ede6dc 50%, #f0ebe0 75%, #f5f0e8 100%)',
            'radial-gradient(circle at 20% 50%, rgba(180,160,130,0.04) 0%, transparent 50%)',
            'radial-gradient(circle at 80% 20%, rgba(16,185,129,0.03) 0%, transparent 50%)',
            'radial-gradient(circle at 50% 80%, rgba(215,140,60,0.03) 0%, transparent 50%)',
          ].join(', '),
          backgroundSize: '400% 400%, auto, auto, auto',
          color: '#1c1917',
        }}>
        <Navbar />
        <BottomNav />
        <ServiceWorkerRegistration />
        <main className="mx-auto max-w-6xl px-4 pb-20 sm:pb-12 pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
