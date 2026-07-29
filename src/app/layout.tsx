import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Joshi Safa House | Manyavar Safa Store",
  description: "POS & Inventory Management & Safa Store",
};

import { LanguageProvider } from "@/lib/LanguageContext";
import { AuthProvider } from "@/lib/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import ExpirationDisplay from "@/components/ExpirationDisplay";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Hardcoded expiration date: January 20, 2026
  const EXPIRATION_DATE = new Date("2026-01-20T00:00:00");
  const isExpired = false;

  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        <AuthProvider>
          <AuthGuard>
            <LanguageProvider>
              {isExpired ? children : children}
            </LanguageProvider>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
