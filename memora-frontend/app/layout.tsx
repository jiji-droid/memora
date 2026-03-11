import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import NetworkToast from "@/components/NetworkToast";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Memoras — Tes espaces de connaissances",
  description: "Espaces de connaissances alimentés par la voix et l'IA. Capture tes meetings, notes vocales et documents, puis pose des questions à ton agent IA.",
  keywords: ["memora", "espaces", "connaissances", "IA", "transcription", "meetings", "notes vocales"],
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={poppins.variable} suppressHydrationWarning>
      <head>
        {/* Manifest PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#09307e" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Memoras" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

        {/* Script anti-flash pour le dark mode */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var t = localStorage.getItem('memora_theme');
            if (t === 'dark') document.documentElement.classList.add('dark');
          })();
        `}} />
      </head>
      <body className={poppins.className}>
        <ServiceWorkerRegistration />
        <ThemeProvider>
          <NetworkToast />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
