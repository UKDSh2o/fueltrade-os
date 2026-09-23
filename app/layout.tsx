import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FuelTrade OS",
  description: "Trade intelligence and landed-cost modelling for physical fuel transactions.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
