import type { Metadata } from "next";
import { Poppins } from "next/font/google";
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
    <html lang="fr" className={poppins.variable} style={{ backgroundColor: '#f0f2f8' }}>
      <body className={poppins.className} style={{ backgroundColor: '#f0f2f8' }}>{children}</body>
    </html>
  );
}
