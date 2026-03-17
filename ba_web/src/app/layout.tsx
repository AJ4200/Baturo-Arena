import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tic-Tac-Two",
  description: "Tic-Tac-Two multiplayer web client",
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
