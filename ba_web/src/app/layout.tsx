import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from '@vercel/analytics/next';
import { GlobalGameUISounds } from "@/features/home/GlobalGameUISounds";

export const metadata: Metadata = {
  title: "Baturo Arena",
  description: "Baturo Arena is a multiplayer hub with online,local and CPU play across multiple games.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="ba-root-scroll">
      <body>
        <GlobalGameUISounds
          clickSoundSrc="/music/ui/ui-click.mp3"
          volume={0.3}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
