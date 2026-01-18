import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Joshi Safa House",
  description: "POS & Inventory Management",
};

import { LanguageProvider } from "@/lib/LanguageContext";
import ExpirationDisplay from "@/components/ExpirationDisplay";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Hardcoded expiration date: January 20, 2026
  const EXPIRATION_DATE = new Date("2026-01-20T00:00:00");
  const isExpired = new Date() > EXPIRATION_DATE;

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageProvider>
          {isExpired ? <ExpirationDisplay /> : children}
        </LanguageProvider>
      </body>
    </html>
  );
}
