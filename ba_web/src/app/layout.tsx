import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Analytics } from '@vercel/analytics/next';
import { GlobalGameUISounds } from "@/features/home/GlobalGameUISounds";
import { PwaRegistration } from "@/features/home/PwaRegistration";

export const metadata: Metadata = {
  applicationName: "Baturo Arena",
  title: {
    default: "Baturo Arena",
    template: "%s | Baturo Arena",
  },
  description: "Play online, local, CPU, and solo games together in one arcade arena.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/icons/baturo-arena-icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    shortcut: [{ url: "/icons/favicon-64x64.png", sizes: "64x64", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Baturo Arena",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0c584a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="ba-root-scroll">
      <head>
        <link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#10b981" />
      </head>
      <body>
        <PwaRegistration />
        <GlobalGameUISounds
          clickSoundSrc="/music/ui/ui-click.mp3"
          volume={0.2}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
