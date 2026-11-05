import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import { FluidRoot } from "@/components/fluid-root";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], axes: ["opsz"], variable: "--font-sans" });

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Ontime",
  description: "Employee attendance with photo proof",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${geistMono.variable} antialiased`}>
        <FluidRoot>{children}</FluidRoot>
      </body>
    </html>
  );
}
