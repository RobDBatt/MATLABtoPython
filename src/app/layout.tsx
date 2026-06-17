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
    default: "MATLABtoPython — Deterministic MATLAB to Python Converter",
    template: "%s | MATLABtoPython",
  },
  description:
    "Convert MATLAB code to Python with deterministic, rule-based transformation. No AI hallucinations. Toolbox-aware. Same input, same output, every time.",
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
      "Paste MATLAB, get Python. Deterministic rule-based engine. No AI. 10 toolboxes mapped. Honest flags instead of silent wrong answers. Free for 50 lines.",
    url: "https://mtopython.com",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "MATLABtoPython — Deterministic MATLAB to Python Converter",
    description:
      "Paste MATLAB, get Python. Deterministic rule-based engine. No AI. 10 toolboxes mapped. Honest flags instead of silent wrong answers.",
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
      <body className="relative min-h-full flex flex-col font-[family-name:var(--font-dm-sans)] bg-[#07091a] text-[#f0f0f8]">
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
    <footer className="mt-16 border-t border-[#1e2547] bg-[#0e1228]">
      <div className="mx-auto max-w-6xl px-6 py-10 grid md:grid-cols-3 gap-8">
        <div>
          <div className="font-[family-name:var(--font-syne)] font-bold text-[#f0f0f8] text-lg mb-2">
            MATLAB<span className="text-[#7c3aed]">to</span>Python
          </div>
          <p className="text-[#9ba3c4] text-sm">
            Deterministic MATLAB-to-Python conversion. No AI hallucinations. Honest flags.
          </p>
        </div>
        <div className="text-sm">
          <div className="text-[#f0f0f8] font-medium mb-3">Product</div>
          <ul className="space-y-1.5 text-[#9ba3c4]">
            <li><a href="/convert" className="hover:text-[#f0f0f8] transition-colors">Converter</a></li>
            <li><a href="/pricing" className="hover:text-[#f0f0f8] transition-colors">Pricing</a></li>
            <li><a href="/examples" className="hover:text-[#f0f0f8] transition-colors">Examples</a></li>
            <li><a href="/toolboxes" className="hover:text-[#f0f0f8] transition-colors">Toolbox coverage</a></li>
            <li><a href="/learn" className="hover:text-[#f0f0f8] transition-colors">Migration guides</a></li>
            <li><a href="/debug" className="hover:text-[#f0f0f8] transition-colors">Debug view</a></li>
            <li>
              <a
                href="https://pypi.org/project/matlabtopython-compat/"
                target="_blank"
                rel="noopener"
                className="hover:text-[#f0f0f8] transition-colors"
              >
                matlabtopython-compat (PyPI)
              </a>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-[#f0f0f8] font-medium text-sm mb-3">Stay in touch</div>
          <p className="text-[#9ba3c4] text-xs mb-3">
            One email per week. New toolbox mappings and release notes.
          </p>
          <EmailCapture
            source="footer"
            variant="inline"
            cta="Join"
          />
        </div>
      </div>
      <div className="border-t border-[#1e2547] text-center text-xs text-[#4d5580] py-4">
        © {new Date().getFullYear()} MATLABtoPython.com
      </div>
    </footer>
  )
}

function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[#1e2547] bg-[#07091a]/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-14">
        <a
          href="/"
          className="font-[family-name:var(--font-syne)] font-bold text-[#f0f0f8] text-lg tracking-tight"
        >
          MATLAB<span className="text-[#7c3aed]">to</span>Python
        </a>
        <div className="flex items-center gap-6 text-sm">
          <a href="/convert" className="text-[#9ba3c4] hover:text-[#f0f0f8] transition-colors">
            Converter
          </a>
          <a href="/examples" className="text-[#9ba3c4] hover:text-[#f0f0f8] transition-colors">
            Examples
          </a>
          <a href="/toolboxes" className="text-[#9ba3c4] hover:text-[#f0f0f8] transition-colors">
            Toolboxes
          </a>
          <a href="/learn" className="text-[#9ba3c4] hover:text-[#f0f0f8] transition-colors">
            Learn
          </a>
          <a href="/pricing" className="text-[#9ba3c4] hover:text-[#f0f0f8] transition-colors">
            Pricing
          </a>
          <Show when="signed-out">
            <SignInButton>
              <button className="text-[#9ba3c4] hover:text-[#f0f0f8] transition-colors">
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
