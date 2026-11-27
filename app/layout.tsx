import type { Metadata, Viewport } from "next";
import { Inter, Lora } from "next/font/google";

import { FirebaseAnalytics } from "@/components/firebase-analytics";

import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PIG e-ADMIN 1.0 — ПИГ „Св. Климент Охридски“",
    template: "%s · PIG e-ADMIN",
  },
  description:
    "Електронна административна система на ПИГ „Св. Климент Охридски“ — кандидатстване, подбор, акредитация, документооборот и институционален контрол.",
  applicationName: "PIG e-ADMIN",
  authors: [{ name: "ПИГ „Св. Климент Охридски“" }],
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#17365D" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1524" },
  ],
  width: "device-width",
  initialScale: 1,
};

const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('pig-theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg" suppressHydrationWarning className={`${inter.variable} ${lora.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-content antialiased">
        <FirebaseAnalytics />
        {children}
      </body>
    </html>
  );
}
