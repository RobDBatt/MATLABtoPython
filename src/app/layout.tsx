import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MATLABtoPython — Deterministic MATLAB to Python Converter",
    template: "%s | MATLABtoPython",
  },
  description:
    "Convert MATLAB code to Python with deterministic, rule-based transformation. No AI hallucinations. Toolbox-aware. Same input, same output, every time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col font-[family-name:var(--font-dm-sans)]">
          <Nav />
          <main className="flex-1">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}

function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-navy-800 bg-navy-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-14">
        <a
          href="/"
          className="font-[family-name:var(--font-syne)] font-bold text-white text-lg tracking-tight"
        >
          MATLAB<span className="text-purple-500">to</span>Python
        </a>
        <div className="flex items-center gap-6 text-sm">
          <a href="/convert" className="text-slate-400 hover:text-white transition-colors">
            Converter
          </a>
          <a href="/toolboxes" className="text-slate-400 hover:text-white transition-colors">
            Toolboxes
          </a>
          <a href="/learn" className="text-slate-400 hover:text-white transition-colors">
            Learn
          </a>
          <a href="/pricing" className="text-slate-400 hover:text-white transition-colors">
            Pricing
          </a>
        </div>
      </div>
    </nav>
  );
}
