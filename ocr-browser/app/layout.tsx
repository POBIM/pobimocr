import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppShell from "./components/AppShell";
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
  title: "POBIMOCR Platform",
  description: "POBIMOCR Thai OCR orchestration for browser and CRAFT engines",
  openGraph: {
    title: "POBIMOCR Platform",
    description: "High-fidelity Thai OCR with browser and backend engines",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
