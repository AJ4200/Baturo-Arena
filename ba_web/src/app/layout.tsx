import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Baturo Arena",
  description: "Baturo Arena is a multiplayer board-game hub with online and CPU play across multiple games.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
