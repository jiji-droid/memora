import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone pour déploiement VPS (PM2 + Nginx)
  // Génère un dossier .next/standalone/ avec tout le nécessaire
  output: 'standalone',

  // Headers pour le Service Worker PWA
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
