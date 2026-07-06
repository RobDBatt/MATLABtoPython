import type { Metadata } from "next";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { EmailCapture } from "@/components/email-capture";
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
  metadataBase: new URL("https://mtopython.com"),
  title: {
    default: "MATLAB to Python Converter — Deterministic, No AI Guessing",
    template: "%s | MATLABtoPython",
  },
  description:
    "Convert MATLAB to Python instantly with a deterministic, toolbox-aware converter — not generic AI. Same input, same output, with honest flags. Free for 50 lines.",
  keywords: [
    "matlab to python",
    "matlab python converter",
    "matlab to numpy",
    "matlab to scipy",
    "convert matlab code",
    "matlab migration",
    "python migration tool",
  ],
  authors: [{ name: "Rob Batt", url: "https://mtopython.com" }],
  openGraph: {
    type: "website",
    siteName: "MATLABtoPython",
    title: "MATLABtoPython — Deterministic MATLAB to Python Converter",
    description:
      "Paste MATLAB, get Python. Deterministic rule-based engine. No AI. 8 toolboxes auto-converted, 3 migration guides. Honest flags instead of silent wrong answers. Free for 50 lines.",
    url: "https://mtopython.com",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "MATLABtoPython — Deterministic MATLAB to Python Converter",
    description:
      "Paste MATLAB, get Python. Deterministic rule-based engine. No AI. 8 toolboxes auto-converted, 3 migration guides. Honest flags instead of silent wrong answers.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col font-[family-name:var(--font-dm-sans)] bg-[#15171d] text-[#eef0f4]">
        <ClerkProvider>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </ClerkProvider>
        <Analytics />
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-5JFH7H7ZNW" strategy="afterInteractive" />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-5JFH7H7ZNW');
          `}
        </Script>
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-[#2a2e3a] bg-[#1b1e26]">
      <div className="mx-auto max-w-6xl px-6 py-10 grid md:grid-cols-3 gap-8">
        <div>
          <div className="font-[family-name:var(--font-syne)] font-bold text-[#eef0f4] text-lg mb-2">
            MATLAB<span className="text-[#d9662b]">to</span>Python
          </div>
          <p className="text-[#9aa1ac] text-sm">
            Deterministic MATLAB-to-Python conversion. No AI hallucinations. Honest flags.
          </p>
        </div>
        <div className="text-sm">
          <div className="text-[#eef0f4] font-medium mb-3">Product</div>
          <ul className="space-y-1.5 text-[#9aa1ac]">
            <li><a href="/convert" className="hover:text-[#eef0f4] transition-colors">Converter</a></li>
            <li><a href="/pricing" className="hover:text-[#eef0f4] transition-colors">Pricing</a></li>
            <li><a href="/examples" className="hover:text-[#eef0f4] transition-colors">Examples</a></li>
            <li><a href="/toolboxes" className="hover:text-[#eef0f4] transition-colors">Toolbox coverage</a></li>
            <li><a href="/learn" className="hover:text-[#eef0f4] transition-colors">Migration guides</a></li>
            <li><a href="/debug" className="hover:text-[#eef0f4] transition-colors">Debug view</a></li>
            <li>
              <a
                href="https://pypi.org/project/matlabtopython-compat/"
                target="_blank"
                rel="noopener"
                className="hover:text-[#eef0f4] transition-colors"
              >
                matlabtopython-compat (PyPI)
              </a>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-[#eef0f4] font-medium text-sm mb-3">Stay in touch</div>
          <p className="text-[#9aa1ac] text-xs mb-3">
            One email per week. New toolbox mappings and release notes.
          </p>
          <EmailCapture
            source="footer"
            variant="inline"
            cta="Join"
          />
        </div>
      </div>
      <div className="border-t border-[#2a2e3a] text-center text-xs text-[#5a5f6b] py-4">
        © {new Date().getFullYear()} MATLABtoPython.com
      </div>
    </footer>
  )
}

function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[#2a2e3a] bg-[#15171d]/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-14">
        <a
          href="/"
          className="font-[family-name:var(--font-syne)] font-bold text-[#eef0f4] text-lg tracking-tight"
        >
          MATLAB<span className="text-[#d9662b]">to</span>Python
        </a>
        <div className="flex items-center gap-6 text-sm">
          <a href="/convert" className="text-[#9aa1ac] hover:text-[#eef0f4] transition-colors">
            Converter
          </a>
          <a href="/examples" className="text-[#9aa1ac] hover:text-[#eef0f4] transition-colors">
            Examples
          </a>
          <a href="/toolboxes" className="text-[#9aa1ac] hover:text-[#eef0f4] transition-colors">
            Toolboxes
          </a>
          <a href="/learn" className="text-[#9aa1ac] hover:text-[#eef0f4] transition-colors">
            Learn
          </a>
          <a href="/pricing" className="text-[#9aa1ac] hover:text-[#eef0f4] transition-colors">
            Pricing
          </a>
          <Show when="signed-out">
            <SignInButton>
              <button className="text-[#9aa1ac] hover:text-[#eef0f4] transition-colors">
                Sign in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
    </nav>
  );
}
