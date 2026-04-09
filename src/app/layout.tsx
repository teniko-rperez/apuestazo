import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/navbar";
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
  title: "Apuestazo",
  description: "Analisis de apuestas NBA y MLB",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f0f2f8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Navbar />
        {/* Mobile: full width with bottom padding for nav */}
        {/* Desktop: offset left for sidebar, centered content */}
        <main className="flex-1 px-3 pt-3 pb-safe w-full max-w-md mx-auto lg:max-w-5xl lg:ml-64 lg:mr-auto lg:px-8 lg:pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
