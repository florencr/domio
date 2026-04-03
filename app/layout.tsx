import type { Metadata } from "next";
import { Geist, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LocaleProvider } from "@/lib/locale-context";
import { DevTextSelectToggle } from "@/components/DevTextSelectToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["700"],
});

/** WhatsApp / Facebook need absolute URLs for previews. Set in prod: NEXT_PUBLIC_SITE_URL=https://your-domain.com */
const metadataBaseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001");

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: { default: "Domio", template: "%s | Domio" },
  description: "Condo Management (HOA)",
  applicationName: "Domio",
  appleWebApp: { capable: true, title: "Domio" },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    siteName: "Domio",
    title: "Domio",
    description: "Condo Management (HOA)",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Domio",
    description: "Condo Management (HOA)",
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
      suppressHydrationWarning
      className={process.env.NODE_ENV !== "development" ? "domio-select-restricted" : undefined}
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${nunito.variable} antialiased`}
      >
        <ThemeProvider>
          <LocaleProvider>
            {children}
          </LocaleProvider>
        </ThemeProvider>
        <DevTextSelectToggle />
      </body>
    </html>
  );
}
