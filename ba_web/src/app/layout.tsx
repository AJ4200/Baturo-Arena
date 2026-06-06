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
      { url: "/icons/baturo-arena-icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/api/app-icon?size=32", sizes: "32x32", type: "image/png" },
      { url: "/api/app-icon?size=16", sizes: "16x16", type: "image/png" },
    ],
    shortcut: [{ url: "/api/app-icon?size=64", sizes: "64x64", type: "image/png" }],
    apple: [{ url: "/api/app-icon?size=180", sizes: "180x180", type: "image/png" }],
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
