import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quantica Digital — Learning Platform",
  description:
    "Quantica Digital brings courses, lectures, notes, and learning resources together in one focused digital learning platform.",
  keywords: [
    "Quantica Digital",
    "study platform",
    "lectures",
    "notes",
    "JEE",
    "NEET",
    "batches",
    "video player",
  ],
  authors: [{ name: "Quantica Digital" }],
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Quantica Digital — Learning Platform",
    description: "Premium batches, lectures and notes in one liquid-glass experience.",
    siteName: "Quantica Digital",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quantica Digital",
    description: "Premium batches, lectures and notes in one liquid-glass experience.",
  },
};

export const viewport: Viewport = {
  themeColor: "#060a14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${jakarta.variable} ${inter.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <div className="sb-aurora" aria-hidden="true" />
        <div className="sb-grain" aria-hidden="true" />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
