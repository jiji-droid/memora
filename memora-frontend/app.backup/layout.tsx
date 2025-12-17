import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Memora - Vos réunions résumées par l'IA",
  description: "Transcription et résumé automatique de vos réunions Zoom, Teams et Meet grâce à l'intelligence artificielle.",
  keywords: ["transcription", "réunion", "IA", "résumé", "Zoom", "Teams", "Meet"],
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
    <html lang="fr" className={poppins.variable}>
      <body className={poppins.className}>{children}</body>
    </html>
  );
}
