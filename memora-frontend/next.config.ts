import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone pour déploiement VPS (PM2 + Nginx)
  // Génère un dossier .next/standalone/ avec tout le nécessaire
  output: 'standalone',
};

export default nextConfig;
